"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { listAnalises, AnalysisDto } from "@/lib/api";
import {
  Printer,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  TrendingUp,
  Layers,
  Hammer,
  Filter,
  Info,
  Download,
  Droplets,
  ArrowUp,
  RefreshCw,
  AlertOctagon,
  ChevronDown,
} from "lucide-react";

const ACCENT = "#ff5a1f";
const MARGIN = 8;

export default function OrcamentosPage() {
  const [data, setData] = useState<AnalysisDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listAnalises();
      const concluded = all.filter(
        (a) => a.status === "concluida" || a.status === "revisada"
      );
      setData(concluded);
      if (concluded.length > 0 && selectedId == null) {
        setSelectedId(concluded[0].id);
      }
    } catch (err: any) {
      const status = err?.status;
      if (status === 502 || status === 504 || !status) {
        setError("Não foi possível carregar os orçamentos agora. Tente novamente em instantes.");
      } else if (status === 401) {
        setError("Sessão expirada. Faça login novamente.");
      } else {
        setError(err?.message || "Erro ao carregar orçamentos.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analysis = useMemo(() => {
    if (!data || selectedId == null) return null;
    return data.find((a) => a.id === selectedId) ?? data[0] ?? null;
  }, [data, selectedId]);

  const isSimulated = analysis?.analysisMode === "simulado";

  const cost = analysis?.estimatedCost ?? null;
  const area = analysis?.area ?? null;
  const minCost = cost != null ? cost * (1 - MARGIN / 100) : null;
  const maxCost = cost != null ? cost * (1 + MARGIN / 100) : null;
  const costPerM2 = cost != null && area != null && area > 0 ? cost / area : null;

  // Deriva "itens" a partir dos quantities reais da análise (labels genéricos da IA).
  // Não inventamos breakdown SINAPI granular — mostramos o que a IA realmente retornou.
  const realItems = useMemo(() => {
    if (!analysis?.quantities) return [];
    return analysis.quantities.map((q, i) => ({
      code: String(i + 1).padStart(2, "0"),
      label: q.label,
      value: q.value,
    }));
  }, [analysis]);

  // Agrupa por categoria derivada dos labels (best-effort, sem inventar dados).
  const categories = useMemo(() => {
    if (!analysis?.quantities) return [];
    const groups: Record<string, { count: number }> = {};
    for (const q of analysis.quantities) {
      const key = q.label || "Outros";
      if (!groups[key]) groups[key] = { count: 0 };
      groups[key].count += 1;
    }
    return Object.entries(groups).map(([name, g]) => ({ name, count: g.count }));
  }, [analysis]);

  const breadcrumbs = [
    { label: "Projetos", href: "/projetos" },
    { label: analysis?.project || "Orçamento" },
    { label: "Orçamento Detalhado" },
  ];

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="max-w-[1180px] mx-auto px-10 py-10">
        {/* HEADER */}
        <div className="flex items-start justify-between mb-[22px] flex-wrap gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-[14px] mb-2 flex-wrap">
              <h1 className="text-[34px] font-bold tracking-[-.02em] m-0">
                Orçamento Detalhado
              </h1>
              <span
                className="font-mono text-[11px] font-bold px-[10px] py-[5px] rounded-[6px]"
                style={{ background: ACCENT, color: "#111110" }}
              >
                SINAPI 08/2026
              </span>
              {isSimulated && (
                <span
                  className="font-mono text-[10px] font-bold px-[9px] py-[5px] rounded-[6px] inline-flex items-center gap-1"
                  style={{ background: "#c0392b", color: "#fff" }}
                  title="Worker de IA indisponível — valores simulados"
                >
                  <AlertOctagon size={11} strokeWidth={2.4} />
                  SIMULADO
                </span>
              )}
            </div>

            {/* Seletor de análise (quando há mais de uma concluída) */}
            {data && data.length > 1 ? (
              <div className="relative mt-2 inline-block">
                <button
                  onClick={() => setSelectorOpen((v) => !v)}
                  className="inline-flex items-center gap-2 font-mono text-[13px] text-[#5c5c58] hover:text-[#111110] transition-colors"
                >
                  <span className="font-bold" style={{ color: ACCENT }}>
                    {analysis?.code || "—"}
                  </span>
                  <span>·</span>
                  <span>{analysis?.project || "—"}</span>
                  <span>·</span>
                  <span>{analysis?.plan || "—"}</span>
                  <span>·</span>
                  <span>
                    {area != null ? `${br(area, 1)} m²` : "—"}
                  </span>
                  <ChevronDown
                    size={14}
                    className="transition-transform"
                    style={{
                      transform: selectorOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
                {selectorOpen && (
                  <div className="absolute left-0 top-full mt-2 z-20 bg-white border border-[#e2e0da] rounded-xl shadow-lg py-1 min-w-[320px]">
                    {data.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          setSelectedId(a.id);
                          setSelectorOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#faf9f6] transition-colors flex items-center justify-between gap-3"
                        style={{
                          background:
                            a.id === selectedId ? "#fff8f2" : undefined,
                        }}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-mono text-[12px] font-bold"
                              style={{ color: ACCENT }}
                            >
                              {a.code || "—"}
                            </span>
                            <span className="text-[14px] font-semibold truncate">
                              {a.project || "—"}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-[#9a9a95] truncate">
                            {a.plan || "—"} ·{" "}
                            {a.area != null ? `${br(a.area, 1)} m²` : "—"} ·{" "}
                            {a.estimatedCost != null
                              ? `R$ ${br(a.estimatedCost)}`
                              : "—"}
                          </div>
                        </div>
                        {a.analysisMode === "simulado" && (
                          <span
                            className="font-mono text-[9px] font-bold px-[6px] py-[3px] rounded-[4px] flex-none"
                            style={{ background: "#c0392b", color: "#fff" }}
                          >
                            SIM
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="font-mono text-[13px] text-[#9a9a95] m-0">
                {analysis
                  ? `${analysis.project || "—"} · ${analysis.plan || "—"} · ${
                      area != null ? `${br(area, 1)} m²` : "—"
                    } · Gerado em ${formatDate(analysis.date)}`
                  : "—"}
              </p>
            )}
          </div>

          <div className="flex items-center gap-[10px] flex-wrap">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 border-[1.5px] border-[#111110] text-[14px] font-semibold px-4 py-[10px] rounded-[11px] hover:bg-[#111110] hover:text-white transition-colors"
            >
              <Printer size={15} strokeWidth={2} />
              Imprimir
            </button>
            <button
              disabled
              title="Exportação Excel em breve"
              className="inline-flex items-center gap-2 border-[1.5px] border-[#e2e0da] text-[14px] font-semibold px-4 py-[10px] rounded-[11px] text-[#9a9a95] cursor-not-allowed"
            >
              <FileSpreadsheet size={15} strokeWidth={2} />
              Excel
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 text-[14px] font-bold px-[18px] py-[10px] rounded-[11px] hover:opacity-90 transition-opacity"
              style={{ background: ACCENT, color: "#111110" }}
            >
              <FileText size={15} strokeWidth={2} />
              PDF
            </button>
          </div>
        </div>

        {/* WARNING */}
        <div
          className="flex gap-3 rounded-[14px] p-[15px_18px] mb-[22px]"
          style={{ background: "#fff8f2", border: "1px solid #ffd9c2" }}
        >
          <AlertTriangle
            size={18}
            strokeWidth={2}
            className="flex-none mt-[1px]"
            style={{ color: ACCENT }}
          />
          <p className="text-[13.5px] leading-[1.55] text-[#5c5c58] m-0">
            Este orçamento é uma{" "}
            <span
              className="px-[5px] font-semibold"
              style={{ background: ACCENT, color: "#111110" }}
            >
              estimativa preliminar
            </span>{" "}
            baseada em composição SINAPI e leitura automática da planta. Margem de
            ±{MARGIN}% aplicada. <strong>Não substitui</strong> orçamento
            executivo nem ART de engenheiro responsável.
          </p>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="bg-white border border-[#e2e0da] rounded-2xl p-12 text-center text-[#9a9a95] font-mono text-sm">
            Carregando orçamento...
          </div>
        )}

        {/* ERROR */}
        {!loading && error && (
          <div className="bg-[#fff0ea] border border-[#ffd9c2] rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
            <AlertOctagon size={24} style={{ color: "#c0392b" }} />
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

        {/* EMPTY */}
        {!loading && !error && (!data || data.length === 0) && (
          <div className="bg-white border border-[#e2e0da] rounded-2xl p-12 text-center">
            <div
              className="w-[64px] h-[64px] rounded-full mx-auto mb-5 flex items-center justify-center"
              style={{ background: "#111110" }}
            >
              <FileText size={28} style={{ color: ACCENT }} strokeWidth={2} />
            </div>
            <h2 className="text-[22px] font-bold mb-2">
              Nenhum orçamento disponível ainda
            </h2>
            <p className="text-[15px] text-[#5c5c58] max-w-[440px] mx-auto mb-6 leading-[1.55]">
              Envie uma planta baixa para gerar quantitativos e um orçamento
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
        )}

        {/* CONTENT */}
        {!loading && !error && analysis && (
          <>
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div
                className="rounded-2xl p-5"
                style={{ background: "#111110" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] tracking-[.06em] text-[#b8b6ae]">
                    CUSTO ESTIMADO
                  </span>
                  <span style={{ color: ACCENT }} className="font-bold">
                    $
                  </span>
                </div>
                <div
                  className="text-[26px] font-bold"
                  style={{ color: ACCENT }}
                >
                  {cost != null ? `R$ ${br(cost)}` : "—"}
                </div>
              </div>
              <SummaryCard
                label={`FAIXA (±${MARGIN}%)`}
                icon={<TrendingUp size={15} strokeWidth={2} />}
                value={
                  minCost != null && maxCost != null
                    ? `${br(minCost)} — ${br(maxCost)}`
                    : "—"
                }
                small
              />
              <SummaryCard
                label="CUSTO POR M²"
                icon={<Layers size={15} strokeWidth={2} />}
                value={costPerM2 != null ? `R$ ${br(costPerM2)}` : "—"}
                suffix={costPerM2 != null ? "/m²" : undefined}
              />
              <SummaryCard
                label="ITENS ORÇADOS"
                icon={<Hammer size={15} strokeWidth={2} />}
                value={String(realItems.length)}
                suffix="itens da IA"
              />
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
              {/* TABLE */}
              <div
                className="rounded-[18px] overflow-hidden"
                style={{ background: "#fff", border: "1px solid #e2e0da" }}
              >
                <div className="flex items-center justify-between px-6 py-5 border-b border-[#f0efec]">
                  <div className="flex items-baseline gap-[10px]">
                    <span className="text-[18px] font-bold">
                      Quantitativos Estimados
                    </span>
                    <span className="font-mono text-[12px] text-[#9a9a95]">
                      {realItems.length} itens
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-[7px] text-[13px] font-semibold text-[#6f6f69]">
                    <Filter size={14} strokeWidth={2} />
                    Filtrar
                  </span>
                </div>

                {/* Honest note about SINAPI granularity */}
                <div
                  className="px-6 py-3 text-[12.5px] leading-[1.5] text-[#5c5c58] border-b border-[#f0efec]"
                  style={{ background: "#fbfaf7" }}
                >
                  Composição detalhada por insumo SINAPI em breve — os valores
                  abaixo usam a estimativa da análise de IA.
                </div>

                {/* Header row */}
                <div
                  className="grid gap-3 px-6 py-3 font-mono text-[11px] tracking-[.04em] text-[#9a9a95] border-b border-[#f0efec]"
                  style={{ gridTemplateColumns: "56px 1fr 140px" }}
                >
                  <span>#</span>
                  <span>ITEM</span>
                  <span style={{ textAlign: "right" }}>QUANTIDADE</span>
                </div>

                {/* Rows */}
                {realItems.length > 0 ? (
                  realItems.map((it) => (
                    <div
                      key={it.code}
                      className="grid gap-3 px-6 py-[13px] items-center border-b border-[#f4f3ef]"
                      style={{ gridTemplateColumns: "56px 1fr 140px" }}
                    >
                      <span
                        className="font-mono text-[12px] font-bold"
                        style={{ color: ACCENT }}
                      >
                        {it.code}
                      </span>
                      <span className="text-[14px]">{it.label}</span>
                      <span
                        className="font-mono text-[13px] font-bold text-right"
                        style={{ color: "#111110" }}
                      >
                        {it.value}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-10 text-center text-[#9a9a95] text-sm">
                    Esta análise não retornou quantitativos detalhados.
                  </div>
                )}

                {/* Footer total */}
                <div
                  className="flex items-center justify-end gap-7 px-6 py-[18px]"
                  style={{ background: "#111110" }}
                >
                  <span className="font-mono text-[12px] tracking-[.06em] text-[#b8b6ae]">
                    TOTAL ESTIMADO
                  </span>
                  <span
                    className="text-[22px] font-bold"
                    style={{ color: ACCENT }}
                  >
                    {cost != null ? `R$ ${br(cost)}` : "—"}
                  </span>
                </div>
              </div>

              {/* SIDEBAR */}
              <div className="flex flex-col gap-4">
                {/* Por Categoria */}
                <div
                  className="rounded-2xl p-5"
                  style={{ background: "#fff", border: "1px solid #e2e0da" }}
                >
                  <div className="flex items-center gap-[9px] mb-4">
                    <Layers size={16} style={{ color: ACCENT }} strokeWidth={2} />
                    <span className="text-[16px] font-bold">Por Categoria</span>
                  </div>
                  <div
                    className="flex items-center justify-between rounded-[10px] px-[14px] py-[11px] mb-[14px]"
                    style={{
                      background: "#fff8f2",
                      border: "1px solid #ffd9c2",
                    }}
                  >
                    <span
                      className="text-[14px] font-bold"
                      style={{ color: ACCENT }}
                    >
                      Todos os itens
                    </span>
                    <span
                      className="font-mono text-[13px] font-bold"
                      style={{ color: ACCENT }}
                    >
                      {realItems.length}
                    </span>
                  </div>
                  {categories.length > 0 ? (
                    categories.map((c) => (
                      <div key={c.name} className="mb-[14px]">
                        <div className="flex items-center justify-between mb-[5px]">
                          <span className="text-[14px] font-semibold">
                            {c.name}
                          </span>
                          <span className="font-mono text-[12px] text-[#9a9a95]">
                            {c.count}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-[#9a9a95] m-0">
                      Sem categorias disponíveis para esta análise.
                    </p>
                  )}
                </div>

                {/* Sobre esta estimativa */}
                <div
                  className="rounded-2xl p-5"
                  style={{ background: "#fff8f2", border: "1px solid #ffd9c2" }}
                >
                  <div className="flex items-center gap-[9px] mb-3">
                    <Info size={16} strokeWidth={2} style={{ color: ACCENT }} />
                    <span className="text-[15px] font-bold">
                      Sobre esta estimativa
                    </span>
                  </div>
                  <p className="text-[13px] leading-[1.55] text-[#5c5c58] m-0 mb-3">
                    Base de preços: SINAPI 08/2026 (desonerado). BDI não incluso.
                    Valores sujeitos a variação regional e de mercado.
                  </p>
                  <div className="flex gap-2">
                    <span className="font-mono text-[11px] font-bold px-[9px] py-1 rounded-[5px] bg-[#eeede9] text-[#6f6f69]">
                      BDI 0%
                    </span>
                    <span className="font-mono text-[11px] font-bold px-[9px] py-1 rounded-[5px] bg-[#eeede9] text-[#6f6f69]">
                      ±{MARGIN}%
                    </span>
                    {isSimulated && (
                      <span className="font-mono text-[11px] font-bold px-[9px] py-1 rounded-[5px] bg-[#c0392b] text-white">
                        SIMULADO
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações Rápidas */}
                <div
                  className="rounded-2xl p-5"
                  style={{ background: "#fff", border: "1px solid #e2e0da" }}
                >
                  <div className="text-[15px] font-bold mb-[14px]">
                    Ações Rápidas
                  </div>
                  <div className="flex flex-col gap-[10px]">
                    <button
                      disabled
                      title="Em breve"
                      className="flex items-center gap-[10px] border border-[#e2e0da] rounded-[11px] px-[14px] py-3 text-[13.5px] font-semibold text-[#9a9a95] cursor-not-allowed text-left"
                    >
                      <Download size={15} style={{ color: ACCENT }} strokeWidth={2} />
                      Baixar memória de cálculo
                    </button>
                    <button
                      disabled
                      title="Em breve"
                      className="flex items-center gap-[10px] border border-[#e2e0da] rounded-[11px] px-[14px] py-3 text-[13.5px] font-semibold text-[#9a9a95] cursor-not-allowed text-left"
                    >
                      <Droplets size={15} style={{ color: ACCENT }} strokeWidth={2} />
                      Ajustar BDI e encargos
                    </button>
                    <button
                      disabled
                      title="Em breve"
                      className="flex items-center gap-[10px] border border-[#e2e0da] rounded-[11px] px-[14px] py-3 text-[13.5px] font-semibold text-[#9a9a95] cursor-not-allowed text-left"
                    >
                      <TrendingUp size={15} style={{ color: ACCENT }} strokeWidth={2} />
                      Comparar com CUB regional
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  suffix,
  icon,
  small,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "#fff", border: "1px solid #e2e0da" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[11px] tracking-[.06em] text-[#9a9a95]">
          {label}
        </span>
        <span style={{ color: "#c9c6bd" }}>{icon}</span>
      </div>
      <div
        className={small ? "text-[20px] font-bold leading-[1.25]" : "text-[26px] font-bold"}
      >
        {value}
        {suffix && (
          <span className="font-mono text-[13px] font-normal text-[#9a9a95] ml-1">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function br(value: number, fractionDigits = 2): string {
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
    });
  } catch {
    return "—";
  }
}