package com.siria.dashboard;

import com.siria.dashboard.model.LecturaSensor;
import com.siria.dashboard.repository.LecturaSensorRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.HashMap;
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

    @GetMapping("/acceso")
    public List<Map<String, String>> obtenerDireccionesAcceso(HttpServletRequest request) throws SocketException {
        List<Map<String, String>> direcciones = new ArrayList<>();
        Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
        if (interfaces == null) return direcciones;

        while (interfaces.hasMoreElements()) {
            NetworkInterface networkInterface = interfaces.nextElement();
            if (!networkInterface.isUp() || networkInterface.isLoopback()) continue;

            Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
            while (addresses.hasMoreElements()) {
                InetAddress address = addresses.nextElement();
                if (!(address instanceof Inet4Address) || !address.isSiteLocalAddress()) continue;

                String host = address.getHostAddress();
                String url = request.getScheme() + "://" + host + ":" + request.getServerPort()
                        + request.getContextPath() + "/#maqueta";
                Map<String, String> entry = new HashMap<>();
                String name = networkInterface.getDisplayName();
                entry.put("nombre", name != null ? name : networkInterface.getName());
                entry.put("host", host);
                entry.put("url", url);
                direcciones.add(entry);
            }
        }

        direcciones.sort(Comparator.comparingInt(entry -> prioridadInterfaz(entry.get("nombre"))));
        return direcciones;
    }

    private int prioridadInterfaz(String nombre) {
        String interfaz = nombre.toLowerCase();
        if (interfaz.contains("wi-fi") || interfaz.contains("wifi") || interfaz.contains("wlan")) return 0;
        if (interfaz.contains("ethernet")) return 1;
        return 2;
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