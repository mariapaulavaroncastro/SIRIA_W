import argparse
import csv
import math
from pathlib import Path
import sys


FIELDS = (
    "run_id",
    "system",
    "protocol",
    "duration_s",
    "messages_sent",
    "messages_delivered",
    "average_power_w",
    "grid_intensity_gco2_kwh",
)


def calculate(row):
    duration = float(row["duration_s"])
    sent = int(row["messages_sent"])
    delivered = int(row["messages_delivered"])
    average_power = float(row["average_power_w"])
    carbon_intensity = float(row["grid_intensity_gco2_kwh"])

    if duration <= 0 or sent <= 0:
        raise ValueError("duration_s y messages_sent deben ser mayores que cero")
    if delivered < 0 or delivered > sent:
        raise ValueError("messages_delivered debe estar entre cero y messages_sent")
    if average_power < 0 or carbon_intensity < 0:
        raise ValueError("potencia e intensidad de carbono no pueden ser negativas")
    if not all(math.isfinite(value) for value in (duration, average_power, carbon_intensity)):
        raise ValueError("los valores numéricos deben ser finitos")

    energy_wh = average_power * duration / 3600
    return {
        "run_id": row["run_id"],
        "system": row["system"],
        "protocol": row["protocol"],
        "data_kind": "MEDIDO",
        "energy_wh": energy_wh,
        "wh_per_delivered_message": energy_wh / delivered if delivered else None,
        "delivery_ratio_pct": 100 * delivered / sent,
        "co2e_g": energy_wh / 1000 * carbon_intensity,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Calcula KPIs verdes a partir de potencia medida y mensajes entregados."
    )
    parser.add_argument("input_csv", type=Path)
    parser.add_argument("--output", type=Path, help="CSV de salida; por defecto escribe en pantalla.")
    args = parser.parse_args()

    with args.input_csv.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        missing = set(FIELDS) - set(reader.fieldnames or ())
        if missing:
            raise ValueError(f"Faltan columnas requeridas: {', '.join(sorted(missing))}")
        results = [calculate(row) for row in reader]

    columns = (
        "run_id",
        "system",
        "protocol",
        "data_kind",
        "energy_wh",
        "wh_per_delivered_message",
        "delivery_ratio_pct",
        "co2e_g",
    )
    target = args.output.open("w", newline="", encoding="utf-8") if args.output else None
    try:
        writer = csv.DictWriter(target or sys.stdout, fieldnames=columns)
        writer.writeheader()
        writer.writerows(results)
    finally:
        if target:
            target.close()


if __name__ == "__main__":
    main()
