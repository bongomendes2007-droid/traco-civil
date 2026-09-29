"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

/**
 * Renderiza a imagem real da planta com overlay SVG das caixas de ambiente.
 * Suporta zoom (botões + roda do mouse) e pan (arrastar quando zoom > 100%).
 * Imagem e SVG ficam dentro do mesmo wrapper transformado, garantindo alinhamento
 * perfeito em qualquer nível de zoom/pan.
 */
export function PlanOverlay({ plantaId, roomsGeometry, scaleInfo, className }: PlanOverlayProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Reset zoom/pan quando muda a planta
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [plantaId]);

  const clampPan = useCallback((px: number, py: number, z: number) => {
    if (z <= 1) return { x: 0, y: 0 };
    // Limita o pan para não arrastar além dos limites do conteúdo
    const maxPanX = ((z - 1) / 2) * 100; // % relativo ao container
    const maxPanY = ((z - 1) / 2) * 100;
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, px)),
      y: Math.max(-maxPanY, Math.min(maxPanY, py)),
    };
  }, []);

  const applyZoom = useCallback((newZoom: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    setZoom(clamped);
    if (clamped <= 1) {
      setPan({ x: 0, y: 0 });
    } else {
      setPan((prev) => clampPan(prev.x, prev.y, clamped));
    }
  }, [clampPan]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Só aplica zoom se Ctrl/Meta estiver pressionado, para não conflitar com scroll normal
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    applyZoom(zoom + delta);
  }, [zoom, applyZoom]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    // Converte pixels de movimento para % relativo ao container
    const containerW = containerRef.current?.clientWidth ?? 1;
    const containerH = containerRef.current?.clientHeight ?? 1;
    const pctX = (dx / containerW) * 100;
    const pctY = (dy / containerH) * 100;
    setPan(clampPan(dragStart.current.panX + pctX, dragStart.current.panY + pctY, zoom));
  }, [isDragging, zoom, clampPan]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const rooms = roomsGeometry ?? [];
  const hasBoxes = rooms.some((r) => r.box != null);
  const scaleLabel = scaleInfo?.denominator ? `1:${scaleInfo.denominator}` : null;
  const canDrag = zoom > 1;

  if (error && !imageUrl) {
    return (
      <div className={`flex items-center justify-center bg-[#faf7f2] border border-[#ececea] rounded-[20px] min-h-[300px] ${className ?? ""}`}>
        <p className="font-mono text-xs text-[#9a9a95]">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none ${className ?? ""}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: canDrag ? (isDragging ? "grabbing" : "grab") : "default" }}
    >
      {/* Wrapper transformado: imagem + SVG escalam/juntos */}
      <div
        className="relative transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate(${pan.x}%, ${pan.y}%) scale(${zoom})`,
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {/* Imagem da planta */}
        {imageUrl ? (
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Planta baixa"
            onLoad={handleLoad}
            className="max-w-full max-h-full object-contain block pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full min-h-[300px]">
            <span className="font-mono text-xs text-[#b2ada2] animate-pulse">Carregando imagem...</span>
          </div>
        )}

        {/* Overlay SVG — posicionado absolutamente sobre a imagem, dentro do mesmo wrapper */}
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
      </div>

      {/* Controles de zoom — sobrepostos no canto inferior esquerdo */}
      {imageUrl && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1 z-10">
          <button
            onClick={() => applyZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            className="w-8 h-8 flex items-center justify-center bg-white border border-[#e2e0da] rounded-lg text-[#111110] hover:bg-[#f7f6f2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Diminuir zoom"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button
            onClick={() => applyZoom(1)}
            className="h-8 px-2 flex items-center justify-center bg-white border border-[#e2e0da] rounded-lg font-mono text-[11px] font-semibold text-[#111110] hover:bg-[#f7f6f2] transition-colors shadow-sm min-w-[48px]"
            title="Resetar zoom (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => applyZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            className="w-8 h-8 flex items-center justify-center bg-white border border-[#e2e0da] rounded-lg text-[#111110] hover:bg-[#f7f6f2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Aumentar zoom"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      )}

      {/* Fallback: sem geometria disponível */}
      {imageUrl && !hasBoxes && rooms.length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[11px] text-[#b2ada2] bg-white/80 px-3 py-1 rounded-md backdrop-blur-sm z-10">
          Geometria de ambientes não disponível nesta análise
        </div>
      )}

      {/* Escala (canto inferior direito) */}
      {scaleLabel && (
        <div className="absolute bottom-3 right-4 font-mono text-[10px] text-[#9a9a95] bg-white/80 px-2 py-1 rounded backdrop-blur-sm z-10">
          Escala {scaleLabel}
        </div>
      )}
    </div>
  );
}