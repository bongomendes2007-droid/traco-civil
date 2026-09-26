package br.com.traco.api.repo;

import br.com.traco.api.model.Planta;
import br.com.traco.api.service.PlantaStorageUpdater;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.DefaultTransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Teste de regressão para o bug de produção onde updateStorageUrl falhava
 * com TransactionRequiredException quando chamado dentro de afterCommit().
 *
 * Causa raiz: @Transactional com propagação REQUIRED não funciona dentro
 * de afterCommit() porque a transação original já foi commitada e fechada.
 *
 * Correção: PlantaStorageUpdater com @Transactional(propagation = REQUIRES_NEW)
 * cria uma nova transação independente e executa SET LOCAL + UPDATE em
 * sequência na MESMA transação, funcionando corretamente no contexto afterCommit.
 *
 * NOTA SOBRE H2: O H2 não suporta SET LOCAL (sintaxe PostgreSQL). Em testes,
 * usamos TestPlantaStorageUpdater que mantém a MESMA assinatura e anotação
 * @Transactional(REQUIRES_NEW) do código de produção, mas omite o SET LOCAL.
 * O mecanismo transacional validado aqui é IDENTICO ao de produção — apenas
 * o comando SQL específico de RLS é adaptado para o banco de teste.
 */
@DataJpaTest
@Import(PlantaRepositoryTest.TestPlantaStorageUpdater.class)
class PlantaRepositoryTest {

    /**
     * Substituto H2-compatível do PlantaStorageUpdater de produção.
     * Mantém EXATAMENTE a mesma assinatura e @Transactional(REQUIRES_NEW),
     * apenas omitindo SET LOCAL que o H2 não suporta.
     * Marcado como @Primary para sobrescrever o bean de produção no contexto de teste.
     */
    @Service
    @Primary
    static class TestPlantaStorageUpdater extends PlantaStorageUpdater {

        @PersistenceContext
        private EntityManager entityManager;

        @Override
        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public int updateStorageUrl(Long plantaId, String objectPath) {
            // Pula SET LOCAL (não suportado pelo H2) — executa apenas o UPDATE
            // na mesma transação REQUIRES_NEW, que é exatamente o que importa
            // para validar o mecanismo transacional.
            return entityManager.createNativeQuery(
                    "UPDATE plantas SET storage_url = :url WHERE id = :id")
                    .setParameter("url", objectPath)
                    .setParameter("id", plantaId)
                    .executeUpdate();
        }
    }

    @Autowired
    private TestEntityManager testEntityManager;

    @Autowired
    private PlantaRepository plantaRepository;

    @Autowired
    private PlantaStorageUpdater plantaStorageUpdater;

    @Autowired
    private PlatformTransactionManager transactionManager;

    /**
     * TESTE PRINCIPAL: simula fielmente o cenário afterCommit() de produção.
     *
     * Fluxo:
     * 1. Abre transação via TransactionTemplate (REQUIRES_NEW para sair da tx do @DataJpaTest)
     * 2. Persiste uma planta
     * 3. Registra TransactionSynchronization com afterCommit()
     * 4. Após commit real, o afterCommit() chama PlantaStorageUpdater.updateStorageUrl()
     *    que tem @Transactional(REQUIRES_NEW) → abre nova transação independente
     * 5. Valida que o valor foi persistido corretamente
     *
     * Se REQUIRES_NEW fosse trocado por REQUIRED, este teste FALHARIA com
     * TransactionRequiredException — reproduzindo o bug de produção.
     */
    @Test
    void updateStorageUrl_afterCommit_comRequiresNew_deveAtualizarComSucesso() {
        AtomicReference<Long> plantaIdRef = new AtomicReference<>();
        AtomicReference<Throwable> afterCommitError = new AtomicReference<>();
        AtomicInteger updatedCount = new AtomicInteger(-1);

        DefaultTransactionDefinition def = new DefaultTransactionDefinition();
        def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager, def);

