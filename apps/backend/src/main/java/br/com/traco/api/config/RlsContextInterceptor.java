package br.com.traco.api.config;

import br.com.traco.api.model.User;
import br.com.traco.api.repo.UserRepository;
import br.com.traco.api.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.sql.Connection;
import java.sql.Statement;
import javax.sql.DataSource;

/**
 * Interceptor que define variáveis de sessão PostgreSQL para RLS (Row Level Security).
 *
 * Executa SET LOCAL app.current_user_id e app.current_user_role no início de cada
 * request autenticado. SET LOCAL garante que as variáveis vivem apenas durante a
 * transação atual, evitando vazamento entre requests em connection pools (HikariCP).
 *
 * Para transações REQUIRES_NEW (ex: AuditService), este interceptor NÃO é invocado
 * novamente (é um HandlerInterceptor, não um AOP). A solução é o RlsConnectionWrapper
 * que intercepta toda obtenção de Connection do DataSource e aplica SET LOCAL
 * automaticamente — cobrindo tanto a transação principal quanto as isoladas.
 *
 * Este interceptor serve como fallback/documentação da intenção. A garantia real
 * está no RlsConnectionWrapper + ThreadLocal.
 */
@Component
public class RlsContextInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(RlsContextInterceptor.class);

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public RlsContextInterceptor(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // Extrair token e definir contexto RLS via ThreadLocal
        // O RlsConnectionWrapper lê este ThreadLocal ao obter qualquer Connection
        String token = extractToken(request);
        if (token != null && jwtService.isValid(token)) {
            try {
                Long userId = jwtService.extractUserId(token);
                String email = jwtService.extractEmail(token);

                // Buscar role do usuário
                String role = userRepository.findByEmail(email)
                        .map(User::getRole)
                        .orElse("engenheiro");

                RlsContext.set(userId, role);
                log.debug("RLS context set: userId={}, role={}", userId, role);
            } catch (Exception e) {
                log.warn("Failed to set RLS context: {}", e.getMessage());
                RlsContext.clear();
            }
        } else {
            RlsContext.clear();
        }

        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        // Limpar ThreadLocal para evitar vazamento em threads reutilizadas do pool
        RlsContext.clear();
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if ("traco_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}