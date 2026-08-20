package br.com.traco.api.service;

import br.com.traco.api.exception.ApiException;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Lockout temporário por e-mail: após 5 falhas em 5 minutos,
 * o login fica bloqueado (HTTP 423) — mitiga brute force / credential stuffing.
 */
@Service
public class LoginAttemptService {

    private static final int MAX_FAILURES = 5;
    private static final long LOCK_WINDOW_MS = 5 * 60_000;

    private final Map<String, Queue<Long>> failures = new ConcurrentHashMap<>();

    public void checkNotLocked(String email) {
        Queue<Long> queue = failures.get(email);
        if (queue == null) return;
        long now = System.currentTimeMillis();
        queue.removeIf(t -> now - t > LOCK_WINDOW_MS);
        if (queue.size() >= MAX_FAILURES) {
            throw new ApiException(
                    "Muitas tentativas inválidas. Conta bloqueada por 5 minutos.", 423);
        }
    }

    public void recordFailure(String email) {
        failures.computeIfAbsent(email, k -> new ConcurrentLinkedQueue<>())
                .add(System.currentTimeMillis());
    }

    public void reset(String email) {
        failures.remove(email);
    }
}