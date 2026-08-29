-- ============================================================
-- TRAÇO CIVIL — Migration V11: Row Level Security (Supabase)
-- ============================================================
-- Habilita RLS em todas as tabelas e cria políticas baseadas em
-- variáveis de sessão SET LOCAL (app.current_user_id, app.current_user_role).
--
-- O backend Java continua usando JDBC direto com um único usuário
-- de banco (postgres/service_role). A segurança por usuário final
-- é garantida pelo RLS + SET LOCAL executado no início de cada request.
--
-- Variáveis de sessão usadas:
--   app.current_user_id   BIGINT  — ID do usuário autenticado
--   app.current_user_role VARCHAR — role do usuário (admin, engenheiro, arquiteto)
--
-- Tabelas globais (sinapi_*) permitem leitura para qualquer sessão
-- que tenha app.current_user_id definido (usuário autenticado).
--
-- Tabelas admin-only (audit_log, login_attempts, security_metrics)
-- exigem app.current_user_role = 'admin'.
--
-- REQUIRES_NEW (AuditService): transações isoladas também recebem
-- SET LOCAL via RlsContextInterceptor, garantindo que o audit_log
-- seja gravado mesmo quando a transação principal falha.
-- ============================================================

-- ── USERS ────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
    FOR SELECT USING (id = current_setting('app.current_user_id', true)::BIGINT);

CREATE POLICY "users_admin_all" ON users
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

-- Permitir INSERT durante registro (sem user_id na sessão ainda)
-- O AuthService usa service_role ou bypass temporário para criar usuários.
-- Alternativa: policy específica para INSERT sem exigir user_id.
CREATE POLICY "users_insert_self" ON users
    FOR INSERT WITH CHECK (true);

-- Usuário pode atualizar o próprio perfil
CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (id = current_setting('app.current_user_id', true)::BIGINT);

-- ── PROJECTS ─────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_user_own" ON projects
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::BIGINT);

CREATE POLICY "projects_admin_all" ON projects
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

-- ── PLANTAS ──────────────────────────────────────────────────
ALTER TABLE plantas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plantas_via_project" ON plantas
    FOR ALL USING (
        project_id IN (
            SELECT id FROM projects
            WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
        )
    );

CREATE POLICY "plantas_admin_all" ON plantas
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

-- ── ANALYSES ─────────────────────────────────────────────────
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analyses_via_project" ON analyses
    FOR ALL USING (
        project_id IN (
            SELECT id FROM projects
            WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
        )
    );

CREATE POLICY "analyses_admin_all" ON analyses
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

-- ── AUDIT_LOG (admin-only) ───────────────────────────────────
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin_read" ON audit_log
    FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

-- INSERT permitido para qualquer sessão autenticada (o sistema grava logs)
-- mas apenas admin pode ler/atualizar/deletar
CREATE POLICY "audit_log_insert_authenticated" ON audit_log
    FOR INSERT WITH CHECK (current_setting('app.current_user_id', true) IS NOT NULL);

-- ── LOGIN_ATTEMPTS (admin-only) ──────────────────────────────
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "login_attempts_admin_read" ON login_attempts
    FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "login_attempts_insert_authenticated" ON login_attempts
    FOR INSERT WITH CHECK (true);

-- ── SECURITY_METRICS (admin-only) ────────────────────────────
ALTER TABLE security_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_metrics_admin_all" ON security_metrics
    FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

-- ── SINAPI_ITEMS (global, leitura autenticada) ───────────────
ALTER TABLE sinapi_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sinapi_items_authenticated_read" ON sinapi_items
    FOR SELECT USING (current_setting('app.current_user_id', true) IS NOT NULL);

-- ── SINAPI_COMPOSICOES (global, leitura autenticada) ─────────
ALTER TABLE sinapi_composicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sinapi_comp_authenticated_read" ON sinapi_composicoes
    FOR SELECT USING (current_setting('app.current_user_id', true) IS NOT NULL);

-- ── SINAPI_COMPOSICAO_CUSTOS (global, leitura autenticada) ───
ALTER TABLE sinapi_composicao_custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sinapi_custos_authenticated_read" ON sinapi_composicao_custos
    FOR SELECT USING (current_setting('app.current_user_id', true) IS NOT NULL);

-- ── SINAPI_ELEMENTO_MAPEAMENTO (global, leitura autenticada) ─
ALTER TABLE sinapi_elemento_mapeamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sinapi_map_authenticated_read" ON sinapi_elemento_mapeamento
    FOR SELECT USING (current_setting('app.current_user_id', true) IS NOT NULL);