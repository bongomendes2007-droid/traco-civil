"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 32, textAlign: "center" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#111110" }}>Erro ao carregar página</h2>
      <p style={{ fontSize: 14, color: "#6f6f69", maxWidth: 480, marginBottom: 24 }}>
        Algo deu errado ao renderizar esta página. Tente novamente.
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
  );
}