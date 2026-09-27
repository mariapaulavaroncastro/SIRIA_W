package com.siria.dashboard.repository;

import com.siria.dashboard.model.LecturaSensor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LecturaSensorRepository extends JpaRepository<LecturaSensor, Long> {

    // Retorna la última lectura ingresada
    Optional<LecturaSensor> findFirstByOrderByIdDesc();

    // Retorna las últimas 20 lecturas ordenadas por ID descendente
    List<LecturaSensor> findTop20ByOrderByIdDesc();

    // Retorna las últimas 30 lecturas para el histórico del dashboard
    List<LecturaSensor> findTop30ByOrderByIdDesc();
}