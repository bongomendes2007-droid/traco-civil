package br.com.traco.api.controller;

import br.com.traco.api.dto.Dtos.ProjectDto;
import br.com.traco.api.dto.Dtos.ProjectRequest;
import br.com.traco.api.exception.ApiException;
import br.com.traco.api.model.Analysis;
import br.com.traco.api.model.Planta;
import br.com.traco.api.model.Project;
import br.com.traco.api.model.User;
import br.com.traco.api.repo.AnalysisRepository;
import br.com.traco.api.repo.PlantaRepository;
import br.com.traco.api.repo.ProjectRepository;
import br.com.traco.api.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/projetos")
public class ProjectController {

    private static final Set<String> TYPES = Set.of("residencial", "comercial", "industrial");
    private static final Set<String> STATUS = Set.of("ativo", "concluido", "rascunho");

    private final ProjectRepository projectRepository;
    private final PlantaRepository plantaRepository;
    private final AnalysisRepository analysisRepository;
    private final CurrentUser currentUser;

    public ProjectController(ProjectRepository projectRepository,
                             PlantaRepository plantaRepository,
                             AnalysisRepository analysisRepository,
                             CurrentUser currentUser) {
        this.projectRepository = projectRepository;
        this.plantaRepository = plantaRepository;
        this.analysisRepository = analysisRepository;
        this.currentUser = currentUser;
    }

    @GetMapping("/{id}")
    public ProjectDto getById(@PathVariable Long id) {
        User user = currentUser.require();
        Project project = projectRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ApiException("Projeto não encontrado.", 404));
        return ProjectDto.from(project, plantaRepository.countByProject(project));
    }

    @GetMapping
    public List<ProjectDto> list() {
        User user = currentUser.require();
        return projectRepository.findByUserOrderByIdDesc(user).stream()
                .map(p -> ProjectDto.from(p, plantaRepository.countByProject(p)))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectDto create(@Valid @RequestBody ProjectRequest req) {
        User user = currentUser.require();
        if (req.name() == null || req.name().isBlank()) {
            throw new ApiException("Informe o nome do projeto.");
        }
        Project project = new Project();
        project.setName(req.name().trim());
        project.setUser(user);
        project.setType(req.type() != null && TYPES.contains(req.type().toLowerCase())
                ? req.type().toLowerCase() : "residencial");
        project.setStatus(req.status() != null && STATUS.contains(req.status().toLowerCase())
                ? req.status().toLowerCase() : "rascunho");
        project = projectRepository.save(project);
        return ProjectDto.from(project, 0);
    }

    @PutMapping("/{id}")
    public ProjectDto update(@PathVariable Long id, @Valid @RequestBody ProjectRequest req) {
        User user = currentUser.require();
        Project project = projectRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ApiException("Projeto não encontrado.", 404));
        if (req.name() != null && !req.name().isBlank()) project.setName(req.name().trim());
        if (req.type() != null && TYPES.contains(req.type().toLowerCase())) project.setType(req.type().toLowerCase());
        if (req.status() != null && STATUS.contains(req.status().toLowerCase())) project.setStatus(req.status().toLowerCase());
        project = projectRepository.save(project);
        return ProjectDto.from(project, plantaRepository.countByProject(project));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        User user = currentUser.require();
        Project project = projectRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ApiException("Projeto não encontrado.", 404));
        for (Planta planta : plantaRepository.findByProjectOrderByIdDesc(project)) {
            analysisRepository.findFirstByPlantaId(planta.getId()).ifPresent(analysisRepository::delete);
            plantaRepository.delete(planta);
        }
        projectRepository.delete(project);
    }
}