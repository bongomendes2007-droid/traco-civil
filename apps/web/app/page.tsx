"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";

const ACCENT = "#ff5a1f";

const NAV_ITEMS = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Projetos", href: "/projetos" },
  { label: "Orçamentos", href: "/orcamentos" },
  { label: "Preços", href: "#recursos" },
];

const FEATURES = [
  {
    no: "01",
    title: "Upload inteligente",
    href: "/upload",
    body: "Arraste sua planta em PDF ou DWG. Nossa IA identifica paredes, esquadrias e áreas automaticamente.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V6M5 12l7-7 7 7" />
      </svg>
    ),
    bg: "#ffffff",
    border: "1.5px solid #111110",
    fg: "#111110",
    muted: "#5c5c58",
    num: "#b3b3ad",
    iconBg: "#111110",
    iconFg: ACCENT,
    arrowBg: "#111110",
    arrowFg: "#ffffff",
  },
  {
    no: "02",
    title: "Quantitativos",
    href: "/analises",
    body: "Concreto, aço, alvenaria e acabamentos calculados em segundos, com precisão técnica.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 15l3-4 3 3 4-6" />
      </svg>
    ),
    bg: "#111110",
    border: "none",
    fg: "#ffffff",
    muted: "#9a9a92",
    num: "#5c5c58",
    iconBg: ACCENT,
    iconFg: "#111110",
    arrowBg: ACCENT,
    arrowFg: "#111110",
  },
  {
    no: "03",
    title: "Orçamento SINAPI",
    href: "/orcamentos",
    body: "Estimativa de custo baseada na tabela SINAPI atualizada, com margem de erro transparente.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="2" x2="12" y2="22" />
        <path d="M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6" />
      </svg>
    ),
    bg: "#111110",
    border: "none",
    fg: "#ffffff",
    muted: "#9a9a92",
    num: "#5c5c58",
    iconBg: ACCENT,
    iconFg: "#111110",
    arrowBg: ACCENT,
    arrowFg: "#111110",
  },
  {
    no: "04",
    title: "Relatórios",
    href: "/orcamentos",
    body: "Exporte tudo em PDF ou Excel. Pronto para enviar ao cliente ou usar na licitação.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h6" />
      </svg>
    ),
    bg: "#ffffff",
    border: "1.5px solid #111110",
    fg: "#111110",
    muted: "#5c5c58",
    num: "#b3b3ad",
    iconBg: "#111110",
    iconFg: ACCENT,
    arrowBg: "#111110",
    arrowFg: "#ffffff",
  },
];

const STEPS = [
  {
    no: "01",
    title: "Envie a planta",
    href: "/upload",
    body: "Faça upload do PDF ou DWG. A IA reconhece a geometria e as camadas do desenho.",
  },
  {
    no: "02",
    title: "A IA processa",
    href: "/plantas",
    body: "Áreas, materiais e quantitativos são extraídos e cruzados com a base SINAPI vigente.",
  },
  {
    no: "03",
    title: "Receba o orçamento",
    href: "/orcamentos",
    body: "Custo estimado com margem ±8%, itemizado por serviço e pronto para exportar.",
  },
];

const TRUSTED = ["SINAPI", "CAIXA", "IBGE", "ABNT", "SICRO"];

