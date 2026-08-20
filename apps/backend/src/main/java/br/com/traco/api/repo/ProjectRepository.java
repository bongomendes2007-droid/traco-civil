package br.com.traco.api.repo;

import br.com.traco.api.model.Project;
import br.com.traco.api.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByUserOrderByIdDesc(User user);

    Optional<Project> findByIdAndUser(Long id, User user);

    Optional<Project> findFirstByUserOrderByIdAsc(User user);
}