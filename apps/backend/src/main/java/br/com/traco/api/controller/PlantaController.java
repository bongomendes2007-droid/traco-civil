package br.com.traco.api.controller;

import br.com.traco.api.dto.Dtos.PlantaDto;
import br.com.traco.api.exception.ApiException;
import br.com.traco.api.model.Planta;
import br.com.traco.api.model.User;
import br.com.traco.api.repo.AnalysisRepository;
import br.com.traco.api.repo.PlantaRepository;
import br.com.traco.api.repo.UserRepository;
import br.com.traco.api.security.CurrentUser;
import br.com.traco.api.service.PlantaIntakeService;
import br.com.traco.api.service.SupabaseStorageClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@RestController
public class PlantaController {

    private final PlantaIntakeService intakeService;
    private final SupabaseStorageClient supabaseStorage;
    private final PlantaRepository plantaRepository;
    private final AnalysisRepository analysisRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public PlantaController(PlantaIntakeService intakeService,
                            SupabaseStorageClient supabaseStorage,
                            PlantaRepository plantaRepository,
                            AnalysisRepository analysisRepository,
                            UserRepository userRepository,
                            CurrentUser currentUser) {
        this.intakeService = intakeService;
        this.supabaseStorage = supabaseStorage;
        this.plantaRepository = plantaRepository;
        this.analysisRepository = analysisRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @PostMapping("/api/plantas/upload")
    public PlantaDto upload(@RequestParam("file") MultipartFile file,
                            @RequestParam(name = "projectId", required = false) Long projectId) {
        User user = currentUser.require();
        return PlantaDto.from(intakeService.intake(user, file, projectId));
    }

    @GetMapping("/api/plantas")
    @Transactional(readOnly = true)
    public List<PlantaDto> list() {
        User user = currentUser.require();
        return plantaRepository.findByProjectUserOrderByIdDesc(user).stream()
                .map(this::withAnalysisMode)
                .toList();
    }

    @GetMapping("/api/plantas/{id}")
    @Transactional(readOnly = true)
    public PlantaDto get(@PathVariable Long id) {
        User user = currentUser.require();
        Planta planta = plantaRepository.findById(id)
                .orElseThrow(() -> new ApiException("Planta não encontrada.", 404));
        if (planta.getProject() == null || !planta.getProject().getUser().getId().equals(user.getId())) {
            throw new ApiException("Planta não encontrada.", 404);
        }
        return withAnalysisMode(planta);
    }

    /** Resolve o analysisMode ("ia" | "simulado") da análise vinculada à planta, se existir. */
    private PlantaDto withAnalysisMode(Planta pl) {
        String mode = analysisRepository.findFirstByPlantaId(pl.getId())
                .map(a -> a.getAnalysisMode())
                .orElse(null);
        return PlantaDto.from(pl, mode);
    }

    @DeleteMapping("/api/plantas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        User user = currentUser.require();
        Planta planta = plantaRepository.findById(id)
                .orElseThrow(() -> new ApiException("Planta não encontrada.", 404));
        if (planta.getProject() == null || !planta.getProject().getUser().getId().equals(user.getId())) {
            throw new ApiException("Planta não encontrada.", 404);
        }
        analysisRepository.findFirstByPlantaId(id).ifPresent(analysisRepository::delete);
        // Remove tambem o objeto do Supabase Storage (evita orfaos no bucket) —
        // best-effort; o registro no banco e removido de qualquer forma.
        if (planta.getStorageUrl() != null) {
            supabaseStorage.delete(planta.getStorageUrl());
        }
        plantaRepository.delete(planta);
    }

    /**
     * Imagem original da planta (signed URL de curta duracao do Supabase Storage).
     * Ownership conferido antes de assinar. 404 se o arquivo ainda nao foi
     * persistido no bucket (upload antigo/Storage desativado).
     */
    @GetMapping("/api/plantas/{id}/image")
    public Map<String, String> image(@PathVariable Long id) {
        User user = currentUser.require();
        Planta planta = plantaRepository.findById(id)
                .orElseThrow(() -> new ApiException("Planta não encontrada.", 404));
        if (planta.getProject() == null || !planta.getProject().getUser().getId().equals(user.getId())) {
            throw new ApiException("Planta não encontrada.", 404);
        }
        if (planta.getStorageUrl() == null) {
            throw new ApiException("Imagem original ainda não disponível para esta planta.", 404);
        }
        String url = supabaseStorage.signedUrl(planta.getStorageUrl(), java.time.Duration.ofHours(1))
                .orElseThrow(() -> new ApiException("Imagem original temporariamente indisponível.", 503));
        return Map.of("url", url);
    }

    /**
     * Endpoint legado — agora exige autenticação obrigatória.
     * O fallback para usuário demo foi removido por segurança (auditoria 01/09/2026).
     */
    @PostMapping("/upload/")
    public Map<String, Object> legacyUpload(@RequestParam("file") MultipartFile file) {
        User user = currentUser.require();
        Planta planta = intakeService.intake(user, file, null);
        return Map.of(
                "filename", planta.getName(),
                "status", "processing",
                "message", "Planta recebida. Iniciando análise de IA...",
                "project_id", String.valueOf(planta.getId()));
    }
}