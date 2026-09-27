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

    private volatile String modoOperacion = "AUTOMATICO";
    private volatile boolean bombaEncendida = false;
    private volatile Boolean releEncendido;
    private final double umbralHumedadMinima = 40.0;
    private final double umbralHumedadOptima = 65.0;

    @GetMapping("/ping")
    public String ping() {
        return "Servidor SIRIA-W en linea";
    }

    @PostMapping("/telemetria")
    public Map<String, Object> recibirTelemetria(@RequestBody LecturaSensor lectura) {
        repository.save(lectura);
        if (lectura.getReleEncendido() != null) {
            releEncendido = lectura.getReleEncendido();
        }

        if ("AUTOMATICO".equalsIgnoreCase(modoOperacion)) {
            Double humedadSuelo = lectura.getHumedadSuelo();
            if (humedadSuelo != null) {
                if (humedadSuelo < umbralHumedadMinima) {
                    bombaEncendida = true;
                } else if (humedadSuelo >= umbralHumedadOptima) {
                    bombaEncendida = false;
                }
            }
        }

        Map<String, Object> respuesta = new HashMap<>();
        respuesta.put("status", "OK");
        respuesta.put("modo", modoOperacion);
        respuesta.put("bombaEncendida", bombaEncendida);
        respuesta.put("releEncendido", releEncendido);
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
        estado.put("releEncendido", releEncendido);
        return estado;
    }

    @PostMapping("/modo")
    public Map<String, Object> cambiarModo(@RequestBody Map<String, Object> payload) {
        Object valorModo = payload.get("modo");
        String nuevoModo = valorModo instanceof String ? (String) valorModo : "";
        if ("AUTOMATICO".equalsIgnoreCase(nuevoModo) || "MANUAL".equalsIgnoreCase(nuevoModo)) {
            this.modoOperacion = nuevoModo.toUpperCase();
        }
        return obtenerEstado();
    }

    @PostMapping("/bomba")
    public Map<String, Object> cambiarBomba(@RequestBody Map<String, Object> payload) {
        if ("MANUAL".equalsIgnoreCase(modoOperacion)) {
            Object valorEncender = payload.get("encender");
            Boolean encender = valorEncender instanceof Boolean ? (Boolean) valorEncender : null;
            if (encender != null) {
                this.bombaEncendida = encender;
            }
        }
        return obtenerEstado();
    }
}