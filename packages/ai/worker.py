"""TRAÇO CV Worker — motor real de visão computacional (OpenCV) para leitura de plantas.

Pipeline:
  1. PDF -> imagem (PyMuPDF, DPI fixo) | PNG/JPG -> decode direto
  2. Binarização (Otsu) + morfologia => máscara de paredes
  3. Contorno externo da planta => área total construída
  4. Connected components do espaço livre interno => ambientes (rooms)
  5. Calibração px->m² por escala assumida (padrão 1:50) + margem da marca
"""
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


def run_pipeline(data: bytes, filename: str, scale: int, dpi: int) -> dict[str, Any]:
    if not data:
        return {"ok": False, "reason": "Arquivo vazio."}
    lower = (filename or "").lower()
    if lower.endswith(".dwg"):
        return {"ok": False,
                "reason": "DWG ainda não suportado pelo motor CV. Envie PDF, PNG ou JPG."}

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

    return {
        "ok": True,
        "area_m2": round(area_m2, 1),
        "rooms": rooms,
        "rooms_count": len(rooms),
        "wall_length_m": round(wall_length_m, 1),
        "openings": openings,
        "confidence": round(confidence, 2),
        "scale": f"1:{scale}",
        "dpi": dpi,
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