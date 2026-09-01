package br.com.traco.api.security;

import br.com.traco.api.config.RlsContext;
import br.com.traco.api.exception.ApiException;
import br.com.traco.api.model.User;
import br.com.traco.api.repo.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Optional;

@Component
public class CurrentUser {

    private static final Logger log = LoggerFactory.getLogger(CurrentUser.class);

    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public CurrentUser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Retorna userId e email diretamente dos claims do JWT (sem query ao banco).
     * Seguro para usar em qualquer ponto do request, inclusive fora de @Transactional.
     * O role retornado aqui é o default ("engenheiro") setado pelo JwtAuthFilter;
     * se precisar do role real do banco, use require() dentro de @Transactional.
     */
    public record TokenIdentity(Long userId, String email, String role) {}

    public TokenIdentity requireIdentity() {
        RlsContext.RlsInfo info = RlsContext.get();
        if (info == null || info.userId() == null || info.email() == null) {
            throw new ApiException("Não autenticado.", 401);
        }
        return new TokenIdentity(info.userId(), info.email(),
                info.role() != null ? info.role() : "engenheiro");
    }

    /**
     * Resolve a entidade User completa via banco de dados.
     * Aplica SET LOCAL explicitamente antes da query para contornar o timing issue
     * do RlsDataSourceWrapper (getConnection() pode ser chamado antes de autoCommit=false).
     */
    @Transactional(readOnly = true)
    public User require() {
        applyRlsInTransaction();
        return optional().orElseThrow(() -> new ApiException("Não autenticado.", 401));
    }

    @Transactional(readOnly = true)
    public Optional<User> optional() {
        applyRlsInTransaction();
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof String email)) {
            return Optional.empty();
        }
        return userRepository.findByEmail(email);
    }

    /**
     * Aplica SET LOCAL explicitamente dentro da transação ativa.
     * O RlsDataSourceWrapper pode pular o SET LOCAL se getConnection() for chamado
     * antes do proxy transacional ativar autoCommit=false. Este método garante que
     * as variáveis RLS estejam definidas ANTES de qualquer query sujeita a RLS.
     *
     * Segurança: usa exclusivamente SET LOCAL (nunca SET global). As variáveis são
     * automaticamente descartadas no COMMIT/ROLLBACK.
     */
    private void applyRlsInTransaction() {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            return;
        }
        RlsContext.RlsInfo info = RlsContext.get();
        if (info == null) return;
        try {
            if (info.userId() != null) {
                entityManager.createNativeQuery("SET LOCAL app.current_user_id = " + info.userId()).executeUpdate();
            }
            if (info.role() != null) {
                String safeRole = info.role().replace("'", "''");
                entityManager.createNativeQuery("SET LOCAL app.current_user_role = '" + safeRole + "'").executeUpdate();
            }
            if (info.email() != null) {
                String safeEmail = info.email().replace("'", "''");
                entityManager.createNativeQuery("SET LOCAL app.current_user_email = '" + safeEmail + "'").executeUpdate();
            }
        } catch (Exception e) {
            log.warn("Failed to apply RLS in CurrentUser: {}", e.getMessage());
        }
    }
}