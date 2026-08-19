"""
TRAÇO - Processadores de Arquivos
Módulo para extração de metadados e geração de previews dos arquivos enviados.
"""

import os
import json
from pathlib import Path
from typing import Optional

from PIL import Image


def process_image(file_path: str, project_dir: str) -> dict:
    """
    Processa arquivos de imagem (JPG, PNG, TIFF, BMP, WebP).
    Extrai dimensões, DPI estimado e gera thumbnail para preview.
    """
    result = {
        "type": "image",
        "width": None,
        "height": None,
        "dpi": None,
        "format": None,
        "thumbnail": None,
        "error": None
    }

    try:
        img = Image.open(file_path)
        result["width"] = img.width
        result["height"] = img.height
        result["format"] = img.format
        result["mode"] = img.mode

        # Tenta extrair DPI dos metadados EXIF
        if hasattr(img, "info") and "dpi" in img.info:
            result["dpi"] = img.info["dpi"]

        # Gera thumbnail (máx 400x400px) para preview no frontend
        thumb_size = (400, 400)
        img.thumbnail(thumb_size, Image.Resampling.LANCZOS)

        thumbs_dir = Path(project_dir) / "thumbnails"
        thumbs_dir.mkdir(exist_ok=True)

        filename_stem = Path(file_path).stem
        thumb_path = thumbs_dir / f"{filename_stem}_thumb.jpg"

        # Converte para RGB se necessário (PNG com transparência, etc.)
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")

        img.save(thumb_path, "JPEG", quality=85)
        result["thumbnail"] = f"thumbnails/{filename_stem}_thumb.jpg"

        # Estimativa básica: assume A4 como referência se DPI for desconhecido
        # (útil para cálculo preliminar de escala)
        if result["dpi"]:
            result["estimated_width_m"] = round(img.width / result["dpi"][0] * 0.0254, 2)
            result["estimated_height_m"] = round(img.height / result["dpi"][1] * 0.0254, 2)

    except Exception as e:
        result["error"] = f"Erro ao processar imagem: {str(e)}"

    return result


def process_pdf(file_path: str, project_dir: str) -> dict:
    """
    Processa arquivos PDF.
    Extrai número de páginas, dimensões e informações básicas.
    """
    result = {
        "type": "pdf",
        "page_count": None,
        "pages": [],
        "error": None
    }

    try:
        from pypdf import PdfReader

        reader = PdfReader(file_path)
        result["page_count"] = len(reader.pages)

        # Extrai metadados de cada página (primeiras 5 para economizar processamento)
        max_pages = min(5, len(reader.pages))
        for i in range(max_pages):
            page = reader.pages[i]
            media_box = page.mediabox

            # Converte pontos tipográficos para milímetros (1pt = 0.3527mm)
            width_pt = float(media_box.width)
            height_pt = float(media_box.height)

            width_mm = round(width_pt * 0.3527, 1)
            height_mm = round(height_pt * 0.3527, 1)

            page_info = {
                "page": i + 1,
                "width_mm": width_mm,
                "height_mm": height_mm,
                "width_m": round(width_mm / 1000, 2),
                "height_m": round(height_mm / 1000, 2),
                "rotation": page.get("/Rotate", 0),
            }

            # Detecta formatos comuns
            if 200 <= width_mm <= 220 and 280 <= height_mm <= 300:
                page_info["format"] = "A4"
            elif 285 <= width_mm <= 305 and 410 <= height_mm <= 430:
                page_info["format"] = "A3"
            elif 410 <= width_mm <= 430 and 580 <= height_mm <= 600:
                page_info["format"] = "A2"
            elif 580 <= width_mm <= 610 and 830 <= height_mm <= 850:
                page_info["format"] = "A1"
            elif 830 <= width_mm <= 860 and 1180 <= height_mm <= 1200:
                page_info["format"] = "A0"
            else:
                page_info["format"] = "custom"

            result["pages"].append(page_info)

        # Extrai metadados gerais do PDF
        if reader.metadata:
            result["title"] = reader.metadata.title or None
            result["author"] = reader.metadata.author or None
            result["creator"] = reader.metadata.creator or None

    except ImportError:
        result["error"] = "pypdf não instalado - instale com: pip install pypdf"
    except Exception as e:
        result["error"] = f"Erro ao processar PDF: {str(e)}"

    return result


