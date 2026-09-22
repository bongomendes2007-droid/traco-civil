-- Fix-RLS: policy de SELECT por email para o fluxo de registro.
--
-- Problema: o INSERT na tabela users é permitido pela policy users_insert_self
-- (WITH CHECK true), mas o JPA/Hibernate executa RETURNING * pós-INSERT para
-- popular a entidade salva. Esse SELECT falhava porque nenhuma policy de SELECT
-- vigente durante o registro permitia ler a linha recém-inserida:
--   - users_select_own exige app.current_user_id (NULL durante registro)
--   - users_select_login exige app.login_context='true' (nunca setado no register)
--   - users_admin_all exige role admin (backend conecta como app_user)
-- Resultado: Postgres bloqueava o RETURNING sob RLS → PSQLException → 500 genérico.
--
-- Solução: leitura liberada SOMENTE quando app.current_user_email está definido
-- E o email da linha casa exatamente. O SET LOCAL é feito em AuthService.register()
-- antes do save(), usando o email já validado. Sem essa variável, nada muda.
-- Esta policy NÃO depende de app.login_context — semânticas separadas por fluxo.

-- Idempotente: se a policy já existir (aplicação parcial anterior), recria.
DROP POLICY IF EXISTS "users_select_register" ON users;

CREATE POLICY "users_select_register" ON users
    FOR SELECT TO app_user
    USING (
        current_setting('app.current_user_email', true) IS NOT NULL
        AND current_setting('app.current_user_email', true) <> ''
        AND email = current_setting('app.current_user_email', true)
    );