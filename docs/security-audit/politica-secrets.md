# Política de Gestão e Rotação de Secrets — Traço Civil

**Última atualização:** 10/09/2026  
**Origem:** Auditoria de Segurança (R5 — Documentar política de rotação + cofre de secrets)  
**Escopo:** Backend Spring Boot, Worker Python, Frontend Next.js, Supabase Postgres

---

## 1. Inventário de Secrets Atuais

| Secret | Localização Local | Localização Produção | Tipo | Sensibilidade |
|--------|-------------------|---------------------|------|---------------|
| `JWT_SECRET` | `apps/backend/.env` | Variável de ambiente no Render (backend) | Chave simétrica HMAC-SHA256 | **Crítica** — assina todos os tokens JWT |
| `DATABASE_PASSWORD` | `apps/backend/.env` | Variável de ambiente no Render (backend) | Senha do role `app_user` no Supabase | **Alta** — acesso a dados via RLS |
| `SUPABASE_POSTGRES_PASSWORD` | `packages/ai/.env` | ⚠️ Verificar painel do Render (worker) | Senha do superuser `postgres` no Supabase | **Crítica** — bypass de RLS, DDL irrestrito |
| `WORKER_TOKEN` | `apps/backend/.env` + `packages/ai/.env` | Variável de ambiente no Render (backend + worker) | Token compartilhado backend↔worker | **Média** — autenticação interna entre serviços |
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/.env.local` | Variável de ambiente no Vercel | URL pública do projeto Supabase | **Baixa** — informação pública por design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/.env.local` | Variável de ambiente no Vercel | Chave anon do Supabase (RLS-enforced) | **Média** — segura apenas com RLS ativo |

### Notas sobre o estado atual

- **`.env` files locais** são ignorados pelo `.gitignore` e nunca foram commitados no histórico do repositório (confirmado na auditoria Item 1).
- **Produção** usa variáveis de ambiente configuradas diretamente nos painéis do Render (backend + worker) e Vercel (frontend). Não há cofre de secrets dedicado.
- `SUPABASE_POSTGRES_PASSWORD` foi movida de `apps/backend/.env` para `packages/ai/.env` durante o Item 1 da auditoria, pois é usada exclusivamente por scripts de importação/DDL, não pelo backend em runtime.

---

## 2. Frequência Recomendada de Rotação

| Secret | Frequência | Gatilho Adicional | Justificativa |
|--------|-----------|-------------------|---------------|
| `JWT_SECRET` | A cada **90 dias** | Suspeita de comprometimento; desligamento de colaborador com acesso | Tokens JWT têm vida longa (configurável); rotação periódica limita janela de exposição |
| `DATABASE_PASSWORD` (`app_user`) | A cada **180 dias** | Suspeita de comprometimento; mudança de equipe DBA | Role tem acesso limitado por RLS; risco menor que superuser |
| `SUPABASE_POSTGRES_PASSWORD` | A cada **90 dias** | Qualquer suspeita de exposição; após incidentes de segurança | Superuser bypassa RLS; exposição = comprometimento total do banco |
| `WORKER_TOKEN` | A cada **180 dias** | Suspeita de vazamento; redeploy do worker | Token interno; risco contido à comunicação backend↔worker |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | A cada **365 dias** | Comprometimento confirmado do RLS | Segura apenas enquanto RLS estiver correto; rotação anual como higiene |

---

## 3. Procedimento de Rotação: JWT_SECRET

### ⚠️ Impacto Crítico

**Rotacionar o `JWT_SECRET` invalida TODOS os tokens JWT ativos imediatamente.** Isso significa:
- Todos os usuários autenticados serão forçados a fazer login novamente
- Sessões ativas no frontend, mobile e API serão encerradas
- Tokens de refresh (se implementados) também serão invalidados
- **Não há logout graceful** — é uma ruptura abrupta para todos os clientes

Planeje a rotação para horários de baixo tráfego e comunique usuários se possível.

### Passo a Passo

#### Pré-requisitos
- Acesso ao painel do Render (backend)
- Acesso ao terminal local ou SSH para gerar novo secret
- Janela de manutenção comunicada (se aplicável)

#### Execução

```bash
# 1. Gerar novo JWT_SECRET (mínimo 32 bytes / 256 bits)
openssl rand -base64 48

# Exemplo de saída: wi3m3jOcvyADzOiUVy1CQwrDpuW8731xHQmeeKTC0le1qw/fDx4FT9pBJjJg9WWy
```

```bash
# 2. Atualizar variável de ambiente no Render (painel web)
#    Serviço: traco-civil-backend → Environment → JWT_SECRET
#    Substituir valor antigo pelo novo gerado acima
#    Salvar → Render fará redeploy automático
```

