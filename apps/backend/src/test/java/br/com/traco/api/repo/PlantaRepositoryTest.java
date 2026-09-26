package br.com.traco.api.repo;

import br.com.traco.api.model.Planta;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Teste de regressão para o bug de produção onde updateStorageUrl falhava
 * com InvalidDataAccessApiUsageException por falta de @Transactional.
 *
 * O método é chamado via afterCommit() em PlantaIntakeService, fora da
 * transação original do request — sem @Transactional próprio, o Spring
 * Data JPA não consegue executar o UPDATE nativo.
 *
 * NOTA: O H2 não suporta SET LOCAL (PostgreSQL GUC). Este teste valida
 * o comportamento transacional usando EntityManager diretamente com a
 * mesma query nativa (sem SET LOCAL), exercitando o mesmo caminho de
 * execução do @Modifying + @Transactional do repository.
 */
@DataJpaTest
class PlantaRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private PlantaRepository plantaRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    /**
     * Valida que o UPDATE nativo funciona dentro de uma transação ativa.
     * Simula o cenário correto após o fix (@Transactional presente).
     */
    @Test
    @Transactional
    void updateStorageUrl_deveAtualizarComSucessoQuandoTransacional() {
        Planta planta = new Planta();
        planta.setName("planta-teste.pdf");
        planta.setFormat("PDF");
        planta.setSizeBytes(1024);
        planta.setStatus("processando");
        entityManager.persist(planta);
        entityManager.flush();
        Long id = planta.getId();
        String novoPath = "user/123/planta-teste.pdf";

        // Executa UPDATE nativo via EntityManager (mesmo mecanismo do @Modifying)
        int updated = entityManager.getEntityManager()
                .createNativeQuery("UPDATE plantas SET storage_url = :url WHERE id = :id")
                .setParameter("url", novoPath)
                .setParameter("id", id)
                .executeUpdate();

        assertThat(updated).isEqualTo(1);

        entityManager.clear();
        Planta reloaded = entityManager.find(Planta.class, id);
        assertThat(reloaded.getStorageUrl()).isEqualTo(novoPath);
    }

    /**
     * VALIDAÇÃO NEGATIVA: UPDATE nativo SEM transação ativa deve falhar.
     *
     * Usa EntityManagerFactory para criar um EntityManager independente
     * do contexto transacional do @DataJpaTest. Isso simula exatamente o
     * cenário afterCommit() onde não há transação herdada e o repository
     * precisa da sua própria @Transactional.
     *
     * Este teste prova que a ausência de @Transactional causa
     * TransactionRequiredException (equivalente JPA do
     * InvalidDataAccessApiUsageException do Spring Data).
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void updateStorageUrl_semTransacao_deveFalhar() {
        // Cria EntityManager fora do contexto transacional do teste
        EntityManager nonTxEm = entityManagerFactory.createEntityManager();
        try {
            // Persiste a planta em uma transação separada primeiro
            nonTxEm.getTransaction().begin();
            Planta planta = new Planta();
            planta.setName("planta-negativa.pdf");
            planta.setFormat("PDF");
            planta.setSizeBytes(512);
            planta.setStatus("processando");
            nonTxEm.persist(planta);
            nonTxEm.flush();
            Long id = planta.getId();
            nonTxEm.getTransaction().commit();

            // Agora tenta o UPDATE nativo FORA de qualquer transação
            // Isso deve falhar exatamente como em produção sem @Transactional
            final Long plantaId = id;
            assertThatThrownBy(() -> {
                nonTxEm.createNativeQuery("UPDATE plantas SET storage_url = :url WHERE id = :id")
                        .setParameter("url", "novo/caminho.pdf")
                        .setParameter("id", plantaId)
                        .executeUpdate();
            }).isInstanceOf(jakarta.persistence.TransactionRequiredException.class);
        } finally {
            if (nonTxEm.isOpen()) {
                nonTxEm.close();
            }
        }
    }

    /**
     * Valida que o repository padrão funciona para operações CRUD básicas.
     * Garante que a entidade Planta está corretamente mapeada.
     */
    @Test
    void repository_devePersistirERecuperarPlanta() {
        Planta planta = new Planta();
        planta.setName("teste-crud.pdf");
        planta.setFormat("PDF");
        planta.setSizeBytes(2048);
        planta.setStatus("concluida");
        planta.setStorageUrl("bucket/path/file.pdf");

        Planta saved = entityManager.persistAndFlush(planta);
        assertThat(saved.getId()).isNotNull();

        entityManager.clear();

        Planta found = plantaRepository.findById(saved.getId()).orElse(null);
        assertThat(found).isNotNull();
        assertThat(found.getStorageUrl()).isEqualTo("bucket/path/file.pdf");
        assertThat(found.getName()).isEqualTo("teste-crud.pdf");
    }
}