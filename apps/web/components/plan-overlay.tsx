"use client";

import { useEffect, useRef, useState } from "react";

const ACCENT = "#ff5a1f";

export type RoomGeometry = {
  id: number;
  name: string;
  type?: string | null;
  area_m2: number;
  confidence: number;
  source: "worker" | "claude" | "user";
  box: { x: number; y: number; w: number; h: number } | null;
  polygon?: unknown;
};

export type ScaleInfo = {
  denominator?: number;
  source?: string;
  meters_per_pixel?: number | null;
  image_width_px?: number | null;
  image_height_px?: number | null;
  mode?: string;
};

type PlanOverlayProps = {
  plantaId: number;
  roomsGeometry: RoomGeometry[] | null | undefined;
  scaleInfo?: ScaleInfo | null;
  className?: string;
};

/**
 * Renderiza a imagem real da planta com overlay SVG das caixas de ambiente.
 * Coordenadas normalizadas 0-1 vindas de rooms_geometry são convertidas
 * para pixels reais da imagem exibida. Responsivo: escala com o container.
 */
export function PlanOverlay({ plantaId, roomsGeometry, scaleInfo, className }: PlanOverlayProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Busca signed URL da planta
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/plantas/${plantaId}/image`, { credentials: "include" });
        if (!res.ok) {
          if (mounted) setError("Imagem da planta indisponível");
          return;
        }
        const data = await res.json();
        if (mounted && data?.url) setImageUrl(data.url);
      } catch {
        if (mounted) setError("Erro ao carregar imagem da planta");
      }
    }
    if (plantaId) load();
    return () => { mounted = false; };
  }, [plantaId]);

  const handleLoad = () => {
    if (imgRef.current) {
      setImgSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  };

  const rooms = roomsGeometry ?? [];
  const hasBoxes = rooms.some((r) => r.box != null);
  const scaleLabel = scaleInfo?.denominator ? `1:${scaleInfo.denominator}` : null;

  if (error && !imageUrl) {
    return (
      <div className={`flex items-center justify-center bg-[#faf7f2] border border-[#ececea] rounded-[20px] min-h-[300px] ${className ?? ""}`}>
        <p className="font-mono text-xs text-[#9a9a95]">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className ?? ""}`}>
      {/* Imagem da planta */}
      {imageUrl ? (
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Planta baixa"
          onLoad={handleLoad}
          className="max-w-full max-h-full object-contain block"
          style={{ userSelect: "none" }}
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full min-h-[300px]">
          <span className="font-mono text-xs text-[#b2ada2] animate-pulse">Carregando imagem...</span>
        </div>
      )}

      {/* Overlay SVG — posicionado absolutamente sobre a imagem */}
      {imageUrl && imgSize.w > 0 && hasBoxes && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {rooms.map((room, i) => {
            if (!room.box) return null;
            const bx = room.box.x * imgSize.w;
            const by = room.box.y * imgSize.h;
            const bw = room.box.w * imgSize.w;
            const bh = room.box.h * imgSize.h;
            const confPct = Math.round(room.confidence * 100);
            const labelW = Math.max(80, room.name.length * 9 + 20);
            const badgeW = 44;

            return (
              <g key={room.id ?? i}>
                {/* Borda da caixa */}
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  stroke={ACCENT}
                  strokeWidth={2.5}
                  fill={ACCENT}
                  fillOpacity={0.06}
                />
                {/* Cantos marcados */}
                <rect x={bx - 4} y={by - 4} width={8} height={8} fill={ACCENT} />
                <rect x={bx + bw - 4} y={by - 4} width={8} height={8} fill={ACCENT} />
                <rect x={bx - 4} y={by + bh - 4} width={8} height={8} fill={ACCENT} />
                <rect x={bx + bw - 4} y={by + bh - 4} width={8} height={8} fill={ACCENT} />

                {/* Label: nome + área (centralizado na caixa) */}
                <text
                  x={bx + bw / 2}
                  y={by + bh / 2 - 6}
                  fontFamily="Space Mono, monospace"
                  fontSize={12}
                  fill="#8a857a"
                  textAnchor="middle"
                  letterSpacing={1}
                >
                  {room.name.toUpperCase()}
                </text>
                <text
                  x={bx + bw / 2}
                  y={by + bh / 2 + 12}
                  fontFamily="Space Mono, monospace"
                  fontSize={11}
                  fill="#b2ada2"
                  textAnchor="middle"
                >
                  {room.area_m2.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m²
                </text>

                {/* Badge de confiança (canto superior esquerdo da caixa) */}
                <rect x={bx + 4} y={by + 4} width={labelW} height={22} rx={5} fill="#111110" />
                <text
                  x={bx + 14}
                  y={by + 19}
                  fontFamily="Space Mono, monospace"
                  fontSize={11}
                  fontWeight={700}
                  fill="#fff"
                >
                  {room.name}
                </text>
                <rect
                  x={bx + 4 + labelW + 4}
                  y={by + 4}
                  width={badgeW}
                  height={22}
                  rx={5}
                  fill="#fff"
                  stroke={ACCENT}
                  strokeWidth={1.5}
                />
                <text
                  x={bx + 4 + labelW + 4 + badgeW / 2}
                  y={by + 19}
                  fontFamily="Space Mono, monospace"
                  fontSize={10}
                  fontWeight={700}
                  fill="#111110"
                  textAnchor="middle"
                >
                  {confPct}%
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* Fallback: sem geometria disponível */}
      {imageUrl && !hasBoxes && rooms.length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[11px] text-[#b2ada2] bg-white/80 px-3 py-1 rounded-md backdrop-blur-sm">
          Geometria de ambientes não disponível nesta análise
        </div>
      )}

      {/* Escala (canto inferior direito) */}
      {scaleLabel && (
        <div className="absolute bottom-3 right-4 font-mono text-[10px] text-[#9a9a95] bg-white/80 px-2 py-1 rounded backdrop-blur-sm">
          Escala {scaleLabel}
        </div>
      )}
    </div>
  );
}