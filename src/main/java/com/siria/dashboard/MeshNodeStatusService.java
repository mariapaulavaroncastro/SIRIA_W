package com.siria.dashboard;

import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class MeshNodeStatusService {

    private final ObjectMapper objectMapper;
    private final ConcurrentMap<String, Map<String, Object>> nodeStatuses = new ConcurrentHashMap<>();

    public MeshNodeStatusService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void accept(String payload) throws JacksonException {
        JsonNode message = objectMapper.readTree(payload);
        String nodeId = message.path("nodoId").asText("");
        if (nodeId.isBlank()) {
            throw new IllegalArgumentException("El estado mesh no contiene nodoId");
        }

        Map<String, Object> status = new HashMap<>();
        status.put("nodoId", nodeId);
        status.put("rolNodo", message.path("rolNodo").asText("DESCONOCIDO"));
        status.put("estado", message.path("estado").asText("desconocido"));
        status.put("secuencia", nullableLong(message, "secuencia"));
        status.put("perdidos", nullableLong(message, "perdidos"));
        status.put("pdrPct", nullableDouble(message, "pdrPct"));
        status.put("etxApp", nullableDouble(message, "etxApp"));
        status.put("rttMs", nullableDouble(message, "rttMs"));
        status.put("reconexiones", nullableLong(message, "reconexiones"));
        status.put("ultimaVez", Instant.now().toString());
        nodeStatuses.put(nodeId, status);
    }

    public List<Map<String, Object>> getStatuses() {
        Instant now = Instant.now();
        List<Map<String, Object>> statuses = new ArrayList<>();
        for (Map<String, Object> current : nodeStatuses.values()) {
            Map<String, Object> status = new HashMap<>(current);
            Instant lastSeen = Instant.parse(status.get("ultimaVez").toString());
            long ageSeconds = Duration.between(lastSeen, now).getSeconds();
            status.put("haceSegundos", ageSeconds);
            if (ageSeconds > 15) {
                status.put("estado", "sin_señal");
            }
            statuses.add(status);
        }
        statuses.sort(Comparator.comparing(status -> status.get("nodoId").toString()));
        return statuses;
    }

    private Long nullableLong(JsonNode message, String field) {
        JsonNode value = message.get(field);
        return value != null && value.isNumber() ? value.longValue() : null;
    }

    private Double nullableDouble(JsonNode message, String field) {
        JsonNode value = message.get(field);
        return value != null && value.isNumber() ? value.doubleValue() : null;
    }
}
