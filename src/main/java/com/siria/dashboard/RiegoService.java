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
    private boolean valvulaAbierta;
    private Boolean valvulaReportada;
    private boolean tanqueDisponible;
    private String errorControl;

    public RiegoService(LecturaSensorRepository repository) {
        this.repository = repository;
    }

    public synchronized Map<String, Object> procesarTelemetria(LecturaSensor lectura) {
        repository.save(lectura);

        if (lectura.getReleEncendido() != null) {
            releEncendido = lectura.getReleEncendido();
        }
        if (lectura.getValvulaAbierta() != null) {
            valvulaReportada = lectura.getValvulaAbierta();
        }
        if (lectura.getNivelTanque() != null) {
            tanqueDisponible = lectura.getNivelTanque() > 0.0;
        }

        if (!tanqueDisponible) {
            bombaEncendida = false;
            valvulaAbierta = false;
        } else if ("AUTOMATICO".equals(modoOperacion)) {
            if (lectura.getHumedadSuelo() != null) {
                double humedad = lectura.getHumedadSuelo();
                if (humedad < HUMEDAD_ENCENDER) {
                    bombaEncendida = true;
                } else if (humedad >= HUMEDAD_APAGAR) {
                    bombaEncendida = false;
                }
            }
            valvulaAbierta = bombaEncendida;
        }

        errorControl = null;
        Map<String, Object> respuesta = obtenerEstado();
        respuesta.put("status", "OK");
        return respuesta;
    }

    public synchronized Map<String, Object> obtenerEstado() {
        Map<String, Object> estado = new HashMap<>();
        estado.put("modo", modoOperacion);
        estado.put("bombaEncendida", bombaEncendida);
        estado.put("releEncendido", releEncendido);
        estado.put("valvulaAbierta", valvulaAbierta);
        estado.put("valvulaReportada", valvulaReportada);
        estado.put("tanqueDisponible", tanqueDisponible);
        if (errorControl != null) {
            estado.put("errorControl", errorControl);
        }
        return estado;
    }

    public synchronized Map<String, Object> cambiarModo(Map<String, Object> payload) {
        Object valorModo = payload == null ? null : payload.get("modo");
        if (valorModo != null) {
            String nuevoModo = String.valueOf(valorModo);
            if ("AUTOMATICO".equalsIgnoreCase(nuevoModo) || "MANUAL".equalsIgnoreCase(nuevoModo)) {
                modoOperacion = nuevoModo.toUpperCase();
                errorControl = null;
                bombaEncendida = false;
                valvulaAbierta = false;
            }
        }
        return obtenerEstado();
    }

    public synchronized Map<String, Object> cambiarBomba(Map<String, Object> payload) {
        if ("MANUAL".equals(modoOperacion) && payload != null) {
            Object valorEncender = payload.get("encender");
            boolean encender = false;
            if (valorEncender instanceof Boolean) {
                encender = (Boolean) valorEncender;
            } else if (valorEncender != null) {
                encender = Boolean.parseBoolean(String.valueOf(valorEncender));
            }
            if (encender && (!tanqueDisponible || !valvulaAbierta)) {
                bombaEncendida = false;
                errorControl = !tanqueDisponible
                        ? "Bomba bloqueada: tanque vacío o sin lectura."
                        : "Bomba bloqueada: abre primero la electroválvula.";
            } else {
                bombaEncendida = encender;
                errorControl = null;
            }
        }
        return obtenerEstado();
    }

    public synchronized Map<String, Object> cambiarValvula(Map<String, Object> payload) {
        if ("MANUAL".equals(modoOperacion) && payload != null) {
            Object valorAbrir = payload.get("abrir");
            boolean abrir = valorAbrir instanceof Boolean
                    ? (Boolean) valorAbrir
                    : valorAbrir != null && Boolean.parseBoolean(String.valueOf(valorAbrir));

            if (abrir && !tanqueDisponible) {
                bombaEncendida = false;
                valvulaAbierta = false;
                errorControl = "Electroválvula bloqueada: tanque vacío o sin lectura.";
            } else {
                valvulaAbierta = abrir;
                if (!abrir) {
                    bombaEncendida = false;
                }
                errorControl = null;
            }
        }
        return obtenerEstado();
    }
}