package br.com.traco.api.dto;

import br.com.traco.api.model.Planta;
import br.com.traco.api.model.Project;
import br.com.traco.api.model.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class Dtos {

    private Dtos() {}

    public record RegisterRequest(
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Email @Size(max = 190) String email,
            @NotBlank @Size(min = 6, max = 72) String password,
            @Size(max = 30) String role) {}

    public record LoginRequest(
            @NotBlank @Email @Size(max = 190) String email,
            @NotBlank @Size(max = 72) String password) {}

    public record AuthResponse(String token, UserDto user) {}

    public record UserDto(Long id, String name, String email, String role) {
        public static UserDto from(User u) {
            return new UserDto(u.getId(), u.getName(), u.getEmail(), u.getRole());
        }
    }

    public record ProjectRequest(
            @NotBlank @Size(max = 120) String name,
            @Size(max = 30) String type,
            @Size(max = 30) String status) {}

    public record ProjectDto(Long id, String name, String type, String status, long plans, Instant createdAt) {
        public static ProjectDto from(Project p, long plans) {
            return new ProjectDto(p.getId(), p.getName(), p.getType(), p.getStatus(), plans, p.getCreatedAt());
        }
    }

    public record PlantaDto(Long id, String name, String format, long sizeBytes, String status,
                            Double area, Integer rooms, String project, Long projectId, Instant uploadedAt,
                            String analysisMode) {
        public static PlantaDto from(Planta pl) {
            return from(pl, null);
        }
        /** Inclui o modo da análise vinculada ("ia" | "simulado") quando conhecido. */
        public static PlantaDto from(Planta pl, String analysisMode) {
            return new PlantaDto(
                    pl.getId(),
                    pl.getName(),
                    pl.getFormat(),
                    pl.getSizeBytes(),
                    pl.getStatus(),
                    pl.getArea(),
                    pl.getRooms(),
                    pl.getProject() != null ? pl.getProject().getName() : null,
                    pl.getProject() != null ? pl.getProject().getId() : null,
                    pl.getUploadedAt(),
                    analysisMode);
        }
    }

    public record AnalysisDto(Long id, String code, String project, String plan, Instant date,
                              Integer durationSeconds, Integer confidence, String status,
                              String analysisMode,
                              Double area, Integer rooms, Double estimatedCost,
                              List<Map<String, String>> elements, List<Map<String, String>> quantities,
                              List<Map<String, Object>> boxes) {
        public static AnalysisDto from(br.com.traco.api.model.Analysis a,
                                       List<Map<String, String>> elements,
                                       List<Map<String, String>> quantities,
                                       List<Map<String, Object>> boxes) {
            return new AnalysisDto(
                    a.getId(),
                    a.getCode(),
                    a.getProject() != null ? a.getProject().getName() : null,
                    a.getPlanta() != null ? a.getPlanta().getName() : null,
                    a.getCreatedAt(),
                    a.getDurationSeconds(),
                    a.getConfidence(),
                    a.getStatus(),
                    a.getAnalysisMode(),
                    a.getArea(),
                    a.getRooms(),
                    a.getEstimatedCost(),
                    elements,
                    quantities,
                    boxes);
        }
    }
}