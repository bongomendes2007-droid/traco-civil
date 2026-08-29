package br.com.traco.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.sql.Statement;

/**
 * Wrapper de DataSource que aplica SET LOCAL para RLS em TODA conexão obtida.
 *
 * Isso garante que transações REQUIRES_NEW (ex: AuditService) também recebam
 * o contexto RLS, já que elas obtêm uma nova Connection do pool — e SET LOCAL
 * é por transação/conexão, não por thread.
 *
 * IMPORTANTE: SET LOCAL só funciona dentro de uma transação (autoCommit = false).
 * Se a conexão estiver em autoCommit = true (ex: Hibernate lendo metadados no
 * startup), pulamos o SET LOCAL para não quebrar a conexão.
 *
 * Quando NÃO há contexto RLS (endpoint público como /register, /login),
 * aplicamos RESET para limpar qualquer valor residual de sessão anterior
 * reutilizada do pool. Com RESET, current_setting(..., true) retorna NULL,
 * e as policies com WITH CHECK (true) permitem INSERT normalmente.
 */
public class RlsDataSourceWrapper implements DataSource {

    private static final Logger log = LoggerFactory.getLogger(RlsDataSourceWrapper.class);
    private final DataSource delegate;

    public RlsDataSourceWrapper(DataSource delegate) {
        this.delegate = delegate;
    }

    @Override
    public Connection getConnection() throws SQLException {
        Connection conn = delegate.getConnection();
        applyRlsContext(conn);
        return conn;
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        Connection conn = delegate.getConnection(username, password);
        applyRlsContext(conn);
        return conn;
    }

    private void applyRlsContext(Connection conn) {
        try {
            // SET LOCAL só funciona dentro de transação (autoCommit = false)
            if (conn.getAutoCommit()) {
                return;
            }

            RlsContext.RlsInfo info = RlsContext.get();

            try (Statement stmt = conn.createStatement()) {
                if (info == null) {
                    // Sem contexto RLS = endpoint público ou startup.
                    // RESET limpa qualquer valor residual de conexão reutilizada.
                    stmt.execute("RESET app.current_user_id");
                    stmt.execute("RESET app.current_user_role");
                    stmt.execute("RESET app.current_user_email");
                    log.debug("RLS context: RESET all (no context)");
                } else {
                    if (info.userId() != null) {
                        stmt.execute("SET LOCAL app.current_user_id = " + info.userId());
                    } else {
                        stmt.execute("RESET app.current_user_id");
                    }
                    if (info.role() != null) {
                        stmt.execute("SET LOCAL app.current_user_role = '" + escapeSql(info.role()) + "'");
                    } else {
                        stmt.execute("RESET app.current_user_role");
                    }
                    if (info.email() != null) {
                        stmt.execute("SET LOCAL app.current_user_email = '" + escapeSql(info.email()) + "'");
                        log.info("RLS context applied: userId={}, role={}, email={}", info.userId(), info.role(), info.email());
                    } else {
                        stmt.execute("RESET app.current_user_email");
                        log.debug("RLS context applied: userId={}, role={}, email=NULL", info.userId(), info.role());
                    }
                }
            }
        } catch (SQLException e) {
            log.debug("Failed to apply RLS context: {}", e.getMessage());
        }
    }

    private String escapeSql(String value) {
        if (value == null) return "";
        return value.replace("'", "''");
    }

    // ── Delegação pura dos métodos restantes do DataSource ──────

    @Override
    public PrintWriter getLogWriter() throws SQLException {
        return delegate.getLogWriter();
    }

    @Override
    public void setLogWriter(PrintWriter out) throws SQLException {
        delegate.setLogWriter(out);
    }

    @Override
    public void setLoginTimeout(int seconds) throws SQLException {
        delegate.setLoginTimeout(seconds);
    }

    @Override
    public int getLoginTimeout() throws SQLException {
        return delegate.getLoginTimeout();
    }

    @Override
    public java.util.logging.Logger getParentLogger() throws SQLFeatureNotSupportedException {
        return delegate.getParentLogger();
    }

    @Override
    public <T> T unwrap(Class<T> iface) throws SQLException {
        return delegate.unwrap(iface);
    }

    @Override
    public boolean isWrapperFor(Class<?> iface) throws SQLException {
        return delegate.isWrapperFor(iface);
    }
}