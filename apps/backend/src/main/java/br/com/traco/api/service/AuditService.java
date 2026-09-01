package br.com.traco.api.service;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;

/**
 * Serviço de auditoria para registrar eventos de segurança e ações críticas.
 *
 * REGRAS DE SEGURANÇA:
 * - NUNCA logar senhas, tokens JWT, ou dados sensíveis em texto claro no campo details.
 * - IPs são armazenados mas devem ser anonimizados em produção (LGPD).
 *
 * IMPLEMENTAÇÃO RLS:
 * O INSERT é feito via função PostgreSQL SECURITY DEFINER (insert_audit_log),
 * que roda com privilégios do owner (postgres) e bypassa RLS de forma segura.
 *
 * CONEXÃO INDEPENDENTE (Opção D):
 * O audit usa uma conexão JDBC própria (fora do EntityManager/Spring TX) com
 * autoCommit=true. Isso garante que o INSERT persista mesmo quando o caller
 * faz rollback (ex: login com senha errada lança ApiException → Spring dá
 * rollback na transação principal, mas o audit já foi commitado separadamente).
 * O Supabase Transaction Pooler não suporta REQUIRES_NEW de forma confiável,
 * então esta abordagem de conexão independente é a alternativa correta.
 * A função SECURITY DEFINER não precisa de SET LOCAL / contexto RLS.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private static final String INSERT_AUDIT_SQL =
            "SELECT insert_audit_log(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    private final DataSource dataSource;

    /**
     * Injeta o DataSource RAW (não wrappeado pelo RlsDataSourceWrapper) para garantir
     * que a conexão de auditoria esteja 100% fora do contexto RLS/transacional do Spring.
     * O bean "rawDataSource" é registrado pelo RlsDataSourcePostProcessor antes do wrap.
     */
    public AuditService(@Qualifier("rawDataSource") DataSource dataSource) {
        this.dataSource = dataSource;
        log.info("AuditService DataSource class: {}", dataSource.getClass().getName());
    }

    /**
     * Registra evento de auditoria numa conexão JDBC independente (autoCommit=true),
     * fora da transação do caller. Persiste mesmo se o caller fizer rollback.
     * Best-effort: erros são logados mas não quebram o fluxo principal.
     */
    public void logEvent(String eventType, String severity, Long userId, String userEmail,
                         String resource, String action, String details, boolean success) {
        String ipAddress = null;
        String userAgent = null;
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpServletRequest request = attrs.getRequest();
            ipAddress = extractIp(request);
            userAgent = truncate(request.getHeader("User-Agent"), 500);
        }

        log.info("logEvent CHAMADO: action={} | email={} | success={}", action, userEmail, success);
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(INSERT_AUDIT_SQL)) {

            // autoCommit=true por padrão numa conexão nova do pool;
            // o INSERT é commitado imediatamente ao executar.
            ps.setString(1, eventType);
            ps.setString(2, severity);
            if (userId != null) {
                ps.setLong(3, userId);
            } else {
                ps.setNull(3, java.sql.Types.BIGINT);
            }
            ps.setString(4, userEmail);
            ps.setString(5, ipAddress);
            ps.setString(6, userAgent);
            ps.setString(7, resource);
            ps.setString(8, action);
            ps.setString(9, sanitize(details));
            ps.setBoolean(10, success);

            ps.execute();
            log.info("insert_audit_log EXECUTADO (conexão independente): action={} | email={}", action, userEmail);
        } catch (Exception e) {
            // Auditoria não deve quebrar o fluxo principal — stacktrace COMPLETO para debug
            log.error("Audit insert failed: action={} email={}", action, userEmail, e);
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