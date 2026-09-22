package br.com.traco.api.service;

import br.com.traco.api.model.Analysis;
import br.com.traco.api.model.Planta;
import br.com.traco.api.repo.AnalysisRepository;
import br.com.traco.api.repo.PlantaRepository;
import br.com.traco.api.service.OrcamentoService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(AnalysisEngine.class);

    private final PlantaRepository plantaRepository;
    private final AnalysisRepository analysisRepository;
    private final ObjectMapper objectMapper;
    private final ComputerVisionClient cvClient;
    private final ReconciliationService reconciliationService;
    private final AuditService auditService;
    private final OrcamentoService orcamentoService;

    /** Perfil Spring ativo. "prod" => erro quando worker offline; outro => simulador. */
    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    public AnalysisEngine(PlantaRepository plantaRepository,
                          AnalysisRepository analysisRepository,
                          ObjectMapper objectMapper,
                          ComputerVisionClient cvClient,
                          ReconciliationService reconciliationService,
                          AuditService auditService,
                          OrcamentoService orcamentoService) {
        this.plantaRepository = plantaRepository;
        this.analysisRepository = analysisRepository;
        this.objectMapper = objectMapper;
        this.cvClient = cvClient;
        this.reconciliationService = reconciliationService;
        this.auditService = auditService;
        this.orcamentoService = orcamentoService;
    }

    private boolean isProd() {
        return "prod".equalsIgnoreCase(activeProfile == null ? "" : activeProfile.trim());
    }

    @Async("rlsAwareExecutor")
    @Transactional
    public void process(Long plantaId) {
        log.info("ENGINE: process() iniciado para plantaId={}", plantaId);

        Planta planta = plantaRepository.findById(plantaId).orElse(null);
        if (planta == null) {
            log.warn("ENGINE: plantaId={} não encontrada no banco — abortando.", plantaId);
            return;
        }
        log.info("ENGINE: planta encontrada: name={}, storagePath={}", planta.getName(), planta.getStoragePath());

        Analysis analysis = new Analysis();
        analysis.setPlanta(planta);
        analysis.setProject(planta.getProject());
        analysis.setCode(nextCode(planta.getId()));
        analysis.setAnalysisMode("ia"); // default; sobrescrito se cair no simulador
        // Motivo exato da falha (reason do 422 do worker / erro interno) —
        // propagado até o audit_log para diagnóstico sem depender de log do Render.
        final String[] failureReason = {null};
        log.info("ENGINE: análise criada com code={}", analysis.getCode());

        long start = System.currentTimeMillis();

        String name = planta.getName() == null ? "" : planta.getName().toLowerCase();
        if (name.contains("fachada") || name.contains("fasade")) {
            log.info("ENGINE: arquivo de fachada detectado — marcando como erro.");
            failureReason[0] = "Arquivo de fachada não suportado para análise de quantitativos.";
            failAnalysis(planta, analysis, start, failureReason[0]);
            return;
        }

        ComputerVisionClient.CvResult cv = null;
        boolean workerOffline = false;
        log.info("ENGINE: chamando ComputerVisionClient.analyze() para storagePath={}", planta.getStoragePath());
        try {
            Optional<ComputerVisionClient.CvResult> r =
                    cvClient.analyze(planta.getStoragePath(), planta.getName());
            if (r.isPresent()) {
                cv = r.get();
                log.info("ENGINE: worker retornou resultado: area={}, rooms={}, confidence={}",
                        cv.areaM2(), cv.roomsCount(), cv.confidence());
            } else {
                workerOffline = true; // Optional.empty() => worker inacessível / fallback
                log.warn("ENGINE: worker offline (Optional.empty) — caindo em política híbrida.");
            }
        } catch (ComputerVisionClient.CvRejectedException e) {
            log.warn("ENGINE: worker rejeitou o arquivo: {}", e.getMessage());
            failureReason[0] = "Worker recusou o arquivo: " + safe(e.getMessage());
            failAnalysis(planta, analysis, start, failureReason[0]);
            return;
        } catch (Exception e) {
            log.error("ENGINE: exceção inesperada ao chamar worker: {}", e.getMessage(), e);
            failureReason[0] = "Erro interno ao processar planta: " + safe(e.getMessage());
            failAnalysis(planta, analysis, start, failureReason[0]);
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
            // ---- leitura real (OpenCV) + revisão cruzada Claude Vision ----
            Long userId = planta.getProject() != null && planta.getProject().getUser() != null
                    ? planta.getProject().getUser().getId() : null;
            String userEmail = planta.getProject() != null && planta.getProject().getUser() != null
                    ? planta.getProject().getUser().getEmail() : null;

            ReconciliationService.ReconciledResult reconciled =
                    reconciliationService.reconcile(cv, planta.getStoragePath(), planta.getName(),
                            userId, userEmail, planta.getId());

            area = reconciled.areaM2();
            rooms = reconciled.roomsCount();
            confidence = (int) Math.round(reconciled.confidence() * 100);
            wallLength = reconciled.wallLengthM();
            openings = reconciled.openings();
            boxesJson = reconciled.boxesJson();
            duration = Math.max(1, secondsSince(start));
            analysis.setAnalysisMode("ia");
            analysis.setRoomsDetail(reconciled.roomsDetail());
            analysis.setRoomsGeometry(reconciled.roomsGeometry());
            analysis.setScaleInfo(reconciled.scaleInfo());
        } else {
            // ---- worker offline: política híbrida ----
            if (isProd()) {
                // Produção: NUNCA mascarar com dados falsos.
                failureReason[0] = "Worker de IA indisponível — análise real não pôde ser feita. Verifique o serviço de visão computacional.";
                failAnalysis(planta, analysis, start, failureReason[0]);
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

        // --- Quantitativos para orçamento SINAPI (Fase 3) ---
        // Alvenaria e fôrma usam wallLengthM real do worker; concreto e aço usam coeficientes por área.
        // Altura padrão 2.80m (NBR 15575) — editável na Fase 1.
        double floorHeight = 2.80;
        double concrete = round2(area * 0.2276);                              // m³ (coeficiente paramétrico)
        double steel = round2(area * 0.0335);                                 // ton (coeficiente paramétrico)
        double masonry = round2(wallLength * floorHeight);                    // m² (perímetro × altura)
        double forms = round2(wallLength * floorHeight * 0.40);               // m² (40% do perímetro = estrutural)

        // Custo SINAPI real substitui heurística area × 2016.41
        // UF temporária "PI" — será parâmetro do usuário na Fase 2
        double cost = orcamentoService.calcularOrcamento(area, wallLength, "PI");

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
        // roomsDetail permanece null em modo simulado — o frontend exibe
        // mensagem de erro neutra (P6) em vez de dados inventados.
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

        auditAnalysis(planta, analysis, cost, null);
    }

    /** Marca planta + análise como erro com mensagem clara e registra auditoria. */
    private void failAnalysis(Planta planta, Analysis analysis, long startMs, String reason) {
        planta.setStatus("erro");
        analysis.setStatus("erro");
        analysis.setDurationSeconds(secondsSince(startMs));
        analysis.setConfidence(0);
        // Mantém analysisMode="ia" (não foi simulado) — o motivo exato fica registrado
        // no audit_log (details) para diagnóstico sem depender de log do Render.
        plantaRepository.save(planta);
        analysisRepository.save(analysis);
        auditAnalysis(planta, analysis, 0d, reason);
    }

    private void auditAnalysis(Planta planta, Analysis analysis, double cost, String failureReason) {
        String userEmail = planta.getProject() != null && planta.getProject().getUser() != null
                ? planta.getProject().getUser().getEmail() : null;
        Long userId = planta.getProject() != null && planta.getProject().getUser() != null
                ? planta.getProject().getUser().getId() : null;
        if ("concluida".equals(analysis.getStatus())) {
            auditService.logAnalysisCompleted(userId, userEmail, analysis.getId(), cost);
        } else if ("erro".equals(analysis.getStatus())) {
            // Registra o motivo EXATO (reason do 422 do worker / erro interno),
            // não apenas o enum genérico — era a lacuna de observabilidade.
            String reason = failureReason != null && !failureReason.isBlank()
                    ? failureReason : "WORKER_OFFLINE_OR_REJECTED";
            auditService.logAnalysisFailed(userId, userEmail, analysis.getId(), reason);
        }
    }

    private String safe(String s) {
        return s == null ? "sem detalhes" : (s.length() > 200 ? s.substring(0, 200) : s);
    }

    private int secondsSince(long startMs) {
        return (int) Math.max(1, (System.currentTimeMillis() - startMs) / 1000);
    }

    /**
     * Gera código único baseado no plantaId — imune a RLS e a análises órfãs.
     * Formato: ANL-{plantaId} garante unicidade global sem depender de queries
     * na tabela analyses (que são filtradas pelo RLS do Supabase).
     */
    private String nextCode(Long plantaId) {
        return String.format("ANL-%04d", plantaId);
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