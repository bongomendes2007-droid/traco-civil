package br.com.traco.api.service;

import br.com.traco.api.dto.RoomDetail;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Orquestra a verificação cruzada entre o worker OpenCV e a Claude Vision API.
 *
 * Fluxo:
 *   1. Worker já rodou e produziu CvResult (geometria bruta + confidence).
 *   2. Claude recebe a imagem + JSON do worker e retorna verdict estruturado.
 *   3. Em caso de discordância, o valor do Claude prevalece.
 *   4. Falha na chamada Claude → review_status="skipped", segue só com worker.
 *
 * A análise NUNCA é derrubada por falha na revisão — best-effort com audit.
 */
@Service
public class ReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(ReconciliationService.class);

    private final ClaudeVisionService claudeVision;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public ReconciliationService(ClaudeVisionService claudeVision,
                                 AuditService auditService,
                                 ObjectMapper objectMapper) {
        this.claudeVision = claudeVision;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    /**
     * Resultado da reconciliação. Contém os dados finais (reconciliados ou originais)
     * e o status da revisão para transparência no audit.
     */
    public record ReconciledResult(
            double areaM2,
            int roomsCount,
            double wallLengthM,
            int openings,
            double confidence,
            String boxesJson,
            List<RoomDetail> roomsDetail,
            List<Map<String, Object>> roomsGeometry,
            Map<String, Object> scaleInfo,
            String reviewStatus,       // "confirmed", "corrected", "skipped"
            String correctionsSummary  // null se confirmed/skipped
    ) {}

    /**
     * Reconcilia o resultado do worker com a revisão da Claude Vision API.
     *
     * @param cv          resultado do worker OpenCV (já validado, não-null)
     * @param storagePath caminho local do arquivo da planta
     * @param fileName    nome original do arquivo
     * @param userId      id do usuário dono (para audit)
     * @param userEmail   email do usuário (para audit)
     * @param plantaId    id da planta (para audit)
     * @return resultado reconciliado (Claude prevalece) ou original (se Claude falhar)
     */
    public ReconciledResult reconcile(ComputerVisionClient.CvResult cv,
                                      String storagePath,
                                      String fileName,
                                      Long userId,
                                      String userEmail,
                                      Long plantaId) {
        if (!claudeVision.configured()) {
            log.info("RECONCILIAÇÃO: Claude API não configurada — seguindo com worker puro.");
            return fromWorker(cv, "skipped", null);
        }

        String workerJson;
        try {
            workerJson = objectMapper.writeValueAsString(cv);
        } catch (Exception e) {
            log.warn("RECONCILIAÇÃO: falha ao serializar CvResult para enviar ao Claude: {}", e.getMessage());
            return fromWorker(cv, "skipped", null);
        }

        Optional<String> claudeResponse = claudeVision.reviewWithVision(storagePath, fileName, workerJson);
        if (claudeResponse.isEmpty()) {
            log.warn("RECONCILIAÇÃO: Claude não retornou resposta válida — seguindo com worker puro.");
            auditReview(userId, userEmail, plantaId, "skipped", null, null);
            return fromWorker(cv, "skipped", null);
        }

        try {
            JsonNode root = parseClaudeResponse(claudeResponse.get());
            if (root == null) {
                log.warn("RECONCILIAÇÃO: parse da resposta Claude falhou — seguindo com worker puro.");
                auditReview(userId, userEmail, plantaId, "skipped", null, null);
                return fromWorker(cv, "skipped", null);
            }

            String verdict = root.path("verdict").asText("confirmado");
            String correctionsSummary = root.path("corrections_summary").asText(null);
            double totalArea = root.path("total_area_m2").asDouble(cv.areaM2());

            List<RoomDetail> reconciledRooms = reconcileRooms(root, cv);
            int roomsCount = reconciledRooms.size();

            String reviewStatus = switch (verdict) {
                case "corrigido" -> "corrected";
                case "confirmado" -> "confirmed";
                default -> "confirmed";
            };

            // Confidence reconciliada: média dos confidences dos rooms reconciliados,
            // ou a do worker se não houver rooms detalhados.
            double reconciledConfidence = computeReconciledConfidence(reconciledRooms, cv.confidence());

            // Geometria reconciliada: prioriza boxes do Claude quando há correção,
            // mantém os do worker quando confirmado.
            List<Map<String, Object>> reconciledGeometry = reconcileGeometry(root, cv, reviewStatus);
            Map<String, Object> reconciledScaleInfo = cv.scaleInfo() != null ? cv.scaleInfo() : Map.of();

            auditReview(userId, userEmail, plantaId, reviewStatus, correctionsSummary,
                    verdict.equals("corrigido") ? totalArea : null);
            auditGeometryProvenance(userId, userEmail, plantaId, reconciledGeometry);

            log.info("RECONCILIAÇÃO: verdict={} | area_worker={} area_claude={} rooms={} geometry={}",
                    verdict, cv.areaM2(), totalArea, roomsCount, reconciledGeometry.size());

            return new ReconciledResult(
                    totalArea,
                    roomsCount,
                    cv.wallLengthM(),      // wall_length não é revisado pelo Claude neste momento
                    cv.openings(),         // openings também mantido do worker
                    reconciledConfidence,
                    cv.boxesJson(),        // boxes originais do worker (visualização)
                    reconciledRooms,
                    reconciledGeometry,
                    reconciledScaleInfo,
                    reviewStatus,
                    correctionsSummary
            );

        } catch (Exception e) {
            log.warn("RECONCILIAÇÃO: erro ao processar resposta Claude: {} — seguindo com worker.", e.getMessage());
            auditReview(userId, userEmail, plantaId, "skipped", "parse_error: " + safe(e.getMessage()), null);
            return fromWorker(cv, "skipped", null);
        }
    }

    /**
     * Converte CvResult direto em ReconciledResult quando a revisão é pulada.
     */
    private ReconciledResult fromWorker(ComputerVisionClient.CvResult cv, String status, String summary) {
        return new ReconciledResult(
                cv.areaM2(),
                cv.roomsCount(),
                cv.wallLengthM(),
                cv.openings(),
                cv.confidence(),
                cv.boxesJson(),
                cv.roomsDetail() != null ? cv.roomsDetail() : List.of(),
                cv.roomsGeometry() != null ? cv.roomsGeometry() : List.of(),
                cv.scaleInfo() != null ? cv.scaleInfo() : Map.of(),
                status,
                summary
        );
    }

    /**
     * Tenta fazer parse da resposta do Claude como JSON.
     * A resposta pode vir envolta em markdown code fences — strip antes de parsear.
     */
    private JsonNode parseClaudeResponse(String raw) {
        String cleaned = raw.strip();
        // Strip markdown code fences se presentes
        if (cleaned.startsWith("```")) {
            int firstNewline = cleaned.indexOf('\n');
            int lastFence = cleaned.lastIndexOf("```");
            if (firstNewline > 0 && lastFence > firstNewline) {
                cleaned = cleaned.substring(firstNewline + 1, lastFence).strip();
            }
        }
        try {
            return objectMapper.readTree(cleaned);
        } catch (Exception e) {
            log.warn("RECONCILIAÇÃO: JSON inválido na resposta Claude ({} chars): {}",
                    cleaned.length(), safe(cleaned));
            return null;
        }
    }

    /**
     * Reconcilia a lista de rooms: usa os dados do Claude quando disponíveis,
     * mantém os do worker para rooms não mencionados.
     */
    private List<RoomDetail> reconcileRooms(JsonNode claudeRoot, ComputerVisionClient.CvResult cv) {
        JsonNode roomsNode = claudeRoot.path("rooms");
        if (!roomsNode.isArray() || roomsNode.isEmpty()) {
            return cv.roomsDetail() != null ? cv.roomsDetail() : List.of();
        }

        List<RoomDetail> result = new ArrayList<>();
        List<RoomDetail> workerRooms = cv.roomsDetail() != null ? cv.roomsDetail() : List.of();

        for (JsonNode roomNode : roomsNode) {
            String action = roomNode.path("action").asText("confirmed");
            if ("removed".equals(action)) {
                continue; // Claude removeu este cômodo
            }

            String name = roomNode.path("name").asText("Ambiente");
            double area = roomNode.path("area_m2").asDouble(0);
            double conf = roomNode.path("confidence").asDouble(0.85);

            if (area <= 0) {
                // Área inválida do Claude — tenta manter a do worker se houver match
                int matchIdx = roomNode.path("match_index").asInt(-1);
                if (matchIdx >= 0 && matchIdx < workerRooms.size()) {
                    area = workerRooms.get(matchIdx).areaM2();
                }
            }

            if (area > 0) {
                result.add(new RoomDetail(name, area, conf));
            }
        }

        // Se Claude retornou lista vazia ou inválida, mantém worker
        if (result.isEmpty() && !workerRooms.isEmpty()) {
            return workerRooms;
        }

        return result;
    }

    /**
     * Confiança reconciliada: média ponderada dos confidences individuais,
     * ou fallback para a confiança global do worker.
     */
    private double computeReconciledConfidence(List<RoomDetail> rooms, double workerConfidence) {
        if (rooms == null || rooms.isEmpty()) {
            return workerConfidence;
        }
        double sum = 0;
        for (RoomDetail r : rooms) {
            sum += r.confidence();
        }
        double avg = sum / rooms.size();
        // Média entre a confiança média dos rooms e a do worker global
        return Math.min(0.99, (avg + workerConfidence) / 2.0);
    }

    /**
     * Registra evento de auditoria da revisão por IA.
     */
    private void auditReview(Long userId, String userEmail, Long plantaId,
                             String reviewStatus, String correctionsSummary, Double correctedArea) {
        String details = "plantaId=" + plantaId
                + ",review_status=" + reviewStatus
                + (correctionsSummary != null ? ",corrections=" + safe(correctionsSummary) : "")
                + (correctedArea != null ? ",corrected_area=" + correctedArea : "");
        auditService.logEvent("ANALYSIS_AI_REVIEW", "INFO", userId, userEmail,
                "/api/analises", "AI_REVIEW", details, true);
    }

    /**
     * Reconcilia a geometria dos ambientes: quando o Claude corrige (review_status="corrected"),
     * prioriza os boxes retornados por ele; quando confirmado, mantém os do worker.
     * Retorna lista de mapas com {id, name, type, area_m2, confidence, source, box:{x,y,w,h}, polygon}.
     */
    private List<Map<String, Object>> reconcileGeometry(JsonNode claudeRoot,
                                                         ComputerVisionClient.CvResult cv,
                                                         String reviewStatus) {
        List<Map<String, Object>> workerGeom = cv.roomsGeometry() != null ? cv.roomsGeometry() : List.of();

        // Se Claude não corrigiu ou não retornou rooms com geometria, usa worker puro
        if (!"corrected".equals(reviewStatus)) {
            return workerGeom;
        }

        JsonNode claudeRooms = claudeRoot.path("rooms");
        if (!claudeRooms.isArray() || claudeRooms.isEmpty()) {
            return workerGeom;
        }

        List<Map<String, Object>> result = new ArrayList<>();
        int idx = 0;
        for (JsonNode roomNode : claudeRooms) {
            String action = roomNode.path("action").asText("confirmed");
            if ("removed".equals(action)) {
                continue;
            }

            Map<String, Object> geom = new HashMap<>();
            geom.put("id", idx);
            geom.put("name", roomNode.path("name").asText("Ambiente " + (idx + 1)));
            geom.put("type", roomNode.path("type").asText(null));
            geom.put("area_m2", roomNode.path("area_m2").asDouble(0));
            geom.put("confidence", roomNode.path("confidence").asDouble(0.85));

            // Se Claude retornou box próprio, usa; senão tenta match pelo match_index
            JsonNode boxNode = roomNode.path("box");
            if (boxNode.isObject() && boxNode.has("x")) {
                Map<String, Object> box = new HashMap<>();
                box.put("x", boxNode.path("x").asDouble(0));
                box.put("y", boxNode.path("y").asDouble(0));
                box.put("w", boxNode.path("w").asDouble(0));
                box.put("h", boxNode.path("h").asDouble(0));
                geom.put("box", box);
                geom.put("source", "claude");
            } else {
                int matchIdx = roomNode.path("match_index").asInt(-1);
                if (matchIdx >= 0 && matchIdx < workerGeom.size()) {
                    geom.put("box", workerGeom.get(matchIdx).get("box"));
                    geom.put("source", "worker");
                } else {
                    geom.put("box", null);
                    geom.put("source", "claude");
                }
            }

            geom.put("polygon", null);
            result.add(geom);
            idx++;
        }

        // Se Claude não produziu geometria válida, fallback para worker
        if (result.isEmpty() && !workerGeom.isEmpty()) {
            return workerGeom;
        }

        return result;
    }

    /**
     * Registra auditoria de proveniência da geometria reconciliada:
     * quantos rooms vieram do worker vs do Claude.
     */
    private void auditGeometryProvenance(Long userId, String userEmail, Long plantaId,
                                          List<Map<String, Object>> geometry) {
        if (geometry == null || geometry.isEmpty()) {
            return;
        }
        long fromWorker = geometry.stream()
                .filter(g -> "worker".equals(g.get("source")))
                .count();
        long fromClaude = geometry.stream()
                .filter(g -> "claude".equals(g.get("source")))
                .count();
        String details = "plantaId=" + plantaId
                + ",total_rooms=" + geometry.size()
                + ",from_worker=" + fromWorker
                + ",from_claude=" + fromClaude;
        auditService.logEvent("ANALYSIS_GEOMETRY_PROVENANCE", "INFO", userId, userEmail,
                "/api/analises", "GEOMETRY_RECONCILE", details, true);
    }

    private String safe(String s) {
        if (s == null) return "";
        return s.length() > 200 ? s.substring(0, 200) : s;
    }
}