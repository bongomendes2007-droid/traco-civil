package br.com.traco.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;

/**
 * Cliente da Claude Vision API (Anthropic) para revisão cruzada da análise
 * do worker OpenCV. Envia a imagem da planta + o JSON de saída do worker
 * e recebe um verdict estruturado (confirmado/corrigido) com os dados
 * reconciliados.
 *
 * Falha na chamada (timeout, erro HTTP, parse) retorna Optional.empty() —
 * o ReconciliationService trata como "skipped" e segue com o resultado
 * do worker. A análise NUNCA é derrubada por falha na revisão.
 *
 * Modelo: claude-sonnet-5 (melhor custo-benefício para visão estruturada).
 * Timeout: 60s conforme especificação da Fase 2.
 */
@Service
public class ClaudeVisionService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeVisionService.class);

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL = "claude-sonnet-5";
    private static final int MAX_TOKENS = 4096;
    private static final Duration TIMEOUT = Duration.ofSeconds(60);

    /** Limite de tamanho para envio em base64: 15 MB raw (após encoding base64 fica ~20 MB). */
    private static final long MAX_FILE_BYTES = 15L * 1024 * 1024;

    private final String apiKey;
    private final HttpClient http;
    private final ObjectMapper objectMapper;

    public ClaudeVisionService(@Value("${app.claude.api-key:}") String apiKey,
                               ObjectMapper objectMapper) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.objectMapper = objectMapper;
        this.http = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public boolean configured() {
        return !apiKey.isBlank();
    }

    /**
     * Envia a imagem + dados do worker para a Claude Vision API e retorna
     * o JSON de resposta estruturada (verdict, rooms, total_area_m2, etc.).
     *
     * @param storagePath caminho local do arquivo da planta
     * @param fileName    nome original do arquivo (para detectar MIME)
     * @param workerJson  JSON de saída do worker.py (inline no prompt)
     * @return JSON de resposta do Claude como string, ou empty se falhar
     */
    public Optional<String> reviewWithVision(String storagePath, String fileName, String workerJson) {
        if (!configured()) {
            log.warn("CLAUDE: api-key não configurada — revisão por IA desativada.");
            return Optional.empty();
        }

        byte[] fileBytes;
        try {
            Path path = Path.of(storagePath);
            if (!Files.exists(path)) {
                log.warn("CLAUDE: arquivo não encontrado no storagePath={}", storagePath);
                return Optional.empty();
            }
            fileBytes = Files.readAllBytes(path);
            if (fileBytes.length == 0 || fileBytes.length > MAX_FILE_BYTES) {
                log.warn("CLAUDE: arquivo com tamanho inválido ({} bytes) — pulando revisão.", fileBytes.length);
                return Optional.empty();
            }
        } catch (Exception e) {
            log.warn("CLAUDE: falha ao ler arquivo local {}: {}", storagePath, e.getMessage());
            return Optional.empty();
        }

        String mediaType = resolveMediaType(fileName);
        String base64Image = Base64.getEncoder().encodeToString(fileBytes);

        String systemPrompt = """
                Você é um engenheiro civil especialista em leitura de plantas baixas brasileiras.
                Sua tarefa é REVISAR a análise feita por um sistema de visão computacional (OpenCV)
                comparando com a imagem real da planta que você recebe.

                PROCESSO OBRIGATÓRIO (siga nesta ordem antes de responder):
                1. ENUMERE MENTALMENTE todas as paredes fechadas visíveis na imagem. Conte quantos
                   recintos delimitados por paredes existem. Isso define o número máximo de ambientes.
                2. DISTINGA "ambiente fechado" de "zona dentro de espaço aberto":
                   - Sala + jantar integrados SEM parede divisória = 1 ambiente único (ex: "Sala de Estar/Jantar").
                   - Hall/corredor só conta como ambiente próprio se for delimitado por paredes em
                     todos os lados. Passagens abertas entre dois cômodos NÃO são ambientes.
                   - Áreas de transição sem paredes (ex: hall aberto para sala) NÃO contam.
                3. Após montar sua lista interna de ambientes, FAÇA UMA SEGUNDA VERIFICAÇÃO:
                   revise a imagem novamente confirmando cada item da lista. Se encontrar algo que
                   não está delimitado por paredes, remova. Se faltar um recinto fechado, adicione.
                   Só então produza a resposta final.

                REGRAS DE SAÍDA:
                1. Compare cada cômodo detectado pelo worker com o que você vê na imagem.
                2. Se o worker acertou, confirme. Se errou (cômodo faltando, área incorreta,
                   tipo errado, parede fantasma, zona aberta contada como ambiente), corrija.
                3. O valor do Claude SEMPRE prevalece sobre o worker em caso de discordância.
                4. Responda APENAS com JSON válido, sem markdown, sem texto extra.
                5. Use nomes de ambiente em português brasileiro.
                6. Áreas em m² com 1 casa decimal.
                7. Box normalizado: x, y, w, h entre 0.0 e 1.0 (proporção da imagem).
                """;

        String userPrompt = String.format("""
                Abaixo está o resultado da análise do worker de visão computacional (OpenCV):

                ```json
                %s
                ```

                Agora analise a imagem da planta que acompanha esta mensagem e retorne um JSON
                com EXATAMENTE esta estrutura:

                {
                  "verdict": "confirmado" | "corrigido",
                  "rooms": [
                    {
                      "match_index": <índice do room no array do worker, ou -1 se novo>,
                      "action": "confirmed" | "corrected" | "added" | "removed",
                      "name": "<nome do ambiente em PT-BR>",
                      "type": "<tipo: sala, quarto, cozinha, banheiro, varanda, corredor, garagem, outro>",
                      "area_m2": <área revisada em m²>,
                      "worker_area_m2": <área original do worker, ou null se adicionado>,
                      "box": {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0},
                      "confidence": <0.0 a 1.0>
                    }
                  ],
                  "total_area_m2": <área total revisada>,
                  "scale_note": "<observação sobre escala se relevante, ou null>",
                  "corrections_summary": "<resumo das correções feitas, ou null se tudo confirmado>"
                }
                """, workerJson);

        try {
            // Construir o payload JSON usando ObjectNode (evita problemas de parsing
            // com double-brace initialization em text blocks)
            ObjectNode sourceNode = objectMapper.createObjectNode()
                    .put("type", "base64")
                    .put("media_type", mediaType)
                    .put("data", base64Image);

            ObjectNode imageBlock = objectMapper.createObjectNode()
                    .put("type", "image");
            imageBlock.set("source", sourceNode);

            ObjectNode textBlock = objectMapper.createObjectNode()
                    .put("type", "text")
                    .put("text", userPrompt);

            ArrayNode contentArray = objectMapper.createArrayNode();
            contentArray.add(imageBlock);
            contentArray.add(textBlock);

            ObjectNode messageNode = objectMapper.createObjectNode()
                    .put("role", "user");
            messageNode.set("content", contentArray);

            ArrayNode messagesArray = objectMapper.createArrayNode();
            messagesArray.add(messageNode);

            ObjectNode requestBody = objectMapper.createObjectNode()
                    .put("model", MODEL)
                    .put("max_tokens", MAX_TOKENS)
                    .put("system", systemPrompt);
            requestBody.set("messages", messagesArray);

            String jsonPayload = objectMapper.writeValueAsString(requestBody);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .timeout(TIMEOUT)
                    .build();

            log.info("CLAUDE: enviando revisão para API (arquivo={} bytes, model={})", fileBytes.length, MODEL);
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() / 100 != 2) {
                log.warn("CLAUDE: API retornou HTTP {} — body: {}", response.statusCode(),
                        safe(response.body(), 300));
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode responseContent = root.path("content");
            if (!responseContent.isArray() || responseContent.isEmpty()) {
                log.warn("CLAUDE: resposta sem content array — body: {}", safe(response.body(), 300));
                return Optional.empty();
            }

            // Extrair o texto do primeiro bloco de texto da resposta
            for (JsonNode block : responseContent) {
                if ("text".equals(block.path("type").asText())) {
                    String text = block.path("text").asText("");
                    if (!text.isBlank()) {
                        log.info("CLAUDE: revisão recebida com sucesso ({} chars)", text.length());
                        return Optional.of(text);
                    }
                }
            }

            log.warn("CLAUDE: nenhum bloco de texto na resposta");
            return Optional.empty();

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("CLAUDE: chamada interrompida");
            return Optional.empty();
        } catch (Exception e) {
            log.warn("CLAUDE: falha na chamada à API: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Resolve o media_type para a API Claude baseado na extensão do arquivo.
     * A Claude Vision API aceita: image/jpeg, image/png, image/gif, image/webp, application/pdf.
     */
    private String resolveMediaType(String fileName) {
        if (fileName == null) return "image/jpeg";
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        return "image/jpeg"; // jpg, jpeg, fallback
    }

    private String safe(String s, int maxLen) {
        if (s == null) return "";
        return s.length() > maxLen ? s.substring(0, maxLen) + "..." : s;
    }
}