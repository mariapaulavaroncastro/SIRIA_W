package com.siria.dashboard;

import com.siria.dashboard.model.LecturaSensor;
import com.siria.dashboard.repository.LecturaSensorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/riego")
@CrossOrigin(origins = "*")
public class RiegoController {

    @Autowired
    private LecturaSensorRepository repository;

    @Autowired
    private RiegoService riegoService;

    @GetMapping("/ping")
    public String ping() {
        return "Servidor SIRIA-W en linea";
    }

    @PostMapping("/telemetria")
    public Map<String, Object> recibirTelemetria(@RequestBody LecturaSensor lectura) {
        return riegoService.procesarTelemetria(lectura);
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
        return riegoService.obtenerEstado();
    }

    @PostMapping("/modo")
    public Map<String, Object> cambiarModo(@RequestBody Map<String, Object> payload) {
        return riegoService.cambiarModo(payload);
    }

    @PostMapping("/bomba")
    public Map<String, Object> cambiarBomba(@RequestBody Map<String, Object> payload) {
        return riegoService.cambiarBomba(payload);
    }
}