export default function LandingPage() {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState({ transform: "translateX(0)", width: "0px" });

  useEffect(() => {
    const idx = hoverIdx ?? activeIdx;
    const cont = navContainerRef.current;
    const el = navRefs.current[idx];
    if (!cont || !el) {
      setPillStyle({ transform: "translateX(0)", width: "0px" });
      return;
    }
    const left = el.offsetLeft;
    setPillStyle({ transform: `translateX(${left}px)`, width: `${el.offsetWidth}px` });
  }, [hoverIdx, activeIdx]);

  return (
    <main className="min-h-screen bg-white text-[#111110]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <style jsx global>{`
        @keyframes tracoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        @keyframes tracoSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes tracoMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .traco-belt {
          display: flex;
          width: max-content;
          animation: tracoMarquee 22s linear infinite;
        }
        .traco-belt:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="max-w-[1240px] mx-auto px-8">
        {/* NAV */}
        <nav className="flex items-center justify-between py-[26px]">
          <Link href="/" className="flex items-center">
            <Image src="/assets/traco-civil-logo.png" alt="TRAÇO CIVIL" width={180} height={30} className="h-[30px] w-auto block" />
          </Link>
          <div
            ref={navContainerRef}
            onMouseLeave={() => setHoverIdx(null)}
            className="relative flex items-center gap-1 p-[5px] rounded-full"
            style={{
              background: "linear-gradient(135deg, #eef1ee, #e2eae4)",
              boxShadow: "inset 0 1px 2px rgba(255,255,255,.7), inset 0 -1px 3px rgba(0,0,0,.05)",
            }}
          >
            <div
              className="absolute top-[5px] left-0 h-[calc(100%-10px)] rounded-full bg-white pointer-events-none transition-all duration-[380ms]"
              style={{
                boxShadow: "0 2px 8px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.08)",
                transitionTimingFunction: "cubic-bezier(.34,1.4,.5,1)",
                transform: pillStyle.transform,
                width: pillStyle.width,
              }}
            />
            {NAV_ITEMS.map((item, i) => (
              <a
                key={item.label}
                href={item.href}
                ref={(el) => { navRefs.current[i] = el; }}
                onMouseEnter={() => setHoverIdx(i)}
                className="relative z-[1] px-[18px] py-[9px] rounded-full text-[15px] whitespace-nowrap transition-colors duration-[250ms]"
                style={{
                  fontWeight: (hoverIdx ?? activeIdx) === i ? 600 : 500,
                  color: (hoverIdx ?? activeIdx) === i ? "#111110" : "#6f7a72",
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[15px] font-medium">Entrar</Link>
            <Link href="/upload" className="bg-[#111110] text-white text-[14px] font-semibold px-5 py-[11px] rounded-full">Começar agora</Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-12 items-center py-11 pb-17">
          <div>
            <div className="inline-flex items-center gap-2 border-[1.5px] border-[#111110] rounded-full px-[14px] py-[6px] font-mono text-[11px] font-bold tracking-[.12em] uppercase mb-[26px]">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: ACCENT }} />
              IA para engenharia civil
            </div>
            <h1 className="text-[58px] leading-[1.02] font-bold tracking-[-.02em] mb-[22px]">
              Do traço à obra,{" "}
              <span className="px-[10px]" style={{ background: ACCENT, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
                sem adivinhação.
              </span>
            </h1>
            <p className="text-[18px] leading-[1.55] text-[#5c5c58] max-w-[460px] mb-[30px]">
              Envie sua planta baixa e receba em minutos os quantitativos de materiais e um orçamento estimativo baseado em SINAPI — com margem de erro transparente.
            </p>
            <div className="flex gap-[14px] flex-wrap mb-[26px]">
              <Link href="/upload" className="inline-flex items-center gap-[10px] bg-[#111110] text-white text-[15px] font-semibold px-6 py-[15px] rounded-xl">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V6M5 12l7-7 7 7" />
                </svg>
                Enviar planta agora
              </Link>
              <Link href="/dashboard" className="inline-flex items-center gap-[10px] bg-white text-[#111110] border-[1.5px] border-[#111110] text-[15px] font-semibold px-6 py-[15px] rounded-xl">
                Ver demo do dashboard
              </Link>
            </div>
            <div className="flex items-center gap-2 font-mono text-[12px] text-[#8a8a85]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111110" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Margem ±8% · Base SINAPI 08/2026 · Sem cartão de crédito
            </div>
          </div>
          <div className="relative min-w-0">
            <div className="absolute -inset-x-[4%] -inset-y-[6%] bg-[#f4f4f1] rounded-[28px]" />
            <svg className="absolute -top-[14px] right-[34px]" style={{ animation: "tracoSpin 18s linear infinite" }} width="34" height="34" viewBox="0 0 24 24" fill={ACCENT}>
              <path d="M12 0l2.6 8.4L23 6l-6.2 6.2L23 18l-8.4-2.6L12 24l-2.6-8.6L1 18l6.2-5.8L1 6l8.4 2.4z" />
            </svg>
            <div className="absolute bottom-4 -left-[14px] w-[30px] h-[30px] bg-[#111110] rounded-full" style={{ animation: "tracoFloat 5s ease-in-out infinite" }} />
            <div className="absolute top-10 -left-2 w-4 h-4 rounded-full" style={{ background: ACCENT }} />
            <div className="relative p-[22px]">
              <svg viewBox="0 0 520 400" className="w-full h-auto block" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="64" y="74" width="182" height="132" fill={ACCENT} opacity="0.10" />
                <rect x="254" y="74" width="182" height="132" rx="0" fill="#111110" opacity="0.04" />
                <rect x="64" y="74" width="372" height="242" stroke="#111110" strokeWidth="4" />
                <rect x="72" y="82" width="356" height="226" stroke="#111110" strokeWidth="1" opacity="0.35" />
                <path d="M250 74 V150 M250 176 V206 M64 206 H150 M176 206 H436" stroke="#111110" strokeWidth="4" />
                <path d="M250 150 A26 26 0 0 1 224 176" stroke="#111110" strokeWidth="1.5" opacity="0.6" />
                <path d="M150 206 A26 26 0 0 1 176 232" stroke="#111110" strokeWidth="1.5" opacity="0.6" />
                <path d="M120 74 H180 M300 74 H370" stroke="#faf6f0" strokeWidth="4" />
                <path d="M120 74 H180 M300 74 H370" stroke="#111110" strokeWidth="1.2" />
                <path d="M64 240 V285 M436 130 V190" stroke="#faf6f0" strokeWidth="4" />
                <path d="M64 240 V285 M436 130 V190" stroke="#111110" strokeWidth="1.2" />
                <text x="155" y="145" fontFamily="Space Mono, monospace" fontSize="11" fill="#8a8a85" textAnchor="middle">SALA</text>
                <text x="345" y="145" fontFamily="Space Mono, monospace" fontSize="11" fill="#8a8a85" textAnchor="middle">QUARTO</text>
                <text x="250" y="270" fontFamily="Space Mono, monospace" fontSize="11" fill="#8a8a85" textAnchor="middle">ÁREA COMUM</text>
                <rect x="50" y="60" width="400" height="270" stroke={ACCENT} strokeWidth="2" strokeDasharray="7 7" opacity="0.9" />
                <path d="M50 84 V60 H74 M426 60 H450 V84 M450 306 V330 H426 M74 330 H50 V306" stroke={ACCENT} strokeWidth="3.5" fill="none" />
                <path d="M64 356 H436" stroke="#111110" strokeWidth="1.2" />
                <path d="M64 350 V362 M436 350 V362" stroke="#111110" strokeWidth="1.2" />
                <rect x="215" y="346" width="90" height="20" rx="4" fill="#faf6f0" />
                <text x="260" y="360" fontFamily="Space Mono, monospace" fontSize="11" fill="#111110" textAnchor="middle">12,40 m</text>
                <g>
                  <line x1="345" y1="120" x2="405" y2="52" stroke="#111110" strokeWidth="1.2" strokeDasharray="3 3" />
                  <rect x="360" y="30" width="140" height="30" rx="15" fill="#111110" />
                  <circle cx="378" cy="45" r="5" fill={ACCENT} />
                  <text x="392" y="49" fontFamily="Space Grotesk, sans-serif" fontSize="12" fontWeight="600" fill="#ffffff">Alvenaria · 86 m²</text>
                </g>
                <g>
                  <line x1="150" y1="140" x2="70" y2="188" stroke="#111110" strokeWidth="1.2" strokeDasharray="3 3" />
                  <rect x="18" y="176" width="128" height="30" rx="15" fill="#ffffff" stroke="#111110" strokeWidth="1.5" />
                  <circle cx="36" cy="191" r="5" fill={ACCENT} />
                  <text x="50" y="195" fontFamily="Space Grotesk, sans-serif" fontSize="12" fontWeight="600" fill="#111110">Concreto · 14 m³</text>
                </g>
                <path d="M420 250 l3.4 9 9 3.4 -9 3.4 -3.4 9 -3.4 -9 -9 -3.4 9 -3.4z" fill={ACCENT} />
              </svg>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="border-t border-b border-[#ececea] py-[26px] mb-22">
          <div className="flex items-center gap-7">
            <span className="flex-none font-mono text-[11px] tracking-[.1em] uppercase text-[#9a9a95]">
              Baseado em<br />dados oficiais
            </span>
            <div className="relative flex-1 overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
              <div className="traco-belt">
                {[...TRUSTED, ...TRUSTED].map((name, i) => (
                  <span key={i} className="flex-none px-[34px] text-[20px] font-bold text-[#b3b3ad] tracking-[.02em] whitespace-nowrap">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* RECURSOS */}
        <section id="recursos" className="mb-24">
          <div className="flex items-end gap-7 mb-9 flex-wrap">
            <span className="text-[26px] font-bold px-3 py-[2px] tracking-[-.01em]" style={{ background: ACCENT }}>Recursos</span>
            <p className="text-[16px] leading-[1.5] text-[#5c5c58] max-w-[440px] m-0">
              Do upload da planta ao orçamento pronto para licitação — quatro etapas que a TRAÇO CIVIL resolve automaticamente com precisão técnica.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.no}
                className="relative rounded-[22px] p-[30px] min-h-[230px] flex flex-col"
                style={{ background: f.bg, border: f.border, color: f.fg }}
              >
                <span className="absolute top-[26px] right-7 font-mono text-[13px]" style={{ color: f.num }}>{f.no}</span>
                <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center mb-auto" style={{ background: f.iconBg, color: f.iconFg }}>
                  {f.icon}
                </div>
                <h3 className="text-[21px] font-bold mt-[22px] mb-[10px]">
                  <span className="px-2 py-[1px]" style={{ background: ACCENT, color: "#111110", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
                    {f.title}
                  </span>
                </h3>
                <p className="text-[15px] leading-[1.5] mb-5 max-w-[340px]" style={{ color: f.muted }}>{f.body}</p>
                <Link href={f.href} className="inline-flex items-center gap-[10px] text-[14px] font-semibold" style={{ color: f.fg }}>
                  <span className="w-8 h-8 rounded-full inline-flex items-center justify-center" style={{ background: f.arrowBg, color: f.arrowFg }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7M9 7h8v8" />
                    </svg>
                  </span>
                  Saiba mais
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* CTA BAND */}
        <section className="relative bg-[#f4f4f1] rounded-[28px] px-14 py-[52px] mb-24 overflow-hidden">
          <div className="max-w-[520px] relative z-[1]">
            <h2 className="text-[34px] font-bold tracking-[-.02em] mb-[14px]">Vamos tirar seu projeto do papel.</h2>
            <p className="text-[16px] leading-[1.55] text-[#5c5c58] mb-[26px]">
              Envie uma planta baixa agora e veja em minutos quanto sua obra vai consumir de material e custar de verdade. Sem planilha, sem chute.
            </p>
            <Link href="/upload" className="inline-flex items-center gap-[10px] bg-[#111110] text-white text-[15px] font-semibold px-[26px] py-[15px] rounded-xl">
              Receber orçamento grátis
            </Link>
          </div>
          <svg className="absolute right-[150px] top-11" style={{ animation: "tracoSpin 22s linear infinite" }} width="40" height="40" viewBox="0 0 24 24" fill="#111110">
            <path d="M12 0l2.6 8.4L23 6l-6.2 6.2L23 18l-8.4-2.6L12 24l-2.6-8.6L1 18l6.2-5.8L1 6l8.4 2.4z" />
          </svg>
          <div className="absolute right-[78px] bottom-[52px] w-[88px] h-[88px] rounded-full" style={{ background: ACCENT, animation: "tracoFloat 6s ease-in-out infinite" }} />
          <div className="absolute right-14 top-[70px] w-[120px] h-[120px] border-2 border-[#111110] rounded-full opacity-50" />
          <div className="absolute right-[210px] bottom-11 h-5 w-5 rotate-45 bg-[#111110] hidden sm:block" />
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="mb-22">
          <div className="flex items-baseline gap-5 mb-[26px] flex-wrap">
            <span className="text-[26px] font-bold px-3 py-[2px]" style={{ background: ACCENT }}>Como funciona</span>
            <p className="text-[15px] text-[#5c5c58] m-0 max-w-[420px]">Três passos entre a sua planta e um orçamento confiável.</p>
          </div>
          <div className="bg-[#111110] rounded-3xl p-11 grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map((s) => (
              <div key={s.no}>
                <span className="font-mono text-[13px]" style={{ color: ACCENT }}>{s.no}</span>
                <h4 className="text-[20px] font-bold text-white mt-[14px] mb-[10px]">{s.title}</h4>
                <p className="text-[14px] leading-[1.55] text-[#9a9a92] m-0">{s.body}</p>
                <Link href={s.href} className="inline-flex items-center gap-2 text-[13px] font-semibold mt-4" style={{ color: ACCENT }}>
                  Saiba mais
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#ececea] py-[34px] mb-5">
          <div className="flex items-center gap-4">
            <Image src="/assets/traco-civil-logo.png" alt="TRAÇO CIVIL" width={132} height={22} className="h-[22px] w-auto block" />
            <span className="font-mono text-[12px] text-[#8a8a85]">© 2026 — IA para Engenharia Civil</span>
          </div>
          <span className="font-mono text-[12px] text-[#8a8a85]">Do traço à obra, sem adivinhação.</span>
        </footer>
      </div>
    </main>
  );
}