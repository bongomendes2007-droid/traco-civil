"""
TRAÇO - Detector de Elementos Arquitetônicos
Algoritmos para identificar paredes, portas, janelas e ambientes em plantas.
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import json


class PlantDetector:
    """
    Detector de elementos em plantas arquitetônicas.
    Usa processamento de imagem para identificar:
    - Paredes (linhas grossas contínuas)
    - Portas (aberturas com arco)
    - Janelas (aberturas com linhas paralelas)
    - Ambientes (regiões fechadas)
    """

    def __init__(self):
        self.wall_thickness_min = 5  # pixels
        self.wall_thickness_max = 20  # pixels
        self.min_wall_length = 50  # pixels
        self.door_arc_threshold = 0.3  # relação arco/raio
        self.window_parallel_distance = (5, 15)  # pixels entre linhas paralelas

    def detect_walls(self, image_path: str) -> Dict:
        """
        Detecta paredes na planta usando detecção de linhas e análise de espessura.
        Retorna lista de paredes com coordenadas e dimensões.
        """
        try:
            import cv2
        except ImportError:
            return {
                "error": "OpenCV não instalado. Execute: pip install opencv-python",
                "walls": []
            }

        # Carrega imagem em escala de cinza
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return {"error": "Não foi possível carregar a imagem", "walls": []}

        # Binarização (preto e branco)
        _, binary = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY_INV)

        # Detecta contornos
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        walls = []
        wall_id = 0

        for contour in contours:
            # Filtra por área (paredes são longas e finas)
            area = cv2.contourArea(contour)
            if area < 500:  # Área mínima
                continue

            # Calcula bounding box
            x, y, w, h = cv2.boundingRect(contour)

            # Verifica se é uma parede (aspect ratio alto)
            aspect_ratio = max(w, h) / max(min(w, h), 1)

            if aspect_ratio > 3:  # Paredes são muito mais longas que largas
                thickness = min(w, h)

                # Verifica espessura da parede
                if self.wall_thickness_min <= thickness <= self.wall_thickness_max:
                    wall_id += 1
                    length = max(w, h)

                    # Determina orientação
                    orientation = "horizontal" if w > h else "vertical"

                    walls.append({
                        "id": wall_id,
                        "type": "wall",
                        "bbox": {"x": x, "y": y, "width": w, "height": h},
                        "length_pixels": length,
                        "thickness_pixels": thickness,
                        "orientation": orientation,
                        "area_pixels": area
                    })

        return {
            "walls": walls,
            "count": len(walls),
            "total_length_pixels": sum(w["length_pixels"] for w in walls)
        }

    def detect_doors(self, image_path: str) -> Dict:
        """
        Detecta portas procurando por arcos e aberturas nas paredes.
        """
        try:
            import cv2
        except ImportError:
            return {"error": "OpenCV não instalado", "doors": []}

        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return {"error": "Não foi possível carregar a imagem", "doors": []}

        # Detecta círculos (arcos de portas)
        circles = cv2.HoughCircles(
            img,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=20,
            param1=50,
            param2=30,
            minRadius=20,
            maxRadius=100
        )

        doors = []
        door_id = 0

        if circles is not None:
            circles = np.round(circles[0, :]).astype("int")

            for (x, y, r) in circles:
                door_id += 1

                # Estima largura da porta (diâmetro do arco)
                width_pixels = r * 2

                doors.append({
                    "id": door_id,
                    "type": "door",
                    "center": {"x": int(x), "y": int(y)},
                    "radius_pixels": int(r),
                    "width_pixels": int(width_pixels),
                    "estimated_width_m": round(width_pixels * 0.01, 2)  # Estimativa grosseira
                })

        return {
            "doors": doors,
            "count": len(doors)
        }

    def detect_windows(self, image_path: str) -> Dict:
        """
        Detecta janelas procurando por linhas paralelas próximas (representando a abertura).
        """
        try:
            import cv2
        except ImportError:
            return {"error": "OpenCV não instalado", "windows": []}

        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return {"error": "Não foi possível carregar a imagem", "windows": []}

        # Detecta linhas usando Hough
        edges = cv2.Canny(img, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi/180,
            threshold=100,
            minLineLength=30,
            maxLineGap=10
        )

        windows = []
        window_id = 0

        if lines is not None:
            # Agrupa linhas paralelas próximas
            processed_pairs = set()

            for i, line1 in enumerate(lines):
                x1, y1, x2, y2 = line1[0]

                for j, line2 in enumerate(lines[i+1:], start=i+1):
                    if (i, j) in processed_pairs:
                        continue

                    x3, y3, x4, y4 = line2[0]

                    # Verifica se são paralelas
                    angle1 = np.arctan2(y2 - y1, x2 - x1)
                    angle2 = np.arctan2(y4 - y3, x4 - x3)

                    angle_diff = abs(angle1 - angle2)
                    if angle_diff > np.pi / 2:
                        angle_diff = np.pi - angle_diff

                    # Linhas paralelas têm ângulos muito próximos
                    if angle_diff < 0.1:  # ~5 graus
                        # Calcula distância entre as linhas
                        # (simplificado: distância do ponto médio)
                        mid1 = ((x1 + x2) / 2, (y1 + y2) / 2)
                        mid2 = ((x3 + x4) / 2, (y3 + y4) / 2)

                        distance = np.sqrt((mid1[0] - mid2[0])**2 + (mid1[1] - mid2[1])**2)

                        if self.window_parallel_distance[0] <= distance <= self.window_parallel_distance[1]:
                            window_id += 1
                            processed_pairs.add((i, j))

                            length = max(
                                np.sqrt((x2 - x1)**2 + (y2 - y1)**2),
                                np.sqrt((x4 - x3)**2 + (y4 - y3)**2)
                            )

                            windows.append({
                                "id": window_id,
                                "type": "window",
                                "length_pixels": int(length),
                                "gap_pixels": int(distance),
                                "estimated_width_m": round(length * 0.01, 2)
                            })

        return {
            "windows": windows,
            "count": len(windows)
        }

    def detect_rooms(self, image_path: str) -> Dict:
        """
        Detecta ambientes (cômodos) procurando por regiões fechadas.
        """
        try:
            import cv2
        except ImportError:
            return {"error": "OpenCV não instalado", "rooms": []}

        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return {"error": "Não foi possível carregar a imagem", "rooms": []}

        # Binarização
        _, binary = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY_INV)

        # Inverte para encontrar regiões internas
        binary_inv = cv2.bitwise_not(binary)

        # Encontra contornos internos
        contours, hierarchy = cv2.findContours(binary_inv, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        rooms = []
        room_id = 0

        if hierarchy is not None:
            for i, contour in enumerate(contours):
                # Verifica se é um contorno interno (tem pai)
                if hierarchy[0][i][3] != -1:
                    area = cv2.contourArea(contour)

                    # Filtra por área mínima (cômodos têm área significativa)
                    if area > 5000:  # ~5000 pixels²
                        room_id += 1

                        x, y, w, h = cv2.boundingRect(contour)

                        # Calcula área em m² (estimativa grosseira: 100px = 1m)
                        area_m2 = round(area / 10000, 2)

                        rooms.append({
                            "id": room_id,
                            "type": "room",
                            "bbox": {"x": x, "y": y, "width": w, "height": h},
                            "area_pixels": int(area),
                            "area_m2_estimated": area_m2,
                            "perimeter_pixels": int(cv2.arcLength(contour))
                        })

        return {
            "rooms": rooms,
            "count": len(rooms),
            "total_area_m2_estimated": round(sum(r["area_m2_estimated"] for r in rooms), 2)
        }

    def analyze_plant(self, image_path: str) -> Dict:
        """
        Executa análise completa da planta, detectando todos os elementos.
        """
        result = {
            "image_path": image_path,
            "analysis_timestamp": None,
            "walls": self.detect_walls(image_path),
            "doors": self.detect_doors(image_path),
            "windows": self.detect_windows(image_path),
            "rooms": self.detect_rooms(image_path)
        }

        from datetime import datetime
        result["analysis_timestamp"] = datetime.now().isoformat()

        # Calcula estatísticas gerais
        result["summary"] = {
            "total_walls": result["walls"].get("count", 0),
            "total_doors": result["doors"].get("count", 0),
            "total_windows": result["windows"].get("count", 0),
            "total_rooms": result["rooms"].get("count", 0),
            "estimated_area_m2": result["rooms"].get("total_area_m2_estimated", 0)
        }

        return result

    def generate_visualization(self, image_path: str, analysis: Dict, output_path: str):
        """
        Gera imagem com anotações dos elementos detectados.
        """
        try:
            import cv2
        except ImportError:
            return {"error": "OpenCV não instalado"}

        # Carrega imagem colorida
        img = cv2.imread(image_path)
        if img is None:
            return {"error": "Não foi possível carregar a imagem"}

        # Cores para cada tipo de elemento
        colors = {
            "wall": (0, 255, 0),      # Verde
            "door": (255, 0, 0),      # Azul
            "window": (0, 0, 255),    # Vermelho
            "room": (255, 255, 0)     # Ciano
        }

        # Desenha paredes
        for wall in analysis["walls"].get("walls", []):
            bbox = wall["bbox"]
            cv2.rectangle(
                img,
                (bbox["x"], bbox["y"]),
                (bbox["x"] + bbox["width"], bbox["y"] + bbox["height"]),
                colors["wall"],
                2
            )
            cv2.putText(
                img,
                f"P{wall['id']}",
                (bbox["x"], bbox["y"] - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                colors["wall"],
                1
            )

        # Desenha portas
        for door in analysis["doors"].get("doors", []):
            center = door["center"]
            radius = door["radius_pixels"]
            cv2.circle(img, (center["x"], center["y"]), radius, colors["door"], 2)
            cv2.putText(
                img,
                f"D{door['id']}",
                (center["x"] - 10, center["y"] - radius - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                colors["door"],
                1
            )

        # Desenha janelas
        for window in analysis["windows"].get("windows", []):
            # Simplificado: apenas marca com texto
            cv2.putText(
                img,
                f"J{window['id']}",
                (50, 50 + window['id'] * 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                colors["window"],
                1
            )

        # Desenha ambientes
        for room in analysis["rooms"].get("rooms", []):
            bbox = room["bbox"]
            cv2.rectangle(
                img,
                (bbox["x"], bbox["y"]),
                (bbox["x"] + bbox["width"], bbox["y"] + bbox["height"]),
                colors["room"],
                2
            )
            area_text = f"A{room['id']}: {room['area_m2_estimated']}m²"
            cv2.putText(
                img,
                area_text,
                (bbox["x"] + 5, bbox["y"] + 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                colors["room"],
                2
            )

        # Salva imagem anotada
        cv2.imwrite(output_path, img)

        return {
            "visualization_path": output_path,
            "message": "Visualização gerada com sucesso"
        }