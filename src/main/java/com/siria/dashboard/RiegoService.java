package com.siria.dashboard;

import com.siria.dashboard.model.LecturaSensor;
import com.siria.dashboard.repository.LecturaSensorRepository;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class RiegoService {

    private static final double HUMEDAD_ENCENDER = 40.0;
    private static final double HUMEDAD_APAGAR = 65.0;

    private final LecturaSensorRepository repository;
    private String modoOperacion = "AUTOMATICO";
    private boolean bombaEncendida;
    private Boolean releEncendido;

    public RiegoService(LecturaSensorRepository repository) {
        this.repository = repository;
    }

    public synchronized Map<String, Object> procesarTelemetria(LecturaSensor lectura) {
        repository.save(lectura);

        if (lectura.getReleEncendido() != null) {
            releEncendido = lectura.getReleEncendido();
        }

        if ("AUTOMATICO".equals(modoOperacion) && lectura.getHumedadSuelo() != null) {
            double humedad = lectura.getHumedadSuelo();
            if (humedad < HUMEDAD_ENCENDER) {
                bombaEncendida = true;
            } else if (humedad >= HUMEDAD_APAGAR) {
                bombaEncendida = false;
            }
        }

        Map<String, Object> respuesta = obtenerEstado();
        respuesta.put("status", "OK");
        return respuesta;
    }

    public synchronized Map<String, Object> obtenerEstado() {
        Map<String, Object> estado = new HashMap<>();
        estado.put("modo", modoOperacion);
        estado.put("bombaEncendida", bombaEncendida);
        estado.put("releEncendido", releEncendido);
        return estado;
    }

    public synchronized Map<String, Object> cambiarModo(Map<String, Object> payload) {
        Object valorModo = payload == null ? null : payload.get("modo");
        if (valorModo != null) {
            String nuevoModo = String.valueOf(valorModo);
            if ("AUTOMATICO".equalsIgnoreCase(nuevoModo) || "MANUAL".equalsIgnoreCase(nuevoModo)) {
                modoOperacion = nuevoModo.toUpperCase();
            }
        }
        return obtenerEstado();
    }

    public synchronized Map<String, Object> cambiarBomba(Map<String, Object> payload) {
        if ("MANUAL".equals(modoOperacion) && payload != null) {
            Object valorEncender = payload.get("encender");
            if (valorEncender instanceof Boolean) {
                bombaEncendida = (Boolean) valorEncender;
            } else if (valorEncender != null) {
                bombaEncendida = Boolean.parseBoolean(String.valueOf(valorEncender));
            }
        }
        return obtenerEstado();
    }
}