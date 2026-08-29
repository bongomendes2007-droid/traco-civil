# TRAÇO CIVIL — Gerenciamento de Migrations e Rollback

**Última atualização:** 2026-08-29  
**Aplicável a:** ambiente de produção (Supabase PostgreSQL)

---

## ⚠️ ESTADO ATUAL: Flyway Desativado em Produção

### Decisão Documentada
O Flyway está **desativado** em produção (`spring.flyway.enabled=false` no profile `prod`).

### Motivo
As migrations V1-V12 foram aplicadas manualmente via script Python (`psycopg2`) conectando como `postgres` (owner das tabelas), porque:
1. O `app_user` (usado pelo backend em produção) não é owner das tabelas e não tem privilégio para executar DDL.
2. O `postgres` do Supabase não tem privilégio de transferir ownership (`ALTER TABLE ... OWNER TO`) nem de `SET ROLE`, impedindo que o Flyway rode como `app_user` ou que as tabelas sejam transferidas para ele.
3. Tentativas de rodar o Flyway como `postgres` falharam porque o Supabase restringe certas operações DDL mesmo para o role `postgres`.

### Processo para Migrations Futuras

#### Passo 1: Escrever a migration
Crie o arquivo SQL seguindo a convenção Flyway (mesmo com Flyway desativado, mantemos a nomenclatura para quando reativarmos):
```
apps/backend/src/main/resources/db/migration/V{n}__descricao.sql
```

#### Passo 2: Aplicar manualmente via script Python
Use o script `packages/ai/run_migrations_supabase.py` ou execute diretamente:
```python
import psycopg2
conn = psycopg2.connect("postgresql://postgres:<SENHA>@db.khpmbksseiwmaurxtxwk.supabase.co:5432/postgres")
conn.autocommit = True
cur = conn.cursor()
sql = open("apps/backend/src/main/resources/db/migration/V{n}__descricao.sql", encoding="utf-8").read()
cur.execute(sql)
cur.close()
conn.close()
```

#### Passo 3: Registrar no histórico do Flyway (opcional mas recomendado)
Para evitar confusão futura sobre quais migrations já foram aplicadas:
```sql
INSERT INTO flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, execution_time, success)
VALUES (
    (SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM flyway_schema_history),
    '{n}',
    'descricao',
    'SQL',
    'V{n}__descricao.sql',
    NULL,
    'manual',
    0,
    true
);
```

#### Passo 4: Commit e deploy
Faça commit do arquivo `.sql` no repositório. O backend não executará a migration automaticamente, mas ela estará versionada e documentada.

### Quando Reativar o Flyway
O Flyway poderá ser reativado (`spring.flyway.enabled=true`) quando:
- O Supabase permitir transferência de ownership para `app_user`, OU
- Criarmos um role dedicado com privilégios DDL suficientes, OU
- Migrarmos para um provedor que suporte Flyway nativamente com o role da aplicação.

Até lá, **toda migration deve ser aplicada manualmente** seguindo o processo acima.

---

## Procedimento de Rollback (Referência Histórica)

> **Nota:** As seções abaixo foram escritas quando o Flyway estava ativo. Mantidas como referência para quando reativarmos.

### Visão Geral (Histórico)

O Flyway gerenciava o schema do banco de dados via migrations versionadas (V1..V8). Em produção, o Flyway rodava automaticamente na inicialização do backend Java. Este documento descrevia como proceder caso uma migration falhasse ou precisasse ser revertida.

---

## Cenário 1: Migration Falha Durante o Deploy

### Sintomas
- O backend não sobe (exceção `FlywayException` no log).
- Mensagem típica: `Migration V{n}__xxx.sql failed` ou `Schema validation failed`.

### Causas Comuns
1. **SQL inválido:** erro de sintaxe ou referência a tabela/coluna inexistente.
2. **Conflito de schema:** a migration tenta criar algo que já existe (ou vice-versa).
3. **Permissões insuficientes:** o usuário do banco não tem `CREATE TABLE`, `ALTER TABLE`, etc.
4. **Timeout:** migration muito pesada (ex: `ALTER TABLE` em tabela grande) excede o timeout de conexão.

### Procedimento de Recuperação

#### Passo 1: Identificar a migration que falhou
```bash
# Conecte ao banco e consulte a tabela de histórico do Flyway
psql $DATABASE_URL -c "SELECT version, description, success, installed_on FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;"
```

