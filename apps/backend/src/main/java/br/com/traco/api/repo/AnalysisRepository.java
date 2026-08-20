package br.com.traco.api.repo;

import br.com.traco.api.model.Analysis;
import br.com.traco.api.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AnalysisRepository extends JpaRepository<Analysis, Long> {

    /** Fetch join: open-in-view está desligado, então project/planta precisam vir carregados. */
    @Query("select a from Analysis a join fetch a.project p left join fetch a.planta " +
           "where p.user = :user order by a.id desc")
    List<Analysis> findByProjectUserOrderByIdDesc(@Param("user") User user);

    @Query("select a from Analysis a left join fetch a.project left join fetch a.planta " +
           "order by a.id desc")
    List<Analysis> findAllFetch();

    @Query("select a from Analysis a left join fetch a.project left join fetch a.planta " +
           "where a.id = :id")
    Optional<Analysis> findFetchById(@Param("id") Long id);

    List<Analysis> findByOrderByIdDesc();

    Optional<Analysis> findFirstByPlantaId(Long plantaId);

    @Query("select a.code from Analysis a")
    List<String> allCodes();
}