package com.siria.dashboard;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/riego/ns3")
public class NS3MetricsController {

    private static final TypeReference<Map<String, Object>> METRICS_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;
    private final Path metricsFile;

    public NS3MetricsController(
            ObjectMapper objectMapper,
            @Value("${siriaw.ns3.metrics-file:src/main/resources/static/ns3-metrics.json}") String metricsFile) {
        this.objectMapper = objectMapper;
        this.metricsFile = Path.of(metricsFile);
    }

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() throws IOException {
        if (!Files.isRegularFile(metricsFile)) {
            return ResponseEntity.notFound().build();
        }
        try (var input = Files.newInputStream(metricsFile)) {
            Map<String, Object> metrics = objectMapper.readValue(input, METRICS_TYPE);
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.noStore())
                    .body(metrics);
        }
    }
}
