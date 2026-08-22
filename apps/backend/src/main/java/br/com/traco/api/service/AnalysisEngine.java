package br.com.traco.api.service;

import br.com.traco.api.model.Analysis;
import br.com.traco.api.model.Planta;
import br.com.traco.api.repo.AnalysisRepository;
import br.com.traco.api.repo.PlantaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Pipeline de análise: tenta a leitura REAL no worker de visão computacional
 * (packages/ai/worker.py — OpenCV).
 *
 * Comportamento quando o worker está offline/inacessível (política híbrida):
 *   - profile "prod"  => grava status "erro" ("worker de IA indisponível").
 *                        NUNCA gera números falsos em produção.
 *   - demais (dev)    => cai no simulador paramétrico determinístico e grava
 *                        analysisMode = "simulado" + status "concluida", para
 *                        que o frontend exiba o aviso "MODO SIMULADO".
 * Se o worker recusar explicitamente o arquivo (422), a planta vira status "erro"
 * em qualquer ambiente.
 */
@Service
public class AnalysisEngine {

    private final PlantaRepository plantaRepository;
    private final AnalysisRepository analysisRepository;
    private final ObjectMapper objectMapper;
    private final ComputerVisionClient cvClient;
    private final AuditService auditService;

    /** Perfil Spring ativo. "prod" => erro quando worker offline; outro => simulador. */
    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    public AnalysisEngine(PlantaRepository plantaRepository,
                          AnalysisRepository analysisRepository,
                          ObjectMapper objectMapper,
                          ComputerVisionClient cvClient,
                          AuditService auditService) {
        this.plantaRepository = plantaRepository;
        this.analysisRepository = analysisRepository;
        this.objectMapper = objectMapper;
        this.cvClient = cvClient;
        this.auditService = auditService;
    }

    private boolean isProd() {
        return "prod".equalsIgnoreCase(activeProfile == null ? "" : activeProfile.trim());
    }

