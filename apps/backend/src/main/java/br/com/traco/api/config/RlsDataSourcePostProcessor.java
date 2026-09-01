package br.com.traco.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.beans.factory.support.RootBeanDefinition;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * Wraps the auto-configured DataSource with RlsDataSourceWrapper AFTER creation.
 *
 * Also registers the RAW (unwrapped) DataSource as a separate bean named
 * "rawDataSource" so that components needing to bypass RLS wrapping
 * (e.g., AuditService fire-and-forget inserts) can inject it directly.
 *
 * This avoids circular dependencies because:
 * - It does NOT define a new DataSource bean upfront
 * - It does NOT depend on repositories or interceptors at construction time
 * - It only wraps existing DataSource beans as they are created by Spring Boot
 *
 * The RlsDataSourceWrapper reads from ThreadLocal (set by JwtAuthFilter),
 * so it has no compile-time dependency on JPA entities or repositories.
 */
@Component
public class RlsDataSourcePostProcessor implements BeanPostProcessor, ApplicationContextAware {

    private static final Logger log = LoggerFactory.getLogger(RlsDataSourcePostProcessor.class);
    private static final String RAW_DS_BEAN_NAME = "rawDataSource";
    private boolean rawRegistered = false;
    private ApplicationContext ctx;

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        this.ctx = applicationContext;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (bean instanceof DataSource ds && !(ds instanceof RlsDataSourceWrapper)
                && !RAW_DS_BEAN_NAME.equals(beanName)) {
            // Register the unwrapped DataSource as "rawDataSource" before wrapping
            if (!rawRegistered && ctx != null && ctx.getAutowireCapableBeanFactory() instanceof BeanDefinitionRegistry reg) {
                RootBeanDefinition def = new RootBeanDefinition();
                def.setBeanClass(ds.getClass());
                def.setInstanceSupplier(() -> ds);
                def.setPrimary(false);
                reg.registerBeanDefinition(RAW_DS_BEAN_NAME, def);
                rawRegistered = true;
                log.info("Registered raw DataSource as bean '{}'", RAW_DS_BEAN_NAME);
            }
            log.info("Wrapping DataSource '{}' with RLS context injection", beanName);
            return new RlsDataSourceWrapper(ds);
        }
        return bean;
    }
}