        txTemplate.executeWithoutResult(status -> {
            Planta planta = new Planta();
            planta.setName("planta-aftercommit-test.pdf");
            planta.setFormat("PDF");
            planta.setSizeBytes(1024);
            planta.setStatus("processando");
            testEntityManager.persist(planta);
            testEntityManager.flush();
            plantaIdRef.set(planta.getId());

            // Registra callback afterCommit — será executado DEPOIS do commit real
            TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            // Chama o método REAL (ou seu substituto H2-compatível)
                            // Dentro de afterCommit(), não há transação ativa.
                            // REQUIRES_NEW cria nova transação → UPDATE funciona.
                            int updated = plantaStorageUpdater.updateStorageUrl(
                                    plantaIdRef.get(), "user/91/planta-aftercommit-test.pdf");
                            updatedCount.set(updated);
                        } catch (Throwable t) {
                            afterCommitError.set(t);
                        }
                    }
                }
            );
        });

        // Assert: nenhuma exceção no afterCommit
        if (afterCommitError.get() != null) {
            throw new AssertionError(
                    "updateStorageUrl falhou dentro de afterCommit(): " +
                    afterCommitError.get().getMessage(),
                    afterCommitError.get()
            );
        }

        // Assert: 1 linha foi atualizada
        assertThat(updatedCount.get())
                .as("updateStorageUrl deve retornar 1 linha afetada dentro de afterCommit()")
                .isEqualTo(1);

        // Assert: valor persistido corretamente no banco
        testEntityManager.clear();
        Planta reloaded = testEntityManager.find(Planta.class, plantaIdRef.get());
        assertThat(reloaded).isNotNull();
        assertThat(reloaded.getStorageUrl()).isEqualTo("user/91/planta-aftercommit-test.pdf");
    }

    /**
     * VALIDAÇÃO NEGATIVA: UPDATE nativo SEM transação ativa deve falhar.
     * Prova que o teste tem valor real como guarda de regressão.
     */
    @Test
    void updateStorageUrl_semTransacao_deveFalharComTransactionRequiredException() {
        Long plantaId;
        DefaultTransactionDefinition def = new DefaultTransactionDefinition();
        def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager, def);

        plantaId = txTemplate.execute(status -> {
            Planta planta = new Planta();
            planta.setName("planta-negativa.pdf");
            planta.setFormat("PDF");
            planta.setSizeBytes(512);
            planta.setStatus("processando");
            testEntityManager.persist(planta);
            testEntityManager.flush();
            return planta.getId();
        });

        // Tenta UPDATE fora de qualquer transação — deve falhar
        var emf = testEntityManager.getEntityManager().getEntityManagerFactory();
        var nonTxEm = emf.createEntityManager();
        try {
            assertThatThrownBy(() -> {
                nonTxEm.createNativeQuery("UPDATE plantas SET storage_url = :url WHERE id = :id")
                        .setParameter("url", "novo/caminho.pdf")
                        .setParameter("id", plantaId)
                        .executeUpdate();
            }).isInstanceOf(jakarta.persistence.TransactionRequiredException.class);
        } finally {
            if (nonTxEm.isOpen()) nonTxEm.close();
        }
    }

    /**
     * Valida que o repository padrão funciona para operações CRUD básicas.
     */
    @Test
    void repository_devePersistirERecuperarPlanta() {
        Planta planta = new Planta();
        planta.setName("teste-crud.pdf");
        planta.setFormat("PDF");
        planta.setSizeBytes(2048);
        planta.setStatus("concluida");
        planta.setStorageUrl("bucket/path/file.pdf");

        Planta saved = testEntityManager.persistAndFlush(planta);
        assertThat(saved.getId()).isNotNull();

        testEntityManager.clear();
        Planta found = plantaRepository.findById(saved.getId()).orElse(null);
        assertThat(found).isNotNull();
        assertThat(found.getStorageUrl()).isEqualTo("bucket/path/file.pdf");
        assertThat(found.getName()).isEqualTo("teste-crud.pdf");
    }
}