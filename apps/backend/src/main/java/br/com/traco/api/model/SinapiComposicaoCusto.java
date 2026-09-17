package br.com.traco.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;

/**
 * Entidade JPA somente-leitura para a tabela sinapi_composicao_custos.
 * Custos unitários por UF e tipo de desoneração.
 * Escrita é feita exclusivamente pelos scripts Python de importação.
 */
@Entity
@Table(name = "sinapi_composicao_custos")
public class SinapiComposicaoCusto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "composicao_id", nullable = false)
    private Long composicaoId;

    @Column(nullable = false)
    @JdbcTypeCode(SqlTypes.CHAR)
    private String uf;

    @Column(nullable = false)
    private Boolean desoneracao;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal custo;

    @Column(name = "mes_referencia", nullable = false)
    private String mesReferencia;

    public Long getId() { return id; }
    public Long getComposicaoId() { return composicaoId; }
    public String getUf() { return uf; }
    public Boolean getDesoneracao() { return desoneracao; }
    public BigDecimal getCusto() { return custo; }
    public String getMesReferencia() { return mesReferencia; }
}