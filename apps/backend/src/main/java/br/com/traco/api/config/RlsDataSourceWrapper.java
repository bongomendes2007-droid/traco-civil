package br.com.traco.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.io.PrintWriter;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.sql.Statement;

/**
 * Wrapper de DataSource que aplica SET LOCAL para RLS em TODA conexão obtida.
 *
 * Usa um ConnectionProxy lazy: o SET LOCAL é aplicado na primeira operação
 * real (createStatement, prepareStatement, etc.), não na obtenção da conexão.
 * Isso garante que o autoCommit já esteja desligado pelo Spring TransactionManager
 * antes do SET LOCAL ser executado — resolvendo o problema onde o HikariCP
 * entrega a conexão com autoCommit=true e o Spring só o desliga depois.
 *
 * Para transações REQUIRES_NEW (ex: AuditService), cada nova conexão obtida
 * recebe seu próprio proxy, e o ThreadLocal RlsContext ainda está válido
 * na mesma thread, garantindo que o SET LOCAL seja aplicado na nova transação.
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
        return wrapConnection(conn);
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        Connection conn = delegate.getConnection(username, password);
        return wrapConnection(conn);
    }

    private Connection wrapConnection(Connection conn) {
        return (Connection) Proxy.newProxyInstance(
                Connection.class.getClassLoader(),
                new Class<?>[]{Connection.class},
                new RlsConnectionHandler(conn));
    }

    /**
     * Handler que intercepta a primeira operação real na conexão para aplicar
     * o SET LOCAL após o autoCommit ter sido desligado pelo Spring.
     */
    private static class RlsConnectionHandler implements InvocationHandler {
        private final Connection delegate;
        private boolean rlsApplied = false;

        RlsConnectionHandler(Connection delegate) {
            this.delegate = delegate;
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            String name = method.getName();

            // Aplicar RLS lazy antes da primeira operação que executa SQL
            if (!rlsApplied && isQueryMethod(name)) {
                applyRlsContext(delegate);
                rlsApplied = true;
            }

            try {
                return method.invoke(delegate, args);
            } catch (java.lang.reflect.InvocationTargetException e) {
                throw e.getCause() != null ? e.getCause() : e;
            }
        }

        private boolean isQueryMethod(String name) {
            return switch (name) {
                case "createStatement", "prepareStatement", "prepareCall",
                     "nativeSQL" -> true;
                default -> false;
            };
        }

        private void applyRlsContext(Connection conn) {
            try {
                if (conn.getAutoCommit()) {
                    log.warn("RLS context skipped (lazy): connection still in autoCommit=true at query time.");
                    return;
                }

                RlsContext.RlsInfo info = RlsContext.get();

                try (Statement stmt = conn.createStatement()) {
                    if (info == null) {
                        stmt.execute("RESET app.current_user_id");
                        stmt.execute("RESET app.current_user_role");
                        stmt.execute("RESET app.current_user_email");
                        log.debug("RLS context (lazy): RESET all (no context)");
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
                            log.info("RLS context applied (lazy): userId={}, role={}, email={}",
                                    info.userId(), info.role(), info.email());
                        } else {
                            stmt.execute("RESET app.current_user_email");
                            log.debug("RLS context applied (lazy): userId={}, role={}, email=NULL",
                                    info.userId(), info.role());
                        }
                    }
                }
            } catch (SQLException e) {
                log.warn("Failed to apply RLS context (lazy): {}", e.getMessage());
            }
        }

        private String escapeSql(String value) {
            if (value == null) return "";
            return value.replace("'", "''");
        }
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
        if (iface.isInstance(delegate)) {
            return iface.cast(delegate);
        }
        return delegate.unwrap(iface);
    }

    @Override
    public boolean isWrapperFor(Class<?> iface) throws SQLException {
        return iface.isInstance(delegate) || delegate.isWrapperFor(iface);
    }
}