package br.com.traco.api.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Serviço de auditoria para registrar eventos de segurança e ações críticas.
 *
 * REGRAS DE SEGURANÇA:
 * - NUNCA logar senhas, tokens JWT, ou dados sensíveis em texto claro no campo details.
 * - IPs são armazenados mas devem ser anonimizados em produção (LGPD).
 *
 * IMPLEMENTAÇÃO RLS + REQUIRES_NEW:
 * O INSERT é feito via função PostgreSQL SECURITY DEFINER (insert_audit_log),
 * que roda com privilégios do owner (postgres) e bypassa RLS de forma segura.
 *
 * A transação é aberta PROGRAMATICAMENTE via TransactionTemplate com
 * PROPAGATION_REQUIRES_NEW para garantir que o audit_log persista mesmo
 * se a transação principal do caller sofrer rollback (ex: login com senha errada).
 * A anotação @Transactional(REQUIRES_NEW) não funcionava corretamente neste
 * cenário devido ao proxy do Spring — TransactionTemplate é mais confiável.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    @PersistenceContext
    private EntityManager entityManager;

    private final TransactionTemplate txTemplate;

    public AuditService(PlatformTransactionManager transactionManager) {
        this.txTemplate = new TransactionTemplate(transactionManager);
        this.txTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Registra evento de auditoria em transação independente (REQUIRES_NEW)
     * usando função SECURITY DEFINER que bypassa RLS.
     */
    public void logEvent(String eventType, String severity, Long userId, String userEmail,
                         String resource, String action, String details, boolean success) {
        // Extrair IP e User-Agent ANTES de abrir a nova transação,
        // pois RequestContextHolder pode não estar disponível dentro dela.
        String ipAddress = null;
        String userAgent = null;
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpServletRequest request = attrs.getRequest();
            ipAddress = extractIp(request);
            userAgent = truncate(request.getHeader("User-Agent"), 500);
        }

        final String fIpAddress = ipAddress;
        final String fUserAgent = userAgent;

        try {
            txTemplate.executeWithoutResult(status -> {
                entityManager.createNativeQuery(
                        "SELECT insert_audit_log(:eventType, :severity, :userId, :userEmail, " +
                        ":ipAddress, :userAgent, :resource, :action, :details, :success)")
                        .setParameter("eventType", eventType)
                        .setParameter("severity", severity)
                        .setParameter("userId", userId)
                        .setParameter("userEmail", userEmail)
                        .setParameter("ipAddress", fIpAddress)
                        .setParameter("userAgent", fUserAgent)
                        .setParameter("resource", resource)
                        .setParameter("action", action)
                        .setParameter("details", sanitize(details))
                        .setParameter("success", success)
                        .getSingleResult();
            });
            log.debug("Audit logged: {} | user={} | success={}", eventType, userEmail, success);
        } catch (Exception e) {
            // Auditoria não deve quebrar o fluxo principal
            log.error("Failed to write audit log: {}", e.getMessage());
        }
    }

    // ── Métodos convenience ────────────────────────────────────────────────

    public void logLoginSuccess(Long userId, String email) {
        logEvent("LOGIN_SUCCESS", "INFO", userId, email, "/api/auth/login", "LOGIN", null, true);
    }

    public void logLoginFailure(String email, String reason) {
        logEvent("LOGIN_FAILURE", "WARN", null, email, "/api/auth/login", "LOGIN",
                "reason=" + reason, false);
    }

    public void logPlantaUploaded(Long userId, String email, Long plantaId, String filename) {
        logEvent("PLANTA_UPLOADED", "INFO", userId, email, "/api/plantas", "UPLOAD",
                "plantaId=" + plantaId + ",file=" + filename, true);
    }

    public void logPlantaUploadRejected(String email, String filename, String reason) {
        logEvent("PLANTA_UPLOAD_REJECTED", "WARN", null, email, "/api/plantas", "UPLOAD",
                "file=" + filename + ",reason=" + reason, false);
    }

    public void logAnalysisCompleted(Long userId, String email, Long analysisId, double cost) {
        logEvent("ANALYSIS_COMPLETED", "INFO", userId, email, "/api/analises", "PROCESS",
                "id=" + analysisId + ",cost=" + cost, true);
    }

    public void logAnalysisFailed(Long userId, String email, Long analysisId, String reason) {
        logEvent("ANALYSIS_FAILED", "ERROR", userId, email, "/api/analises", "PROCESS",
                "id=" + analysisId + ",reason=" + reason, false);
    }

    public void logDataAccess(Long userId, String email, String resource, String resourceId) {
        logEvent("DATA_ACCESS", "INFO", userId, email, resource, "READ",
                "id=" + resourceId, true);
    }

    // ── Utilitários ────────────────────────────────────────────────────────

    private String extractIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank()) {
            return ip.split(",")[0].trim();
        }
        ip = request.getHeader("X-Real-IP");
        if (ip != null && !ip.isBlank()) {
            return ip.trim();
        }
        return request.getRemoteAddr();
    }

    private String truncate(String value, int maxLen) {
        if (value == null) return null;
        return value.length() > maxLen ? value.substring(0, maxLen) : value;
    }

    private String sanitize(String details) {
        if (details == null) return null;
        return details.replaceAll("(?i)(password|token|secret|key)\\s*[=:]\\s*\\S+", "$1=***REDACTED***");
    }
}