    @Async
    @Transactional
    public void process(Long plantaId) {
        Planta planta = plantaRepository.findById(plantaId).orElse(null);
        if (planta == null) return;

        Analysis analysis = new Analysis();
        analysis.setPlanta(planta);
        analysis.setProject(planta.getProject());
        analysis.setCode(nextCode());
        analysis.setAnalysisMode("ia"); // default; sobrescrito se cair no simulador

        long start = System.currentTimeMillis();

        String name = planta.getName() == null ? "" : planta.getName().toLowerCase();
        if (name.contains("fachada") || name.contains("fasade")) {
            failAnalysis(planta, analysis, start, "Arquivo de fachada não suportado para análise de quantitativos.");
            return;
        }

        ComputerVisionClient.CvResult cv = null;
        boolean workerOffline = false;
        try {
            Optional<ComputerVisionClient.CvResult> r =
                    cvClient.analyze(planta.getStoragePath(), planta.getName());
            if (r.isPresent()) cv = r.get();
            else workerOffline = true; // Optional.empty() => worker inacessível / fallback
        } catch (ComputerVisionClient.CvRejectedException e) {
            failAnalysis(planta, analysis, start, "Worker recusou o arquivo: " + safe(e.getMessage()));
            return;
        }

        double area;
        int rooms;
        int confidence;
        int duration;
        double wallLength;
        int openings;
        String boxesJson = null;

        if (cv != null) {
            // ---- leitura real (OpenCV) ----
            area = cv.areaM2();
            rooms = cv.roomsCount();
            confidence = (int) Math.round(cv.confidence() * 100);
            wallLength = cv.wallLengthM();
            openings = cv.openings();
            boxesJson = cv.boxesJson();
            duration = Math.max(1, secondsSince(start));
            analysis.setAnalysisMode("ia");
        } else {
            // ---- worker offline: política híbrida ----
            if (isProd()) {
                // Produção: NUNCA mascarar com dados falsos.
                failAnalysis(planta, analysis, start,
                        "Worker de IA indisponível — análise real não pôde ser feita. Verifique o serviço de visão computacional.");
                return;
            }
            // Dev: simulador determinístico, marcado explicitamente como "simulado".
            analysis.setAnalysisMode("simulado");
            try {
                Thread.sleep(2500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            long seed = Math.abs(planta.getSizeBytes() + plantaId * 7919);
            area = round1(90 + (seed % 620) / 10.0);   // 90.0 – 151.9 m²
            rooms = (int) (3 + (seed % 5));            // 3 – 7 ambientes
            confidence = (int) (93 + (seed % 7));      // 93 – 99%
            wallLength = round1(area * 0.97);
            openings = rooms + 2;
            duration = (int) (8 + (seed % 18));        // 8 – 25 s
        }

        double concrete = round2(area * 0.2276);
        double steel = round2(area * 0.0335);
        double masonry = round2(area * 1.0687);
        double forms = round2(area * 2.0028);
        double cost = round2(area * 2016.41);

        planta.setStatus("concluida");
        planta.setArea(area);
        planta.setRooms(rooms);

        analysis.setStatus("concluida");
        analysis.setDurationSeconds(duration);
        analysis.setConfidence(confidence);
        analysis.setArea(area);
        analysis.setRooms(rooms);
        analysis.setEstimatedCost(cost);
        analysis.setBoxesJson(boxesJson);
        analysis.setElementsJson(json(List.of(
                Map.of("label", "Pilares", "value", String.valueOf(Math.max(1, Math.round(area / 6)))),
                Map.of("label", "Vigas", "value", String.valueOf(Math.max(1, Math.round(area / 3.9)))),
                Map.of("label", "Lajes", "value", String.valueOf(Math.max(1, Math.round(area / 8)))),
                Map.of("label", "Paredes", "value", String.valueOf(Math.max(1, Math.round(wallLength / 2.5)))),
                Map.of("label", "Esquadrias", "value", String.valueOf(Math.max(1, openings)))
        )));
        analysis.setQuantitiesJson(json(List.of(
                Map.of("label", "Concreto", "value", br(concrete) + " m³"),
                Map.of("label", "Aço CA-50", "value", br(steel) + " ton"),
                Map.of("label", "Alvenaria", "value", br(masonry) + " m²"),
                Map.of("label", "Formas", "value", br(forms) + " m²")
        )));

        plantaRepository.save(planta);
        analysisRepository.save(analysis);

        auditAnalysis(planta, analysis, cost);
    }

    /** Marca planta + análise como erro com mensagem clara e registra auditoria. */
    private void failAnalysis(Planta planta, Analysis analysis, long startMs, String reason) {
        planta.setStatus("erro");
        analysis.setStatus("erro");
        analysis.setDurationSeconds(secondsSince(startMs));
        analysis.setConfidence(0);
        // Mantém analysisMode="ia" (não foi simulado) — o motivo fica claro pelo status+auditoria.
        plantaRepository.save(planta);
        analysisRepository.save(analysis);
        auditAnalysis(planta, analysis, 0d);
    }

    private void auditAnalysis(Planta planta, Analysis analysis, double cost) {
        String userEmail = planta.getProject() != null && planta.getProject().getUser() != null
                ? planta.getProject().getUser().getEmail() : null;
        Long userId = planta.getProject() != null && planta.getProject().getUser() != null
                ? planta.getProject().getUser().getId() : null;
        if ("concluida".equals(analysis.getStatus())) {
            auditService.logAnalysisCompleted(userId, userEmail, analysis.getId(), cost);
        } else if ("erro".equals(analysis.getStatus())) {
            auditService.logAnalysisFailed(userId, userEmail, analysis.getId(), "WORKER_OFFLINE_OR_REJECTED");
        }
    }

    private String safe(String s) {
        return s == null ? "sem detalhes" : (s.length() > 200 ? s.substring(0, 200) : s);
    }

    private int secondsSince(long startMs) {
        return (int) Math.max(1, (System.currentTimeMillis() - startMs) / 1000);
    }

    private String nextCode() {
        int max = analysisRepository.allCodes().stream()
                .map(c -> c.replace("ANL-", "").trim())
                .mapToInt(s -> {
                    try {
                        return Integer.parseInt(s);
                    } catch (NumberFormatException e) {
                        return 0;
                    }
                })
                .max()
                .orElse(0);
        return String.format("ANL-%04d", max + 1);
    }

    private String json(List<Map<String, String>> data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String br(double value) {
        return String.format(Locale.ROOT, "%.2f", value).replace('.', ',');
    }

    private double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}