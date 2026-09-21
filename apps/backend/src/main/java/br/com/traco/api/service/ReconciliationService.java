package br.com.traco.api.service;

import br.com.traco.api.dto.RoomDetail;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
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

            auditReview(userId, userEmail, plantaId, reviewStatus, correctionsSummary,
                    verdict.equals("corrigido") ? totalArea : null);

            log.info("RECONCILIAÇÃO: verdict={} | area_worker={} area_claude={} rooms={}",
                    verdict, cv.areaM2(), totalArea, roomsCount);

            return new ReconciledResult(
                    totalArea,
                    roomsCount,
                    cv.wallLengthM(),      // wall_length não é revisado pelo Claude neste momento
                    cv.openings(),         // openings também mantido do worker
                    reconciledConfidence,
                    cv.boxesJson(),        // boxes originais do worker (visualização)
                    reconciledRooms,
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

    private String safe(String s) {
        if (s == null) return "";
        return s.length() > 200 ? s.substring(0, 200) : s;
    }
}