"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PlanOverlay } from "@/components/plan-overlay";
import { listAnalises, listProjetos, AnalysisDto, ProjectDto } from "@/lib/api";
import { Maximize2, RefreshCw, Download, ArrowRight, AlertTriangle, DollarSign, AlertOctagon, ChevronDown } from "lucide-react";

// Chave compartilhada com a página de Plantas (Item 6) para manter o projeto ativo entre telas.
const SELECTED_PROJECT_KEY = "traco_dashboard_selected_project";

const ACCENT = "#ff5a1f";

function br(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null) return "–";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

export default function DashboardPage() {
  const [analysis, setAnalysis] = useState<AnalysisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Load projects on mount
  useEffect(() => {
    let mounted = true;
    async function loadProjects() {
      try {
        const data = await listProjetos();
        if (mounted) setProjects(data);
      } catch {
        // Non-blocking
      }
    }
    loadProjects();
    return () => { mounted = false; };
  }, []);

  // Restore selected project from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SELECTED_PROJECT_KEY);
      if (stored) setSelectedProjectId(Number(stored));
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Persist selection and reload analyses when projectId changes
  const loadAnalyses = useCallback(async (projectId: number | null) => {
    setLoading(true);
    try {
      const all = await listAnalises(projectId ?? undefined);
      setAnalysis(all.length > 0 ? all[0] : null);
    } catch (e) {
      console.error("Failed to load analyses", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalyses(selectedProjectId);
  }, [selectedProjectId, loadAnalyses]);

  const handleProjectChange = (id: number | null) => {
    setSelectedProjectId(id);
    setShowProjectDropdown(false);
    try {
      if (id != null) {
        localStorage.setItem(SELECTED_PROJECT_KEY, String(id));
      } else {
        localStorage.removeItem(SELECTED_PROJECT_KEY);
      }
    } catch {
      // localStorage unavailable
    }
  };

  const isSimulated = analysis?.analysisMode === "simulado";
  const isConcluded = analysis?.status === "concluida";

  const selectedProjectName = projects.find((p) => p.id === selectedProjectId)?.name;

  const breadcrumbs = [
    { label: "Projetos", href: "/projetos" },
    { label: selectedProjectName ?? analysis?.project ?? "Todos os projetos" },
    ...(analysis?.plan ? [{ label: analysis.plan }] : []),
  ];

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="p-[26px] pb-0">
        {/* PROJECT SELECTOR — shared key with Plantas page (Item 6) */}
        <div className="relative inline-block mb-[22px]">
          <button
            onClick={() => setShowProjectDropdown((v) => !v)}
            disabled={loading}
            className="inline-flex items-center gap-[8px] px-[14px] py-[9px] bg-white border border-[#e2e0da] rounded-xl text-[14px] font-semibold text-[#111110] hover:border-[#111110] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="font-mono text-[11px] font-bold tracking-[.06em] text-[#9a9a95] uppercase mr-[4px]">Projeto</span>
            <span className="max-w-[220px] truncate">
              {selectedProjectName ?? "Todos os projetos"}
            </span>
            <ChevronDown size={15} strokeWidth={2.2} className={`text-[#9a9a95] transition-transform ${showProjectDropdown ? "rotate-180" : ""}`} />
          </button>
          {showProjectDropdown && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowProjectDropdown(false)} />
              <div className="absolute left-0 top-full mt-[6px] w-[280px] bg-white border border-[#e2e0da] rounded-xl shadow-lg z-40 py-[6px] max-h-[320px] overflow-auto">
                <button
                  onClick={() => handleProjectChange(null)}
                  className={`w-full text-left px-[14px] py-[10px] text-[14px] hover:bg-[#f7f6f2] transition-colors ${selectedProjectId === null ? "font-bold text-[#111110]" : "text-[#6f6f69]"}`}
                >
                  Todos os projetos
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProjectChange(p.id)}
                    className={`w-full text-left px-[14px] py-[10px] text-[14px] hover:bg-[#f7f6f2] transition-colors truncate ${selectedProjectId === p.id ? "font-bold text-[#111110]" : "text-[#6f6f69]"}`}
                  >
                    {p.name}
                  </button>
                ))}
                {projects.length === 0 && (
                  <div className="px-[14px] py-[10px] text-[13px] text-[#9a9a95]">
                    Nenhum projeto cadastrado
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_372px] gap-[22px] px-[26px] pb-[26px] h-full min-h-0">

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