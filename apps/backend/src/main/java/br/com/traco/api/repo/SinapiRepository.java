package br.com.traco.api.repo;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

/**
 * Repositório somente-leitura para consulta de preços SINAPI.
 * Usa query nativa porque as tabelas SINAPI não têm relacionamentos JPA diretos
 * entre si (são independentes, ligadas apenas por código/codigo).
 */
public interface SinapiRepository extends Repository<br.com.traco.api.model.SinapiComposicao, Long> {

    /**
     * Retorna os preços unitários mais recentes para os elementos mapeados na UF informada.
     * Para cada elemento do mapeamento, busca a composição com o maior mes_referencia
     * disponível para aquela UF/desoneracao.
     */
    @Query(value = """
        SELECT c.codigo AS codigo, c.unidade AS unidade, cc.custo AS custo,
               m.elemento AS elemento, m.fator_conversao AS fatorConversao
        FROM sinapi_composicoes c
        JOIN sinapi_composicao_custos cc ON cc.composicao_id = c.id
        JOIN sinapi_elemento_mapeamento m ON m.composicao_codigo = c.codigo
        WHERE cc.uf = :uf AND cc.desoneracao = false
          AND cc.mes_referencia = (
            SELECT MAX(cc2.mes_referencia) FROM sinapi_composicao_custos cc2
            WHERE cc2.composicao_id = c.id AND cc2.uf = :uf AND cc2.desoneracao = false
          )
        """, nativeQuery = true)
    List<SinapiPrecoRow> findPrecosByUf(@Param("uf") String uf);

    /**
     * Interface projection para o resultado da query de preços SINAPI.
     * Spring Data JPA mapeia native queries para interfaces via proxy dinâmico;
     * records NÃO são suportados com nativeQuery=true (causa ConverterNotFoundException).
     * Os getters devem corresponder exatamente aos aliases SQL (case-insensitive).
     */
    interface SinapiPrecoRow {
        String getCodigo();
        String getUnidade();
        BigDecimal getCusto();
        String getElemento();
        BigDecimal getFatorConversao();
    }
}