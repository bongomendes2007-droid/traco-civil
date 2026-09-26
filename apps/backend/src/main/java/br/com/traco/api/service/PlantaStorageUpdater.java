package br.com.traco.api.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Atualiza storage_url da planta dentro de uma transação REQUIRES_NEW,
 * executando SET LOCAL + UPDATE em sequência na MESMA transação.
 *
 * Chamado via afterCommit() do PlantaIntakeService — nesse ponto a
 * transação original já foi commitada e fechada, então REQUIRED não
 * funciona (TransactionRequiredException). REQUIRES_NEW cria uma
 * transação independente que funciona corretamente.
 *
 * SET LOCAL app.internal_storage_write = 'true' habilita a policy RLS
 * plantas_update_storage_url (V20260922_1) apenas para esta transação,
 * sem exigir app.current_user_id (que não está disponível em afterCommit).
 *
 * NOTA: Os dois comandos DEVEM rodar na mesma transação. Se fossem
 * métodos separados com @Transactional cada um, o SET LOCAL da primeira
 * chamada desapareceria antes da segunda rodar, e a policy RLS bloquearia
 * o UPDATE novamente.
 */
@Service
public class PlantaStorageUpdater {

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Atualiza storage_url da planta em transação independente (REQUIRES_NEW).
     * Executa SET LOCAL + UPDATE em sequência na mesma transação.
     *
     * @param plantaId ID da planta a atualizar
     * @param objectPath path do objeto no bucket Supabase Storage
     * @return número de linhas afetadas pelo UPDATE
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int updateStorageUrl(Long plantaId, String objectPath) {
        // 1. Habilita a policy RLS para esta transação
        entityManager.createNativeQuery("SET LOCAL app.internal_storage_write = 'true'")
                .executeUpdate();

        // 2. Atualiza storage_url na mesma transação (SET LOCAL ainda ativo)
        return entityManager.createNativeQuery(
                        "UPDATE plantas SET storage_url = :url WHERE id = :id")
                .setParameter("url", objectPath)
                .setParameter("id", plantaId)
                .executeUpdate();
    }
}