"""
TRAÇO - Analisador de Plantas
Orquestra a detecção de elementos e calcula estimativas de dimensões reais.
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

from .detector import PlantDetector


class PlantAnalyzer:
    """
    Analisador de alto nível para plantas arquitetônicas.
    Combina detecção de elementos com estimativa de escala e geração de relatório.
    """

    # Dimensões padrão de referência (em metros) para calibração de escala
    STANDARD_DOOR_WIDTH_M = 0.80  # Porta padrão de 80cm
    STANDARD_WALL_THICKNESS_M = 0.15  # Parede de 15cm
    STANDARD_CEILING_HEIGHT_M = 2.80  # Pé-direito padrão

    def __init__(self):
        self.detector = PlantDetector()

    def analyze(self, image_path: str, project_dir: str) -> Dict:
        """
        Executa análise completa da planta com estimativa de escala.

        Args:
            image_path: Caminho para a imagem da planta
            project_dir: Diretório do projeto para salvar resultados

        Returns:
            Dicionário com análise completa e estimativas
        """
        # Executa detecção básica
        detection = self.detector.analyze_plant(image_path)

        if "error" in detection.get("walls", {}):
            return {
                "status": "error",
                "error": detection["walls"]["error"],
                "timestamp": datetime.now().isoformat()
            }

        # Estima escala baseada em elementos conhecidos
        scale = self._estimate_scale(detection)

        # Converte medidas de pixels para metros usando a escala estimada
        quantified = self._quantify_elements(detection, scale)

        # Gera resumo executivo
        summary = self._generate_summary(quantified, scale)

        # Salva análise completa
        result = {
            "status": "completed",
            "timestamp": datetime.now().isoformat(),
            "image_path": image_path,
            "scale": scale,
            "elements": quantified,
            "summary": summary,
            "raw_detection": detection
        }

        # Salva em arquivo JSON
        output_dir = Path(project_dir) / "analysis"
        output_dir.mkdir(exist_ok=True)

        stem = Path(image_path).stem
        output_path = output_dir / f"{stem}_analysis.json"

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False, default=str)

        result["analysis_file"] = str(output_path)

        # Gera visualização anotada
        viz_path = output_dir / f"{stem}_annotated.jpg"
        viz_result = self.detector.generate_visualization(
            image_path, detection, str(viz_path)
        )
        if "error" not in viz_result:
            result["visualization_path"] = str(viz_path)

        return result

    def _estimate_scale(self, detection: Dict) -> Dict:
        """
        Estima a escala da planta (metros por pixel) usando elementos de referência.

        Estratégias:
        1. Portas detectadas: compara largura em pixels com porta padrão (80cm)
        2. Paredes detectadas: compara espessura com parede padrão (15cm)
        3. Fallback: assume escala genérica baseada em resolução comum
        """
        scale_candidates = []

        # Estratégia 1: Portas
        doors = detection.get("doors", {}).get("doors", [])
        if doors:
            # Usa a mediana das portas detectadas para evitar outliers
            widths = sorted([d["width_pixels"] for d in doors])
            if widths:
                median_width_px = widths[len(widths) // 2]
                if median_width_px > 0:
                    m_per_px = self.STANDARD_DOOR_WIDTH_M / median_width_px
                    scale_candidates.append({
                        "method": "door_width",
                        "m_per_px": m_per_px,
                        "reference": f"{self.STANDARD_DOOR_WIDTH_M}m / {median_width_px}px",
                        "confidence": 0.7
                    })

        # Estratégia 2: Paredes
        walls = detection.get("walls", {}).get("walls", [])
        if walls:
            thicknesses = sorted([w["thickness_pixels"] for w in walls])
            if thicknesses:
                median_thickness_px = thicknesses[len(thicknesses) // 2]
                if median_thickness_px > 0:
                    m_per_px = self.STANDARD_WALL_THICKNESS_M / median_thickness_px
                    scale_candidates.append({
                        "method": "wall_thickness",
                        "m_per_px": m_per_px,
                        "reference": f"{self.STANDARD_WALL_THICKNESS_M}m / {median_thickness_px}px",
                        "confidence": 0.5
                    })

        # Seleciona a melhor estimativa
        if scale_candidates:
            # Prioriza método com maior confiança
            best = max(scale_candidates, key=lambda x: x["confidence"])

            # Se temos múltiplas estimativas próximas, aumenta confiança
            if len(scale_candidates) > 1:
                values = [c["m_per_px"] for c in scale_candidates]
                variance = max(values) / min(values) if min(values) > 0 else 999
                if variance < 1.3:  # Estimativas concordam dentro de 30%
                    best["confidence"] = min(0.95, best["confidence"] + 0.2)
                    best["method"] = "combined"

            return {
                "m_per_px": best["m_per_px"],
                "px_per_m": 1 / best["m_per_px"] if best["m_per_px"] > 0 else 0,
                "method": best["method"],
                "reference": best["reference"],
                "confidence": best["confidence"],
                "candidates": scale_candidates
            }

        # Fallback: escala genérica (assume 300 DPI e planta impressa em A4)
        # ~11.8 pixels por mm = 11800 pixels por metro
        fallback_m_per_px = 1 / 11800
        return {
            "m_per_px": fallback_m_per_px,
            "px_per_m": 11800,
            "method": "fallback_generic",
            "reference": "Generic 300 DPI assumption",
            "confidence": 0.2,
            "candidates": []
        }

    def _quantify_elements(self, detection: Dict, scale: Dict) -> Dict:
        """
        Converte elementos detectados de pixels para medidas reais (metros).
        """
        m_per_px = scale["m_per_px"]
        quantified = {
            "walls": [],
            "doors": [],
            "windows": [],
            "rooms": []
        }

        # Paredes
        for wall in detection.get("walls", {}).get("walls", []):
            length_m = wall["length_pixels"] * m_per_px
            thickness_m = wall["thickness_pixels"] * m_per_px

            quantified["walls"].append({
                "id": wall["id"],
                "orientation": wall["orientation"],
                "length_m": round(length_m, 2),
                "thickness_m": round(thickness_m, 2),
                "area_m2": round(length_m * thickness_m, 3),
                "height_m": self.STANDARD_CEILING_HEIGHT_M,
                "volume_m3": round(length_m * thickness_m * self.STANDARD_CEILING_HEIGHT_M, 3)
            })

        # Portas
        for door in detection.get("doors", {}).get("doors", []):
            width_m = door["width_pixels"] * m_per_px

            quantified["doors"].append({
                "id": door["id"],
                "width_m": round(width_m, 2),
                "height_m": 2.10,  # Altura padrão de porta
                "type": self._classify_door(width_m)
            })

        # Janelas
        for window in detection.get("windows", {}).get("windows", []):
            length_m = window["length_pixels"] * m_per_px

            quantified["windows"].append({
                "id": window["id"],
                "width_m": round(length_m, 2),
                "height_m": 1.20,  # Altura padrão de janela
                "sill_height_m": 0.90,  # Peitoril padrão
                "type": self._classify_window(length_m)
            })

        # Ambientes
        for room in detection.get("rooms", {}).get("rooms", []):
            # Área em pixels² para m²: (pixels * m_per_px)²
            area_m2 = room["area_pixels"] * (m_per_px ** 2)
            perimeter_m = room["perimeter_pixels"] * m_per_px

            quantified["rooms"].append({
                "id": room["id"],
                "area_m2": round(area_m2, 2),
                "perimeter_m": round(perimeter_m, 2),
                "estimated_name": self._guess_room_name(area_m2)
            })

        return quantified

    def _classify_door(self, width_m: float) -> str:
        """Classifica porta baseado na largura."""
        if width_m < 0.70:
            return "porta_estreita"
        elif width_m <= 0.90:
            return "porta_padrao"
        elif width_m <= 1.20:
            return "porta_larga"
        else:
            return "porta_dupla_ou_portao"

    def _classify_window(self, width_m: float) -> str:
        """Classifica janela baseado na largura."""
        if width_m < 0.60:
            return "janela_pequena"
        elif width_m <= 1.50:
            return "janela_padrao"
        elif width_m <= 2.50:
            return "janela_grande"
        else:
            return "janela_panoramica"

    def _guess_room_name(self, area_m2: float) -> str:
        """Estimativa grosseira do tipo de ambiente baseado na área."""
        if area_m2 < 4:
            return "Banheiro / Lavabo"
        elif area_m2 < 8:
            return "Quarto pequeno / Cozinha"
        elif area_m2 < 15:
            return "Quarto padrão"
        elif area_m2 < 25:
            return "Sala / Quarto grande"
        elif area_m2 < 40:
            return "Sala ampla / Suíte master"
        else:
            return "Área social / Espaço aberto"

    def _generate_summary(self, quantified: Dict, scale: Dict) -> Dict:
        """Gera resumo executivo da análise."""
        total_wall_length = sum(w["length_m"] for w in quantified["walls"])
        total_wall_area = sum(w["area_m2"] for w in quantified["walls"])
        total_room_area = sum(r["area_m2"] for r in quantified["rooms"])

        return {
            "total_walls": len(quantified["walls"]),
            "total_wall_length_m": round(total_wall_length, 2),
            "total_wall_area_m2": round(total_wall_area, 2),
            "total_doors": len(quantified["doors"]),
            "total_windows": len(quantified["windows"]),
            "total_rooms": len(quantified["rooms"]),
            "total_area_m2": round(total_room_area, 2),
            "scale_confidence": f"{scale['confidence']*100:.0f}%",
            "scale_method": scale["method"],
            "estimated_perimeter_m": round(total_wall_length * 0.8, 2)  # Estimativa grosseira
        }


def analyze_plant_file(image_path: str, project_dir: str) -> Dict:
    """
    Função de conveniência para analisar uma planta.
    """
    analyzer = PlantAnalyzer()
    return analyzer.analyze(image_path, project_dir)