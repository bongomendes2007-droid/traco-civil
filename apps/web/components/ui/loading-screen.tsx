"use client";

import { useEffect, useState } from "react";

/**
 * Tela de carregamento reutilizável com o ícone da marca (triângulo/montanha)
 * animado peça por peça. Usada em dois momentos:
 * 1. Abertura do site (AppLoadingWrapper no layout raiz)
 * 2. Após login bem-sucedido (LoginPage)
 */

const PIECE_DELAY_MS = 100;
const MIN_VISIBLE_MS = 800;

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f7f6f2]">
      <svg
        width="96"
        height="96"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="TRAÇO CIVIL carregando"
      >
        {/* Peça 1: topo esquerdo */}
        <polygon
          points="50,8 30,42 50,42"
          fill="#ff5a1f"
          className="tc-piece tc-piece-1"
        />
        {/* Peça 2: topo direito */}
        <polygon
          points="50,8 50,42 70,42"
          fill="#ff5a1f"
          className="tc-piece tc-piece-2"
        />
        {/* Peça 3: base esquerda superior */}
        <polygon
          points="30,42 10,76 50,76"
          fill="#ff5a1f"
          className="tc-piece tc-piece-3"
        />
        {/* Peça 4: base direita superior */}
        <polygon
          points="70,42 50,76 90,76"
          fill="#ff5a1f"
          className="tc-piece tc-piece-4"
        />
        {/* Peça 5: base esquerda inferior */}
        <polygon
          points="10,76 0,92 50,92"
          fill="#ff5a1f"
          className="tc-piece tc-piece-5"
        />
        {/* Peça 6: base direita inferior */}
        <polygon
          points="90,76 50,92 100,92"
          fill="#ff5a1f"
          className="tc-piece tc-piece-6"
        />
      </svg>

      <style jsx>{`
        .tc-piece {
          opacity: 0;
          transform: translateY(8px) scale(0.92);
          animation: tc-assemble 0.4s ease-out forwards;
        }
        .tc-piece-1 { animation-delay: 0ms; }
        .tc-piece-2 { animation-delay: ${PIECE_DELAY_MS}ms; }
        .tc-piece-3 { animation-delay: ${PIECE_DELAY_MS * 2}ms; }
        .tc-piece-4 { animation-delay: ${PIECE_DELAY_MS * 3}ms; }
        .tc-piece-5 { animation-delay: ${PIECE_DELAY_MS * 4}ms; }
        .tc-piece-6 { animation-delay: ${PIECE_DELAY_MS * 5}ms; }

        @keyframes tc-assemble {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.92);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Wrapper para o layout raiz: mostra a tela de carregamento na primeira
 * renderização e a remove após a montagem + tempo mínimo de visibilidade.
 * Evita flash de conteúdo antes da hidratação completar.
 */
const LOADING_SHOWN_KEY = "traco_loading_shown";

export function AppLoadingWrapper({ children }: { children: React.ReactNode }) {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    // Só mostra na primeira carga da sessão de navegador.
    // Navegações client-side (Link, router.push) não remontam o layout raiz,
    // mas se algum cenário causar remount (error boundary, hot reload, etc.),
    // a flag no sessionStorage impede reaparição indevida.
    try {
      if (sessionStorage.getItem(LOADING_SHOWN_KEY)) return;
      sessionStorage.setItem(LOADING_SHOWN_KEY, "1");
      setShowLoading(true);
    } catch {
      // sessionStorage indisponível (ex: modo privado bloqueado):
      // fallback seguro — não mostra loading para evitar loop.
    }
  }, []);

  useEffect(() => {
    if (!showLoading) return;
    const timer = setTimeout(() => setShowLoading(false), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [showLoading]);

  if (showLoading) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}