package br.com.traco.api.security;

import br.com.traco.api.config.RlsContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);
    private static final String COOKIE_NAME = "traco_token";
    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);
        log.info("JWT_FILTER: uri={}, tokenPresent={}, tokenLen={}",
                request.getRequestURI(), token != null, token != null ? token.length() : 0);

        try {
            boolean valid = token != null && jwtService.isValid(token);
            log.info("JWT_FILTER: isValid={}, authAlreadySet={}",
                    valid, SecurityContextHolder.getContext().getAuthentication() != null);

            if (valid && SecurityContextHolder.getContext().getAuthentication() == null) {
                String email = jwtService.extractEmail(token);
                Long userId = jwtService.extractUserId(token);
                String role = jwtService.extractRole(token);

                // Define contexto RLS a partir dos claims do JWT — SEM consulta ao banco.
                // O role vem do claim "role" do token (default "engenheiro" se ausente).
                // Para o filtro, basta ter userId + email + role para que SET LOCAL funcione
                // nas queries subsequentes dentro de transação.
                if (email != null && !email.isBlank()) {
                    RlsContext.set(userId, role, email.toLowerCase().trim());
                }

                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(email, null, List.of());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
            filterChain.doFilter(request, response);
        } finally {
            // Limpa contexto RLS após o request completo para evitar vazamento
            // em threads reutilizadas pelo servlet container.
            RlsContext.clear();
        }
    }

    private String extractToken(HttpServletRequest request) {
        // 1. Tenta pegar do Header Authorization (compatibilidade com testes/clients antigos)
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }

        // 2. Tenta pegar do Cookie httpOnly (novo fluxo de login web)
        if (request.getCookies() != null) {
            return Arrays.stream(request.getCookies())
                    .filter(c -> COOKIE_NAME.equals(c.getName()))
                    .map(Cookie::getValue)
                    .findFirst()
                    .orElse(null);
        }

        return null;
    }
}