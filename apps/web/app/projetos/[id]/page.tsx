"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  listProjetos,
  listAnalises,
  type ProjectDto,
  type AnalysisDto,
} from "@/lib/api";

const ACCENT = "#ff5a1f";
const FONT = "'Space Grotesk', system-ui, sans-serif";
const MONO = "'Space Mono', monospace";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function br(value: number, decimals = 0): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function ProjetoDetalhesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);

  const [project, setProject] = useState<ProjectDto | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId || isNaN(projectId)) {
      setError("ID de projeto inválido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [projects, allAnalyses] = await Promise.all([
        listProjetos(),
        listAnalises().catch(() => [] as AnalysisDto[]),
      ]);

      const found = projects.find((p) => p.id === projectId);
      if (!found) {
        setError("Projeto não encontrado.");
        setLoading(false);
        return;
      }

      setProject(found);
      setAnalyses(allAnalyses.filter((a) => a.project === found.name));
    } catch (err: any) {
      const status = err?.status;
      if (status === 401) return;
      setError(
        status === 502 || status === 504 || !status
          ? "O servidor está iniciando. Tente novamente em alguns segundos."
          : "Não foi possível carregar os detalhes do projeto."
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f7f6f2",
          fontFamily: FONT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ fontFamily: MONO, fontSize: 14, color: "#9a9a95" }}>
          Carregando projeto...
        </p>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f7f6f2",
          fontFamily: FONT,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <p style={{ fontSize: 15, color: "#b3261e" }}>{error || "Projeto não encontrado."}</p>
        <button
          onClick={() => router.push("/projetos")}
          style={{
            background: "#111110",
            color: "#fff",
            border: "none",
            borderRadius: 11,
            padding: "11px 22px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          Voltar para Projetos
        </button>
      </main>
    );
  }

  const projectAnalyses = analyses;
  const totalCost = projectAnalyses.reduce(
    (sum, a) => sum + (a.estimatedCost ?? 0),
    0
  );
  const latestAnalysis =
    projectAnalyses.length > 0
      ? projectAnalyses.reduce((latest, a) =>
          a.date > latest.date ? a : latest
        )
      : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f6f2",
        fontFamily: FONT,
        color: "#111110",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Header */}
      <header style={{ borderBottom: "1px solid #e2e0da", background: "#f7f6f2" }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "18px 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Link href="/dashboard" style={{ display: "inline-flex" }}>
            <Image
              src="/assets/traco-civil-logo.png"
              alt="TRAÇO CIVIL"
              width={156}
              height={26}
              style={{ height: 26, width: "auto", display: "block" }}
            />
          </Link>
          <nav style={{ display: "flex", gap: 26, fontSize: 14, fontWeight: 500, flexWrap: "wrap" }}>
            <Link href="/dashboard" style={{ color: "#6f6f69" }}>Dashboard</Link>
            <Link href="/projetos" style={{ color: "#111110", fontWeight: 700 }}>Projetos</Link>
            <Link href="/plantas" style={{ color: "#6f6f69" }}>Plantas</Link>
            <Link href="/upload" style={{ color: "#6f6f69" }}>Nova Análise</Link>
          </nav>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 40px" }}>
        {/* Breadcrumb + Back */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => router.push("/projetos")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#6f6f69",
              fontFamily: FONT,
              padding: 0,
              marginBottom: 16,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Voltar para Projetos
          </button>
        </div>

        {/* Project Title Block */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e0da",
            borderRadius: 18,
            padding: "32px 36px",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
                {project.name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: project.status.toLowerCase() === "ativo" || project.status.toLowerCase() === "active" ? ACCENT : "#eeede9",
                    color: project.status.toLowerCase() === "ativo" || project.status.toLowerCase() === "active" ? "#111110" : "#9a9a95",
                    textTransform: "capitalize",
                  }}
                >
                  {project.status}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: "#9a9a95", textTransform: "capitalize" }}>
                  {project.type}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: "#9a9a95" }}>
                  Criado em {fmtDate(project.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Plants Count */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e0da",
              borderRadius: 14,
              padding: "22px 24px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9a9a95", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Plantas Vinculadas
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {project.plans}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: "#9a9a95", marginTop: 4 }}>
              {project.plans === 0 ? "Nenhuma planta ainda" : `${project.plans} planta${project.plans !== 1 ? "s" : ""}`}
            </div>
          </div>

          {/* Analyses Count */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e0da",
              borderRadius: 14,
              padding: "22px 24px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9a9a95", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Análises Realizadas
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {projectAnalyses.length}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: "#9a9a95", marginTop: 4 }}>
              {projectAnalyses.length === 0 ? "Nenhuma análise ainda" : `${projectAnalyses.length} análise${projectAnalyses.length !== 1 ? "s" : ""}`}
            </div>
          </div>

          {/* Estimated Cost */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e0da",
              borderRadius: 14,
              padding: "22px 24px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9a9a95", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Orçamento Estimado
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {totalCost > 0 ? `R$ ${br(totalCost)}` : "—"}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: "#9a9a95", marginTop: 4 }}>
              {totalCost > 0 ? "Soma das análises vinculadas" : "Aguardando primeira análise"}
            </div>
          </div>

          {/* Latest Analysis */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e0da",
              borderRadius: 14,
              padding: "22px 24px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9a9a95", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Última Análise
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {latestAnalysis ? fmtDate(latestAnalysis.date) : "—"}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: "#9a9a95", marginTop: 4 }}>
              {latestAnalysis
                ? `Confiança ${latestAnalysis.confidence != null ? `${latestAnalysis.confidence}%` : "indisponível"}`
                : "Nenhuma análise realizada"}
            </div>
          </div>
        </div>

        {/* Analyses Table */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e0da",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "22px 28px",
              borderBottom: "1px solid #f0efec",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Análises do Projeto</h2>
            <Link
              href={`/upload?projeto=${project.id}`}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: ACCENT,
                textDecoration: "none",
              }}
            >
              + Nova Análise
            </Link>
          </div>

          {projectAnalyses.length === 0 ? (
            <div style={{ padding: "48px 28px", textAlign: "center" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "#fbeee7",
                  color: ACCENT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Nenhuma análise ainda</p>
              <p style={{ fontFamily: MONO, fontSize: 13, color: "#9a9a95", margin: 0 }}>
                Faça upload de uma planta para gerar quantitativos e orçamento estimativo.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid #f0efec" }}>
                    {["Código", "Data", "Área", "Ambientes", "Duração", "Confiança", "Orçamento"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "14px 20px",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#9a9a95",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {projectAnalyses.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f0efec" }}>
                      <td style={{ padding: "14px 20px", fontFamily: MONO, fontWeight: 600 }}>
                        {a.code || "—"}
                      </td>
                      <td style={{ padding: "14px 20px" }}>{fmtDate(a.date)}</td>
                      <td style={{ padding: "14px 20px", fontFamily: MONO }}>
                        {a.area != null ? `${br(a.area, 1)} m²` : "Aguardando análise"}
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: MONO }}>
                        {a.rooms != null ? String(a.rooms) : "Aguardando análise"}
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: MONO }}>
                        {a.durationSeconds != null ? `${a.durationSeconds}s` : "Indisponível"}
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: MONO }}>
                        {a.confidence != null ? `${a.confidence}%` : "Indisponível"}
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: MONO, fontWeight: 700 }}>
                        {a.estimatedCost != null ? `R$ ${br(a.estimatedCost)}` : "Ainda não calculado"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 600px) {
          main > div:last-of-type { padding: 28px 20px !important; }
        }
      `}</style>
    </main>
  );
}