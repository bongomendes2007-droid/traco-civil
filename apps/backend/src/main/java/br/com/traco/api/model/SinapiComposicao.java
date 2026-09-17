package br.com.traco.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Entidade JPA somente-leitura para a tabela sinapi_composicoes.
 * Catálogo mestre de composições SINAPI (CAIXA).
 * Escrita é feita exclusivamente pelos scripts Python de importação.
 */
@Entity
@Table(name = "sinapi_composicoes")
public class SinapiComposicao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String codigo;

    @Column(nullable = false)
    private String descricao;

    @Column(nullable = false)
    private String unidade;

    private String grupo;

    @Column(name = "mes_referencia", nullable = false)
    private String mesReferencia;

    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public String getDescricao() { return descricao; }
    public String getUnidade() { return unidade; }
    public String getGrupo() { return grupo; }
    public String getMesReferencia() { return mesReferencia; }
}