package br.com.traco.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Rate limiting simples por IP (janela deslizante de 1 minuto)
 * aplicado apenas aos endpoints sensíveis: login, register e upload legado.
 * Em produção com balanceador, complementar com rate limit de edge (Cloudflare/Render).
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_PER_MINUTE = 10;
    private static final long WINDOW_MS = 60_000;

    private final Map<String, Queue<Long>> buckets = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        boolean sensitive =
                path.startsWith("/api/auth/login") ||
                path.startsWith("/api/auth/register") ||
                path.equals("/upload/") ||
                path.startsWith("/api/plantas/upload");
        return !sensitive;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String ip = request.getRemoteAddr();
        long now = System.currentTimeMillis();

        Queue<Long> bucket = buckets.computeIfAbsent(ip, k -> new ConcurrentLinkedQueue<>());
        bucket.removeIf(t -> now - t > WINDOW_MS);

        if (bucket.size() >= MAX_PER_MINUTE) {
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"detail\":\"Muitas tentativas em sequência. Aguarde 1 minuto.\"}");
            return;
        }
        bucket.add(now);

        // limpeza periódica do mapa para evitar crescimento ilimitado
        if (buckets.size() > 10_000) {
            buckets.entrySet().removeIf(e -> e.getValue().isEmpty());
        }

        filterChain.doFilter(request, response);
    }
}