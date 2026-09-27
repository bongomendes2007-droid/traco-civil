package br.com.traco.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filtro global de logging de requisições HTTP para diagnóstico de produção.
 *
 * Registra início e fim de cada requisição /api/* com método, URI, status HTTP
 * e duração em ms. Se uma requisição travar no backend (nunca completar), o log
 * de conclusão nunca aparecerá — ausência desse log = hang no processamento.
 *
 * Registrado automaticamente pelo Spring como @Component + OncePerRequestFilter.
 * A ordem é definida em SecurityConfig (addFilterAfter jwtAuthFilter).
 */
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Aplica apenas a rotas /api/* — ignora health checks, H2 console, etc.
        String uri = request.getRequestURI();
        return !uri.startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String method = request.getMethod();
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        String fullUri = query != null ? uri + "?" + query : uri;

        long startNanos = System.nanoTime();
        log.info("REQUEST_START method={} uri={}", method, fullUri);

        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = (System.nanoTime() - startNanos) / 1_000_000;
            int status = response.getStatus();
            log.info("REQUEST_COMPLETED method={} uri={} status={} durationMs={}",
                    method, fullUri, status, durationMs);
        }
    }
}