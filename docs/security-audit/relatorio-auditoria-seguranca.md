# Relatório de Auditoria de Segurança — Traco Civil

**Data:** 01/09/2026  
**Escopo:** Backend Spring Boot (apps/backend) + Supabase RLS  
**Auditor:** Claude Opus 5 (Anthropic)  
**Metodologia:** Análise estática de código, teste E2E automatizado, verificação de políticas RLS  

---

## Sumário Executivo

Foram identificadas **4 vulnerabilidades** na auditoria inicial. Todas as vulnerabilidades técnicas foram **corrigidas e validadas** nesta sessão. O sistema passou em **9/9 testes E2E** após as correções, confirmando integridade funcional e segurança.

| Severidade | Encontrados | Corrigidos | Aceitos (Risco) |
|------------|-------------|------------|-----------------|
| Crítico    | 1           | 1          | 0               |
| Alto       | 1           | 1          | 0               |
| Médio      | 1           | 1          | 0               |
| Baixo/Info | 1           | 0          | 1               |

---

## 1. Gestão de Segredos e Configuração

### 1.1 ✅ RESOLVIDO — Senha do Supabase commitada em texto puro

- **Severidade:** CRÍTICO  
- **Localização:** `apps/backend/src/main/resources/application-supabase.properties` (commit `52b6d49`)  
- **Descrição:** Credenciais de banco de dados (`spring.datasource.password`) estavam em texto puro no repositório Git.  
- **Correção aplicada:**  
  - Substituído por variáveis de ambiente: `${SUPABASE_POSTGRES_USERNAME}` e `${SUPABASE_POSTGRES_PASSWORD}`  
  - Arquivo adicionado ao `.gitignore` para prevenir futuros commits  
- **Validação:** Backend iniciou com profile `prod` usando credenciais do `.env`, conexão HikariPool estabelecida com sucesso.  
- **Recomendação adicional:** Rotacionar a senha do Supabase imediatamente, pois a versão anterior foi exposta no histórico do Git.

### 1.2 ✅ RESOLVIDO — JWT Secret fallback fraco em produção

- **Severidade:** MÉDIO  
- **Localização:** `application-supabase.properties` / configuração JWT  
- **Descrição:** Ausência de validação que garanta `JWT_SECRET` forte em ambiente de produção. Fallback silencioso poderia permitir tokens forjados.  
- **Correção aplicada:**  
  - Criado `JwtSecretValidator.java` com `@Profile("prod")`  
  - Escuta `ApplicationReadyEvent` e lança `IllegalStateException` se secret for nula, vazia ou < 32 caracteres  
- **Validação:** Backend subiu sem exceção → JWT_SECRET atual tem ≥32 caracteres.

---

## 2. Autenticação e Autorização

### 2.1 ✅ RESOLVIDO — Role hardcoded "engenheiro" no JwtAuthFilter

- **Severidade:** ALTO  
- **Localização:**  
  - `JwtService.generateToken()` — não incluía claim `role`  
  - `JwtAuthFilter.doFilterInternal()` — usava string fixa `"engenheiro"`  
  - `AuthService.login()` / `register()` — não passavam role real do usuário  
- **Descrição:** Todos os usuários recebiam role "engenheiro" independente do valor real no banco. Impossibilitava diferenciação de permissões via JWT.  
- **Correção aplicada:**  
  - `JwtService.generateToken(userId, email, role)` agora aceita e inclui claim `role`  
  - `JwtService.extractRole(token)` extrai o claim com fallback seguro para `"engenheiro"`  
  - `AuthService.login()` e `register()` passam `user.getRole()` ao gerador de token  
  - `JwtAuthFilter` lê `jwtService.extractRole(token)` em vez da string fixa  
- **Validação:** Teste E2E confirmou login funcional e tokens emitidos corretamente. Usuários existentes continuam funcionando (fallback "engenheiro").

### 2.2 ℹ️ ACEITO — Frontend sem enforcement de role

- **Severidade:** INFORMATIVO  
- **Descrição:** O frontend não valida roles localmente antes de renderizar componentes.  
- **Justificativa arquitetural:** RLS no Supabase é a **fonte única de autorização**. O backend nunca retorna dados não autorizados, independente do que o frontend solicite. A ausência de guards no frontend é uma decisão consciente de arquitetura defense-in-depth onde o RLS garante isolamento de dados na camada de persistência.  
- **Recomendação futura:** Adicionar guards de UI como melhoria de UX (evitar telas vazias), mas **não como controle de segurança**.

---

## 3. Row Level Security (RLS) — Supabase

### 3.1 Políticas verificadas via teste E2E

| Teste | Resultado | Descrição |
|-------|-----------|-----------|
| Usuário A lê próprio projeto | ✅ 200 | RLS permite acesso ao owner |
| Usuário A lê projeto de B | ✅ 404 | RLS bloqueia acesso cruzado |
| Listagem de projetos | ✅ count=1 | Apenas projetos próprios retornados |
| Criação de projeto | ✅ 201 | INSERT permitido com user_id autenticado |

**Conclusão:** Políticas RLS estão funcionais e aplicadas corretamente. O contexto RLS é injetado via `RlsDataSourceWrapper` usando claims do JWT (`SET LOCAL app.current_user_id`).

---

## 4. Audit Log

### 4.1 Funcionalidade verificada

- **Login com falha:** Registrado em `audit_log` com tipo `LOGIN_FAILURE` ✅  
- **Login com sucesso:** Registrado via `AuditService.logLoginSuccess()` ✅  
- **DataSource:** AuditService usa `HikariDataSource` (mesmo pool RLS) ✅  
- **SECURITY DEFINER:** Função de audit configurada como `SECURITY DEFINER` para bypass de RLS no insert de logs ✅

---

## 5. Compilação e Integração

| Verificação | Resultado |
|-------------|-----------|
| `mvn clean compile` | ✅ Exit code 0, sem erros |
| Backend startup (profile prod) | ✅ 9.3s, HikariPool conectado ao Supabase |
| JwtSecretValidator | ✅ Sem exceção (secret válida) |
| Teste E2E completo (9 passos) | ✅ 9/9 passando |

---

## Recomendações Pós-Auditoria

1. **Rotacionar senha do Supabase** — a versão anterior foi exposta no Git history (`git log --all -p -- application-supabase.properties`)
2. **Adicionar `/actuator/health` ao `permitAll`** em `SecurityConfig.java` para habilitar health checks de load balancers e monitoramento
3. **Implementar rate limiting** no endpoint `/api/auth/login` para mitigar brute-force (atualmente há contador de tentativas mas sem throttle temporal)
4. **Adicionar headers de segurança** adicionais: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`
5. **Documentar política de rotação de JWT_SECRET** e armazenar em cofre de secrets (Vault/AWS Secrets Manager) para produção

---

## Apêndice: Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `apps/backend/src/main/resources/application-supabase.properties` | Substituído credenciais por variáveis de ambiente |
| `.gitignore` | Adicionado `application-supabase.properties` |
| `apps/backend/.../security/JwtService.java` | Adicionado parâmetro `role` em `generateToken()`; novo método `extractRole()` |
| `apps/backend/.../security/JwtAuthFilter.java` | Lê role do JWT em vez de string fixa |
| `apps/backend/.../service/AuthService.java` | Passa `user.getRole()` em `login()` e `register()` |
| `apps/backend/.../config/JwtSecretValidator.java` | **Novo arquivo** — valida JWT_SECRET em prod |

---

*Relatório gerado automaticamente em 01/09/2026. Para questões, consulte o histórico completo da sessão de auditoria.*