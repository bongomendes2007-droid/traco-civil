package br.com.traco.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Configuração de processamento assíncrono com propagação de contexto RLS.
 *
 * O TaskDecorator copia o RlsContext (ThreadLocal) da thread que dispara
 * o @Async para a thread do executor, garantindo que operações de banco
 * dentro do método async tenham as variáveis de sessão PostgreSQL corretas.
 *
 * Sem isso, o AnalysisEngine.process() rodaria sem contexto RLS e qualquer
 * INSERT/UPDATE falharia com "violates row-level security policy".
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    private static final Logger log = LoggerFactory.getLogger(AsyncConfig.class);

    @Bean(name = "rlsAwareExecutor")
    public Executor rlsAwareExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(10);
        executor.setThreadNamePrefix("traco-async-");
        executor.setTaskDecorator(new RlsContextPropagator());
        executor.initialize();
        log.info("Async executor configured with RLS context propagation");
        return executor;
    }

    /**
     * Copia o RlsContext da thread caller para a thread async.
     */
    private static class RlsContextPropagator implements TaskDecorator {
        @Override
        public Runnable decorate(Runnable runnable) {
            // Capturar contexto na thread original (antes de submeter ao pool)
            RlsContext.RlsInfo context = RlsContext.get();
            return () -> {
                try {
                    // Restaurar contexto na thread async
                    if (context != null) {
                        RlsContext.set(context.userId(), context.role(), context.email());
                        log.debug("RLS context propagated to async thread: userId={}", context.userId());
                    } else {
                        RlsContext.clear();
                        log.debug("No RLS context to propagate to async thread");
                    }
                    runnable.run();
                } finally {
                    // Limpar para evitar vazamento em threads reutilizadas do pool
                    RlsContext.clear();
                }
            };
        }
    }
}