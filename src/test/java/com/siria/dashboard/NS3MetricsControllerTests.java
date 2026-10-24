package com.siria.dashboard;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NS3MetricsControllerTests {

    @TempDir
    Path tempDir;

    @Test
    void returnsNotFoundUntilTheSimulatorPublishesMetrics() throws Exception {
        NS3MetricsController controller = new NS3MetricsController(
                new ObjectMapper(),
                tempDir.resolve("ns3-metrics.json").toString());

        assertEquals(HttpStatus.NOT_FOUND, controller.getMetrics().getStatusCode());
    }

    @Test
    void servesTheLatestMetricsWithoutCaching() throws Exception {
        Path metricsFile = tempDir.resolve("ns3-metrics.json");
        Files.writeString(metricsFile,
                "{\"version\":1,\"runId\":\"test-run\",\"sequence\":4,\"simulationStatus\":\"activa\","
                        + "\"rttMs\":12.4,\"jitterMs\":1.2,\"packetLossPercent\":0,"
                        + "\"packetEvents\":[]}");
        NS3MetricsController controller = new NS3MetricsController(
                new ObjectMapper(),
                metricsFile.toString());

        var response = controller.getMetrics();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("test-run", response.getBody().get("runId"));
        assertEquals(12.4, response.getBody().get("rttMs"));
        assertEquals("no-store", response.getHeaders().getCacheControl());
    }
}
