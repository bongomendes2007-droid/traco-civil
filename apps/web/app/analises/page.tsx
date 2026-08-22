"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { listAnalises, type AnalysisDto } from "@/lib/api";
import {
  Search,
  ChevronRight,
  BarChart3,
  FileText,
  Eye,
  AlertOctagon,
  ArrowUp,
  RefreshCw,
} from "lucide-react";

const ACCENT = "#ff5a1f";

type FilterKey = "todas" | "concluida" | "revisada" | "processando" | "erro";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "concluida", label: "Concluídas" },
  { key: "revisada", label: "Revisadas" },
  { key: "processando", label: "Processando" },
];

function br(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusBadge(status: string): { bg: string; fg: string; label: string } {
  switch (status) {
    case "concluida":
      return { bg: "#eaf7e6", fg: "#2f7d32", label: "Concluída" };
    case "revisada":
      return { bg: "#ffffff", fg: ACCENT, label: "Revisada" };
    case "processando":
      return { bg: "#eeede9", fg: "#9a9a95", label: "Processando" };
    case "erro":
      return { bg: "#fdece9", fg: "#c0392b", label: "Falha na leitura" };
    default:
      return { bg: "#eeede9", fg: "#9a9a95", label: status };
  }
}

function matchesFilter(a: AnalysisDto, f: FilterKey): boolean {
  if (f === "todas") return true;
  return a.status === f;
}

function ConfBar({ pct }: { pct: number | null }) {
  if (pct == null) {
    return (
      <div
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 13,
          color: "#c9c6bd",
          textAlign: "right",
        }}
      >
        —
      </div>
    );
  }
  return (
    <div style={{ width: 120 }}>
      <div
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
          color: "#9a9a95",
          textAlign: "right",
        }}
      >
        {pct}%
      </div>
      <div
        style={{
          height: 4,
          background: "#f0efec",
          borderRadius: 2,
          marginTop: 3,
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            height: "100%",
            background: ACCENT,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
}

export default function AnalisesPage() {
  const [data, setData] = useState<AnalysisDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const all = await listAnalises();
      setData(all);
      if (all.length > 0 && expandedId == null) {
        setExpandedId(all[0].id);
      }
    } catch (err: any) {
      const status = err?.status;
      if (status === 502 || status === 504 || !status) {
        setError("O servidor está iniciando, tente novamente em alguns segundos.");
      } else {
        setError(err?.message || "Não foi possível carregar as análises.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.filter((a) => {
      if (!matchesFilter(a, filter)) return false;
      if (!q) return true;
      return (
        (a.code || "").toLowerCase().includes(q) ||
        (a.project || "").toLowerCase().includes(q) ||
        (a.plan || "").toLowerCase().includes(q)
      );
    });
  }, [data, filter, query]);

  const stats = useMemo(() => {
    const list = data || [];
    const total = list.length;
    const concluded = list.filter((a) => a.status === "concluida" || a.status === "revisada");
    const processing = list.filter((a) => a.status === "processando").length;
    const confidences = concluded.map((a) => a.confidence).filter((c): c is number => c != null);
    const avgConf = confidences.length
      ? confidences.reduce((s, c) => s + c, 0) / confidences.length
      : null;
    const durations = list
      .map((a) => a.durationSeconds)
      .filter((d): d is number => d != null);
    const avgTime = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : null;
    const areas = list.map((a) => a.area).filter((v): v is number => v != null);
    const totalArea = areas.length ? areas.reduce((s, v) => s + v, 0) : null;
    return { total, concludedCount: concluded.length, processing, avgConf, avgTime, totalArea };
  }, [data]);

  const lastReport = useMemo(() => {
    const list = data || [];
    return (
      list.find((a) => a.status === "concluida" || a.status === "revisada") || null
    );
  }, [data]);

  const breadcrumbs = [{ label: "Análises" }];

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div
        className="mx-auto px-10 py-10"
        style={{ maxWidth: 1420, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between mb-[26px] flex-wrap gap-4">
          <div>
            <h1
              className="text-[36px] font-bold tracking-[-.02em] mb-[6px]"
              style={{ margin: 0 }}
            >
              Histórico de Análises
            </h1>
            <p
              className="font-mono text-[13px] text-[#9a9a95]"
              style={{ margin: 0 }}
            >
              {loading
                ? "Carregando..."
                : `${stats.total} análises · ${stats.concludedCount} concluídas · ${stats.processing} em processamento`}
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center gap-[9px] text-[15px] font-bold px-[22px] py-[13px] rounded-xl hover:opacity-90 transition-opacity"
            style={{ background: ACCENT, color: "#111110" }}
          >
            <ArrowUp size={17} strokeWidth={2.2} />
            Nova Análise
          </Link>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-[26px]">
          <StatCard label="ANÁLISES TOTAIS" value={stats.total} suffix="execuções" />
          <StatCard
            label="CONFIANÇA MÉDIA"
            value={stats.avgConf != null ? br(stats.avgConf, 1) : "—"}
            suffix="%"
            dark
          />
          <StatCard
            label="TEMPO MÉDIO"
            value={stats.avgTime != null ? stats.avgTime : "—"}
            suffix="segundos"
          />
          <StatCard
            label="ÁREA ANALISADA"
            value={stats.totalArea != null ? br(stats.totalArea, 1) : "—"}
            suffix="m²"
          />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          <div>
            {/* SEARCH + FILTERS */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex-1 min-w-[240px] flex items-center gap-[10px] bg-white border border-[#e2e0da] rounded-xl px-4 py-3">
                <Search size={17} strokeWidth={2} className="text-[#9a9a95]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por código, projeto ou planta..."
                  className="bg-transparent border-none outline-none text-sm text-[#111110] placeholder:text-[#9a9a95] w-full"
                />
              </div>
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="px-[15px] py-2 rounded-full text-[13px] font-semibold border transition-colors"
                  style={
                    filter === f.key
                      ? { background: "#111110", color: "#fff", borderColor: "#111110" }
                      : { background: "#fff", color: "#6f6f69", borderColor: "#e2e0da" }
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* LOADING */}
            {loading && (
              <div className="bg-white border border-[#e2e0da] rounded-2xl p-10 text-center text-[#9a9a95] font-mono text-sm">
                Carregando análises...
              </div>
            )}

            {/* ERROR */}
            {!loading && error && (
              <div className="bg-[#fff0ea] border border-[#ffd9c2] rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
                <AlertOctagon size={22} style={{ color: "#c0392b" }} />
                <p className="text-sm text-[#92231a] m-0">{error}</p>
                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-[#111110] hover:bg-[#111110] hover:text-white transition-colors"
                >
                  <RefreshCw size={14} />
                  Tentar novamente
                </button>
              </div>
            )}

            {/* EMPTY STATE */}
            {!loading && !error && data && data.length === 0 && (
              <EmptyState />
            )}

            {/* FILTERED EMPTY */}
            {!loading && !error && data && data.length > 0 && filtered.length === 0 && (
              <div className="bg-white border border-[#e2e0da] rounded-2xl p-10 text-center text-[#9a9a95] text-sm">
                Nenhuma análise corresponde aos filtros atuais.
              </div>
            )}

            {/* LIST */}
            {!loading && !error && filtered.length > 0 && (
              <div>
                {filtered.map((a) => {
                  const expanded = expandedId === a.id;
                  const badge = statusBadge(a.status);
                  const isSimulated = a.analysisMode === "simulado";
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl mb-[14px] overflow-hidden bg-white"
                      style={{
                        border: expanded
                          ? `2px solid ${ACCENT}`
                          : "1px solid #e2e0da",
                        borderRadius: expanded ? 16 : 14,
                      }}
                    >
                      <button
                        onClick={() => setExpandedId(expanded ? null : a.id)}
                        className="w-full flex items-center gap-[18px] px-5 py-4 text-left hover:bg-[#faf9f6] transition-colors"
                      >
                        <ChevronRight
                          size={16}
                          strokeWidth={2.4}
                          className="text-[#9a9a95] transition-transform"
                          style={{
                            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                          }}
                        />
                        <span
                          className="font-mono text-[13px] font-bold"
                          style={{ color: ACCENT, width: 76 }}
                        >
                          {a.code || "—"}
                        </span>
                        <div style={{ width: 180 }} className="min-w-0">
                          <div className="text-[15px] font-bold truncate">
                            {a.project || "—"}
                          </div>
                          <div className="font-mono text-[12px] text-[#9a9a95] truncate">
                            {a.plan || "—"}
                          </div>
                        </div>
                        <span
                          className="font-mono text-[12px] text-[#8a8a85] flex-1 hidden md:block"
                        >
                          {formatDate(a.date)}
                        </span>
                        <span
                          className="font-mono text-[12px] text-[#8a8a85] hidden sm:block"
                          style={{ width: 34 }}
                        >
                          {a.durationSeconds != null ? `${a.durationSeconds}s` : "—"}
                        </span>
                        <div className="hidden lg:block">
                          <ConfBar pct={a.confidence} />
                        </div>
                        <span
                          className="font-mono text-[14px] font-bold hidden sm:block"
                          style={{
                            color: a.estimatedCost != null ? ACCENT : "#c9c6bd",
                            width: 130,
                            textAlign: "right",
                          }}
                        >
                          {a.estimatedCost != null ? `R$ ${br(a.estimatedCost)}` : "—"}
                        </span>
                        <span
                          className="font-mono text-[10px] font-bold px-[9px] py-[5px] rounded-[6px] text-center leading-[1.2] whitespace-nowrap"
                          style={{ background: badge.bg, color: badge.fg }}
                        >
                          {badge.label}
                        </span>
                        {isSimulated && (
                          <span
                            className="font-mono text-[10px] font-bold px-[9px] py-[5px] rounded-[6px] whitespace-nowrap inline-flex items-center gap-1"
                            style={{ background: "#c0392b", color: "#fff" }}
                            title="Worker de IA indisponível — dados simulados"
                          >
                            <AlertOctagon size={11} strokeWidth={2.4} />
                            SIMULADO
                          </span>
                        )}
                      </button>

                      {expanded && (
                        <div
                          className="grid grid-cols-1 md:grid-cols-3 gap-8 px-6 py-6 border-t border-[#f0efec]"
                          style={{ background: "#fbfaf7" }}
                        >
                          <div>
                            <div className="font-mono text-[11px] tracking-[.06em] text-[#9a9a95] mb-[14px]">
                              ELEMENTOS DETECTADOS
                            </div>
                            {a.elements && a.elements.length > 0 ? (
                              a.elements.map((e, i) => (
                                <Row key={i} k={e.label} v={e.value} />
                              ))
                            ) : (
                              <Dash />
                            )}
                          </div>
                          <div>
                            <div className="font-mono text-[11px] tracking-[.06em] text-[#9a9a95] mb-[14px]">
                              QUANTITATIVOS ESTIMADOS
                            </div>
                            {a.quantities && a.quantities.length > 0 ? (
                              a.quantities.map((e, i) => (
                                <Row key={i} k={e.label} v={e.value} />
                              ))
                            ) : (
                              <Dash />
                            )}
                          </div>
                          <div>
                            <div className="font-mono text-[11px] tracking-[.06em] text-[#9a9a95] mb-[14px]">
                              RESUMO
                            </div>
                            <Row k="Área" v={a.area != null ? `${br(a.area, 1)} m²` : "—"} />
                            <Row k="Ambientes" v={a.rooms != null ? String(a.rooms) : "—"} />
                            <Row
                              k="Orçamento est."
                              v={a.estimatedCost != null ? `R$ ${br(a.estimatedCost)}` : "—"}
                              accent
                            />
                            <div className="flex justify-between items-center py-[7px]">
                              <span className="text-sm text-[#5c5c58]">Margem</span>
                              <span
                                className="font-mono text-[11px] font-bold px-2 py-[3px] rounded-[5px]"
                                style={{ background: ACCENT, color: "#111110" }}
                              >
                                ±8%
                              </span>
                            </div>
                            {isSimulated && (
                              <div className="mt-3 p-3 rounded-lg bg-[#fdecea] border border-[#f5c6cb] text-[12px] text-[#92231a] leading-[1.5]">
                                <strong>MODO SIMULADO.</strong> Os números acima foram gerados
                                pelo simulador e NÃO refletem a planta enviada.
                              </div>
                            )}
                            <div className="flex gap-[10px] mt-4">
                              <Link
                                href="/dashboard"
                                className="flex-1 inline-flex items-center justify-center gap-[7px] text-[13px] font-semibold py-[10px] rounded-[10px] border-[1.5px] border-[#111110] hover:bg-[#111110] hover:text-white transition-colors"
                              >
                                <Eye size={14} strokeWidth={2} />
                                Ver no canvas
                              </Link>
                              <Link
                                href="/orcamentos"
                                className="flex-1 inline-flex items-center justify-center gap-[7px] text-[13px] font-bold py-[10px] rounded-[10px]"
                                style={{ background: ACCENT, color: "#111110" }}
                              >
                                Orçamento
                              </Link>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="flex flex-col gap-4">
            <ActivityCard analyses={data || []} />
            <LastReportCard analysis={lastReport} />
            <div
              className="rounded-2xl p-5"
              style={{ background: "#fff8f2", border: "1px solid #ffd9c2" }}
            >
              <div className="text-[15px] font-bold mb-[10px]">
                Como funciona a confiança
              </div>
              <p className="text-[13px] leading-[1.55] text-[#5c5c58] m-0">
                O score de confiança mede a legibilidade da planta e a certeza da
                detecção. Abaixo de 90%, recomendamos revisar as caixas de detecção
                no canvas antes de usar o orçamento como referência.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  suffix,
  dark,
}: {
  label: string;
  value: number | string;
  suffix: string;
  dark?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={
        dark
          ? { background: "#111110" }
          : { background: "#fff", border: "1px solid #e2e0da" }
      }
    >
      <div
        className="font-mono text-[11px] tracking-[.06em] mb-[10px]"
        style={{ color: dark ? "#b8b6ae" : "#9a9a95" }}
      >
        {label}
      </div>
      <div
        className="text-[28px] font-bold"
        style={{ color: dark ? ACCENT : "#111110" }}
      >
        {value}
        <span
          className="font-mono text-[13px] font-normal ml-1"
          style={{ color: dark ? "#b8b6ae" : "#9a9a95" }}
        >
          {suffix}
        </span>
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div
      className="flex justify-between py-[7px] border-b border-[#f2f1ed]"
    >
      <span className="text-sm text-[#5c5c58]">{k}</span>
      <span
        className="font-mono text-sm font-bold"
        style={{ color: accent ? ACCENT : "#111110" }}
      >
        {v}
      </span>
    </div>
  );
}

function Dash() {
  return (
    <div
      className="font-mono text-[13px] text-[#c9c6bd]"
      style={{ textAlign: "right" }}
    >
      —
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-[#e2e0da] rounded-2xl p-12 text-center">
      <div
        className="w-[64px] h-[64px] rounded-full mx-auto mb-5 flex items-center justify-center"
        style={{ background: "#111110" }}
      >
        <BarChart3 size={28} style={{ color: ACCENT }} strokeWidth={2} />
      </div>
      <h2 className="text-[22px] font-bold mb-2">Nenhuma análise ainda</h2>
      <p className="text-[15px] text-[#5c5c58] max-w-[420px] mx-auto mb-6 leading-[1.55]">
        Envie sua primeira planta baixa para gerar quantitativos e um orçamento
        estimativo baseado em SINAPI — em minutos, com margem transparente.
      </p>
      <Link
        href="/upload"
        className="inline-flex items-center gap-[9px] text-[15px] font-bold px-[22px] py-[13px] rounded-xl hover:opacity-90 transition-opacity"
        style={{ background: ACCENT, color: "#111110" }}
      >
        <ArrowUp size={17} strokeWidth={2.2} />
        Fazer minha primeira análise
      </Link>
    </div>
  );
}

function ActivityCard({ analyses }: { analyses: AnalysisDto[] }) {
  const days = useMemo(() => {
    const now = new Date();
    const buckets: { day: string; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.push({
        day: key,
        label: d.toLocaleDateString("pt-BR", { day: "2-digit" }),
        count: 0,
      });
    }
    for (const a of analyses) {
      if (!a.date) continue;
      const key = new Date(a.date).toISOString().slice(0, 10);
      const b = buckets.find((x) => x.day === key);
      if (b) b.count += 1;
    }
    return buckets;
  }, [analyses]);

  const max = Math.max(1, ...days.map((d) => d.count));
  const peak = days.reduce((acc, d) => (d.count > acc.count ? d : acc), days[0]);

  return (
    <div className="bg-white border border-[#e2e0da] rounded-2xl p-5">
      <div className="flex items-center gap-[9px] mb-[18px]">
        <BarChart3 size={16} style={{ color: ACCENT }} strokeWidth={2} />
        <span className="text-[15px] font-bold">Atividade — últimos 7 dias</span>
      </div>
      <div
        className="flex items-end justify-between gap-2 mb-2"
        style={{ height: 96 }}
      >
        {days.map((d) => {
          const h = d.count === 0 ? 4 : Math.round(20 + (d.count / max) * 70);
          const color =
            d.count === 0
              ? "#d8d5cc"
              : d.count === peak.count && peak.count > 0
              ? ACCENT
              : "#b0aca2";
          return (
            <div
              key={d.day}
              className="flex-1 flex flex-col items-center justify-end gap-[5px] h-full"
            >
              <span className="font-mono text-[10px] text-[#9a9a95]">
                {d.count > 0 ? d.count : ""}
              </span>
              <div
                style={{
                  width: "100%",
                  height: h,
                  background: color,
                  borderRadius: "4px 4px 0 0",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between">
        {days.map((d) => (
          <span
            key={d.day}
            className="flex-1 text-center font-mono text-[10px] text-[#b2ada2]"
          >
            {d.label}
          </span>
        ))}
      </div>
      <p className="text-[13px] leading-[1.5] text-[#5c5c58] mt-4 mb-0">
        {peak.count > 0 ? (
          <>
            Pico de atividade em{" "}
            <strong>{peak.label} Ago</strong> com{" "}
            <span style={{ color: ACCENT, fontWeight: 700 }}>
              {peak.count} {peak.count === 1 ? "análise" : "análises"}
            </span>
            .
          </>
        ) : (
          <>Sem análises nos últimos 7 dias.</>
        )}
      </p>
    </div>
  );
}

function LastReportCard({ analysis }: { analysis: AnalysisDto | null }) {
  return (
    <div className="bg-white border border-[#e2e0da] rounded-2xl p-5">
      <div className="flex items-center gap-[9px] mb-4">
        <FileText size={16} style={{ color: ACCENT }} strokeWidth={2} />
        <span className="text-[15px] font-bold">Último relatório</span>
      </div>
      {analysis ? (
        <>
          <div className="border border-[#f0efec] rounded-xl p-4">
            <div
              className="font-mono text-[12px] font-bold mb-[6px]"
              style={{ color: ACCENT }}
            >
              {analysis.code || "—"}
            </div>
            <div className="text-[16px] font-bold">
              {analysis.project || "—"}
            </div>
            <div className="font-mono text-[12px] text-[#9a9a95] mt-1">
              {analysis.area != null ? `${br(analysis.area, 1)} m²` : "—"} ·{" "}
              {analysis.estimatedCost != null
                ? `R$ ${br(analysis.estimatedCost)}`
                : "—"}{" "}
              ±8%
            </div>
          </div>
          <Link
            href="/orcamentos"
            className="block text-center mt-[14px] border-[1.5px] border-[#111110] text-[14px] font-semibold py-[11px] rounded-[11px] hover:bg-[#111110] hover:text-white transition-colors"
          >
            Abrir orçamento completo
          </Link>
        </>
      ) : (
        <p className="text-[13px] text-[#9a9a95] m-0">
          Ainda não há relatórios concluídos.
        </p>
      )}
    </div>
  );
}