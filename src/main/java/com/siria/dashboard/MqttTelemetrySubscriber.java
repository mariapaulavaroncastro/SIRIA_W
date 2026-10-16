package com.siria.dashboard;

import com.siria.dashboard.model.LecturaSensor;
import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;

@Component
@ConditionalOnProperty(prefix = "siria.mqtt", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MqttTelemetrySubscriber {

    private static final Logger log = LoggerFactory.getLogger(MqttTelemetrySubscriber.class);

    private final RiegoService riegoService;
    private final ObjectMapper objectMapper;

    @Value("${siria.mqtt.broker-url:tcp://localhost:1883}")
    private String brokerUrl;

    @Value("${siria.mqtt.client-id:siria-dashboard}")
    private String clientId;

    @Value("${siria.mqtt.topic:siria/telemetria/#}")
    private String topic;

    @Value("${siria.mqtt.username:}")
    private String username;

    @Value("${siria.mqtt.password:}")
    private String password;

    @Value("${siria.mqtt.qos:1}")
    private int qos;

    private MqttClient client;

    public MqttTelemetrySubscriber(RiegoService riegoService, ObjectMapper objectMapper) {
        this.riegoService = riegoService;
        this.objectMapper = objectMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void conectarAlIniciar() {
        conectarSiHaceFalta();
    }

    @Scheduled(fixedDelayString = "${siria.mqtt.reconnect-delay-ms:5000}")
    public synchronized void conectarSiHaceFalta() {
        try {
            if (client == null) {
                client = new MqttClient(brokerUrl, clientId, new MemoryPersistence());
                client.setCallback(new MqttCallback() {
                    @Override
                    public void connectionLost(Throwable cause) {
                        log.warn("Conexion MQTT perdida: {}", cause == null ? "sin detalle" : cause.getMessage());
                    }

                    @Override
                    public void messageArrived(String receivedTopic, MqttMessage message) {
                        procesarMensaje(receivedTopic, message);
                    }

                    @Override
                    public void deliveryComplete(IMqttDeliveryToken token) {
                    }
                });
            }

            if (!client.isConnected()) {
                MqttConnectOptions options = new MqttConnectOptions();
                options.setCleanSession(true);
                options.setConnectionTimeout(5);
                options.setKeepAliveInterval(30);
                if (!username.isBlank()) {
                    options.setUserName(username);
                    options.setPassword(password.toCharArray());
                }
                client.connect(options);
                client.subscribe(topic, qos);
                log.info("Suscrito a MQTT: broker={}, topic={}, qos={}", brokerUrl, topic, qos);
            }
        } catch (MqttException exception) {
            log.warn("No se pudo conectar a MQTT en {}: {}. Se reintentara.",
                    brokerUrl, exception.getMessage());
        }
    }

    private void procesarMensaje(String receivedTopic, MqttMessage message) {
        try {
            String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
            LecturaSensor lectura = objectMapper.readValue(payload, LecturaSensor.class);
            riegoService.procesarTelemetria(lectura);
            log.debug("Telemetria MQTT guardada desde {}", receivedTopic);
        } catch (Exception exception) {
            log.error("No se pudo procesar telemetria MQTT de {}: {}",
                    receivedTopic, exception.getMessage());
        }
    }

    @PreDestroy
    public synchronized void cerrar() {
        if (client != null && client.isConnected()) {
            try {
                client.disconnect();
                client.close();
            } catch (MqttException exception) {
                log.warn("Error cerrando la conexion MQTT: {}", exception.getMessage());
            }
        }
    }
}