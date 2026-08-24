"""TRAÇO CV Worker — motor real de visão computacional (OpenCV) para leitura de plantas.

Pipeline (cascata):
  0. PDF vetorial? -> extração determinística via get_drawings()/get_text()
     (paredes como segmentos, escala real via cotas, nomes de ambiente)
  1. PDF raster / PNG / JPG -> imagem (PyMuPDF DPI fixo | decode direto)
  2. Binarização adaptativa (Otsu p/ CAD nítido, CLAHE+adaptive p/ baixo contraste)
     + morfologia => máscara de paredes
  3. Heurística de pilares: blobs compactos (aspecto~1, área pequena) => pilar
  4. Contorno externo da planta => área total construída
  5. Connected components do espaço livre interno => ambientes (rooms)
  6. Calibração px->m² por escala (vetorial: real | raster: assumida 1:50)
"""
import re
from typing import Any

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    fitz = None

import os
from fastapi.middleware.cors import CORSMiddleware

# Token interno compartilhado com o backend Java (app.ai.token). Se definido,
# toda requisição aos endpoints de análise DEVE trazer o header X-Worker-Token.
# Isso impede que o worker (porta 8001) seja chamado diretamente por clientes
# externos — apenas o backend autenticado pode invocá-lo.
WORKER_TOKEN = os.environ.get("WORKER_TOKEN", "").strip()

app = FastAPI(title="TRAÇO CIVIL CV Worker", version="1.0.0")

# O worker NÃO deve aceitar CORS de navegadores: ele só fala com o backend Java.
# Restringimos origens ao vazio e validamos por token no middleware abaixo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_methods=["GET", "POST"],
    allow_headers=["X-Worker-Token", "X-File-Name", "Content-Type"],
)


def require_worker_token(x_worker_token: str | None = Header(None)):
    """Dependência que valida o token interno. Se WORKER_TOKEN estiver vazio
    (dev local), a checagem é ignorada para facilitar testes. Em produção,
    defina WORKER_TOKEN e o backend Java deve enviar o mesmo valor em
    app.ai.token."""
    if WORKER_TOKEN and x_worker_token != WORKER_TOKEN:
        raise HTTPException(status_code=401, detail="Token de worker inválido.")
    return True

DPI_DEFAULT = 150
SCALE_DEFAULT = 50  # escala assumida 1:50 (ajustável por parâmetro)


def pdf_to_image(data: bytes, dpi: int) -> np.ndarray:
    if fitz is None:
        raise ValueError("Suporte a PDF indisponível neste worker.")
    doc = fitz.open(stream=data, filetype="pdf")
    if doc.page_count == 0:
        raise ValueError("PDF sem páginas.")
    page = doc[0]
    pix = page.get_pixmap(dpi=dpi)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    elif pix.n == 3:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    else:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    return img


def decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Imagem ilegível (PNG/JPG inválido).")
    return img


_LAST_MODE = "unknown"