A última linha com `success = false` é a migration problemática.

#### Passo 2: Corrigir a migration
- **Se a migration ainda não foi aplicada em nenhum ambiente:** edite o arquivo `V{n}__xxx.sql` diretamente, corrija o SQL, e faça um novo deploy. O Flyway detectará a mudança pelo checksum e reaplicará.
- **Se a migration já foi aplicada em dev/staging mas falhou em prod:** NUNCA edite uma migration já aplicada. Crie uma nova migration `V{n+1}__fix_xxx.sql` que corrige o problema (ex: `DROP TABLE IF EXISTS` + recriação, ou `ALTER TABLE` corretivo).

#### Passo 3: Limpar o estado de falha (apenas se a migration NÃO foi parcialmente aplicada)
```bash
# Opção A: Via CLI do Flyway (recomendado)
flyway -url=$DATABASE_URL -user=$DATABASE_USERNAME -password=$DATABASE_PASSWORD repair

# Opção B: Manualmente (se não tiver CLI)
psql $DATABASE_URL -c "DELETE FROM flyway_schema_history WHERE version = '{n}' AND success = false;"
```

**⚠️ AVISO:** O `repair` apenas remove o registro de falha do histórico. Se a migration criou tabelas/colunas parcialmente, você precisará limpar manualmente antes de rodar `repair`.

#### Passo 4: Re-deploy
```bash
# Suba o backend novamente
java -jar target/traco-api-0.1.0.jar --spring.profiles.active=prod
```

O Flyway tentará aplicar a migration corrigida (ou a próxima da fila).

---

## Cenário 2: Rollback Completo (Reverter para Versão Anterior do Schema)

### Quando Usar
- Uma migration foi aplicada com sucesso mas introduziu um bug crítico em produção.
- Você precisa reverter para o estado anterior do schema enquanto corrige o código.

### ⚠️ AVISO CRÍTICO
**O Flyway Community Edition (usado neste projeto) NÃO suporta rollback automático.** As migrations são projetadas para serem **forward-only** (apenas avançar). Reverter o schema manualmente é arriscado e pode causar perda de dados.

### Procedimento Manual (Use com Extrema Cautela)

#### Passo 1: Backup IMEDIATO do banco
```bash
# Dump completo do banco antes de qualquer alteração
pg_dump $DATABASE_URL > backup-pre-rollback-$(date +%Y%m%d-%H%M%S).sql
```

**NUNCA pule este passo.** Se algo der errado, o backup é sua única salvação.

#### Passo 2: Identificar as migrations a reverter
```bash
# Liste todas as migrations aplicadas
psql $DATABASE_URL -c "SELECT version, description, installed_on FROM flyway_schema_history WHERE success = true ORDER BY installed_rank;"
```

Anote quais versões você quer reverter (ex: V7 e V8).

#### Passo 3: Criar scripts de rollback manuais
Para cada migration a reverter, crie um script SQL que desfaça as alterações. Exemplos:

**Rollback de V8 (sinapi_items):**
```sql
-- rollback_V8.sql
DROP TABLE IF EXISTS sinapi_items;
DELETE FROM flyway_schema_history WHERE version = '8';
```

**Rollback de V7 (security_metrics):**
```sql
-- rollback_V7.sql
DROP TABLE IF EXISTS security_metrics;
DELETE FROM flyway_schema_history WHERE version = '7';
```

**⚠️ AVISO:** Se a migration adicionou colunas a tabelas existentes (ex: `ALTER TABLE users ADD COLUMN ...`), o rollback deve usar `ALTER TABLE ... DROP COLUMN`. Se a migration criou índices, use `DROP INDEX`.

#### Passo 4: Executar os rollbacks na ordem INVERSA
```bash
# Execute do mais recente para o mais antigo
psql $DATABASE_URL -f rollback_V8.sql
psql $DATABASE_URL -f rollback_V7.sql
```

#### Passo 5: Validar o schema
```bash
# Confirme que as tabelas foram removidas
psql $DATABASE_URL -c "\dt" | grep -E "sinapi_items|security_metrics"

# Confirme que o histórico do Flyway está consistente
psql $DATABASE_URL -c "SELECT version, description FROM flyway_schema_history ORDER BY installed_rank;"
```

