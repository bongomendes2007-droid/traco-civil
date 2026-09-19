package br.com.traco.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/**
 * Cliente mínimo do Supabase Storage (REST) para o bucket privado
 * "plantas-originais" — persistência de longo prazo do arquivo original
 * enviado pelo usuário (o disco local do Render é efêmero).
 *
 * Autenticação via SUPABASE_SERVICE_ROLE_KEY (service role). O backend
 * SEMPRE prefixa o path com o id do usuário dono e só gera signed URLs
 * curtas para arquivos validados como do usuário (o controller confere
 * ownership antes de assinar).
 *
 * Se url/token não configurados, o cliente fica desativado e o pipeline
 * continua funcionando apenas com o disco local (comportamento atual).
 */
@Service
public class SupabaseStorageClient {

    private final String baseUrl;
    private final String serviceKey;
    private final String bucket;
    private final HttpClient http;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SupabaseStorageClient(@Value("${app.supabase.url:}") String url,
                                 @Value("${app.supabase.service-key:}") String serviceKey,
                                 @Value("${app.supabase.storage.bucket:plantas-originais}") String bucket) {
        this.baseUrl = url == null ? "" : url.replaceAll("/$", "");
        this.serviceKey = serviceKey == null ? "" : serviceKey;
        this.bucket = bucket;
        this.http = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public boolean configured() {
        return !baseUrl.isBlank() && !serviceKey.isBlank();
    }

    /** Faz upload do arquivo local para {user_id}/{planta_id}/{filename} no bucket. */
    public Optional<String> upload(long userId, long plantaId, String filename, Path localFile) {
        if (!configured()) {
            return Optional.empty();
        }
        String objectPath = objectPath(userId, plantaId, filename);
        try {
            byte[] body = Files.readAllBytes(localFile);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/storage/v1/object/" + bucket + "/" + objectPath))
                    .header("Authorization", "Bearer " + serviceKey)
                    .header("Content-Type", "application/octet-stream")
                    .header("x-upsert", "true")
                    .PUT(HttpRequest.BodyPublishers.ofByteArray(body))
                    .timeout(Duration.ofSeconds(120))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                return Optional.empty();
            }
            return Optional.of(objectPath);
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return Optional.empty();
        }
    }

    /** Gera uma signed URL de curta duração (mínimo 60s) para leitura do objeto. */
    public Optional<String> signedUrl(String objectPath, Duration expires) {
        if (!configured()) {
            return Optional.empty();
        }
        try {
            int seconds = (int) Math.max(60, expires.toSeconds());
            String json = objectMapper.writeValueAsString(Map.of("expiresIn", seconds));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/storage/v1/object/sign/" + bucket + "/" + objectPath))
                    .header("Authorization", "Bearer " + serviceKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .timeout(Duration.ofSeconds(10))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                return Optional.empty();
            }
            JsonNode node = objectMapper.readTree(response.body());
            String signed = node.path("signedURL").asText(null);
            if (signed == null || signed.isBlank()) {
                return Optional.empty();
            }
            // signedURL já vem URL-encoded, relativo a /storage/v1
            return Optional.of(baseUrl + "/storage/v1" + signed);
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return Optional.empty();
        }
    }

    /** Remove o objeto do bucket (usado ao deletar a planta). 404 = já removido. */
    public boolean delete(String objectPath) {
        if (!configured()) {
            return false;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/storage/v1/object/" + bucket + "/" + objectPath))
                    .header("Authorization", "Bearer " + serviceKey)
                    .DELETE()
                    .timeout(Duration.ofSeconds(15))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() / 100 == 2 || response.statusCode() == 404;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return false;
        }
    }

    /** Path do objeto: {user_id}/{planta_id}/{filename sanitizado}. */
    public String objectPath(long userId, long plantaId, String filename) {
        String safe = URLEncoder.encode(filename.replaceAll("[^a-zA-Z0-9._-]", "_"), StandardCharsets.UTF_8);
        return userId + "/" + plantaId + "/" + safe;
    }
}
