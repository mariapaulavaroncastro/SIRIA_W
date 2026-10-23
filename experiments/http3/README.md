# G6: laboratorio QUIC/HTTP/3 frente a MQTT

Este experimento corre en el PC/Kali y usa el mismo esquema de telemetría simplificado. El firmware ESP32 continúa usando MQTT; no se atribuye soporte HTTP/3 al ESP32.

## Preparación y ejecución

En Kali/WSL, desde esta carpeta:

```bash
sudo apt install -y python3 python3-venv python3-pip
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python generate_certificate.py
python server.py --certificate cert.pem --private-key key.pem
```

En otra terminal, dentro del entorno virtual:

```bash
python client.py --host 127.0.0.1 --count 50
python mqtt_client.py --host 127.0.0.1 --count 50
```

El broker MQTT del baseline debe estar disponible. Si requiere autenticación, proporcione `SIRIA_MQTT_USERNAME` y `SIRIA_MQTT_PASSWORD` como variables de entorno; no las escriba en el código ni en el historial del shell. `SIRIA_MQTT_HOST` y `SIRIA_MQTT_PORT` permiten cambiar el broker.

Ambos programas imprimen JSON por mensaje y un resumen p50/p95/promedio. El RTT HTTP/3 incluye la respuesta de la aplicación; `PUBACK` MQTT mide confirmación del broker, no persistencia del dashboard. Son medidas de protocolo distintas y deben reportarse con esa limitación. Use la misma máquina, ubicación de red, tamaño de mensaje, número de repeticiones y periodo entre mensajes; repita cada corrida al menos tres veces.

El servidor se enlaza por defecto a `127.0.0.1`; no se exponga a Internet ni a redes no confiables. El certificado de laboratorio es autofirmado y el cliente no valida identidad TLS. El puerto UDP 4433 solo debe abrirse temporalmente para una prueba en una LAN controlada.
