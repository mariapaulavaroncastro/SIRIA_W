package com.siria.dashboard.repository;

import com.siria.dashboard.model.LecturaSensor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LecturaSensorRepository extends JpaRepository<LecturaSensor, Long> {
    // Retorna los ultimos registros ordenados por fecha
    List<LecturaSensor> findTop20ByOrderByIdDesc();
}