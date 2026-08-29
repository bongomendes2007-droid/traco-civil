package br.com.traco.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuração central do RLS (Row Level Security) para Supabase.
 *
 * 1. Registra o RlsContextInterceptor para extrair userId/role do JWT
 *    e armazenar no ThreadLocal RlsContext no início de cada request.
 *
 * 2. O wrapping do DataSource é feito pelo RlsDataSourcePostProcessor
 *    (BeanPostProcessor), que evita dependência circular com EntityManagerFactory.
 *
 * O fluxo completo:
 *   Request → JwtAuthFilter (autentica) → RlsContextInterceptor (seta ThreadLocal)
 *   → Controller → Repository → HikariCP.getConnection() → RlsDataSourceWrapper
 *   → SET LOCAL → Query com RLS ativo
 *
 * Para REQUIRES_NEW:
 *   AuditService → nova transação → HikariCP.getConnection() (mesma thread)
 *   → RlsDataSourceWrapper lê ThreadLocal (ainda válido) → SET LOCAL na nova tx
 *   → audit_log INSERT funciona mesmo com rollback da tx principal
 */
@Configuration
public class RlsConfig implements WebMvcConfigurer {

    private final RlsContextInterceptor rlsContextInterceptor;

    public RlsConfig(RlsContextInterceptor rlsContextInterceptor) {
        this.rlsContextInterceptor = rlsContextInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Excluir endpoints públicos que não têm JWT (health check, login, register)
        registry.addInterceptor(rlsContextInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/auth/login", "/api/auth/register");
    }
}