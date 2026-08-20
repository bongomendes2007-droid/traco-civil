package br.com.traco.api.service;

import br.com.traco.api.model.AuditLog;
import br.com.traco.api.repo.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Serviço de auditoria para registrar eventos de segurança e ações críticas.
 *
 * REGRAS DE SEGURANÇA:
 * - NUNCA logar senhas, tokens JWT, ou dados sensíveis em texto claro no campo details.
 * - IPs são armazenados mas devem ser anonimizados em produção (LGPD).
 * - Este serviço usa Propagation.REQUIRES_NEW para garantir que o log seja gravado
 *   mesmo se a transação principal falhar (rollback).
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Registra um evento de auditoria.
     *
     * @param eventType Tipo do evento (ex: LOGIN_SUCCESS, LOGIN_FAILURE, PLANTA_UPLOADED)
     * @param severity Severidade: INFO, WARN, ERROR, CRITICAL
     * @param userId ID do usuário (null se não autenticado)
     * @param userEmail Email do usuário (null se não disponível)
     * @param resource Recurso acessado (ex: /api/plantas/upload, planta:123)
     * @param action Ação realizada (ex: UPLOAD, DELETE, ANALYZE)
     * @param details Detalhes adicionais (NUNCA incluir senhas/tokens)
     * @param success Se a ação foi bem-sucedida
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logEvent(String eventType, String severity, Long userId, String userEmail,
                         String resource, String action, String details, boolean success) {
        try {
            AuditLog entry = new AuditLog();
            entry.setEventType(eventType);
            entry.setSeverity(severity);
            entry.setUserId(userId);
            entry.setUserEmail(userEmail);
            entry.setResource(resource);
            entry.setAction(action);
            entry.setDetails(sanitize(details));
            entry.setSuccess(success);

            // Extrair IP e User-Agent do request atual (se disponível)
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                entry.setIpAddress(extractIp(request));
                entry.setUserAgent(truncate(request.getHeader("User-Agent"), 500));
            }

            auditLogRepository.save(entry);
            log.debug("Audit logged: {} | user={} | success={}", eventType, userEmail, success);
        } catch (Exception e) {
            // Auditoria não deve quebrar o fluxo principal
            log.error("Failed to write audit log: {}", e.getMessage());
        }
    }

    // Métodos convenience para eventos comuns

    public void logLoginSuccess(Long userId, String email) {
        logEvent("LOGIN_SUCCESS", "INFO", userId, email, "/api/auth/login", "LOGIN", null, true);
    }

    public void logLoginFailure(String email, String reason) {
        logEvent("LOGIN_FAILURE", "WARN", null, email, "/api/auth/login", "LOGIN",
                "reason=" + sanitize(reason), false);
    }

    public void logPlantaUploaded(Long userId, String email, Long plantaId, String filename) {
        logEvent("PLANTA_UPLOADED", "INFO", userId, email, "planta:" + plantaId, "UPLOAD",
                "filename=" + sanitize(filename), true);
    }

    public void logPlantaUploadRejected(String email, String filename, String reason) {
        logEvent("PLANTA_UPLOAD_REJECTED", "WARN", null, email, "/api/plantas/upload", "UPLOAD",
                "filename=" + sanitize(filename) + " | reason=" + sanitize(reason), false);
    }

    public void logAnalysisStarted(Long userId, String email, Long analysisId, Long plantaId) {
        logEvent("ANALYSIS_STARTED", "INFO", userId, email, "analysis:" + analysisId, "ANALYZE",
                "plantaId=" + plantaId, true);
    }

    public void logAnalysisCompleted(Long userId, String email, Long analysisId, double estimatedCost) {
        logEvent("ANALYSIS_COMPLETED", "INFO", userId, email, "analysis:" + analysisId, "ANALYZE",
                "estimatedCost=" + estimatedCost, true);
    }

    public void logAnalysisFailed(Long userId, String email, Long analysisId, String error) {
        logEvent("ANALYSIS_FAILED", "ERROR", userId, email, "analysis:" + analysisId, "ANALYZE",
                "error=" + sanitize(error), false);
    }

    public void logUnauthorizedAccess(String email, String resource) {
        logEvent("UNAUTHORIZED_ACCESS", "CRITICAL", null, email, resource, "ACCESS", null, false);
    }

    public void logRateLimited(String ip, String email) {
        logEvent("RATE_LIMITED", "WARN", null, email, "/api/auth/login", "LOGIN",
                "ip=" + anonymizeIp(ip), false);
    }

    // Helpers de segurança

    /**
     * Remove dados sensíveis acidentais do campo details.
     * NUNCA confie apenas nisso — o caller é responsável por não passar senhas/tokens.
     */
    private String sanitize(String input) {
        if (input == null) return null;
        // Remove padrões óbvios de secrets (JWT, passwords em query strings, etc.)
        String sanitized = input.replaceAll("(?i)(password|token|secret|jwt)=[^&\\s]+", "$1=[REDACTED]");
        return truncate(sanitized, 2000);
    }

    /**
     * Anonimiza IP para conformidade LGPD (mantém apenas os primeiros 2 octetos).
     * Ex: 192.168.1.100 -> 192.168.x.x
     */
    private String anonymizeIp(String ip) {
        if (ip == null || ip.isBlank()) return null;
        // IPv4
        if (ip.contains(".")) {
            String[] parts = ip.split("\\.");
            if (parts.length >= 2) {
                return parts[0] + "." + parts[1] + ".x.x";
            }
        }
        // IPv6 ou outro formato: retorna hash curto
        return "anon-" + Integer.toHexString(ip.hashCode());
    }

    /**
     * Extrai o IP real do cliente, considerando proxies (X-Forwarded-For).
     */
    private String extractIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            // Pega o primeiro IP da lista (cliente original)
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return null;
        return s.length() <= maxLen ? s : s.substring(0, maxLen);
    }
}