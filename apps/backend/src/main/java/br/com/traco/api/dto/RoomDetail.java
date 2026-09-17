package br.com.traco.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Dados de um cômodo individual retornado pelo worker de IA.
 *
 * @param name       Nome do ambiente (ex: "Sala", "Quarto 1")
 * @param areaM2     Área em metros quadrados — serializado como "area_m2" (snake_case)
 *                   para manter consistência com o resto da API (rooms_detail, analysis_mode).
 * @param confidence Confiança da detecção (0.0 a 1.0)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RoomDetail(
        String name,
        @JsonProperty("area_m2") double areaM2,
        double confidence) {}