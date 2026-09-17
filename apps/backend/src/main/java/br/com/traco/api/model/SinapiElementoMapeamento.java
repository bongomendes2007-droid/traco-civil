package br.com.traco.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/**
 * Entidade JPA somente-leitura para a tabela sinapi_elemento_mapeamento.
 * Mapeamento dos elementos detectados pela IA para códigos SINAPI.
 * fator_conversao ajusta unidades (ex: aço ton→kg = 1000).
 */
@Entity
@Table(name = "sinapi_elemento_mapeamento")
public class SinapiElementoMapeamento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String elemento;

    @Column(name = "composicao_codigo", nullable = false)
    private String composicaoCodigo;

    @Column(name = "fator_conversao", nullable = false, precision = 10, scale = 4)
    private BigDecimal fatorConversao;

    private String descricao;

    public Long getId() { return id; }
    public String getElemento() { return elemento; }
    public String getComposicaoCodigo() { return composicaoCodigo; }
    public BigDecimal getFatorConversao() { return fatorConversao; }
    public String getDescricao() { return descricao; }
}