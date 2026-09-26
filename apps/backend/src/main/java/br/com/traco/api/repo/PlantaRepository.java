package br.com.traco.api.repo;

import br.com.traco.api.model.Planta;
import br.com.traco.api.model.Project;
import br.com.traco.api.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlantaRepository extends JpaRepository<Planta, Long> {

    List<Planta> findByOrderByIdDesc();

    List<Planta> findByProjectOrderByIdDesc(Project project);

    /** Fetch join: open-in-view está desligado, então o project precisa vir carregado. */
    @Query("select pl from Planta pl left join fetch pl.project p " +
           "where p.user = :user order by pl.id desc")
    List<Planta> findByProjectUserOrderByIdDesc(@Param("user") User user);

    long countByProject(Project project);
}