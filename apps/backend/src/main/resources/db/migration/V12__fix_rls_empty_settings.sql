-- ============================================================
-- TRAÇO CIVIL — Migration V12: Corrigir policies RLS para strings vazias
-- ============================================================
-- Problema: RESET de custom GUCs no PostgreSQL não remove a variável —
-- ela fica como string vazia ''. A expressão '' IS NOT NULL retorna TRUE,
-- fazendo o RLS deixar passar queries de "usuário não autenticado".
--
-- Solução: usar nullif(current_setting(...), '') para tratar string vazia
-- como NULL, bloqueando acesso não autenticado.
-- ============================================================

-- Drop e recriar policies que usam current_setting IS NOT NULL

-- ── AUDIT_LOG ────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_log_insert_authenticated" ON audit_log;
CREATE POLICY "audit_log_insert_authenticated" ON audit_log
FOR INSERT WITH CHECK (nullif(current_setting('app.current_user_id', true), '') IS NOT NULL);

DROP POLICY IF EXISTS "audit_log_admin_read" ON audit_log;
CREATE POLICY "audit_log_admin_read" ON audit_log
FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

-- ── LOGIN_ATTEMPTS ───────────────────────────────────────────
DROP POLICY IF EXISTS "login_attempts_insert_authenticated" ON login_attempts;
CREATE POLICY "login_attempts_insert_authenticated" ON login_attempts
FOR INSERT WITH CHECK (true);

-- ── SINAPI_ITEMS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "sinapi_items_authenticated_read" ON sinapi_items;
CREATE POLICY "sinapi_items_authenticated_read" ON sinapi_items
FOR SELECT USING (nullif(current_setting('app.current_user_id', true), '') IS NOT NULL);

-- ── SINAPI_COMPOSICOES ───────────────────────────────────────
DROP POLICY IF EXISTS "sinapi_comp_authenticated_read" ON sinapi_composicoes;
CREATE POLICY "sinapi_comp_authenticated_read" ON sinapi_composicoes
FOR SELECT USING (nullif(current_setting('app.current_user_id', true), '') IS NOT NULL);

-- ── SINAPI_COMPOSICAO_CUSTOS ─────────────────────────────────
DROP POLICY IF EXISTS "sinapi_custos_authenticated_read" ON sinapi_composicao_custos;
CREATE POLICY "sinapi_custos_authenticated_read" ON sinapi_composicao_custos
FOR SELECT USING (nullif(current_setting('app.current_user_id', true), '') IS NOT NULL);

-- ── SINAPI_ELEMENTO_MAPEAMENTO ───────────────────────────────
DROP POLICY IF EXISTS "sinapi_map_authenticated_read" ON sinapi_elemento_mapeamento;
CREATE POLICY "sinapi_map_authenticated_read" ON sinapi_elemento_mapeamento
FOR SELECT USING (nullif(current_setting('app.current_user_id', true), '') IS NOT NULL);

-- ── Corrigir policies de user/project/planta/analysis para consistência ──
-- As policies com ::BIGINT cast já falham naturalmente com string vazia
-- ('' não converte para BIGINT), mas vamos deixar explícito com nullif

DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users
FOR SELECT USING (id = nullif(current_setting('app.current_user_id', true), '')::BIGINT);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
FOR UPDATE USING (id = nullif(current_setting('app.current_user_id', true), '')::BIGINT);

DROP POLICY IF EXISTS "projects_user_own" ON projects;
CREATE POLICY "projects_user_own" ON projects
FOR ALL USING (user_id = nullif(current_setting('app.current_user_id', true), '')::BIGINT);

DROP POLICY IF EXISTS "plantas_via_project" ON plantas;
CREATE POLICY "plantas_via_project" ON plantas
FOR ALL USING (
    project_id IN (
        SELECT id FROM projects
        WHERE user_id = nullif(current_setting('app.current_user_id', true), '')::BIGINT
    )
);

DROP POLICY IF EXISTS "analyses_via_project" ON analyses;
CREATE POLICY "analyses_via_project" ON analyses
FOR ALL USING (
    project_id IN (
        SELECT id FROM projects
        WHERE user_id = nullif(current_setting('app.current_user_id', true), '')::BIGINT
    )
);