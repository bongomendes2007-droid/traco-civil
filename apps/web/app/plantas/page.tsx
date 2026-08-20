"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useState } from "react";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

const ACCENT = "#ff5a1f";

type PlantStatus = "done" | "proc" | "err";

interface Plant {
  name: string;
  project: string;
  ext: string;
  size: string;
  date: string;
  area?: string;
  rooms?: string;
  status: PlantStatus;
}

const plants: Plant[] = [
  { name: "Planta Térreo.pdf", project: "Residencial Alpha", ext: "PDF", size: "2.4 MB", date: "14 Ago 2026", area: "142,6 m²", rooms: "4", status: "done" },
  { name: "Pavimento Superior.pdf", project: "Residencial Alpha", ext: "PDF", size: "2.1 MB", date: "13 Ago 2026", area: "128,4 m²", rooms: "5", status: "done" },
  { name: "Subsolo Garagem.pdf", project: "Edifício Comercial Beta", ext: "PDF", size: "3.8 MB", date: "14 Ago 2026", status: "proc" },
  { name: "Planta Comercial Térreo.dwg", project: "Edifício Comercial Beta", ext: "DWG", size: "5.6 MB", date: "08 Ago 2026", area: "486,2 m²", rooms: "12", status: "done" },
  { name: "Fachada Frontal.png", project: "Residencial Alpha", ext: "PNG", size: "840 KB", date: "13 Ago 2026", status: "err" },
  { name: "Galpão Principal.pdf", project: "Galpão Industrial Gamma", ext: "PDF", size: "1.9 MB", date: "01 Ago 2026", area: "720,0 m²", rooms: "6", status: "done" },
  { name: "Casa Térrea Delta.pdf", project: "Casa Térrea Delta", ext: "PDF", size: "1.2 MB", date: "14 Ago 2026", status: "proc" },
];

const filters = [
  { id: "all", label: "Todas" },
  { id: "done", label: "Concluídas" },
  { id: "proc", label: "Processando" },
  { id: "err", label: "Com erro" },
];

export default function PlantasPage() {
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredPlants = plants.filter((p) => {
    if (activeFilter === "all") return true;
    return p.status === activeFilter;
  });

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
              7 arquivos · 4 analisadas · 2 em processamento
            </p>
          </div>
          <button
            className="inline-flex items-center gap-[9px] text-[15px] font-bold px-[22px] py-[13px] rounded-xl hover:opacity-90 transition-opacity"
            style={{ background: ACCENT, color: "#111110" }}
          >
            <Upload size={17} strokeWidth={2.2} />
            Nova Planta
          </button>
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
              7<span className="font-mono text-[13px] font-normal text-[#9a9a95]"> plantas</span>
            </div>
          </div>

          {/* ARMAZENAMENTO */}
          <div className="bg-white border border-[#e2e0da] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] tracking-[.06em] text-[#9a9a95]">ARMAZENAMENTO</span>
              <Database size={16} strokeWidth={2} className="text-[#c9c6bd]" />
            </div>
            <div className="text-[28px] font-bold">
              17,8<span className="font-mono text-[13px] font-normal text-[#9a9a95]"> MB</span>
            </div>
          </div>

          {/* ÁREA ANALISADA (BLACK CARD) */}
          <div className="bg-[#111110] border border-[#111110] rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] tracking-[.06em] text-[#b8b6ae]">ÁREA ANALISADA</span>
              <PenTool size={16} strokeWidth={2} style={{ color: ACCENT }} />
            </div>
            <div className="text-[28px] font-bold" style={{ color: ACCENT }}>
              1.477,2<span className="font-mono text-[13px] font-normal text-[#b8b6ae]"> m²</span>
            </div>
          </div>

          {/* AMBIENTES DETECTADOS */}
          <div className="bg-white border border-[#e2e0da] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] tracking-[.06em] text-[#9a9a95]">AMBIENTES DETECTADOS</span>
              <LayoutGrid size={16} strokeWidth={2} className="text-[#c9c6bd]" />
            </div>
            <div className="text-[28px] font-bold">
              27<span className="font-mono text-[13px] font-normal text-[#9a9a95]"> cômodos</span>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 mb-6">
          <div className="w-full sm:flex-1 sm:max-w-[420px] flex items-center gap-2.5 bg-white border border-[#e2e0da] rounded-xl px-4 py-3">
            <Search size={17} strokeWidth={2} className="text-[#9a9a95]" />
            <input
              type="text"
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

        {/* Plants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlants.map((plant, idx) => (
            <PlantCard key={idx} plant={plant} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function PlantCard({ plant }: { plant: Plant }) {
  const isDone = plant.status === "done";
  const isProc = plant.status === "proc";
  const isErr = plant.status === "err";

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
          {plant.ext}
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
        <div className="font-mono text-xs text-[#9a9a95] mt-[3px] mb-[14px]">{plant.project}</div>

        <div className="flex items-center gap-4 font-mono text-xs text-[#8a8a85] pb-[14px] border-b border-[#f0efec]">
          <span>{plant.size}</span>
          <span>{plant.date}</span>
        </div>

        <div className="flex items-center justify-between py-3">
          <span className="text-[13px] text-[#8a8a85]">Área</span>
          <span className="font-mono text-sm font-bold" style={{ color: areaColor }}>
            {plant.area || "—"}
          </span>
        </div>
        <div className="flex items-center justify-between pb-[14px]">
          <span className="text-[13px] text-[#8a8a85]">Ambientes</span>
          <span className="font-mono text-sm font-bold" style={{ color: areaColor }}>
            {plant.rooms || "—"}
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