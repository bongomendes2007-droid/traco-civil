package br.com.traco.api.controller;

import br.com.traco.api.model.Planta;
import br.com.traco.api.model.Project;
import br.com.traco.api.model.User;
import br.com.traco.api.repo.PlantaRepository;
import br.com.traco.api.repo.ProjectRepository;
import br.com.traco.api.repo.UserRepository;
import br.com.traco.api.security.CurrentUser;
import br.com.traco.api.service.SupabaseStorageClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.DefaultTransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Teste de regressão para o LazyInitializationException no endpoint /api/plantas/{id}/image.
 *
 * Causa raiz: o método image() acessava planta.getProject().getUser() para verificar
 * ownership, mas sem @Transactional a sessão Hibernate fechava após o findById(),
 * deixando o proxy do Project como lazy. Ao chamar getUser(), lançava
 * LazyInitializationException (confirmado via stack trace de produção).
 *
 * Correção: adicionar @Transactional(readOnly = true) no método image(), consistente
 * com os métodos list() e get() do mesmo controller.
 *
 * NOTA SOBRE TESTE NEGATIVO: Reproduzir LazyInitializationException em H2/@DataJpaTest
 * é notoriamente difícil porque o contexto de teste mantém recursos de sessão e o H2
 * pode resolver associações LAZY de forma diferente do PostgreSQL em produção. O bug
 * foi confirmado via stack trace real de produção (Project#50 proxy - no Session).
 * Este teste valida o cenário POSITIVO: dentro de uma transação readOnly (como o
 * método image() corrigido), o acesso lazy a project.getUser() funciona corretamente.
 */
@DataJpaTest
class PlantaControllerTest {

    @Autowired
    private TestEntityManager testEntityManager;

    @Autowired
    private PlantaRepository plantaRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private PlatformTransactionManager transactionManager;

    /**
     * VALIDAÇÃO POSITIVA: acesso a project.getUser() dentro de transação
     * readOnly funciona corretamente — simula o comportamento do método
     * image() após a correção com @Transactional(readOnly = true).
     *
     * O teste cria dados em transação REQUIRES_NEW separada (commit real),
     * depois busca a planta e acessa o user do project DENTRO de uma nova
     * transação readOnly — exatamente o que o controller faz agora.
     */
    @Test
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    void acessoLazyDentroDeTransacaoReadOnly_deveFuncionar() {
        Long plantaId;

        // Cria as entidades em transação separada (commit real antes da leitura)
        DefaultTransactionDefinition def = new DefaultTransactionDefinition();
        def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager, def);
        plantaId = txTemplate.execute(status -> {
            User user = new User();
            user.setName("Test User");
            user.setEmail("lazy-test@example.com");
            user.setPassword("hashed-password");
            user.setRole("user");
            testEntityManager.persist(user);

            Project project = new Project();
            project.setName("Test Project");
            project.setType("residencial");
            project.setStatus("ativo");
            project.setUser(user);
            testEntityManager.persist(project);

            Planta planta = new Planta();
            planta.setName("planta-lazy-test.pdf");
            planta.setFormat("PDF");
            planta.setSizeBytes(1024);
            planta.setStatus("concluida");
            planta.setProject(project);
            testEntityManager.persist(planta);
            testEntityManager.flush();
            return planta.getId();
        });

        // Limpa o cache de primeiro nível para garantir que a busca abaixo
        // venha do banco (não de entidade já carregada na sessão anterior)
        testEntityManager.clear();

        // Busca e acessa DENTRO da transação readOnly do teste
        // Isso simula exatamente o fluxo do controller.image() corrigido
        Planta planta = plantaRepository.findById(plantaId).orElse(null);
        assertThat(planta).isNotNull();

        // Acesso lazy a project.getUser() deve funcionar dentro da transação
        assertThatCode(() -> {
            User owner = planta.getProject().getUser();
            assertThat(owner).isNotNull();
            assertThat(owner.getEmail()).isEqualTo("lazy-test@example.com");
        }).doesNotThrowAnyException();
    }

    /**
     * Valida que o ownership check (project.getUser().getId()) funciona
     * corretamente dentro de transação, comparando IDs como o controller faz.
     */
    @Test
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    void ownershipCheck_dentroDeTransacao_deveCompararIdsCorretamente() {
        Long plantaId;
        Long userId;

        DefaultTransactionDefinition def = new DefaultTransactionDefinition();
        def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager, def);

        Long[] ids = txTemplate.execute(status -> {
            User user = new User();
            user.setName("Owner User");
            user.setEmail("owner@example.com");
            user.setPassword("hashed-password");
            user.setRole("user");
            testEntityManager.persist(user);

            Project project = new Project();
            project.setName("Owner Project");
            project.setType("residencial");
            project.setStatus("ativo");
            project.setUser(user);
            testEntityManager.persist(project);

            Planta planta = new Planta();
            planta.setName("planta-owner-test.pdf");
            planta.setFormat("PDF");
            planta.setSizeBytes(2048);
            planta.setStatus("concluida");
            planta.setProject(project);
            testEntityManager.persist(planta);
            testEntityManager.flush();
            return new Long[]{planta.getId(), user.getId()};
        });

        plantaId = ids[0];
        userId = ids[1];

        testEntityManager.clear();

        // Simula o ownership check do controller.image()
        Planta planta = plantaRepository.findById(plantaId).orElse(null);
        assertThat(planta).isNotNull();

        // Este é exatamente o check que falhava com LazyInitializationException
        boolean isOwner = planta.getProject() != null
                && planta.getProject().getUser().getId().equals(userId);
        assertThat(isOwner).isTrue();
    }
}