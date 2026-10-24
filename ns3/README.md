# Co-simulación NS-3 de SIRIA-W

El escenario reproduce la ruta de datagramas UDP `YL-69/DHT11 -> ESP32 -> Gateway`
con enlaces punto a punto de 5 Mbps y 2 ms por salto. Los nodos conservan las
coordenadas de la maqueta 3D. FlowMonitor estima RTT a partir del retardo
unidireccional, y calcula jitter y pérdida; el
escenario publica métricas y eventos de paquetes en un archivo local que expone
el endpoint `/api/riego/ns3/metrics`.

## Instalar en Ubuntu/WSL2

```bash
apt update
apt install -y build-essential pkg-config ns3 libns3-dev libsqlite3-dev libgsl-dev
```

La distribución WSL configurada para este entorno inicia como `root`. Si se
crea un usuario Linux normal, ejecutar esos comandos con `sudo`.

Desde WSL, cambia a la carpeta del dashboard (está en el disco de Windows) y
ejecuta:

```bash
cd "/mnt/c/Users/maria paula/Documents/SEPTIMO SEMESTRE/Sistema de Riego/dashboard"
bash ns3/run-simulation.sh
```

El dashboard y el escenario deben usar la misma carpeta del proyecto. Mientras
la simulación esté activa, se actualiza
`src/main/resources/static/ns3-metrics.json` cada segundo. El endpoint del
dashboard lee el archivo local, sin caché; la pestaña **Maqueta 3D** consume las
métricas y anima los datagramas recibidos. El archivo es de ejecución local y
está excluido de Git. Si se ejecuta Spring Boot desde otra carpeta, configura
`SIRIAW_NS3_METRICS_FILE` con la ruta completa del archivo.

Variables opcionales:

```bash
DURATION_SECONDS=60 LOSS_PERCENT=1 bash run-simulation.sh
```

`LOSS_PERCENT` configura la probabilidad de pérdida en cada interfaz receptora.
Para probar la coloración crítica, por ejemplo, puede ejecutarse con
`LOSS_PERCENT=6`; para degradación por latencia, se pueden ajustar el retardo de
los enlaces en `siriaw-mesh.cc`.
