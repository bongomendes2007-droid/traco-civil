"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  listProjetos,
  createProjeto,
  deleteProjeto,
  type ProjectDto,
} from "@/lib/api";

const ACCENT = "#ff5a1f";
const FONT = "'Space Grotesk', system-ui, sans-serif";
const MONO = "'Space Mono', monospace";

type FilterKey = "todos" | "ativos" | "concluidos";

function statusBadge(status: string): { label: string; bg: string; fg: string } {
  const s = status.toLowerCase();
  if (s === "concluido" || s === "concluído" || s === "done") {
    return { label: "Concluído", bg: "#eaf7e6", fg: "#2f7d32" };
  }
  if (s === "ativo" || s === "active") {
    return { label: "Ativo", bg: ACCENT, fg: "#111110" };
  }
  return { label: "Rascunho", bg: "#eeede9", fg: "#9a9a95" };
}

function TypeIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (t.includes("comercial") || t.includes("commercial")) {
    return (
      <svg {...common}>
        <rect x="4" y="2" width="16" height="20" rx="1" />
        <path d="M9 6h1M14 6h1M9 10h1M14 10h1M9 14h1M14 14h1M10 22v-4h4v4" />
      </svg>
    );
  }
  if (t.includes("industrial") || t.includes("galp")) {
    return (
      <svg {...common}>
        <path d="M2 20h20V9l-6 4V9l-6 4V4H2z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M3 10l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

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

export default function ProjetosPage() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>("todos");
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("residencial");
  const [creating, setCreating] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjetos();
      setProjects(data);
    } catch (err: any) {
      const status = err?.status;
      if (status === 401) {
        return;
      }
      setError(
        status === 502 || status === 504 || !status
          ? "O servidor está iniciando. Tente novamente em alguns segundos."
          : "Não foi possível carregar os projetos. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      await createProjeto(newName.trim(), newType);
      setShowCreate(false);
      setNewName("");
      setNewType("residencial");
      await load();
    } catch (err: any) {
      const status = err?.status;
      window.alert(
        status === 502 || status === 504 || !status
          ? "O servidor está iniciando. Tente novamente em alguns segundos."
          : "Não foi possível criar o projeto. Tente novamente."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteProjeto(id);
      setConfirmDeleteId(null);
      await load();
    } catch (err: any) {
      const status = err?.status;
      window.alert(
        status === 502 || status === 504 || !status
          ? "O servidor está iniciando. Tente novamente em alguns segundos."
          : "Não foi possível excluir o projeto. Tente novamente."
      );
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  const matchesFilter = (p: ProjectDto) => {
    if (filter === "ativos") {
      const s = p.status.toLowerCase();
      return s === "ativo" || s === "active";
    }
    if (filter === "concluidos") {
      const s = p.status.toLowerCase();
      return s === "concluido" || s === "concluído" || s === "done";
    }
    return true;
  };

  const visible = projects.filter(
    (p) =>
      matchesFilter(p) &&
      p.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const activeCount = projects.filter((p) => {
    const s = p.status.toLowerCase();
    return s === "ativo" || s === "active";
  }).length;

  const pill = (key: FilterKey, label: string) => {
    const on = filter === key;
    return (
      <button
        key={key}
        onClick={() => setFilter(key)}
        style={{
          padding: "8px 16px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          border: `1px solid ${on ? "#111110" : "#e2e0da"}`,
          background: on ? "#111110" : "#fff",
          color: on ? "#fff" : "#6f6f69",
          fontFamily: FONT,
        }}
      >
        {label}
      </button>
    );
  };

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

      <div className="pj-wrap" style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 40px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 32,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
              Meus Projetos
            </h1>
            <p style={{ fontFamily: MONO, fontSize: 13, color: "#9a9a95", margin: 0 }}>
              {projects.length} projeto{projects.length !== 1 ? "s" : ""} · {activeCount} ativo
              {activeCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              background: ACCENT,
              color: "#111110",
              fontSize: 15,
              fontWeight: 700,
              padding: "13px 22px",
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo Projeto
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26, flexWrap: "wrap" }}>
          <div
            style={{
              flex: 1,
              maxWidth: 420,
              minWidth: 220,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#fff",
              border: "1px solid #e2e0da",
              borderRadius: 12,
              padding: "12px 16px",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9a9a95" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar projetos..."
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 14,
                color: "#111110",
                width: "100%",
                fontFamily: FONT,
              }}
            />
          </div>
          {pill("todos", "Todos")}
          {pill("ativos", "Ativos")}
          {pill("concluidos", "Concluídos")}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#9a9a95", fontFamily: MONO, fontSize: 14 }}>
            Carregando projetos...
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <p style={{ color: "#b3261e", fontSize: 15, margin: "0 0 18px" }}>{error}</p>
            <button
              onClick={load}
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
              Tentar novamente
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "70px 24px",
              background: "#fff",
              border: "1px dashed #e2e0da",
              borderRadius: 18,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "#fbeee7",
                color: ACCENT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
              {search || filter !== "todos" ? "Nenhum projeto corresponde" : "Nenhum projeto ainda"}
            </h3>
            <p
              style={{
                fontFamily: MONO,
                fontSize: 13,
                color: "#9a9a95",
                margin: "0 0 22px",
                maxWidth: 420,
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.6,
              }}
            >
              {search || filter !== "todos"
                ? "Ajuste a busca/filtro ou crie um novo projeto."
                : "Crie seu primeiro projeto para organizar plantas, análises de IA e orçamento estimativo num só lugar."}
            </p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                background: ACCENT,
                color: "#111110",
                fontSize: 15,
                fontWeight: 700,
                padding: "13px 22px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Criar Primeiro Projeto
            </button>
          </div>
        ) : (
          <div className="pj-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {visible.map((p) => {
              const badge = statusBadge(p.status);
              return (
                <div
                  key={p.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e0da",
                    borderRadius: 18,
                    padding: 22,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 16 }}>
                    <span
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 11,
                        background: "#fbeee7",
                        color: ACCENT,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "none",
                      }}
                    >
                      <TypeIcon type={p.type} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, overflowWrap: "anywhere" }}>
                        {p.name}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 12, color: "#9a9a95", marginTop: 3, textTransform: "capitalize" }}>
                        {p.type}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 9px",
                        borderRadius: 6,
                        background: badge.bg,
                        color: badge.fg,
                      }}
                    >
                      {badge.label}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: "#9a9a95" }}>
                      {p.plans} planta{p.plans !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 11,
                      paddingBottom: 16,
                      borderBottom: "1px solid #f0efec",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8a8a85" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        Criado em
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>{fmtDate(p.createdAt)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8a8a85" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                        </svg>
                        Última análise
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: "#c9c6bd" }}>—</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8a8a85" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 17l6-6 4 4 8-8" />
                          <path d="M17 7h4v4" />
                        </svg>
                        Orçamento est.
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: "#c9c6bd" }}>—</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
                    <Link
                      href={`/projetos/${p.id}`}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        border: "1.5px solid #111110",
                        fontSize: 14,
                        fontWeight: 600,
                        padding: 11,
                        borderRadius: 11,
                        color: "#111110",
                      }}
                    >
                      Ver Detalhes
                    </Link>
                    <button
                      onClick={() => setConfirmDeleteId(p.id)}
                      title="Excluir projeto"
                      style={{
                        width: 42,
                        height: 42,
                        border: "1px solid #e2e0da",
                        borderRadius: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#9a9a95",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(17,17,16,0.5)",
            backdropFilter: "blur(3px)",
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e0da",
              borderRadius: 18,
              width: "100%",
              maxWidth: 440,
              fontFamily: FONT,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                borderBottom: "1px solid #f0efec",
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Novo Projeto</h2>
              <button
                onClick={() => setShowCreate(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9a9a95", padding: 4 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Nome do Projeto</label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  placeholder="Ex: Residencial Alpha"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: "1px solid #e2e0da",
                    borderRadius: 11,
                    fontSize: 14,
                    outline: "none",
                    fontFamily: FONT,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Tipo de Obra</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {(["residencial", "comercial", "industrial"] as const).map((t) => {
                    const on = newType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewType(t)}
                        style={{
                          padding: 12,
                          borderRadius: 11,
                          border: `1px solid ${on ? ACCENT : "#e2e0da"}`,
                          background: on ? "#fbeee7" : "#fff",
                          color: on ? ACCENT : "#6f6f69",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          fontFamily: FONT,
                        }}
                      >
                        <TypeIcon type={t} />
                        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{t}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                padding: "16px 24px",
                borderTop: "1px solid #f0efec",
                background: "#faf9f6",
                borderRadius: "0 0 18px 18px",
              }}
            >
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  border: "1px solid #e2e0da",
                  background: "#fff",
                  borderRadius: 11,
                  padding: "11px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: FONT,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                style={{
                  border: "none",
                  background: !newName.trim() || creating ? "#e2e0da" : ACCENT,
                  color: "#111110",
                  borderRadius: 11,
                  padding: "11px 20px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: !newName.trim() || creating ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                }}
              >
                {creating ? "Criando..." : "Criar Projeto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(17,17,16,0.5)",
            backdropFilter: "blur(3px)",
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e0da",
              borderRadius: 18,
              width: "100%",
              maxWidth: 380,
              padding: 24,
              fontFamily: FONT,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Excluir projeto?</h3>
            <p style={{ fontSize: 14, color: "#6f6f69", margin: "0 0 20px", lineHeight: 1.5 }}>
              Esta ação é irreversível. O projeto e suas plantas associadas serão removidos.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                style={{
                  border: "1px solid #e2e0da",
                  background: "#fff",
                  borderRadius: 11,
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: FONT,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleting}
                style={{
                  border: "none",
                  background: "#b3261e",
                  color: "#fff",
                  borderRadius: 11,
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: deleting ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                }}
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media (max-width: 900px) {
          .pj-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 600px) {
          .pj-grid { grid-template-columns: 1fr !important; }
          .pj-wrap { padding: 28px 20px !important; }
        }
      `}</style>
    </main>
  );
}