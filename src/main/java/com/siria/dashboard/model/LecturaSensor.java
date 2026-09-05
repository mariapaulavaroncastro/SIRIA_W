package com.siria.dashboard.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lecturas_sensores")
public class LecturaSensor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Double humedadSuelo;
    private Double temperatura;
    private Double humedadAmbiente;
    private Double nivelTanque;
    private LocalDateTime fechaHora;

    public LecturaSensor() {
        this.fechaHora = LocalDateTime.now();
    }

    public LecturaSensor(Double humedadSuelo, Double temperatura, Double humedadAmbiente, Double nivelTanque) {
        this.humedadSuelo = humedadSuelo;
        this.temperatura = temperatura;
        this.humedadAmbiente = humedadAmbiente;
        this.nivelTanque = nivelTanque;
        this.fechaHora = LocalDateTime.now();
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Double getHumedadSuelo() { return humedadSuelo; }
    public void setHumedadSuelo(Double humedadSuelo) { this.humedadSuelo = humedadSuelo; }

    public Double getTemperatura() { return temperatura; }
    public void setTemperatura(Double temperatura) { this.temperatura = temperatura; }

    public Double getHumedadAmbiente() { return humedadAmbiente; }
    public void setHumedadAmbiente(Double humedadAmbiente) { this.humedadAmbiente = humedadAmbiente; }

    public Double getNivelTanque() { return nivelTanque; }
    public void setNivelTanque(Double nivelTanque) { this.nivelTanque = nivelTanque; }

    public LocalDateTime getFechaHora() { return fechaHora; }
    public void setFechaHora(LocalDateTime fechaHora) { this.fechaHora = fechaHora; }
}