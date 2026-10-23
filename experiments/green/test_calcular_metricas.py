import unittest

from calcular_metricas import calculate


class GreenMetricsTests(unittest.TestCase):
    def setUp(self):
        self.row = {
            "run_id": "fixture-no-es-una-medicion",
            "system": "test",
            "protocol": "fixture",
            "duration_s": "3600",
            "messages_sent": "100",
            "messages_delivered": "80",
            "average_power_w": "2.5",
            "grid_intensity_gco2_kwh": "400",
        }

    def test_calculates_energy_per_delivered_message_and_co2e(self):
        result = calculate(self.row)

        self.assertEqual("MEDIDO", result["data_kind"])
        self.assertAlmostEqual(2.5, result["energy_wh"])
        self.assertAlmostEqual(0.03125, result["wh_per_delivered_message"])
        self.assertAlmostEqual(1.0, result["co2e_g"])

    def test_rejects_delivered_count_greater_than_sent(self):
        self.row["messages_delivered"] = "101"

        with self.assertRaises(ValueError):
            calculate(self.row)

    def test_reports_zero_delivery_without_division_error(self):
        self.row["messages_delivered"] = "0"

        result = calculate(self.row)

        self.assertIsNone(result["wh_per_delivered_message"])
        self.assertEqual(0, result["delivery_ratio_pct"])


if __name__ == "__main__":
    unittest.main()
