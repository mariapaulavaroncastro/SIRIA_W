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
@CrossOrigin(origins = "*")
public class RiegoController {

    @Autowired
    private LecturaSensorRepository repository;

    private String modoOperacion = "AUTOMATICO";
    private boolean bombaEncendida = false;
    private final double umbralHumedadMinima = 40.0;
    private final double umbralHumedadOptima = 65.0;

    @GetMapping("/ping")
    public String ping() {
        return "Servidor SIRIA-W en linea";
    }

    @PostMapping("/telemetria")
    public Map<String, Object> recibirTelemetria(@RequestBody LecturaSensor lectura) {
        repository.save(lectura);
        if ("AUTOMATICO".equalsIgnoreCase(modoOperacion)) {
            Double hSuelo = lectura.getHumedadSuelo();
            if (hSuelo != null && hSuelo > 0) {
                if (hSuelo < umbralHumedadMinima) {
                    bombaEncendida = true;
                } else if (hSuelo >= umbralHumedadOptima) {
                    bombaEncendida = false;
                }
            }
        }
        Map<String, Object> respuesta = new HashMap<>();
        respuesta.put("status", "OK");
        respuesta.put("modo", modoOperacion);
        respuesta.put("bombaEncendida", bombaEncendida);
        return respuesta;
    }

    @GetMapping("/telemetria/ultima")
    public LecturaSensor obtenerUltimaLectura() {
        return repository.findFirstByOrderByIdDesc()
                .orElse(new LecturaSensor(0.0, 0.0, 0.0, 0.0, 0.0));
    }

    @GetMapping("/historico")
    public List<LecturaSensor> obtenerHistorico() {
        return repository.findTop30ByOrderByIdDesc();
    }

    @GetMapping("/estado")
    public Map<String, Object> obtenerEstado() {
        Map<String, Object> estado = new HashMap<>();
        estado.put("modo", modoOperacion);
        estado.put("bombaEncendida", bombaEncendida);
        return estado;
    }

    @PostMapping("/modo")
    public Map<String, Object> cambiarModo(@RequestBody Map<String, Object> payload) {
        if (payload != null && payload.get("modo") != null) {
            String nuevoModo = String.valueOf(payload.get("modo"));
            if ("AUTOMATICO".equalsIgnoreCase(nuevoModo) || "MANUAL".equalsIgnoreCase(nuevoModo)) {
                this.modoOperacion = nuevoModo.toUpperCase();
            }
        }
        return obtenerEstado();
    }

    @PostMapping("/bomba")
    public Map<String, Object> cambiarBomba(@RequestBody Map<String, Object> payload) {
        if ("MANUAL".equalsIgnoreCase(modoOperacion) && payload != null && payload.get("encender") != null) {
            Object valorEncender = payload.get("encender");
            if (valorEncender instanceof Boolean) {
                this.bombaEncendida = (Boolean) valorEncender;
            } else {
                this.bombaEncendida = Boolean.parseBoolean(String.valueOf(valorEncender));
            }
        }
        return obtenerEstado();
    }
}