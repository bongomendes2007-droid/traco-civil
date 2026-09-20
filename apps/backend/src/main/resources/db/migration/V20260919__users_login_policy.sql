-- Fase fix-RLS: policy de SELECT por email para o fluxo de login.
--
-- Problema: o login precisa achar o usuário por email ANTES de conhecer o id,
-- mas as policies existentes (users_select_own por app.current_user_id,
-- users_admin_all por role) não casam — o findByEmail retornava 0 linhas
-- sempre que o contexto RLS não pegava a tempo (race do pool Hikari frio).
--
-- Solução (superfície mínima): leitura liberada SOMENTE quando a flag de
-- sessão app.login_context = 'true' E o email da linha casa exatamente com
-- app.current_user_email. A flag é setada via SET LOCAL apenas dentro da
-- transação de login (AuthService) — ela morre no fim da transação e nunca
-- existe em nenhum outro fluxo da aplicação. Sem a flag, nada muda: a tabela
-- continua opaca por email para qualquer outra query.

-- Idempotente: se a policy já existir (aplicação parcial anterior), recria.
DROP POLICY IF EXISTS "users_select_login" ON users;

CREATE POLICY "users_select_login" ON users
    FOR SELECT TO app_user
    USING (
        current_setting('app.login_context', true) = 'true'
        AND email = nullif(current_setting('app.current_user_email', true), '')
    );