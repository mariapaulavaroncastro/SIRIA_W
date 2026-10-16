package com.siria.dashboard;

import com.siria.dashboard.model.LecturaSensor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = "siria.mqtt.enabled=false")
class DashboardApplicationTests {

	@Autowired
	private RiegoService riegoService;

	@Test
	void contextLoads() {
	}

	@Test
	void humedadCeroActivaLaOrdenAutomaticaAunqueElAdcSeaAlto() {
		LecturaSensor lectura = new LecturaSensor(0.0, 22.0, 50.0, 0.0, 1000.0);
		lectura.setLecturaSueloRaw(4095);

		var estado = riegoService.procesarTelemetria(lectura);

		assertTrue((Boolean) estado.get("bombaEncendida"));
	}
}
