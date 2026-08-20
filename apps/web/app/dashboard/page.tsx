"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Maximize2, RefreshCw, Download, ArrowRight, AlertTriangle, DollarSign } from "lucide-react";

const ACCENT = "#ff5a1f";

export default function DashboardPage() {
  const breadcrumbs = [
    { label: "Projetos", href: "/projetos" },
    { label: "Residencial Alpha", href: "/projetos/alpha" },
    { label: "Planta Térreo" },
  ];

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_372px] gap-[22px] p-[26px] h-full min-h-0">

        {/* CANVAS PANEL */}
        <section className="flex flex-col bg-white border border-[#ececea] rounded-[20px] overflow-hidden min-w-0 shadow-sm">
          {/* Canvas Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0efec]">
            <div className="flex items-center gap-[14px] min-w-0">
              <span
                className="font-mono text-[11px] font-bold tracking-[.06em] px-[10px] py-[5px] rounded-md whitespace-nowrap"
                style={{ background: ACCENT, color: "#111110" }}
              >
                IA ATIVA · DEMO
              </span>
              <span className="font-mono text-xs text-[#9a9a95] whitespace-nowrap overflow-hidden text-ellipsis hidden sm:block">
                Detecção automática · 4 ambientes identificados
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

          {/* Canvas Area (Dot Grid) */}
          <div
            className="flex-1 flex items-center justify-center p-[18px] relative overflow-hidden"
            style={{
              backgroundColor: "#faf7f2",
              backgroundImage: "radial-gradient(#e6e2d8 1px, transparent 1px)",
              backgroundSize: "22px 22px"
            }}
          >
            <svg viewBox="0 0 680 460" className="w-full max-w-[640px] h-auto block" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Top dimension */}
              <path d="M60 44 H620 M60 38 V50 M620 38 V50" stroke="#b7b2a6" strokeWidth="1.2"/>
              <rect x="305" y="34" width="70" height="20" rx="4" fill="#faf7f2"/>
              <text x="340" y="48" fontFamily="Space Mono, monospace" fontSize="11" fill="#6f6f69" textAnchor="middle">15,00 m</text>

              {/* Room fills */}
              <rect x="62" y="82" width="276" height="156" fill={ACCENT} opacity="0.06"/>
              <rect x="342" y="82" width="276" height="156" fill={ACCENT} opacity="0.06"/>
              <rect x="62" y="242" width="276" height="156" fill={ACCENT} opacity="0.06"/>
              <rect x="342" y="242" width="276" height="156" fill={ACCENT} opacity="0.06"/>

              {/* Dark walls */}
              <rect x="60" y="80" width="560" height="320" stroke="#3a382f" strokeWidth="4"/>
              <path d="M340 80 V400 M60 240 H620" stroke="#3a382f" strokeWidth="4"/>

              {/* Door + window details */}
              <path d="M340 130 A30 30 0 0 1 310 160" stroke="#3a382f" strokeWidth="1.4" opacity="0.55"/>
              <path d="M180 80 H250" stroke="#faf7f2" strokeWidth="4"/><path d="M180 80 H250" stroke="#3a382f" strokeWidth="1.2"/>
              <path d="M430 80 H500" stroke="#faf7f2" strokeWidth="4"/><path d="M430 80 H500" stroke="#3a382f" strokeWidth="1.2"/>

              {/* Orange detection outlines */}
              <rect x="66" y="86" width="268" height="148" stroke={ACCENT} strokeWidth="2.5"/>
              <rect x="346" y="86" width="268" height="148" stroke={ACCENT} strokeWidth="2.5"/>
              <rect x="66" y="246" width="268" height="148" stroke={ACCENT} strokeWidth="2.5"/>
              <rect x="346" y="246" width="268" height="148" stroke={ACCENT} strokeWidth="2.5"/>

              {/* Corner nodes */}
              <g fill={ACCENT}>
                <rect x="54" y="74" width="12" height="12"/><rect x="334" y="74" width="12" height="12"/><rect x="614" y="74" width="12" height="12"/>
                <rect x="54" y="234" width="12" height="12"/><rect x="334" y="234" width="12" height="12"/><rect x="614" y="234" width="12" height="12"/>
                <rect x="54" y="394" width="12" height="12"/><rect x="334" y="394" width="12" height="12"/><rect x="614" y="394" width="12" height="12"/>
              </g>

              {/* Area labels */}
              <text x="200" y="164" fontFamily="Space Mono, monospace" fontSize="12" fill="#8a857a" textAnchor="middle" letterSpacing="1">SALA DE ESTAR</text>
              <text x="200" y="182" fontFamily="Space Mono, monospace" fontSize="11" fill="#b2ada2" textAnchor="middle">28,50 m²</text>
              <text x="480" y="164" fontFamily="Space Mono, monospace" fontSize="12" fill="#8a857a" textAnchor="middle" letterSpacing="1">SUÍTE 01</text>
              <text x="480" y="182" fontFamily="Space Mono, monospace" fontSize="11" fill="#b2ada2" textAnchor="middle">22,40 m²</text>
              <text x="200" y="324" fontFamily="Space Mono, monospace" fontSize="12" fill="#8a857a" textAnchor="middle" letterSpacing="1">COZINHA</text>
              <text x="200" y="342" fontFamily="Space Mono, monospace" fontSize="11" fill="#b2ada2" textAnchor="middle">16,20 m²</text>
              <text x="480" y="324" fontFamily="Space Mono, monospace" fontSize="12" fill="#8a857a" textAnchor="middle" letterSpacing="1">BANHEIRO</text>
              <text x="480" y="342" fontFamily="Space Mono, monospace" fontSize="11" fill="#b2ada2" textAnchor="middle">8,60 m²</text>

              {/* Room tags */}
              <g>
                <rect x="74" y="96" width="86" height="22" rx="5" fill="#111110"/>
                <text x="84" y="111" fontFamily="Space Mono, monospace" fontSize="11" fontWeight="700" fill="#fff">Sala Estar</text>
                <rect x="164" y="96" width="40" height="22" rx="5" fill="#fff" stroke={ACCENT} strokeWidth="1.5"/>
                <text x="184" y="111" fontFamily="Space Mono, monospace" fontSize="10" fontWeight="700" fill="#111110" textAnchor="middle">98%</text>
              </g>
              <g>
                <rect x="354" y="96" width="72" height="22" rx="5" fill="#111110"/>
                <text x="364" y="111" fontFamily="Space Mono, monospace" fontSize="11" fontWeight="700" fill="#fff">Suíte 01</text>
                <rect x="430" y="96" width="40" height="22" rx="5" fill="#fff" stroke={ACCENT} strokeWidth="1.5"/>
                <text x="450" y="111" fontFamily="Space Mono, monospace" fontSize="10" fontWeight="700" fill="#111110" textAnchor="middle">99%</text>
              </g>
              <g>
                <rect x="74" y="256" width="72" height="22" rx="5" fill="#111110"/>
                <text x="84" y="271" fontFamily="Space Mono, monospace" fontSize="11" fontWeight="700" fill="#fff">Cozinha</text>
                <rect x="150" y="256" width="40" height="22" rx="5" fill="#fff" stroke={ACCENT} strokeWidth="1.5"/>
                <text x="170" y="271" fontFamily="Space Mono, monospace" fontSize="10" fontWeight="700" fill="#111110" textAnchor="middle">96%</text>
              </g>
              <g>
                <rect x="354" y="256" width="78" height="22" rx="5" fill="#111110"/>
                <text x="364" y="271" fontFamily="Space Mono, monospace" fontSize="11" fontWeight="700" fill="#fff">Banheiro</text>
                <rect x="436" y="256" width="40" height="22" rx="5" fill="#fff" stroke={ACCENT} strokeWidth="1.5"/>
                <text x="456" y="271" fontFamily="Space Mono, monospace" fontSize="10" fontWeight="700" fill="#111110" textAnchor="middle">97%</text>
              </g>
            </svg>
          </div>

          {/* Canvas Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0efec] font-mono text-xs text-[#9a9a95]">
            <span>Escala 1:50 · PDF 2.4MB</span>
            <span className="flex items-center gap-[6px]">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: ACCENT }} />
              modo demo
            </span>
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside className="flex flex-col gap-4 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-bold mb-[5px]">Análise por IA</h2>
              <p className="font-mono text-xs text-[#9a9a95]">Processado em 12s · Confiança 98%</p>
            </div>
            <span className="flex-none inline-flex items-center gap-[6px] bg-[#eaf7e6] text-[#2f7d32] font-mono text-[10px] font-bold tracking-[.06em] px-[10px] py-[6px] rounded-md">
              <span className="w-[6px] h-[6px] bg-[#3a9d3f] rounded-full" />
              CONCLUÍDO
            </span>
          </div>

          {/* Warning Box */}
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
              <div className="text-2xl font-bold">4</div>
            </div>
            <div className="border border-[#ececea] rounded-[14px] p-[14px] bg-white">
              <div className="font-mono text-[11px] text-[#9a9a95] mb-[6px]">ÁREA TOTAL</div>
              <div className="text-2xl font-bold">
                75,70<span className="text-sm font-medium text-[#9a9a95]"> m²</span>
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
              R$ 287.540,60
            </div>

            <div className="flex items-center justify-between mb-5">
              <span className="font-mono text-xs text-[#111110] px-[9px] py-1 rounded-[5px] font-bold" style={{ background: ACCENT }}>
                ±8% margem
              </span>
              <span className="font-mono text-[13px] text-[#b8b6ae]">
                R$ 2.016,41/m²
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