#### Passo 6: Re-deploy com a versão anterior do código
```bash
# Use o JAR da versão anterior (antes das migrations problemáticas)
java -jar target/traco-api-0.1.0-old.jar --spring.profiles.active=prod
```

---

## Cenário 3: Banco Corrompido ou Inconsistente

### Sintomas
- O Flyway reporta `Detected applied migration not resolved locally` (migration aplicada no banco mas o arquivo não existe no código).
- O Flyway reporta `Detected resolved migration not applied to database` (arquivo existe mas não foi aplicado).
- Tabelas existem mas não batem com as entidades JPA (erro `Schema validation failed`).

### Procedimento

#### Opção A: Baseline (Adotar Banco Existente)
Se o banco já tem dados e você quer que o Flyway "adote" o estado atual sem rodar migrations antigas:

```bash
# Marque o banco como "baseline" na versão atual
flyway -url=$DATABASE_URL -user=$DATABASE_USERNAME -password=$DATABASE_PASSWORD baseline -baselineVersion=8
```

Isso cria um registro no `flyway_schema_history` marcando que o banco já está na V8, e o Flyway só rodará migrations V9+ no futuro.

**⚠️ AVISO:** Use apenas se você tiver certeza absoluta de que o schema do banco bate com a V8. Caso contrário, o Flyway tentará rodar V9 sobre um schema inconsistente.

#### Opção B: Restaurar do Backup
Se o banco está irrecuperável:

```bash
# Drop e recrie o banco
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restaure do último backup válido
psql $DATABASE_URL < backup-ultimo-valido.sql

# Rode o baseline se necessário
flyway -url=$DATABASE_URL -user=$DATABASE_USERNAME -password=$DATABASE_PASSWORD baseline -baselineVersion=8
```

---

## Boas Práticas para Evitar Problemas

### 1. Nunca Edite Migrations Já Aplicadas
Uma vez que uma migration foi aplicada em QUALQUER ambiente (dev, staging, prod), ela é imutável. Se precisar corrigir algo, crie uma nova migration `V{n+1}__fix.sql`.

### 2. Teste Migrations em Banco Vazio Antes de Deploy
```bash
# Crie um banco temporário
createdb tracocivil_test

# Rode o backend com profile prod apontando para o banco de teste
java -jar target/traco-api-0.1.0.jar \
  --spring.profiles.active=prod \
  --spring.datasource.url=jdbc:postgresql://localhost:5432/tracocivil_test \
  --spring.datasource.username=test \
  --spring.datasource.password=test

# Confirme que todas as V1..V8 rodaram sem erro
psql tracocivil_test -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"

# Drop o banco de teste
dropdb tracocivil_test
```

### 3. Mantenha Backups Automáticos
Configure backups diários (ou horários) do banco de produção. Em provedores gerenciados (Render, Railway, Supabase), ative o backup automático nas configurações.

### 4. Use Transações nas Migrations (Quando Possível)
O PostgreSQL suporta DDL transacional. Se uma migration falhar no meio, o PostgreSQL reverte automaticamente. Certifique-se de que suas migrations não usam comandos que quebram transações (ex: `CREATE INDEX CONCURRENTLY`).

### 5. Monitore o Histórico do Flyway
Adicione um endpoint de saúde que reporte a versão do schema:
```java
@GetMapping("/api/health/db")
public Map<String, Object> dbHealth() {
    // Consulte flyway_schema_history e retorne a última versão aplicada
}
```

---

## Checklist Pré-Deploy

Antes de cada deploy em produção, confirme:

- [ ] Todas as migrations novas foram testadas em banco vazio local.
- [ ] Backup do banco de produção foi feito (automático ou manual).
- [ ] O código do backend está sincronizado com as migrations (nenhuma migration "órfã").
- [ ] As variáveis de ambiente estão corretas (`DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`).
- [ ] O Flyway está ativado (`spring.flyway.enabled=true` no profile prod).
- [ ] Você tem acesso ao banco via `psql` ou ferramenta equivalente para diagnóstico.

---

## Contatos e Escalonamento

- **Responsável pelo banco:** [Nome do DBA ou equipe]
- **Canal de emergência:** [Slack/Teams/PagerDuty]
- **Documentação do provedor:** [Link para docs do Render/Railway/Supabase]

---

**Lembre-se:** Em produção, **sempre tenha um backup antes de qualquer mudança no schema**. O custo de um backup é zero; o custo de perder dados é infinito.