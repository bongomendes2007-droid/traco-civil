package br.com.traco.api.service;

import br.com.traco.api.repo.SinapiRepository;
import br.com.traco.api.repo.SinapiRepository.SinapiPrecoRow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Serviço de cálculo de orçamento baseado em composições SINAPI.
 *
 * Substitui a heurística anterior (area × 2016.41) por um cálculo real:
 *   custo_total = Σ(quantidade_elemento × custo_unitario_SINAPI)
 *
 * Os quantitativos ainda são estimativas paramétricas (coeficientes × área
 * ou wallLength), mas os PREÇOS vêm da base oficial CAIXA/SINAPI para a UF
 * escolhida, tornando o resultado significativamente mais preciso que a
 * constante hardcoded anterior.
 *
 * FASE 3: UF e altura são parâmetros fixos (PI / 2.80m).
 * FASE 1/2 trarão edição pelo usuário e persistência na entidade Analysis.
 */
@Service
public class OrcamentoService {

    private static final Logger log = LoggerFactory.getLogger(OrcamentoService.class);

    /**
     * Pé-direito padrão residencial brasileiro conforme NBR 15575.
     * Valor temporário até a Fase 1, quando o usuário poderá editar.
     */
    private static final double DEFAULT_FLOOR_HEIGHT_M = 2.80;

    /**
     * Coeficiente de volume de concreto por m² de área construída (m³/m²).
     * Inclui lajes, vigas e pilares em proporção típica residencial.
     * Fonte: estimativa paramétrica do AnalysisEngine original.
     * Refinável quando o worker extrair quantitativos reais por elemento.
     */
    private static final double CONCRETE_VOLUME_FACTOR_M3_PER_M2 = 0.2276;

    /**
     * Coeficiente de aço CA-50 por m² de área construída (ton/m²).
     * Fonte: estimativa paramétrica do AnalysisEngine original.
     */
    private static final double STEEL_WEIGHT_FACTOR_TON_PER_M2 = 0.0335;

    /**
     * Fator de conversão de toneladas para quilogramas.
     * O SINAPI usa KG para aço (composição 92919), a heurística retorna em ton.
     */
    private static final double TON_TO_KG = 1000.0;

    /**
     * Proporção do perímetro de paredes que corresponde a elementos estruturais
     * (vigas, pilares, cintas) que exigem fôrma. Os demais ~60% são alvenaria
     * de vedação, que não usa fôrma.
     * NOTA PARA UI: mencionar que "cálculo de fôrma é uma aproximação baseada
     * no perímetro de paredes" (pendência para Fase 1/2).
     * Refinável quando o worker detectar elementos estruturais individualmente.
     */
    private static final double FORMS_WALL_RATIO = 0.40;

    /**
     * Fallback por m² caso algum elemento não tenha preço SINAPI na UF.
     * Mesma constante usada anteriormente — garante degradação graciosa.
     */
    private static final double FALLBACK_COST_PER_M2 = 2016.41;

    private final SinapiRepository sinapiRepository;

    public OrcamentoService(SinapiRepository sinapiRepository) {
        this.sinapiRepository = sinapiRepository;
    }

    /**
     * Calcula o orçamento estimado usando preços SINAPI para a UF informada.
     *
     * @param areaM2      Área total construída em m² (do worker CV)
     * @param wallLengthM Comprimento total de paredes em m (do worker CV)
     * @param uf          Sigla da UF para consulta de preços (ex: "PI", "SP")
     * @return Custo total estimado em R$, arredondado para 2 casas decimais
     */
    public double calcularOrcamento(double areaM2, double wallLengthM, String uf) {
        // Buscar preços SINAPI para a UF
        List<SinapiPrecoRow> precos = sinapiRepository.findPrecosByUf(uf);
        Map<String, SinapiPrecoRow> precoPorElemento = precos.stream()
                .collect(Collectors.toMap(SinapiPrecoRow::getElemento, Function.identity()));

        if (precoPorElemento.isEmpty()) {
            log.warn("SINAPI: nenhum preço encontrado para UF='{}' — usando fallback completo.", uf);
            return round2(areaM2 * FALLBACK_COST_PER_M2);
        }

        // Calcular quantitativos por elemento
        double qtdAlvenaria = wallLengthM * DEFAULT_FLOOR_HEIGHT_M;           // m²
        double qtdConcreto = areaM2 * CONCRETE_VOLUME_FACTOR_M3_PER_M2;       // m³
        double qtdAcoKg = areaM2 * STEEL_WEIGHT_FACTOR_TON_PER_M2 * TON_TO_KG; // kg
        double qtdForma = wallLengthM * DEFAULT_FLOOR_HEIGHT_M * FORMS_WALL_RATIO; // m²

        // Somar subtotais
        double total = 0.0;
        total += subtotalOuFallback("alvenaria", qtdAlvenaria, precoPorElemento, areaM2);
        total += subtotalOuFallback("concreto", qtdConcreto, precoPorElemento, areaM2);
        total += subtotalOuFallback("aco", qtdAcoKg, precoPorElemento, areaM2);
        total += subtotalOuFallback("forma", qtdForma, precoPorElemento, areaM2);

        log.info("SINAPI: orçamento calculado para UF='{}': R$ {} (area={}m², wall={}m)",
                uf, round2(total), areaM2, wallLengthM);

        return round2(total);
    }

    /**
     * Retorna quantidade × custo_unitario para o elemento, ou fallback se
     * o preço não existir na UF.
     */
    private double subtotalOuFallback(String elemento, double quantidade,
                                       Map<String, SinapiPrecoRow> precos,
                                       double areaM2) {
        SinapiPrecoRow row = precos.get(elemento);
        if (row == null || row.getCusto() == null) {
            log.warn("SINAPI: preço não encontrado para elemento='{}' — usando fallback parcial.", elemento);
            // Fallback proporcional: fração do custo total por m² atribuída a este elemento
            return areaM2 * FALLBACK_COST_PER_M2 * 0.25;
        }
        BigDecimal custoUnitario = row.getCusto();
        double subtotal = quantidade * custoUnitario.doubleValue();
        log.debug("SINAPI: {} → qtd={} × R${} = R${}",
                elemento, round2(quantidade), custoUnitario, round2(subtotal));
        return subtotal;
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}