```bash
# 3. Atualizar .env local (para desenvolvimento)
#    apps/backend/.env → JWT_SECRET=<novo_valor>
```

```bash
# 4. Validar
#    - Backend reiniciou sem erros (verificar logs no Render)
#    - Login funciona normalmente (novo token emitido com novo secret)
#    - Tokens antigos são rejeitados (tentar usar token pré-rotação → 401)
```

#### Pós-rotação
- Monitorar logs de autenticação por 1 hora para detectar anomalias
- Se algum serviço interno usa JWT para comunicação service-to-service, atualizar também
- Registrar data da rotação em log de operações (planilha, Notion, etc.)

---

## 4. Procedimento de Rotação: DATABASE_PASSWORD (app_user)

### Impacto
- **Não invalida sessões de usuário** — o backend reconecta automaticamente com nova senha após restart
- Requer coordenação: atualizar senha no Supabase ANTES de atualizar no backend (evitar janela de indisponibilidade)

### Passo a Passo

1. Gerar nova senha forte (mínimo 24 caracteres, alfanumérico)
2. No painel do Supabase → Database → Connection pooling → alterar senha do role `app_user`
3. Atualizar `DATABASE_PASSWORD` no Render (backend) → redeploy automático
4. Atualizar `apps/backend/.env` local
5. Validar conexão HikariPool nos logs do backend

---

## 5. Procedimento de Rotação: SUPABASE_POSTGRES_PASSWORD (superuser)

### Impacto
- Scripts de importação/DDL (`import_sinapi.py`, etc.) param de funcionar até atualização
- **Não afeta o backend em runtime** (usa `app_user`, não superuser)
- Se worker no Render usa essa variável, precisa ser atualizado lá também

### Passo a Passo

1. No painel do Supabase → Project Settings → Database → Connection string → copiar nova senha
2. Atualizar `packages/ai/.env` local
3. Verificar painel do Render (worker) → se `SUPABASE_POSTGRES_PASSWORD` existe, atualizar
4. Testar `import_sinapi.py --dry-run` para confirmar conectividade

---

## 6. Recomendação: Cofre de Secrets Dedicado

### Estado Atual
Secrets estão distribuídos em:
- `.env` files locais (desenvolvimento)
- Painel do Render (backend + worker)
- Painel do Vercel (frontend)

Isso funciona para o estágio atual mas apresenta riscos:
- Sem versionamento de mudanças (quem alterou o quê e quando?)
- Sem auditoria de acesso (quem leu qual secret?)
- Rotação manual propensa a erro e esquecimento
- Secrets duplicados entre serviços sem sincronização automática

### Opções de Cofre Dedicado

| Opção | Custo | Complexidade | Adequação |
|-------|-------|-------------|-----------|
| **Render Environment Groups** | Incluso no plano | Baixa | ✅ **Recomendada para curto prazo** — centraliza vars entre serviços do mesmo projeto no Render |
| **Doppler** | Free até 5 projetos | Média | ✅ Boa para médio prazo — integra com Render/Vercel, auditoria de acesso, rotação assistida |
| **HashiCorp Vault** | Self-hosted free / Cloud pago | Alta | ❌ Overkill para estágio atual — justifica apenas com compliance regulatório ou multi-cloud |
| **AWS Secrets Manager** | ~$0.40/secret/mês | Média | ❌ Só faz sentido se migrar infraestrutura para AWS |

### Roadmap Sugerido

1. **Imediato (R5):** Este documento estabelece política e procedimentos manuais
2. **Curto prazo (~1 mês):** Migrar para Render Environment Groups para eliminar duplicação backend↔worker
3. **Médio prazo (~3 meses):** Avaliar Doppler se equipe crescer além de 2 devs ou se compliance exigir auditoria
4. **Longo prazo:** Vault apenas se houver requisito regulatório (LGPD strict, SOC2, etc.)

---

## 7. Checklist de Rotação Periódica

Use este checklist a cada ciclo de rotação (copie para ticket/tarefa):

- [ ] Identificar quais secrets estão vencendo (conforme tabela §2)
- [ ] Comunicar janela de manutenção (se JWT_SECRET envolvido)
- [ ] Gerar novos valores com gerador criptograficamente seguro (`openssl rand`)
- [ ] Atualizar produção ANTES de local (evitar usar secret de prod em dev)
- [ ] Atualizar `.env` local após confirmação de produção
- [ ] Validar conectividade/autenticação pós-rotação
- [ ] Registrar data e responsável pela rotação
- [ ] Verificar se há referências hardcoded em código, docs ou scripts utilitários (`grep` no repositório)

---

*Este documento deve ser revisado trimestralmente ou sempre que a arquitetura de deploy mudar significativamente.*