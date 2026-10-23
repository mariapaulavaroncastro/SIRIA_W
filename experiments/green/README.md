# G3: medición energética y huella de carbono

No se dispone de un medidor de potencia, así que el repositorio no incluye resultados energéticos inventados. `mediciones.csv` está intencionalmente vacío aparte de su encabezado. Cada fila debe corresponder a una corrida medida con un vatímetro o medidor USB adecuado; registre la potencia promedio de todo el sistema bajo prueba y los mensajes realmente entregados.

Columnas de entrada:

- `duration_s`: duración de la corrida en segundos.
- `messages_sent` y `messages_delivered`: contadores obtenidos durante esa corrida.
- `average_power_w`: lectura promedio del medidor, no una potencia nominal estimada.
- `grid_intensity_gco2_kwh`: intensidad de carbono de la red eléctrica para la ubicación y fecha de la medición.

Desde esta carpeta:

```powershell
python .\calcular_metricas.py .\mediciones.csv --output .\resultados.csv
```

El cálculo es `Wh = W promedio × segundos / 3600`, `Wh/mensaje entregado = Wh / entregados` y `gCO2e = Wh / 1000 × gCO2e/kWh`. El campo `data_kind=MEDIDO` indica que se usó el formato de entrada de mediciones; no certifica que el instrumento esté calibrado. Documente instrumento, incertidumbre, ubicación, hora y condiciones de carga junto a las evidencias del informe.

PUE y CUE no son apropiados para atribuir eficiencia a este prototipo: son métricas de centros de datos. Para reportar el prototipo use energía por mensaje entregado y CO2e calculado con intensidad eléctrica explícita. Hasta que se rellene el CSV con datos del medidor, no hay resultado real que reportar.
