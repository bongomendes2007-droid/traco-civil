# Dívida Técnica — Traço Civil

**Última atualização:** 10/09/2026  
**Origem:** Auditoria de Segurança (R2 — Actuator Health)

---

## DT-001: Gestão de Schema Fragmentada (JPA + Script Python sem Flyway ativo)

**Severidade:** Média  
**Registrado em:** 10/09/2026  
**Contexto:** Descoberto durante implementação do R2 (actuator health endpoint)

### Problema

A gestão de schema do banco de dados em produção está fragmentada entre três mecanismos independentes, sem validação automática de consistência:

1. **Migrations Flyway (V1–V12)** — existem no repositório (`apps/backend/src/main/resources/db/migration/`) mas estão **desativadas em produção**. Um comentário no código indica que "migrations são aplicadas via script Python".
2. **Scripts Python de importação/DDL** (`packages/ai/import_sinapi.py`, `apply_migration_rooms_detail.py`, etc.) — executam DDL diretamente contra o banco de produção, fora do controle de versionamento do Flyway.
3. **Entidades JPA** — definem o modelo esperado pelo backend Java, mas a validação automática (`spring.jpa.hibernate.ddl-auto=validate`) foi **desativada** (`none`) porque o Hibernate não consegue validar corretamente tipos `CHAR(n)` do Postgres mesmo com `columnDefinition` explícito.

### Risco

- **Mismatches silenciosos:** Alterações no schema feitas por scripts Python podem divergir das entidades JPA sem nenhum alerta. O erro só aparece em runtime (ex: `DataException`, `SQLGrammarException`), não no startup ou em CI.
- **Debugging difícil:** Sem validação no startup, identificar se um erro de persistência é causado por mismatch de schema, bug de query ou dado corrompido requer inspeção manual do banco.
- **Rollback inseguro:** Scripts Python não têm mecanismo de rollback integrado. Se uma migration parcial falhar, o estado do banco pode ficar inconsistente sem registro no `flyway_schema_history`.
- **Onboarding frágil:** Novos desenvolvedores não têm uma fonte única de verdade para entender o schema atual — precisam cruzar migrations Flyway (que podem estar desatualizadas em prod), scripts Python e entidades JPA.

### Recomendação de Correção Futura

| Opção | Descrição | Esforço | Prioridade |
|-------|-----------|---------|------------|
| **A (Recomendada)** | Reativar Flyway como fonte única de verdade em produção. Migrar os scripts Python DDL para migrations Flyway formais (V13+). Reativar `ddl-auto=validate` após resolver o problema de tipos `CHAR(n)` (possivelmente com `@JdbcTypeCode(SqlTypes.CHAR)` do Hibernate 6+). | Alto (~2-3 dias) | Alta |
| **B** | Manter scripts Python como fonte primária, mas adicionar um step de CI que compare o schema real do banco (via `information_schema`) com as anotações JPA e falhe o build se houver divergência. | Médio (~1 dia) | Média |
| **C** | Adicionar testes de integração que exercitem todas as entidades JPA contra um banco de teste com o mesmo schema de produção (via Testcontainers + migrations Flyway). Não resolve a fragmentação, mas detecta mismatches antes do deploy. | Médio (~1 dia) | Média |

### Workaround Atual

O campo `uf` em `SinapiComposicaoCusto.java` foi corrigido com `@Column(columnDefinition = "char(2)")` e `ddl-auto` foi trocado para `none` em `application-prod.properties`. Isso permite que o backend inicie, mas remove a rede de segurança da validação automática.

### Critério de Resolução

- [ ] Flyway reativado em produção OU mecanismo alternativo de validação de schema implementado
- [ ] Todos os scripts Python de DDL migrados para migrations versionadas (Flyway ou equivalente)
- [ ] `ddl-auto=validate` reativado OU substituído por validação equivalente em CI/startup
- [ ] Teste de integração confirma que entidades JPA e schema do banco estão consistentes

---

---

## DT-002: Rate Limiting In-Memory (IP) — Lockout por Conta Já Existe

**Severidade:** Baixa  
**Registrado em:** 10/09/2026  
**Contexto:** Implementação do R3 (rate limiting no `/api/auth/login`)

### Estado Atual

O backend possui **duas camadas de proteção contra brute-force**, já funcionais e complementares:

| Camada | Mecanismo | Limite | Janela | Escopo | HTTP Status |
|--------|-----------|--------|--------|--------|-------------|
| Rate limit por IP | `RateLimitFilter` | 10 req/min | Deslizante 60s | Por origem (IP) | 429 |
| Lockout por conta | `LoginAttemptService` | 5 falhas | Fixa 5 min | Por e-mail | 423 |

Durante a implementação do R3, uma camada adicional de rate limit por e-mail foi prototipada no `RateLimitFilter`, mas **revertida** porque o `LoginAttemptService` já cobre exatamente esse caso com janela mais longa e persistência em banco (tabela `login_attempts`). As duas camadas atuais são ortogonais: IP mitiga volume de origem única; lockout mitiga ataques contra conta específica independente da origem.

