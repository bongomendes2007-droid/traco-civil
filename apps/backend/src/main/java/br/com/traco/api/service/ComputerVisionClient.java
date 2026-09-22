package br.com.traco.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import br.com.traco.api.dto.RoomDetail;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Cliente do worker Python de visão computacional (packages/ai/worker.py).
 *
 * Contrato:
 *  - POST {url}/analyze  (corpo binário = arquivo da planta)
 *      headers: X-File-Name, query: scale/dpi
 *      200 => {"ok":true, area_m2, rooms:[{x,y,w,h,area_m2}], rooms_count,
 *              wall_length_m, openings, confidence}
 *      422 => {"ok":false,"reason":...}  => CvRejectedException (vira status "erro")
 *  - Serviço inacessível => Optional.empty() => fallback do simulador determinístico.
 *
 * Nota: HTTP/1.1 forçado — o upgrade h2c do HTTP/2 não é aceito pelo uvicorn
 * (h11) e fazia o corpo da requisição chegar vazio no worker.
 */
@Service
public class ComputerVisionClient {

    private static final Logger log = LoggerFactory.getLogger(ComputerVisionClient.class);

    public record CvResult(double areaM2,
                           int roomsCount,
                           double wallLengthM,
                           int openings,
                           double confidence,
                           String boxesJson,
                           List<RoomDetail> roomsDetail,
                           List<Map<String, Object>> roomsGeometry,
                           Map<String, Object> scaleInfo) {}

    public static class CvRejectedException extends RuntimeException {
        public CvRejectedException(String message) {
            super(message);
        }
    }

    private final String aiUrl;
    private final String aiToken;
    private final ObjectMapper objectMapper;
    private final HttpClient http = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    public ComputerVisionClient(@Value("${app.ai.url:}") String aiUrl,
                                @Value("${app.ai.token:}") String aiToken,
                                ObjectMapper objectMapper) {
        this.aiUrl = aiUrl == null ? "" : aiUrl.trim();
        this.aiToken = aiToken == null ? "" : aiToken.trim();
        this.objectMapper = objectMapper;
    }

    public boolean configured() {
        return !aiUrl.isBlank();
    }

    public Optional<CvResult> analyze(String storagePath, String fileName) {
        if (!configured() || storagePath == null || storagePath.isBlank()) {
            return Optional.empty();
        }
        byte[] data;
        try {
            data = Files.readAllBytes(Path.of(storagePath));
        } catch (Exception e) {
            log.warn("CV: não foi possível ler o arquivo local {} ({})", storagePath, e.getMessage());
            return Optional.empty();
        }
        if (data.length == 0) {
            log.warn("CV: arquivo local vazio: {}", storagePath);
            return Optional.empty();
        }

        HttpRequest.Builder rb = HttpRequest.newBuilder()
                .uri(URI.create(aiUrl + "/analyze?scale=50&dpi=150"))
                .header("Content-Type", "application/octet-stream")
                .header("X-File-Name", fileName == null ? "planta" : fileName)
                .timeout(Duration.ofSeconds(90))
                .POST(HttpRequest.BodyPublishers.ofByteArray(data));
        if (!aiToken.isBlank()) {
            rb.header("X-Worker-Token", aiToken);
        }
        HttpRequest request = rb.build();

        try {
            log.info("CV: enviando {} ({} bytes) para o worker...", fileName, data.length);
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            log.info("CV: worker respondeu HTTP {}", response.statusCode());
            if (response.statusCode() == 200) {
                JsonNode n = objectMapper.readTree(response.body());
                if (!n.path("ok").asBoolean(false)) {
                    throw new CvRejectedException(
                            n.path("reason").asText("A IA não conseguiu ler esta planta."));
                }
                // Parse per-room details and geometry from worker response
                List<RoomDetail> roomsDetail = new ArrayList<>();
                List<Map<String, Object>> roomsGeometry = new ArrayList<>();
                JsonNode roomsNode = n.path("rooms");
                if (roomsNode.isArray()) {
                    for (int i = 0; i < roomsNode.size(); i++) {
                        JsonNode r = roomsNode.get(i);
                        String name = r.path("name").asText("Ambiente " + (i + 1));
                        double roomArea = r.path("area_m2").asDouble(0);
                        double roomConf = r.path("confidence").asDouble(n.path("confidence").asDouble(0));
                        roomsDetail.add(new RoomDetail(name, roomArea, roomConf));

                        // Geometria normalizada (box 0-1) — Fase 3
                        Map<String, Object> geom = new HashMap<>();
                        geom.put("id", i);
                        geom.put("name", name);
                        geom.put("type", r.path("type").asText(null));
                        geom.put("area_m2", roomArea);
                        geom.put("confidence", roomConf);
                        geom.put("source", "worker");
                        Map<String, Object> box = new HashMap<>();
                        box.put("x", r.path("x").asDouble(0));
                        box.put("y", r.path("y").asDouble(0));
                        box.put("w", r.path("w").asDouble(0));
                        box.put("h", r.path("h").asDouble(0));
                        geom.put("box", box);
                        geom.put("polygon", null);
                        roomsGeometry.add(geom);
                    }
                }

                // Scale info — Fase 3
                Map<String, Object> scaleInfo = new HashMap<>();
                String scaleStr = n.path("scale").asText("1:50");
                int denominator = 50;
                if (scaleStr.contains(":")) {
                    try {
                        denominator = Integer.parseInt(scaleStr.substring(scaleStr.indexOf(':') + 1).trim());
                    } catch (NumberFormatException ignored) {}
                }
                scaleInfo.put("denominator", denominator);
                scaleInfo.put("source", "worker");
                scaleInfo.put("mode", n.path("mode").asText("raster"));
                scaleInfo.put("dpi", n.path("dpi").asInt(150));
                // meters_per_pixel será calculado no ReconciliationService quando
                // tivermos as dimensões da imagem; aqui deixamos null como placeholder.
                scaleInfo.put("meters_per_pixel", null);
                scaleInfo.put("image_width_px", null);
                scaleInfo.put("image_height_px", null);

                return Optional.of(new CvResult(
                        n.path("area_m2").asDouble(0),
                        n.path("rooms_count").asInt(0),
                        n.path("wall_length_m").asDouble(0),
                        n.path("openings").asInt(0),
                        n.path("confidence").asDouble(0),
                        objectMapper.writeValueAsString(roomsNode),
                        roomsDetail,
                        roomsGeometry,
                        scaleInfo));
            }
            if (response.statusCode() == 422) {
                JsonNode n = objectMapper.readTree(response.body());
                throw new CvRejectedException(
                        n.path("reason").asText("A IA não conseguiu ler esta planta."));
            }
            log.warn("CV: status inesperado {} do worker — caindo no simulador.", response.statusCode());
            return Optional.empty();
        } catch (CvRejectedException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            log.warn("CV: worker offline/inalcançável ({}) — caindo no simulador.", e.getMessage());
            return Optional.empty();
        }
    }
}