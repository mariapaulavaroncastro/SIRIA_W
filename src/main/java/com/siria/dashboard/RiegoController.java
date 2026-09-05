package com.siria.dashboard;

import com.siria.dashboard.model.LecturaSensor;
import com.siria.dashboard.repository.LecturaSensorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/riego")
public class RiegoController {

    @Autowired
    private LecturaSensorRepository repository;

    private String modoOperacion = "AUTOMATICO"; // "AUTOMATICO" o "MANUAL"
    private boolean bombaEncendida = false;
    private double umbralHumedadMinima = 40.0; // Umbral automatico (< 40% enciende)

    @GetMapping("/ping")
    public String ping() {
        return "Servidor SIRIA-W en linea";
    }

    // Endpoint donde el ESP32 envia datos y recibe ordenes
    @PostMapping("/telemetria")
    public Map<String, Object> recibirTelemetria(@RequestBody Map<String, Double> datos) {
        Double hSuelo = datos.getOrDefault("humedadSuelo", 0.0);
        Double temp = datos.getOrDefault("temperatura", 0.0);
        Double hAmb = datos.getOrDefault("humedadAmbiente", 0.0);
        Double nTanque = datos.getOrDefault("nivelTanque", 0.0);

        // Guardar lectura en BD
        LecturaSensor lectura = new LecturaSensor(hSuelo, temp, hAmb, nTanque);
        repository.save(lectura);

        // LÓGICA AUTOMÁTICA
        if ("AUTOMATICO".equalsIgnoreCase(modoOperacion)) {
            if (hSuelo > 0 && hSuelo < umbralHumedadMinima) {
                bombaEncendida = true; // Enciende si la tierra esta seca
            } else if (hSuelo >= 65.0) {
                bombaEncendida = false; // Apaga si ya recupero humedad suficiente
            }
        }

        Map<String, Object> respuesta = new HashMap<>();
        respuesta.put("status", "OK");
        respuesta.put("modo", modoOperacion);
        respuesta.put("bombaEncendida", bombaEncendida);
        return respuesta;
    }

    @GetMapping("/historico")
    public List<LecturaSensor> obtenerHistorico() {
        return repository.findTop20ByOrderByIdDesc();
    }

    // Obtener estado actual de los controles
    @GetMapping("/estado")
    public Map<String, Object> obtenerEstado() {
        Map<String, Object> estado = new HashMap<>();
        estado.put("modo", modoOperacion);
        estado.put("bombaEncendida", bombaEncendida);
        return estado;
    }

    // Cambiar entre AUTOMATICO y MANUAL
    @PostMapping("/modo")
    public Map<String, Object> cambiarModo(@RequestBody Map<String, String> payload) {
        String nuevoModo = payload.get("modo");
        if ("AUTOMATICO".equalsIgnoreCase(nuevoModo) || "MANUAL".equalsIgnoreCase(nuevoModo)) {
            this.modoOperacion = nuevoModo.toUpperCase();
        }
        return obtenerEstado();
    }

    // Encender/Apagar Bomba manualmente
    @PostMapping("/bomba")
    public Map<String, Object> cambiarBomba(@RequestBody Map<String, Boolean> payload) {
        if ("MANUAL".equalsIgnoreCase(modoOperacion)) {
            Boolean encender = payload.get("encender");
            if (encender != null) {
                this.bombaEncendida = encender;
            }
        }
        return obtenerEstado();
    }
}