### Gaps Remanescentes

1. **Storage in-memory (`ConcurrentHashMap`) no rate limit por IP:** Estado perdido em restarts; não compartilhado entre instâncias. Em horizontal scaling, cada instância tem contador independente, multiplicando o limite efetivo pelo número de instâncias.
2. **Lockout por conta não tem backoff progressivo:** Após desbloqueio (5 min), o contador reseta completamente. Atacante persistente pode repetir ciclos de 5 tentativas a cada 5 minutos indefinidamente.
3. **Rate limit por IP não diferencia sucesso/falha:** Requests bem-sucedidos consomem quota igual a falhas. Usuário legítimo atrás de NAT/proxy pode ser bloqueado coletivamente.

### Risco

- **Ataque distribuído sustentado:** Botnet pode manter brute-force contra conta específica respeitando limite por IP individual, explorando ausência de correlação entre instâncias (se escalonar horizontalmente).
- **Falso positivo em NAT/proxy corporativo:** Múltiplos usuários legítimos atrás do mesmo IP público podem ser bloqueados coletivamente pelo rate limit de IP.
- **Ineficácia em escala horizontal:** Se backend for escalado para 3+ instâncias no Render, rate limit efetivo por IP será 3× o configurado.

### Recomendação de Correção Futura

| Opção | Descrição | Esforço | Prioridade |
|-------|-----------|---------|------------|
| **A (Recomendada)** | Migrar storage do rate limit por IP para Redis (ou tabela Supabase dedicada). Adicionar backoff exponencial ao `LoginAttemptService`: após 3 ciclos de lockout consecutivos, dobrar janela de bloqueio. Contar apenas falhas no rate limit por IP. | Médio (~1 dia) | Média |
| **B** | Substituir por Bucket4j com storage distribuído. Mais robusto, políticas declarativas, integração Spring Boot nativa. | Alto (~2 dias) | Baixa (overkill para estágio atual) |
| **C** | Adicionar headers `X-RateLimit-Remaining` e `Retry-After` nas respostas 429/423 para melhorar UX. | Baixo (~30 min) | Alta (UX improvement) |

### Critério de Resolução

- [ ] Storage do rate limit por IP migrado para mecanismo distribuído OU documentado como limitação aceita para single-instance
- [ ] Backoff progressivo implementado no `LoginAttemptService` (janela crescente após N ciclos de lockout)
- [ ] Rate limit por IP conta apenas falhas de autenticação (sucessos não consomem quota)
- [ ] Headers `X-RateLimit-*` e `Retry-After` adicionados às respostas 429/423

---

---

## DT-003: Content-Security-Policy (CSP) não configurado no Frontend Next.js

**Severidade:** Média  
**Registrado em:** 10/09/2026  
**Contexto:** Implementação do R4 (headers de segurança no backend)

### Problema

O backend é uma API REST pura (respostas JSON), portanto o header `Content-Security-Policy` **não foi adicionado** no `SecurityConfig.java` — CSP é um mecanismo de segurança para navegadores renderizando páginas HTML, não para respostas `application/json`.

O frontend Next.js (`apps/web`) atualmente **não configura CSP** em `next.config.js`. Sem CSP, o frontend está vulnerável a:
- Injeção de scripts maliciosos via XSS (mesmo com sanitização, CSP é defesa em profundidade)
- Carregamento de recursos de origens não autorizadas
- Execução de scripts inline não intencionais

### Risco

- **XSS persistente/refletido:** Sem CSP, qualquer ponto de injeção de script no frontend pode executar código arbitrário no navegador do usuário, mesmo que o backend esteja seguro.
- **Data exfiltration:** Scripts maliciosos podem enviar dados sensíveis para domínios externos sem restrição.
- **Supply chain:** Se uma dependência npm comprometida injetar script, não há política de CSP para bloquear execução.

### Recomendação de Correção Futura

Adicionar CSP no `apps/web/next.config.js` via `headers()`:

```js
// next.config.js
module.exports = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",  // Next.js usa scripts inline; avaliar nonce/hash
            "style-src 'self' 'unsafe-inline'",   // Tailwind CSS gera estilos inline
            "img-src 'self' data: https:",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self' https://*.supabase.co",
            "frame-ancestors 'self'",
          ].join('; ')
        }
      ]
    }]
  }
}
```

**Nota:** O valor acima é um ponto de partida. A diretiva `script-src` deve evoluir para usar nonces ou hashes em vez de `'unsafe-inline'` antes de ir para produção. Testar extensivamente em staging antes de ativar.

### Critério de Resolução

- [ ] CSP configurado em `apps/web/next.config.js`
- [ ] `script-src` usa nonces ou hashes (não `'unsafe-inline'`) em produção
- [ ] Todos os recursos legítimos (fontes, API Supabase, imagens) funcionam com a política ativa
- [ ] Testado em staging sem regressão de funcionalidade

---

*Este documento deve ser revisado a cada sprint de manutenção. Itens resolvidos devem ser marcados e movidos para uma seção "Resolvidos" ao final.*