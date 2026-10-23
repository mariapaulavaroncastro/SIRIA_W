# Experimentos para las correcciones G3, G6 y G8

Esta carpeta separa las mediciones del prototipo físico de los experimentos de laboratorio y de simulación:

- Firmware PlatformIO del proyecto: publica secuencia/ACK, RTT, pérdidas, PDR, ETX aproximado de aplicación y reconexiones; el backend los muestra en la tarjeta G4 del dashboard.
- `green/`: calcula energía y CO2e únicamente a partir de mediciones que se ingresen desde un medidor.
- `http3/`: compara una solicitud QUIC/HTTP/3 con MQTT QoS 1 desde el PC. No modifica el firmware ni afirma que el ESP32 use HTTP/3.
- `ns3/`: simula una red Wi-Fi multi-salto, la caída de un relay y el cambio de ruta. Es evidencia simulada, no evidencia física.

Para generar evidencia física G4, compile y cargue `esp32_gateway` en el gateway y `esp32_node` en el segundo ESP32; deje el gateway conectado al broker y al dashboard. La tarjeta **Red mesh y calidad del enlace (G4)** se actualiza desde los estados MQTT. Reinicie o desconecte el nodo para observar pérdida de heartbeats y reconexiones. Con las dos placas disponibles se demuestra el enlace y la reconexión, no una ruta multihop ni una ruta alternativa.

El gateway usa GPIO 25 para el relé de la bomba y GPIO 26 para el relé de la electroválvula; DHT11 usa GPIO 4, humedad de suelo ADC GPIO 34, nivel de tanque GPIO 18 y BMP280 I2C GPIO 21/22. La lógica de riego abre primero la válvula y espera 1 s antes de activar la bomba; al detenerse, apaga primero la bomba y cierra la válvula 1 s después. La bomba se bloquea si el tanque está vacío/sin lectura o la válvula no está abierta. Para la primera prueba, mantenga las cargas desconectadas de COM/NO/NC. No conecte una carga a la fuente hasta verificar su corriente, la corriente de arranque y la capacidad DC de los contactos del relé; la fuente disponible de 12 V/5 A no ofrece margen para una bomba nominal de 5 A más la válvula.

Los resultados no deben presentarse como mediciones reales si provienen de una simulación o de valores estimados. El estado mesh del dashboard reside en memoria y vuelve a poblarse al recibir el siguiente estado MQTT.
