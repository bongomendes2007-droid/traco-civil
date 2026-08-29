package br.com.traco.api.config;

/**
 * ThreadLocal holder for RLS (Row Level Security) context variables.
 *
 * Stores the authenticated user's ID, role, and optionally email so that any
 * JDBC Connection obtained during this request (including REQUIRES_NEW
 * transactions) can apply SET LOCAL before executing queries.
 *
 * The email field is used during public endpoints (like /register) where
 * the user doesn't have an ID yet but needs to be able to SELECT their
 * own row via RETURNING clause.
 *
 * Lifecycle:
 * - Set by RlsContextInterceptor.preHandle() or JwtAuthFilter (authenticated)
 * - Set by AuthService.register() before saving (public registration)
 * - Read by RlsDataSourceWrapper when obtaining a Connection from DataSource
 * - Cleared by RlsContextInterceptor.afterCompletion() to prevent leaks
 */
public final class RlsContext {

    private static final ThreadLocal<RlsInfo> CONTEXT = new ThreadLocal<>();

    public record RlsInfo(Long userId, String role, String email) {
        public RlsInfo(Long userId, String role) {
            this(userId, role, null);
        }
    }

    private RlsContext() {}

    public static void set(Long userId, String role) {
        CONTEXT.set(new RlsInfo(userId, role, null));
    }

    public static void set(Long userId, String role, String email) {
        CONTEXT.set(new RlsInfo(userId, role, email));
    }

    public static void setEmail(String email) {
        RlsInfo current = CONTEXT.get();
        if (current != null) {
            CONTEXT.set(new RlsInfo(current.userId(), current.role(), email));
        } else {
            CONTEXT.set(new RlsInfo(null, null, email));
        }
    }

    public static RlsInfo get() {
        return CONTEXT.get();
    }

    public static void clear() {
        CONTEXT.remove();
    }

    public static boolean isSet() {
        return CONTEXT.get() != null;
    }
}