def process_dwg(file_path: str, project_dir: str) -> dict:
    """
    Processa arquivos DWG/DXF (AutoCAD).
    Extração básica de metadados. Processamento completo requer bibliotecas
    especializadas (ezdxf para DXF, ODA para DWG).
    """
    result = {
        "type": "dwg",
        "file_format": Path(file_path).suffix.lower().lstrip("."),
        "size_bytes": os.path.getsize(file_path),
        "readable": False,
        "layers": None,
        "error": None
    }

    ext = result["file_format"]

    if ext == "dxf":
        # DXF é texto aberto, podemos tentar ler com ezdxf
        try:
            import ezdxf

            doc = ezdxf.readfile(file_path)
            result["readable"] = True
            result["dxf_version"] = doc.dxfversion

            # Lista camadas (layers)
            layers = []
            for layer in doc.layers:
                layers.append({
                    "name": layer.dxf.name,
                    "color": getattr(layer.dxf, "color", None),
                    "on": layer.is_on,
                })
            result["layers"] = layers
            result["layer_count"] = len(layers)

            # Conta entidades por tipo (visão geral)
            msp = doc.modelspace()
            entity_types = {}
            for entity in msp:
                t = entity.dxftype()
                entity_types[t] = entity_types.get(t, 0) + 1
            result["entity_summary"] = entity_types
            result["total_entities"] = sum(entity_types.values())

        except ImportError:
            result["error"] = "ezdxf não instalado - instale com: pip install ezdxf"
        except Exception as e:
            result["error"] = f"Erro ao processar DXF: {str(e)}"

    elif ext == "dwg":
        # DWG é binário proprietário. Para produção: ODA File Converter ou similar
        # Aqui fazemos apenas validação básica do cabeçalho
        try:
            with open(file_path, "rb") as f:
                header = f.read(6)

            # Arquivos DWG começam com "AC" seguido da versão
            if header[:2] == b"AC":
                result["readable"] = True
                # Versões comuns do DWG
                versions = {
                    b"AC1015": "AutoCAD 2000",
                    b"AC1018": "AutoCAD 2004",
                    b"AC1021": "AutoCAD 2007",
                    b"AC1024": "AutoCAD 2010",
                    b"AC1027": "AutoCAD 2013",
                    b"AC1032": "AutoCAD 2018+",
                }
                result["dwg_version"] = versions.get(header[:6], f"DWG {header.decode('ascii', errors='ignore')}")
            else:
                result["error"] = "Cabeçalho DWG inválido ou arquivo corrompido"

        except Exception as e:
            result["error"] = f"Erro ao validar DWG: {str(e)}"

    return result


def process_file(file_path: str, project_dir: str) -> dict:
    """
    Roteia o processamento para o handler correto baseado na extensão.
    """
    ext = Path(file_path).suffix.lower()

    if ext == ".pdf":
        return process_pdf(file_path, project_dir)
    elif ext in (".dwg", ".dxf"):
        return process_dwg(file_path, project_dir)
    elif ext in (".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"):
        return process_image(file_path, project_dir)
    else:
        return {"type": "unknown", "error": f"Extensão não suportada: {ext}"}


def save_processing_result(project_dir: str, filename: str, result: dict):
    """
    Salva o resultado do processamento em arquivo JSON ao lado dos metadados.
    """
    processing_dir = Path(project_dir) / "processing"
    processing_dir.mkdir(exist_ok=True)

    stem = Path(filename).stem
    output_path = processing_dir / f"{stem}_processed.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False, default=str)

    return str(output_path)