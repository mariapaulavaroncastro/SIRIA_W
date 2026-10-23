# G8: simulación de malla en ns-3

La simulación usa cinco nodos Wi-Fi ad hoc: origen, dos relays candidatos, un relay de salida y destino. Usa rutas estáticas explícitas; a los 5.1 s apaga el relay primario y a los 7.1 s cambia la ruta del origen al relay alternativo. Reporta PDR, pérdida estimada, retardo medio y throughput por ventana. El cambio de ruta está programado en el escenario: demuestra el impacto y la recuperación de una ruta multihop simulada, pero no es una demostración de convergencia autónoma de OLSR. No sustituye la prueba física con los dos ESP32, que demuestra enlace gateway-nodo, ACK y reconexión, no multihop.

## Kali en WSL

En Kali:

```bash
sudo apt update
sudo apt install -y ns3 libns3-dev pkg-config g++ libsqlite3-dev libgsl-dev
cd "/mnt/c/Users/sergi/OneDrive/Documentos/Proyecto Siria-W/SIRIA_W/experiments/ns3"
g++ -std=c++20 siria_mesh.cc -o siria_mesh $(pkg-config --cflags --libs ns3-core ns3-network ns3-internet ns3-mobility ns3-wifi ns3-applications ns3-flow-monitor)
./siria_mesh
```

La salida son objetos JSON por ventana que pueden guardarse para anexarlos al informe:

```bash
./siria_mesh | tee resultado-ns3.jsonl
```

`lost_packets_estimate` es la diferencia de paquetes transmitidos y recibidos en la aplicación dentro de cada ventana; la primera ventana incluye el inicio de la simulación. Deben conservarse y analizarse las tres ventanas, incluida la interrupción durante el cambio de ruta. El ETX no se declara como medición MAC: el firmware físico informa aparte `etxApp`, un estimado derivado de la tasa de ACK de aplicación.
