package br.com.traco.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * Wraps the auto-configured DataSource with RlsDataSourceWrapper AFTER creation.
 *
 * This avoids circular dependencies because:
 * - It does NOT define a new DataSource bean
 * - It does NOT depend on repositories or interceptors at construction time
 * - It only wraps existing DataSource beans as they are created by Spring Boot
 *
 * The RlsDataSourceWrapper reads from ThreadLocal (set by JwtAuthFilter),
 * so it has no compile-time dependency on JPA entities or repositories.
 */
@Component
public class RlsDataSourcePostProcessor implements BeanPostProcessor {

    private static final Logger log = LoggerFactory.getLogger(RlsDataSourcePostProcessor.class);

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (bean instanceof DataSource ds && !(ds instanceof RlsDataSourceWrapper)) {
            log.info("Wrapping DataSource '{}' with RLS context injection", beanName);
            return new RlsDataSourceWrapper(ds);
        }
        return bean;
    }
}