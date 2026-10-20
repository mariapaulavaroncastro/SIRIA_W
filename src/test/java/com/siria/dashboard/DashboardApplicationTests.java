package com.siria.dashboard;

import com.siria.dashboard.model.LecturaSensor;
import com.siria.dashboard.repository.LecturaSensorRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.test.context.SpringBootTest;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "siria.mqtt.enabled=false")
class DashboardApplicationTests {

	@LocalServerPort
	private int port;

	@Autowired
	private RiegoService riegoService;

	@Autowired
	private LecturaSensorRepository repository;

	@Test
	void contextLoads() {
	}

	@Test
	void recibeTelemetriaHttpCompatibleConPayloadDelEsp32() throws Exception {
		riegoService.cambiarModo(java.util.Map.of("modo", "AUTOMATICO"));
		repository.deleteAll();

		HttpRequest request = HttpRequest.newBuilder()
				.uri(URI.create("http://localhost:" + port + "/api/riego/telemetria"))
				.header("Content-Type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString("""
						{
						  "nodoId": "nodo-02",
						  "rolNodo": "SENSOR",
						  "temperatura": 22.5,
						  "humedadAmbiente": 54.0,
						  "humedadSuelo": 20,
						  "lecturaSueloRaw": 2800,
						  "nivelTanque": 100.0,
						  "releEncendido": true,
						  "presionAtmosferica": 1013.2
						}
						"""))
				.build();
		HttpResponse<String> response = HttpClient.newHttpClient()
				.send(request, HttpResponse.BodyHandlers.ofString());

		assertEquals(200, response.statusCode());
		assertTrue(response.body().contains("\"status\":\"OK\""));
		assertTrue(response.body().contains("\"bombaEncendida\":true"));

		LecturaSensor lectura = repository.findFirstByOrderByIdDesc().orElseThrow();
		assertEquals("nodo-02", lectura.getNodoId());
		assertEquals("SENSOR", lectura.getRolNodo());
		assertEquals(20.0, lectura.getHumedadSuelo());
		assertEquals(2800, lectura.getLecturaSueloRaw());
		assertEquals(Boolean.TRUE, lectura.getReleEncendido());
		assertEquals(1013.2, lectura.getPresionAtmosferica());
	}

	@Test
	void entregaDireccionesLanParaElAccesoQr() throws Exception {
		HttpRequest request = HttpRequest.newBuilder()
				.uri(URI.create("http://localhost:" + port + "/api/riego/acceso"))
				.GET()
				.build();
		HttpResponse<String> response = HttpClient.newHttpClient()
				.send(request, HttpResponse.BodyHandlers.ofString());

		assertEquals(200, response.statusCode());
		assertTrue(response.body().startsWith("["));
		assertTrue(response.body().endsWith("]"));
	}

	@Test
	void humedadCeroActivaLaOrdenAutomaticaAunqueElAdcSeaAlto() {
		LecturaSensor lectura = new LecturaSensor(0.0, 22.0, 50.0, 0.0, 1000.0);
		lectura.setLecturaSueloRaw(4095);

		var estado = riegoService.procesarTelemetria(lectura);

		assertTrue((Boolean) estado.get("bombaEncendida"));
	}
}
