"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf7f2", color: "#111110" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ fontSize: 14, color: "#6f6f69", maxWidth: 480, marginBottom: 24 }}>
            Ocorreu um erro inesperado na aplicação. Tente recarregar a página.
          </p>
          {error?.message && (
            <pre style={{ fontSize: 12, color: "#c0392b", background: "#fff", border: "1px solid #ececea", borderRadius: 8, padding: 16, maxWidth: 600, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 24 }}>
              {error.message}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              background: "#ff5a1f",
              color: "#111110",
              border: "none",
              borderRadius: 11,
              padding: "12px 28px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}