def _try_vectorial(data: bytes, scale: int, dpi: int) -> dict[str, Any] | None:
    """Tenta extração vetorial determinística de um PDF.

    Retorna dict de resultado se houver conteúdo vetorial suficiente (paredes
    como segmentos de reta), ou None para cair no caminho raster.

    Vantagens sobre raster: escala real via cotas (não chutada), paredes como
    geometria exata (sem binarização), nomes de ambiente via texto.
    """
    if fitz is None:
        return None
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        if doc.page_count == 0:
            return None
        page = doc[0]
        drawings = page.get_drawings()
        # Filtrar segmentos de reta com comprimento significativo (paredes)
        segments = []
        for d in drawings:
            for item in d.get("items", []):
                if item[0] == "l":  # line segment
                    p1, p2 = item[1], item[2]
                    length = ((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2) ** 0.5
                    if length > 5:  # ignora micro-segmentos (< 5pt)
                        segments.append((p1.x, p1.y, p2.x, p2.y, length))
        if len(segments) < 10:
            # Poucos vetores → provavelmente PDF rasterizado/scan, cai no raster
            return None

        # Extrair escala real via cotas (texto com padrão "X.XX m" ou "X,XX m")
        text_blocks = page.get_text("blocks")
        detected_scale = scale  # fallback para o parâmetro
        scale_source = "assumed"  # transparência: "detected" vs "assumed"
        dim_texts = []
        room_names = []
        for block in text_blocks:
            txt = block[4].strip() if len(block) > 4 else ""
            # Cotas: número seguido de "m" ou " m"
            dims = re.findall(r'(\d+[.,]\d+)\s*m', txt, re.IGNORECASE)
            dim_texts.extend(dims)
            # Nomes de ambiente (heurística: texto curto em maiúsculas)
            if 2 <= len(txt) <= 30 and txt.isupper() and not re.search(r'\d', txt):
                room_names.append(txt)

        # --- Abordagem 3 (Caminho C): detectar escala no texto vetorial ---
        # Padrões brasileiros comuns: "1:50", "1/50", "ESC 1:50", "ESCALA 1/100",
        # "escala 1:75", "1 : 50", "1 / 100". Captura o denominador da escala.
        scale_match = None
        for block in text_blocks:
            txt = block[4].strip() if len(block) > 4 else ""
            # Regex: opcional "esc/escala" + "1" + separador ":" ou "/" + denominador
            m = re.search(r'(?:esc(?:ala)?)?\s*1\s*[:/]\s*(\d{2,4})', txt, re.IGNORECASE)
            if m:
                denom = int(m.group(1))
                # Sanity: escalas de planta civil típicas entre 1:10 e 1:2000
                if 10 <= denom <= 2000:
                    scale_match = denom
                    break

        if scale_match is not None:
            detected_scale = scale_match
            scale_source = "detected"
            px_per_m = (dpi / 25.4) * (1000.0 / detected_scale)
        elif dim_texts:
            # Fallback anterior: calibrar via maior cota (> 5m = dimensão total)
            dims_float = [float(d.replace(',', '.')) for d in dim_texts]
            max_dim = max(dims_float)
            if max_dim > 5.0:
                rect = page.rect
                page_width_pt = max(rect.width, rect.height)
                pt_per_m = page_width_pt / max_dim
                px_per_m = pt_per_m * (dpi / 72.0)
                detected_scale = int(round(1000.0 / (px_per_m * 25.4 / dpi)))
                scale_source = "detected"  # detectado via cota, não via texto de escala
            else:
                px_per_m = (dpi / 25.4) * (1000.0 / max(1, scale))
        else:
            px_per_m = (dpi / 25.4) * (1000.0 / max(1, scale))

        px2_per_m2 = px_per_m * px_per_m

        # Calcular área total a partir dos segmentos (polígono convexo dos endpoints)
        all_points = []
        for x1, y1, x2, y2, _ in segments:
            all_points.append([x1, y1])
            all_points.append([x2, y2])
        if not all_points:
            return None
        pts = np.array(all_points, dtype=np.float32)
        # Converter pontos pt → px
        pts_px = pts * (dpi / 72.0)
        hull = cv2.convexHull(pts_px.astype(np.int32))
        exterior_area_px = cv2.contourArea(hull)
        area_m2 = exterior_area_px / px2_per_m2

        # Paredes: soma dos comprimentos dos segmentos convertidos para metros
        wall_length_pt = sum(s[4] for s in segments)
        wall_length_m = wall_length_pt / (72.0 / dpi) / px_per_m * (dpi / 72.0)
        # Simplificação: wall_length_m = soma dos comprimentos em pt → metros
        wall_length_m = wall_length_pt / (px_per_m * 72.0 / dpi)

        # Ambientes: estimar a partir de interseções de segmentos (cruzamentos = divisões)
        # Heurística simples: contar segmentos horizontais e verticais longos
        h_segs = [s for s in segments if abs(s[3] - s[1]) < 2 and s[4] > 20]
        v_segs = [s for s in segments if abs(s[2] - s[0]) < 2 and s[4] > 20]
        # Cada par de divisórias cria potencialmente um ambiente
        rooms_count = max(1, (len(h_segs) // 2) * (len(v_segs) // 2))
        rooms_count = min(rooms_count, 30)  # sanity cap

        rooms = []
        # Gerar bounding boxes aproximados a partir dos clusters de segmentos
        # (simplificado: dividir o hull em grid baseado nos segmentos)
        if rooms_count > 0:
            x_min, y_min = pts_px.min(axis=0)
            x_max, y_max = pts_px.max(axis=0)
            w_total = x_max - x_min
            h_total = y_max - y_min
            cols = max(1, len(v_segs) // 2 + 1)
            rows = max(1, len(h_segs) // 2 + 1)
            cell_w = w_total / cols
            cell_h = h_total / rows
            page_w_px = page.rect.width * (dpi / 72.0)
            page_h_px = page.rect.height * (dpi / 72.0)
            count = 0
            for r in range(rows):
                for c in range(cols):
                    if count >= rooms_count:
                        break
                    cx = x_min + c * cell_w
                    cy = y_min + r * cell_h
                    rooms.append({
                        "x": round(float(cx) / page_w_px, 4),
                        "y": round(float(cy) / page_h_px, 4),
                        "w": round(float(cell_w) / page_w_px, 4),
                        "h": round(float(cell_h) / page_h_px, 4),
                        "area_m2": round(float(cell_w * cell_h) / px2_per_m2, 1),
                    })
                    count += 1

        openings = rooms_count + 2
        confidence = min(0.99, 0.90 + 0.01 * min(len(segments) / 50, 5))

        global _LAST_MODE
        _LAST_MODE = "vectorial"

        return {
            "ok": True,
            "area_m2": round(area_m2, 1),
            "rooms": rooms,
            "rooms_count": len(rooms),
            "wall_length_m": round(wall_length_m, 1),
            "openings": openings,
            "confidence": round(confidence, 2),
            "scale": f"1:{detected_scale}",
            "dpi": dpi,
            "mode": "vectorial",
            "segments": len(segments),
            "room_names": room_names[:10],
            "scale_source": scale_source,
        }
    except Exception:
        return None


def _detect_pillars(walls: np.ndarray, mask_inside: np.ndarray,
                    px2_per_m2: float) -> list[dict]:
    """Detecta pilares no caminho raster usando heurística geométrica.

    Pilares = blobs preenchidos compactos (aspecto ~1, área pequena relativa
    ao total). Retorna lista de dicts com posição e área em m².
    """
    inner = cv2.bitwise_and(walls, mask_inside)
    contours, _ = cv2.findContours(inner, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    pillars = []
    total_area = cv2.countNonZero(mask_inside)
    for c in contours:
        area = cv2.contourArea(c)
        if area < px2_per_m2 * 0.02 or area > px2_per_m2 * 0.5:
            continue  # muito pequeno (ruído) ou muito grande (parede)
        x, y, w, h = cv2.boundingRect(c)
        aspect = max(w, h) / max(1, min(w, h))
        compactness = area / max(1, w * h)
        # Pilar: quase quadrado (aspecto < 2.5) e bem preenchido (> 0.6)
        if aspect < 2.5 and compactness > 0.6:
            pillars.append({
                "x": round(float(x) / walls.shape[1], 4),
                "y": round(float(y) / walls.shape[0], 4),
                "w": round(float(w) / walls.shape[1], 4),
                "h": round(float(h) / walls.shape[0], 4),
                "area_m2": round(float(area) / px2_per_m2, 2),
                "type": "pillar",
            })
    return pillars


def _binarize(gray: np.ndarray) -> np.ndarray:
    """Binarização com seleção automática por contraste global (p95 - p5).

    Alto contraste (CAD: linha preta sobre fundo branco) -> Otsu global,
    byte-a-byte o caminho original já validado.
    Baixo contraste (renders/rasters cinza) -> CLAHE + adaptiveThreshold,
    recuperando contraste local antes de limiarizar.
    """
    global _LAST_MODE
    lo = float(np.percentile(gray, 5))
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    # CAD nítido tem linhas pretas reais sobre fundo branco → p5 próximo de 0.
    # Renders/rasters de baixo contraste não têm pretos verdadeiros (p5 > 40),
    # mesmo que o spread p95-p5 seja alto (cinza-claro → branco).
    if lo < 40.0:
        _LAST_MODE = "otsu"
        _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        return binary
    _LAST_MODE = "adaptive"
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    eq = clahe.apply(gray)
    blur = cv2.GaussianBlur(eq, (5, 5), 0)
    return cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, blockSize=31, C=8)


def _binarize_canny(gray: np.ndarray) -> np.ndarray:
    """Fallback Canny: detecção de bordas + dilatação para engrossar paredes.

    Usado quando Otsu/adaptativo resulta em 0 cômodos. Diferente do threshold
    direto (que preenche massas), Canny detecta contornos de transição e a
    dilatação os transforma em "paredes" com espessura. A semântica muda:
    a máscara é um anel de bordas, não uma massa preenchida — por isso a
    lógica de wall_length_m e detecção de cômodos precisa de ajuste no caller.
    """
    global _LAST_MODE
    _LAST_MODE = "canny_fallback"
    # Redução de ruído antes do Canny
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    # Canny com thresholds automáticos baseados na mediana (robusto a contraste variável)
    v = np.median(blur)
    sigma = 0.33
    lower = int(max(0, (1.0 - sigma) * v))
    upper = int(min(255, (1.0 + sigma) * v))
    edges = cv2.Canny(blur, lower, upper)
    # Dilatação para engrossar as bordas em "paredes" (kernel 3x3, 2 iterações)
    kernel = np.ones((3, 3), np.uint8)
    walls = cv2.dilate(edges, kernel, iterations=2)
    # Fechamento morfológico para conectar gaps pequenos nas paredes
    walls = cv2.morphologyEx(walls, cv2.MORPH_CLOSE, kernel, iterations=2)
    return walls


def run_pipeline(data: bytes, filename: str, scale: int, dpi: int) -> dict[str, Any]:
    if not data:
        return {"ok": False, "reason": "Arquivo vazio."}
    lower = (filename or "").lower()
    if lower.endswith(".dwg"):
        return {"ok": False,
                "reason": "DWG ainda não suportado pelo motor CV. Envie PDF, PNG ou JPG."}

    # --- Tentar caminho vetorial primeiro (só para PDF com vetor real) ---
    if (lower.endswith(".pdf") or data[:4] == b"%PDF"):
        vec_result = _try_vectorial(data, scale, dpi)
        if vec_result is not None:
            return vec_result

    if lower.endswith(".pdf") or data[:4] == b"%PDF":
        img = pdf_to_image(data, dpi)
    else:
        img = decode_image(data)

    # --- Upscale condicional: renders/rasters pequenos perdem resolução e
    # quebram morfologia/contornos. Se a maior dimensão < 1200px, redimensiona
    # para ~1500px mantendo proporção. O DPI efetivo é recalculado na mesma
    # razão para que a calibração px->m² continue correta. ---
    h, w = img.shape[:2]
    if max(h, w) < 1200:
        up_factor = 1500.0 / max(h, w)
        img = cv2.resize(img, None, fx=up_factor, fy=up_factor, interpolation=cv2.INTER_CUBIC)
        h, w = img.shape[:2]
        dpi = int(round(dpi * up_factor))

    px_per_m = (dpi / 25.4) * (1000.0 / max(1, scale))
    px2_per_m2 = px_per_m * px_per_m

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    walls = _binarize(gray)

    kernel = np.ones((3, 3), np.uint8)
    walls = cv2.morphologyEx(walls, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(walls, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return {"ok": False, "reason": "Nenhuma estrutura de paredes detectada."}

    image_area = float(h * w)
    exterior = None
    for c in sorted(contours, key=cv2.contourArea, reverse=True):
        a = cv2.contourArea(c)
        if image_area * 0.03 < a < image_area * 0.94:
            exterior = c
            break
    if exterior is None:
        return {"ok": False, "reason": "Contorno externo da planta não identificado."}

    exterior_area_px = cv2.contourArea(exterior)
    area_m2 = exterior_area_px / px2_per_m2

    # Ambientes = componentes conexos do espaço livre dentro do contorno externo
    mask_inside = np.zeros((h, w), np.uint8)
    cv2.drawContours(mask_inside, [exterior], -1, 255, thickness=cv2.FILLED)
    free = cv2.bitwise_and(cv2.bitwise_not(walls), mask_inside)
    n, _labels, stats, _cent = cv2.connectedComponentsWithStats(free, connectivity=4)

    min_room_px = px2_per_m2 * 1.5  # ignora nichos < 1,5 m²
    rooms = []
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if area < min_room_px or area > exterior_area_px * 0.9:
            continue
        rooms.append({
            "x": round(float(x) / w, 4),
            "y": round(float(y) / h, 4),
            "w": round(float(bw) / w, 4),
            "h": round(float(bh) / h, 4),
            "area_m2": round(float(area) / px2_per_m2, 1),
        })
    rooms.sort(key=lambda r: r["area_m2"], reverse=True)

    # --- Heurística de pilares: blobs compactos dentro do contorno externo ---
    pillars = _detect_pillars(walls, mask_inside, px2_per_m2)

    # Extensão de paredes: área da máscara / espessura mediana (distance transform)
    inner_walls = cv2.bitwise_and(walls, mask_inside)
    wall_px = cv2.countNonZero(inner_walls)
    dist = cv2.distanceTransform(walls, cv2.DIST_L2, 3)
    wall_vals = dist[walls > 0]
    thickness = float(np.median(wall_vals)) * 2 if wall_vals.size else 1.0
    wall_length_m = (wall_px / thickness) / px_per_m if thickness > 0 else 0.0

    openings = len(rooms) + 2  # porta social + esquadrias estimadas por ambiente

    confidence = 0.0
    if rooms:
        confidence = min(0.99, 0.88 + 0.02 * len(rooms) + (0.03 if area_m2 > 20 else 0.0))

    # --- Canny fallback: só ativa quando o caminho normal (Otsu/adaptativo)
    # resultou em 0 cômodos E confiança baixa. Não substitui o caminho que
    # já funciona para CAD nítido. ---
    if len(rooms) == 0 and confidence < 0.5:
        walls_canny = _binarize_canny(gray)
        walls_canny = cv2.morphologyEx(walls_canny, cv2.MORPH_CLOSE, kernel, iterations=2)
        contours_c, _ = cv2.findContours(walls_canny, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        exterior_c = None
        for c in sorted(contours_c, key=cv2.contourArea, reverse=True):
            a = cv2.contourArea(c)
            if image_area * 0.03 < a < image_area * 0.94:
                exterior_c = c
                break
        if exterior_c is not None:
            ext_area_c = cv2.contourArea(exterior_c)
            mask_c = np.zeros((h, w), np.uint8)
            cv2.drawContours(mask_c, [exterior_c], -1, 255, thickness=cv2.FILLED)
            free_c = cv2.bitwise_and(cv2.bitwise_not(walls_canny), mask_c)
            n_c, _, stats_c, _ = cv2.connectedComponentsWithStats(free_c, connectivity=4)
            rooms_c = []
            for i in range(1, n_c):
                x, y, bw, bh, area = stats_c[i]
                if area < min_room_px or area > ext_area_c * 0.9:
                    continue
                rooms_c.append({
                    "x": round(float(x) / w, 4),
                    "y": round(float(y) / h, 4),
                    "w": round(float(bw) / w, 4),
                    "h": round(float(bh) / h, 4),
                    "area_m2": round(float(area) / px2_per_m2, 1),
                })
            rooms_c.sort(key=lambda r: r["area_m2"], reverse=True)
            if len(rooms_c) > 0:
                # Canny encontrou cômodos onde o threshold não conseguiu — usar
                rooms = rooms_c
                walls = walls_canny
                mask_inside = mask_c
                exterior_area_px = ext_area_c
                area_m2 = ext_area_c / px2_per_m2
                pillars = _detect_pillars(walls, mask_inside, px2_per_m2)
                inner_walls = cv2.bitwise_and(walls, mask_inside)
                wall_px = cv2.countNonZero(inner_walls)
                dist = cv2.distanceTransform(walls, cv2.DIST_L2, 3)
                wall_vals = dist[walls > 0]
                thickness = float(np.median(wall_vals)) * 2 if wall_vals.size else 1.0
                wall_length_m = (wall_px / thickness) / px_per_m if thickness > 0 else 0.0
                openings = len(rooms) + 2
                confidence = min(0.85, 0.70 + 0.03 * len(rooms))
                # mode já foi setado para "canny_fallback" dentro de _binarize_canny

    return {
        "ok": True,
        "area_m2": round(area_m2, 1),
        "rooms": rooms,
        "rooms_count": len(rooms),
        "pillars": pillars,
        "pillars_count": len(pillars),
        "wall_length_m": round(wall_length_m, 1),
        "openings": openings,
        "confidence": round(confidence, 2),
        "scale": f"1:{scale}",
        "dpi": dpi,
        "mode": _LAST_MODE,
    }


def _run(data: bytes, name: str, scale: int, dpi: int):
    try:
        result = run_pipeline(data, name, scale, dpi)
        return JSONResponse(result, status_code=200 if result.get("ok") else 422)
    except ValueError as e:
        return JSONResponse({"ok": False, "reason": str(e)}, status_code=422)
    except Exception as e:  # cv2.error etc. — rejeição clara, nunca 500 silencioso
        return JSONResponse({"ok": False, "reason": "Falha na leitura: " + str(e)[:200]}, status_code=422)


@app.get("/")
def health():
    return {"status": "online", "service": "TRAÇO CIVIL CV Worker", "engine": "OpenCV " + cv2.__version__}


@app.post("/analyze")
async def analyze_raw(request: Request,
                      x_file_name: str = Header("planta.pdf"),
                      scale: int = SCALE_DEFAULT,
                      dpi: int = DPI_DEFAULT,
                      _token: bool = Depends(require_worker_token)):
    """Recebe o arquivo como corpo binário (usado pelo backend Java)."""
    data = await request.body()
    return _run(data, x_file_name, scale, dpi)


@app.post("/analyze-upload")
async def analyze_upload(file: UploadFile = File(...),
                         scale: int = Form(SCALE_DEFAULT),
                         dpi: int = Form(DPI_DEFAULT),
                         _token: bool = Depends(require_worker_token)):
    """Recebe multipart (usado em testes manuais / curl)."""
    data = await file.read()
    return _run(data, file.filename or "planta", scale, dpi)