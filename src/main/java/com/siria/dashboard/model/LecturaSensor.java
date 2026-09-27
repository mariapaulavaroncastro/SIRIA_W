package com.siria.dashboard.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lecturas_sensores")
public class LecturaSensor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "humedad_suelo")
    private Double humedadSuelo;

    @Column(name = "temperatura")
    private Double temperatura;

    @Column(name = "humedad_ambiente")
    private Double humedadAmbiente;

    @Column(name = "nivel_tanque")
    private Double nivelTanque;

    @Column(name = "presion_atmosferica")
    private Double presionAtmosferica;

    @Column(name = "fecha_hora", nullable = false, updatable = false)
    private LocalDateTime fechaHora;

    // Constructor vacío requerido por JPA / Hibernate
    public LecturaSensor() {
    }

    // Constructor completo
    public LecturaSensor(Double humedadSuelo, Double temperatura, Double humedadAmbiente, Double nivelTanque, Double presionAtmosferica) {
        this.humedadSuelo = humedadSuelo;
        this.temperatura = temperatura;
        this.humedadAmbiente = humedadAmbiente;
        this.nivelTanque = nivelTanque;
        this.presionAtmosferica = presionAtmosferica;
    }

    // Callback automático: asigna la fecha y hora exacta justo antes de guardar en la BD
    @PrePersist
    protected void onCreate() {
        if (this.fechaHora == null) {
            this.fechaHora = LocalDateTime.now();
        }
    }

    // --- Getters y Setters ---

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Double getHumedadSuelo() {
        return humedadSuelo;
    }

    public void setHumedadSuelo(Double humedadSuelo) {
        this.humedadSuelo = humedadSuelo;
    }

    public Double getTemperatura() {
        return temperatura;
    }

    public void setTemperatura(Double temperatura) {
        this.temperatura = temperatura;
    }

    public Double getHumedadAmbiente() {
        return humedadAmbiente;
    }

    public void setHumedadAmbiente(Double humedadAmbiente) {
        this.humedadAmbiente = humedadAmbiente;
    }

    public Double getNivelTanque() {
        return nivelTanque;
    }

    public void setNivelTanque(Double nivelTanque) {
        this.nivelTanque = nivelTanque;
    }

    public Double getPresionAtmosferica() {
        return presionAtmosferica;
    }

    public void setPresionAtmosferica(Double presionAtmosferica) {
        this.presionAtmosferica = presionAtmosferica;
    }

    public LocalDateTime getFechaHora() {
        return fechaHora;
    }

    public void setFechaHora(LocalDateTime fechaHora) {
        this.fechaHora = fechaHora;
    }
}