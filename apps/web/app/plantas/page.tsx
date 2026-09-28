"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useEffect, useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { listPlantas, type PlantaDto } from "@/lib/api";
import Link from "next/link";
import {
  Upload,
  Search,
  FileText,
  Database,
  PenTool,
  LayoutGrid,
  Check,
  Clock,
  RotateCcw,
  Eye,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";

const ACCENT = "#ff5a1f";
// Chave compartilhada com Dashboard (Item 5) para manter o projeto ativo entre telas.
const SELECTED_PROJECT_KEY = "traco_dashboard_selected_project";

type PlantStatus = "done" | "proc" | "err";

function mapStatus(status: string): PlantStatus {
  const s = status.toLowerCase();
  if (s === "concluida" || s === "concluída" || s === "done") return "done";
  if (s === "processando" || s === "processing" || s === "proc") return "proc";
  if (s === "erro" || s === "error" || s === "err" || s === "falha") return "err";
  return "proc";
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
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

const filters = [
  { id: "all", label: "Todas" },
  { id: "done", label: "Concluídas" },
  { id: "proc", label: "Processando" },
  { id: "err", label: "Com erro" },
];

export default function PlantasPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [plants, setPlants] = useState<PlantaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Restore selected project from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SELECTED_PROJECT_KEY);
      if (stored) setSelectedProjectId(Number(stored));
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Load plantas filtered by selected project
  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await listPlantas(selectedProjectId ?? undefined);
        if (mounted) setPlants(data);
      } catch (err: any) {
        if (mounted) {
          const status = err?.status;
          setError(
            status === 502 || status === 504 || !status
              ? "O servidor está iniciando. Tente novamente em alguns segundos."
              : "Não foi possível carregar as plantas. Tente novamente."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [selectedProjectId]);

  // Listen for localStorage changes from other tabs/pages
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === SELECTED_PROJECT_KEY) {
        setSelectedProjectId(e.newValue ? Number(e.newValue) : null);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const mappedPlants = useMemo(() => {
    return plants.map((p) => ({
      ...p,
      uiStatus: mapStatus(p.status),
    }));
  }, [plants]);

  const filteredPlants = useMemo(() => {
    return mappedPlants.filter((p) => {
      if (activeFilter !== "all" && p.uiStatus !== activeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const projMatch = p.project?.toLowerCase().includes(q);
        if (!nameMatch && !projMatch) return false;
      }
      return true;
    });
  }, [mappedPlants, activeFilter, search]);

  // Dynamic stats
  const stats = useMemo(() => {
    const total = mappedPlants.length;
    const doneCount = mappedPlants.filter((p) => p.uiStatus === "done").length;
    const procCount = mappedPlants.filter((p) => p.uiStatus === "proc").length;
    const totalBytes = mappedPlants.reduce((sum, p) => sum + (p.sizeBytes || 0), 0);
    const totalArea = mappedPlants.reduce((sum, p) => sum + (p.area || 0), 0);
    const totalRooms = mappedPlants.reduce((sum, p) => sum + (p.rooms || 0), 0);
    return { total, doneCount, procCount, totalBytes, totalArea, totalRooms };
  }, [mappedPlants]);

  const breadcrumbs = [
    { label: "Projetos", href: "/projetos" },
    { label: "Plantas" },
  ];

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="max-w-[1180px] mx-auto px-10 py-11">
        {/* Header */}
        <div className="flex items-start justify-between mb-7">
          <div>
            <h1 className="text-[38px] font-bold tracking-[-.02em] mb-1.5">Plantas</h1>
            <p className="font-mono text-[13px] text-[#9a9a95]">
              {stats.total} arquivo{stats.total !== 1 ? "s" : ""} &middot; {stats.doneCount} analisada{stats.doneCount !== 1 ? "s" : ""} &middot; {stats.procCount} em processamento
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center gap-[9px] text-[15px] font-bold px-[22px] py-[13px] rounded-xl hover:opacity-90 transition-opacity"
            style={{ background: ACCENT, color: "#111110" }}
          >
            <Upload size={17} strokeWidth={2.2} />
            Nova Planta
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {/* ARQUIVOS */}
          <div className="bg-white border border-[#e2e0da] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] tracking-[.06em] text-[#9a9a95]">ARQUIVOS</span>
              <FileText size={16} strokeWidth={2} className="text-[#c9c6bd]" />
            </div>
            <div className="text-[28px] font-bold">
              {stats.total}<span className="font-mono text-[13px] font-normal text-[#9a9a95]"> plantas</span>
            </div>
          </div>

          {/* ARMAZENAMENTO */}
          <div className="bg-white border border-[#e2e0da] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] tracking-[.06em] text-[#9a9a95]">ARMAZENAMENTO</span>
              <Database size={16} strokeWidth={2} className="text-[#c9c6bd]" />
            </div>
            <div className="text-[28px] font-bold">
              {fmtSize(stats.totalBytes)}
            </div>
          </div>

          {/* ÁREA ANALISADA (BLACK CARD) */}
          <div className="bg-[#111110] border border-[#111110] rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] tracking-[.06em] text-[#b8b6ae]">ÁREA ANALISADA</span>
              <PenTool size={16} strokeWidth={2} style={{ color: ACCENT }} />
            </div>
            <div className="text-[28px] font-bold" style={{ color: ACCENT }}>
              {stats.totalArea > 0
                ? stats.totalArea.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                : "0,0"}<span className="font-mono text-[13px] font-normal text-[#b8b6ae]"> m²</span>
            </div>
          </div>

          {/* AMBIENTES DETECTADOS */}
          <div className="bg-white border border-[#e2e0da] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] tracking-[.06em] text-[#9a9a95]">AMBIENTES DETECTADOS</span>
              <LayoutGrid size={16} strokeWidth={2} className="text-[#c9c6bd]" />
            </div>
            <div className="text-[28px] font-bold">
              {stats.totalRooms}<span className="font-mono text-[13px] font-normal text-[#9a9a95]"> cômodos</span>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 mb-6">
          <div className="w-full sm:flex-1 sm:max-w-[420px] flex items-center gap-2.5 bg-white border border-[#e2e0da] rounded-xl px-4 py-3">
            <Search size={17} strokeWidth={2} className="text-[#9a9a95]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou projeto..."
              className="bg-transparent border-none outline-none text-sm text-[#111110] placeholder:text-[#9a9a95] w-full"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-[13px] font-semibold border transition-colors",
                  activeFilter === f.id
                    ? "bg-[#111110] text-white border-[#111110]"
                    : "bg-white text-[#6f6f69] border-[#e2e0da] hover:bg-[#f4f4f1]"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="animate-spin text-[#9a9a95]" />
            <span className="font-mono text-[13px] text-[#9a9a95]">Carregando plantas...</span>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-[#b3261e] text-[15px] mb-4">{error}</p>
            <button
              onClick={() => setSelectedProjectId(selectedProjectId)}
              className="bg-[#111110] text-white border-none rounded-[11px] px-[22px] py-[11px] text-[14px] font-semibold cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredPlants.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-[#e2e0da] rounded-[18px]">
            <div
              className="w-14 h-14 rounded-[14px] mx-auto mb-4 flex items-center justify-center"
              style={{ background: "#fbeee7", color: ACCENT }}
            >
              <FileText size={26} strokeWidth={2} />
            </div>
            <h3 className="text-[22px] font-bold mb-2 tracking-[-.01em]">
              {search || activeFilter !== "all" ? "Nenhuma planta corresponde" : "Nenhuma planta ainda"}
            </h3>
            <p className="font-mono text-[13px] text-[#9a9a95] max-w-[420px] mx-auto leading-relaxed">
              {search || activeFilter !== "all"
                ? "Ajuste a busca/filtro ou envie uma nova planta."
                : "Envie sua primeira planta para iniciar a análise de IA e gerar o orçamento estimativo."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPlants.map((plant) => (
              <PlantCard key={plant.id} plant={plant} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PlantCard({ plant }: { plant: PlantaDto & { uiStatus: PlantStatus } }) {
  const isDone = plant.uiStatus === "done";
  const isProc = plant.uiStatus === "proc";
  const isErr = plant.uiStatus === "err";

  const planOpacity = isDone ? 1 : isProc ? 0.35 : 0.3;
  const areaColor = isDone ? "#111110" : "#c9c6bd";

  let btnBg = "#111110";
  let btnFg = "#fff";
  let btnBorder = "none";
  let btnLabel = "Ver Análise";
  let BtnIcon = Eye;

  if (isProc) {
    btnBg = "#f2f1ed";
    btnFg = "#9a9a95";
    btnBorder = "1px solid #e2e0da";
    btnLabel = "Na fila da IA";
    BtnIcon = Clock;
  } else if (isErr) {
    btnBg = "#fff";
    btnFg = "#111110";
    btnBorder = "1.5px solid #111110";
    btnLabel = "Reprocessar";
    BtnIcon = RotateCcw;
  }

  const ext = (plant.format ?? "PDF").toUpperCase();
  const areaDisplay = plant.area != null ? `${plant.area.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²` : null;
  const roomsDisplay = plant.rooms != null ? String(plant.rooms) : null;

  return (
    <div className="bg-white border border-[#e2e0da] rounded-[18px] overflow-hidden flex flex-col h-full">
      {/* Thumbnail Area */}
      <div className="relative h-[172px] bg-[#faf9f6] flex items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 300 150"
          className="w-[82%] h-auto"
          style={{ opacity: planOpacity }}
          fill="none"
        >
          <rect x="20" y="20" width="260" height="110" stroke="#3a382f" strokeWidth="3" />
          <path d="M150 20 V130 M20 75 H280" stroke="#3a382f" strokeWidth="3" />
          <text x="85" y="52" fontFamily="Space Mono, monospace" fontSize="10" fill="#9a9a92" textAnchor="middle">SALA</text>
          <text x="215" y="52" fontFamily="Space Mono, monospace" fontSize="10" fill="#9a9a92" textAnchor="middle">SUÍTE</text>
          <text x="85" y="107" fontFamily="Space Mono, monospace" fontSize="10" fill="#9a9a92" textAnchor="middle">COZINHA</text>
          <text x="215" y="107" fontFamily="Space Mono, monospace" fontSize="10" fill="#9a9a92" textAnchor="middle">BANHO</text>
        </svg>

        {/* Ext Badge */}
        <span
          className="absolute top-3 left-3 font-mono text-[9px] font-bold px-[7px] py-[3px] rounded-[5px]"
          style={{ background: "#fbeee7", color: ACCENT }}
        >
          {ext}
        </span>

        {/* Status Badges & Overlays */}
        {isDone && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-[5px] font-mono text-[10px] font-bold px-2 py-1 rounded-[5px] bg-[#eaf7e6] text-[#2f7d32]">
            <Check size={11} strokeWidth={3} />
            Concluída
          </span>
        )}

        {isProc && (
          <>
            <div className="absolute inset-0 bg-[rgba(30,28,24,0.55)] flex flex-col items-center justify-center gap-3 z-10">
              <div
                className="w-[34px] h-[34px] border-[3px] border-[rgba(255,255,255,0.25)] rounded-full animate-spin"
                style={{ borderTopColor: ACCENT }}
              />
              <span className="font-mono text-[11px] text-white">IA lendo planta...</span>
            </div>
            <span
              className="absolute top-3 right-3 font-mono text-[10px] font-bold px-2 py-1 rounded-[5px] z-20"
              style={{ background: ACCENT, color: "#111110" }}
            >
              Processando
            </span>
          </>
        )}

        {isErr && (
          <>
            <div className="absolute inset-0 bg-[rgba(120,30,20,0.6)] flex flex-col items-center justify-center gap-2.5 px-6 text-center z-10">
              <div className="w-[34px] h-[34px] border-2 border-[#ffb4a2] rounded-full flex items-center justify-center text-[#ffd7cc] font-bold">
                !
              </div>
              <span className="font-mono text-[10.5px] leading-[1.4] text-[#ffe3db]">
                Não foi possível ler este arquivo. Verifique a qualidade do scan.
              </span>
            </div>
            <span className="absolute top-3 right-3 font-mono text-[10px] font-bold px-2 py-1 rounded-[5px] bg-[#c0392b] text-white z-20">
              Falha na leitura
            </span>
          </>
        )}
      </div>

      {/* Card Content */}
      <div className="p-[18px] flex flex-col flex-1">
        <div className="text-base font-bold">{plant.name}</div>
        <div className="font-mono text-xs text-[#9a9a95] mt-[3px] mb-[14px]">{plant.project ?? "Sem projeto"}</div>

        <div className="flex items-center gap-4 font-mono text-xs text-[#8a8a85] pb-[14px] border-b border-[#f0efec]">
          <span>{fmtSize(plant.sizeBytes)}</span>
          <span>{fmtDate(plant.uploadedAt)}</span>
        </div>

        <div className="flex items-center justify-between py-3">
          <span className="text-[13px] text-[#8a8a85]">Área</span>
          <span className="font-mono text-sm font-bold" style={{ color: areaColor }}>
            {areaDisplay ?? "Aguardando análise"}
          </span>
        </div>
        <div className="flex items-center justify-between pb-[14px]">
          <span className="text-[13px] text-[#8a8a85]">Ambientes</span>
          <span className="font-mono text-sm font-bold" style={{ color: areaColor }}>
            {roomsDisplay ?? "Aguardando análise"}
          </span>
        </div>

        <div className="flex items-center gap-[10px] mt-auto">
          <button
            className="flex-1 flex items-center justify-center gap-2 text-[13px] font-semibold py-[11px] rounded-[11px] transition-opacity hover:opacity-90"
            style={{ background: btnBg, color: btnFg, border: btnBorder }}
          >
            <BtnIcon size={14} strokeWidth={2} />
            {btnLabel}
          </button>
          <button className="w-10 h-10 border border-[#e2e0da] rounded-[10px] flex items-center justify-center text-[#9a9a95] hover:bg-[#f4f4f1] transition-colors">
            <Download size={15} strokeWidth={2} />
          </button>
          <button className="w-10 h-10 border border-[#e2e0da] rounded-[10px] flex items-center justify-center text-[#9a9a95] hover:bg-[#f4f4f1] transition-colors">
            <Trash2 size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
