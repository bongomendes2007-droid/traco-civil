-- Policies RLS escopadas para permitir acesso interno ao afterCommit()
-- do PlantaIntakeService, onde app.current_user_id não está disponível
-- (contexto fora do request HTTP).
-- A flag app.internal_storage_write é setada via SET LOCAL antes do save().
-- Restrito a app_user (role da aplicação) — não concede acesso a outros roles.
-- NOTA: RLS no PostgreSQL opera em nível de LINHA, não de coluna.
-- Para restringir UPDATE apenas à coluna storage_url, seria necessário
-- um trigger BEFORE UPDATE comparando OLD.* vs NEW.* — opção mais complexa
-- e não implementada aqui. A proteção atual confia no escopo transacional
-- do SET LOCAL e na restrição ao role app_user.

DROP POLICY IF EXISTS plantas_select_internal ON plantas;
DROP POLICY IF EXISTS plantas_update_storage_url ON plantas;

CREATE POLICY plantas_select_internal
    ON plantas
    FOR SELECT
    TO app_user
    USING (current_setting('app.internal_storage_write', true) = 'true');

CREATE POLICY plantas_update_storage_url
    ON plantas
    FOR UPDATE
    TO app_user
    USING (current_setting('app.internal_storage_write', true) = 'true')
    WITH CHECK (current_setting('app.internal_storage_write', true) = 'true');