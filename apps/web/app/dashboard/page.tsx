"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PlanOverlay } from "@/components/plan-overlay";
import { listAnalises, AnalysisDto } from "@/lib/api";
import { Maximize2, RefreshCw, Download, ArrowRight, AlertTriangle, DollarSign, AlertOctagon } from "lucide-react";

const ACCENT = "#ff5a1f";

function br(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null) return "–";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

export default function DashboardPage() {
  const [analysis, setAnalysis] = useState<AnalysisDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const all = await listAnalises();
        if (mounted && all.length > 0) {
          // Pega a análise mais recente (lista vem ordenada por id desc no backend)
          setAnalysis(all[0]);
        }
      } catch (e) {
        console.error("Failed to load analyses", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const isSimulated = analysis?.analysisMode === "simulado";
  const isConcluded = analysis?.status === "concluida";

  const breadcrumbs = [
    { label: "Projetos", href: "/projetos" },
    { label: analysis?.project ?? "Residencial Alpha", href: "/projetos/alpha" },
    { label: analysis?.plan ?? "Planta Térreo" },
  ];

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_372px] gap-[22px] p-[26px] h-full min-h-0">

        {/* CANVAS PANEL */}
        <section className="flex flex-col bg-white border border-[#ececea] rounded-[20px] overflow-hidden min-w-0 shadow-sm">
          {/* Canvas Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0efec]">
            <div className="flex items-center gap-[14px] min-w-0 flex-wrap">
              {isSimulated ? (
                <span
                  className="inline-flex items-center gap-[6px] font-mono text-[11px] font-bold tracking-[.06em] px-[10px] py-[5px] rounded-md whitespace-nowrap"
                  style={{ background: "#c0392b", color: "#ffffff" }}
                  title="Não foi possível processar esta análise agora. Tente novamente em alguns instantes ou entre em contato com o suporte."
                >
                  <AlertOctagon size={13} strokeWidth={2.4} />
                  ERRO NO PROCESSAMENTO
                </span>
              ) : (
                <span
                  className="font-mono text-[11px] font-bold tracking-[.06em] px-[10px] py-[5px] rounded-md whitespace-nowrap"
                  style={{ background: ACCENT, color: "#111110" }}
                >
                  {loading ? "CARREGANDO..." : "IA ATIVA"}
                </span>
              )}
              <span className="font-mono text-xs text-[#9a9a95] whitespace-nowrap overflow-hidden text-ellipsis hidden sm:block">
                {loading
                  ? "Buscando última análise..."
                  : analysis
                    ? `Detecção automática · ${analysis.rooms ?? "–"} ambientes identificados`
                    : "Nenhuma análise encontrada"}
              </span>
            </div>
            <div className="flex items-center gap-[14px] flex-none">
              <button className="text-[#6f6f69] hover:text-[#111110] transition-colors">
                <Maximize2 size={17} strokeWidth={2} />
              </button>
              <button className="text-[#6f6f69] hover:text-[#111110] transition-colors">
                <RefreshCw size={17} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Simulated banner (full-width, above canvas) */}
          {isSimulated && (
            <div className="flex items-start gap-3 px-5 py-3 bg-[#fdecea] border-b border-[#f5c6cb]">
              <AlertOctagon size={18} className="flex-none mt-[1px]" style={{ color: "#c0392b" }} strokeWidth={2} />
              <p className="text-[13px] leading-[1.5] text-[#92231a] m-0">
                Não foi possível processar esta análise agora. Tente novamente em alguns instantes ou entre em contato com o suporte.
              </p>
            </div>
          )}

          {/* Canvas Area — overlay real da planta ou fallback visual */}
          <div
            className="flex-1 flex items-center justify-center p-[18px] relative overflow-hidden min-h-[320px]"
            style={{
              backgroundColor: "#faf7f2",
              backgroundImage: "radial-gradient(#e6e2d8 1px, transparent 1px)",
              backgroundSize: "22px 22px"
            }}
          >
            {analysis?.plantaId ? (
              <PlanOverlay
                plantaId={analysis.plantaId}
                roomsGeometry={analysis.roomsGeometry}
                scaleInfo={analysis.scaleInfo}
                className="w-full h-full"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <span className="font-mono text-xs text-[#b2ada2]">
                  {analysis
                    ? "Imagem da planta não disponível nesta análise"
                    : "Nenhuma análise carregada"}
                </span>
                {(analysis?.roomsDetail?.length ?? 0) > 0 && (
                  <span className="font-mono text-[11px] text-[#9a9a95]">
                    {analysis!.roomsDetail!.length} ambientes detectados · ver detalhes abaixo
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Canvas Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0efec] font-mono text-xs text-[#9a9a95]">
            <span>Escala 1:50 · {analysis ? `Análise ${analysis.code}` : "PDF 2.4MB"}</span>
            <span className="flex items-center gap-[6px]">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: isSimulated ? "#c0392b" : ACCENT }} />
              {isSimulated ? "erro no processamento" : "análise concluída"}
            </span>
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside className="flex flex-col gap-4 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-bold mb-[5px]">Análise por IA</h2>
              <p className="font-mono text-xs text-[#9a9a95]">
                {loading
                  ? "Carregando..."
                  : analysis
                    ? `Processado em ${analysis.durationSeconds ?? "–"}s · Confiança ${analysis.confidence ?? "–"}%`
                    : "Sem análises ainda"}
              </p>
            </div>
            {isConcluded && (
              <span className="flex-none inline-flex items-center gap-[6px] bg-[#eaf7e6] text-[#2f7d32] font-mono text-[10px] font-bold tracking-[.06em] px-[10px] py-[6px] rounded-md">
                <span className="w-[6px] h-[6px] bg-[#3a9d3f] rounded-full" />
                CONCLUÍDO
              </span>
            )}
          </div>

          {/* Warning Box — margin disclaimer (always) + simulated emphasis */}
          <div className="flex gap-3 bg-[#fff8f2] border border-[#ffd9c2] rounded-[14px] p-[14px_16px]">
            <AlertTriangle size={18} className="flex-none mt-[1px]" style={{ color: ACCENT }} strokeWidth={2} />
            <p className="text-[13px] leading-[1.5] text-[#5c5c58] m-0">
              Os valores abaixo são <span className="font-semibold px-[5px]" style={{ background: ACCENT, color: "#111110" }}>estimativas</span> com margem de ±8%. Consulte um engenheiro responsável antes de decisões finais.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-[#ececea] rounded-[14px] p-[14px] bg-white">
              <div className="font-mono text-[11px] text-[#9a9a95] mb-[6px]">AMBIENTES</div>
              <div className="text-2xl font-bold">{analysis?.rooms ?? "Aguardando análise"}</div>
            </div>
            <div className="border border-[#ececea] rounded-[14px] p-[14px] bg-white">
              <div className="font-mono text-[11px] text-[#9a9a95] mb-[6px]">ÁREA TOTAL</div>
              <div className="text-2xl font-bold">
                {br(analysis?.area)}<span className="text-sm font-medium text-[#9a9a95]"> m²</span>
              </div>
            </div>
          </div>

          {/* Budget Card */}
          <div className="mt-auto bg-[#111110] rounded-[18px] p-[22px] text-white">
            <div className="flex items-center justify-between mb-[14px]">
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-[.08em] text-[#b8b6ae]">
                <DollarSign size={14} style={{ color: ACCENT }} strokeWidth={2.4} />
                ORÇAMENTO ESTIMADO
              </span>
              <span className="font-mono text-[10px] font-bold text-[#111110] px-2 py-1 rounded-[5px]" style={{ background: ACCENT }}>
                SINAPI 08/26
              </span>
            </div>

            <div className="text-[38px] font-bold tracking-[-.02em] mb-[14px]" style={{ color: ACCENT }}>
              R$ {br(analysis?.estimatedCost)}
            </div>

            <div className="flex items-center justify-between mb-5">
              <span className="font-mono text-xs text-[#111110] px-[9px] py-1 rounded-[5px] font-bold" style={{ background: ACCENT }}>
                ±8% margem
              </span>
              <span className="font-mono text-[13px] text-[#b8b6ae]">
                {analysis?.area ? `R$ ${br((analysis.estimatedCost ?? 0) / analysis.area)}/m²` : "Aguardando análise"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              <button className="flex items-center justify-center gap-2 bg-transparent text-white border-[1.5px] border-[#3a382f] text-sm font-semibold py-3 rounded-[11px] hover:bg-[#1a1a1a] transition-colors">
                <Download size={15} strokeWidth={2} />
                Exportar
              </button>
              <button className="flex items-center justify-center gap-2 text-[#111110] text-sm font-bold py-3 rounded-[11px] hover:opacity-90 transition-opacity" style={{ background: ACCENT }}>
                Ver Relatório
                <ArrowRight size={15} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </aside>

      </div>
    </AppShell>
  );
}