package br.com.traco.api.config;

import br.com.traco.api.model.Analysis;
import br.com.traco.api.model.Planta;
import br.com.traco.api.model.Project;
import br.com.traco.api.model.User;
import br.com.traco.api.repo.AnalysisRepository;
import br.com.traco.api.repo.PlantaRepository;
import br.com.traco.api.repo.ProjectRepository;
import br.com.traco.api.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cria o usuário demo + um projeto com análise concluída na primeira inicialização,
 * para que o frontend tenha dados reais sem cadastro manual.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final PlantaRepository plantaRepository;
    private final AnalysisRepository analysisRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository,
                      ProjectRepository projectRepository,
                      PlantaRepository plantaRepository,
                      AnalysisRepository analysisRepository,
                      PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.plantaRepository = plantaRepository;
        this.analysisRepository = analysisRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.existsByEmail("demo@tracocivil.com.br")) {
            return;
        }
        log.info("Seed inicial: criando usuário demo e dados de exemplo...");

        User demo = new User();
        demo.setName("Marina Prado");
        demo.setEmail("demo@tracocivil.com.br");
        demo.setPassword(passwordEncoder.encode("demo123"));
        demo.setRole("engenheiro");
        demo = userRepository.save(demo);

        Project alpha = new Project();
        alpha.setName("Residencial Alpha");
        alpha.setType("residencial");
        alpha.setStatus("ativo");
        alpha.setUser(demo);
        alpha = projectRepository.save(alpha);

        Planta planta = new Planta();
        planta.setName("Planta Térreo.pdf");
        planta.setFormat("PDF");
        planta.setSizeBytes(2_400_000L);
        planta.setStatus("concluida");
        planta.setArea(142.6);
        planta.setRooms(4);
        planta.setProject(alpha);
        planta = plantaRepository.save(planta);

        Analysis analysis = new Analysis();
        analysis.setCode("ANL-0047");
        analysis.setProject(alpha);
        analysis.setPlanta(planta);
        analysis.setStatus("concluida");
        analysis.setDurationSeconds(12);
        analysis.setConfidence(98);
        analysis.setArea(142.6);
        analysis.setRooms(4);
        analysis.setEstimatedCost(287540.60);
        analysis.setElementsJson("[" +
                "{\"label\":\"Pilares\",\"value\":\"24\"}," +
                "{\"label\":\"Vigas\",\"value\":\"37\"}," +
                "{\"label\":\"Lajes\",\"value\":\"18\"}," +
                "{\"label\":\"Paredes\",\"value\":\"56\"}," +
                "{\"label\":\"Esquadrias\",\"value\":\"23\"}]");
        analysis.setQuantitiesJson("[" +
                "{\"label\":\"Concreto\",\"value\":\"32,45 m³\"}," +
                "{\"label\":\"Aço CA-50\",\"value\":\"4,78 ton\"}," +
                "{\"label\":\"Alvenaria\",\"value\":\"152,40 m²\"}," +
                "{\"label\":\"Formas\",\"value\":\"285,60 m²\"}]");
        analysisRepository.save(analysis);

        log.info("Seed concluído. Login demo: demo@tracocivil.com.br / demo123");
    }
}