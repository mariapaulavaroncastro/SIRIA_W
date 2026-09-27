package com.siria.dashboard;

import com.siria.dashboard.model.LecturaSensor;
import com.siria.dashboard.repository.LecturaSensorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class DashboardApplicationTests {

	@Autowired
	private RiegoController riegoController;

	@Autowired
	private LecturaSensorRepository repository;

	@BeforeEach
	void prepararControlAutomatico() {
		riegoController.cambiarModo(Map.of("modo", "MANUAL"));
		riegoController.cambiarBomba(Map.of("encender", false));
		riegoController.cambiarModo(Map.of("modo", "AUTOMATICO"));
		repository.deleteAll();
	}

	@Test
	void contextLoads() {
	}

	@Test
	void ceroPorCientoEnciendeLaBombaAunqueElAdcSeaAlto() {
		LecturaSensor lectura = new LecturaSensor(0.0, 22.0, 50.0, 0.0, null);
		lectura.setLecturaSueloRaw(4095);

		Map<String, Object> respuesta = riegoController.recibirTelemetria(lectura);

		assertTrue((Boolean) respuesta.get("bombaEncendida"));
	}

	@Test
	void humedadOptimaApagaLaBomba() {
		LecturaSensor lecturaSeca = new LecturaSensor(0.0, 22.0, 50.0, 0.0, null);
		lecturaSeca.setLecturaSueloRaw(4095);
		riegoController.recibirTelemetria(lecturaSeca);

		LecturaSensor lecturaOptima = new LecturaSensor(65.0, 22.0, 50.0, 0.0, null);
		lecturaOptima.setLecturaSueloRaw(100);

		Map<String, Object> respuesta = riegoController.recibirTelemetria(lecturaOptima);

		assertFalse((Boolean) respuesta.get("bombaEncendida"));
	}

	@Test
	void estadoDelReleReportadoSeDistingueDelComandoAutomatico() {
		LecturaSensor lectura = new LecturaSensor(0.0, 22.0, 50.0, 0.0, null);
		lectura.setReleEncendido(false);

		Map<String, Object> respuesta = riegoController.recibirTelemetria(lectura);

		assertTrue((Boolean) respuesta.get("bombaEncendida"));
		assertFalse((Boolean) respuesta.get("releEncendido"));
	}

}
