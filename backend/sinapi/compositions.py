"""
TRAÇO - Mapeador de Composições SINAPI
Mapeia elementos arquitetônicos detectados nas plantas para composições
de serviços SINAPI (Cadernos Técnicos).

Baseado nas metodologias:
- SINAPI Cadernos Técnicos de Composições
- Manual de Orçamento de Obras (CAIXA/TCU)
"""

from typing import Dict, List, Optional
from .importer import SinapiImporter
from .pricing import PricingEngine


class CompositionMapper:
    """
    Mapeador de composições SINAPI.
    Converte elementos detectados (paredes, portas, janelas, ambientes)
    em serviços orçamentários com quantitativos e preços.
    """

    # Mapeamento de elementos para códigos SINAPI (serviços padrão para edificações residenciais)
    # Estes códigos são referências e devem ser validados com os Cadernos Técnicos vigentes
    ELEMENT_SERVICE_MAP = {
        # Paredes
        "wall": {
            "alvenaria": "87498",      # Alvenaria bloco cerâmico furos verticais
            "reboco_interno": "87644", # Reboco interno traço 1:6
            "reboco_externo": "87645", # Reboco externo traço 1:6
            "pintura_interna": "88485", # Pintura látex acrílica (2 demãos)
            "pintura_externa": "88487"  # Pintura esmalte sintético
        },
        # Portas
        "door": {
            "porta_leve": "91367",     # Porta madeira leve 80x210cm
            "porta_pesada": "91369",   # Porta madeira pesada 80x210cm
        },
        # Janelas
        "window": {
            "janela_aluminio_120": "91371",  # Janela alumínio correr 120x120
            "janela_aluminio_150": "91373",  # Janela alumínio correr 150x120
        },
        # Ambientes (pisos e contrapisos)
        "room": {
            "contrapiso": "87634",     # Contrapiso argamassa 1:4 esp. 3cm
            "piso_ceramico": "87636",  # Piso cerâmico esmaltado PEI-4
            "porcelanato": "87637",    # Porcelanato polido 60x60
        },
        # Estrutura (quando detectada ou inferida)
        "structure": {
            "concreto_pilar": "92263",
            "concreto_viga": "92265",
            "concreto_laje": "92267",
            "forma_madeira": "96534",
        },
        # Cobertura
        "roof": {
            "telha_ceramica": "94210",
            "telha_concreto": "94212",
            "impermeabilizacao": "94214",
        }
    }

    # Especificações padrão de composições (quantidades de insumos por m²/m³/un)
    # Baseado em composições analíticas SINAPI simplificadas
    COMPOSITION_SPECS = {
        "87498": {
            "descricao": "ALVENARIA DE BLOCOS CERÂMICOS 14x19x39cm (Furos verticais) - ASSENTAMENTO COM ARGAMASSA DE CIMENTO E AREIA TRAÇO 1:6",
            "unidade": "M2",
            "insumos": {
                "Bloco cerâmico 14x19x39cm": 12.5,  # un/m²
                "Argamassa traço 1:6 (cimento e areia)": 0.018,  # m³/m² (esp. 1,5cm)
                "Pedreiro": 0.50,  # h/m²
                "Servente": 0.50,  # h/m²
            }
        },
        "87644": {
            "descricao": "REBOCO OU MASSA ÚNICA COM ARGAMASSA TRACO 1:6 (CIMENTO E AREIA), ESPESSURA 2,0 CM, PREPARO MANUAL",
            "unidade": "M2",
            "insumos": {
                "Cimento CP II": 4.2,  # kg/m²
                "Areia média lavada": 0.024,  # m³/m²
                "Pedreiro": 0.40,
                "Servente": 0.25,
            }
        },
        "87634": {
            "descricao": "CONTRAPISO EM ARGAMASSA TRACO 1:4 (CIMENTO E AREIA), ESPESSURA 3 CM",
            "unidade": "M2",
            "insumos": {
                "Cimento CP II": 7.5,
                "Areia média lavada": 0.036,
                "Pedreiro": 0.25,
                "Servente": 0.25,
            }
        },
        "92263": {
            "descricao": "CONCRETO ARMADO FCK=25MPA PARA PILAR, COM LANÇAMENTO E ADENSAMENTO",
            "unidade": "M3",
            "insumos": {
                "Concreto usinado fck 25MPa": 1.0,  # m³/m³
                "Aço CA-50 (média)": 100.0,  # kg/m³ (estimativa média)
                "Carpinteiro": 4.0,
                "Armador": 8.0,
                "Forma compensada resinada (m²)": 10.0,  # m²/m³ de concreto
                "Servente": 6.0,
            }
        },
        "91367": {
            "descricao": "PORTA DE MADEIRA LEVE (NÚCLEO COLMELADO/COLMEIA), 80x210 CM, FORNECIMENTO E INSTALAÇÃO",
            "unidade": "UN",
            "insumos": {
                "Folha de porta leve 80x210": 1.0,
                "Batente/alizar/almofada": 1.0,
                "Dobradiça e fechadura": 1.0,
                "Carpinteiro": 1.5,
                "Servente": 0.5,
            }
        }
    }

    def __init__(self, regiao: str = "SP", desonerado: bool = False):
        self.importer = SinapiImporter()
        self.pricing = PricingEngine(desonerado=desonerado, regiao=regiao)
        self.regiao = regiao
        self.desonerado = desonerado

    def generate_budget(self, analysis_result: Dict,
                        user_overrides: Optional[Dict] = None) -> Dict:
        """
        Gera orçamento completo a partir do resultado da análise da planta.

        Args:
            analysis_result: Dicionário retornado por PlantAnalyzer.analyze()
            user_overrides: Dicionário opcional para sobrescrever padrões:
                           {
                             "wall_finish": "reboco_interno",
                             "floor_type": "piso_ceramico",
                             "door_type": "porta_leve"
                           }

        Returns:
            Orçamento detalhado com quantitativos e custos
        """
        if analysis_result.get("status") == "error":
            return {"status": "error", "message": "Análise da planta falhou"}

        elementos = analysis_result.get("elements", {})
        scale = analysis_result.get("scale", {})

        itens_orcamento = []

        # 1. Processa Paredes
        for wall in elementos.get("walls", []):
            itens = self._budget_wall(wall, user_overrides)
            itens_orcamento.extend(itens)

        # 2. Processa Portas
        for door in elementos.get("doors", []):
            itens = self._budget_door(door, user_overrides)
            itens_orcamento.extend(itens)

        # 3. Processa Janelas
        for window in elementos.get("windows", []):
            itens = self._budget_window(window, user_overrides)
            itens_orcamento.extend(itens)

        # 4. Processa Ambientes (pisos)
        for room in elementos.get("rooms", []):
            itens = self._budget_room(room, user_overrides)
            itens_orcamento.extend(itens)

        # 5. Adiciona serviços inferidos (estrutura básica proporcional à área)
        itens_inferidos = self._budget_inferred_services(
            elementos.get("rooms", []), user_overrides
        )
        itens_orcamento.extend(itens_inferidos)

        # Gera resumo final
        orcamento_final = self.pricing.gerar_orcamento(itens_orcamento)

        # Adiciona metadados
        orcamento_final["metadata"] = {
            "source": "TRAÇO AI Analysis",
            "scale_method": scale.get("method", "unknown"),
            "scale_confidence": scale.get("confidence", 0),
            "regiao": self.regiao,
            "desonerado": self.desonerado,
            "overrides": user_overrides or {},
            "total_elements_analyzed": {
                "walls": len(elementos.get("walls", [])),
                "doors": len(elementos.get("doors", [])),
                "windows": len(elementos.get("windows", [])),
                "rooms": len(elementos.get("rooms", [])),
            }
        }

        return orcamento_final

    def _budget_wall(self, wall: Dict, overrides: Optional[Dict]) -> List[Dict]:
        """Gera itens orçamentários para uma parede."""
        itens = []
        area_m2 = wall.get("area_m2", 0)
        if area_m2 <= 0:
            return itens

        # Alvenaria (sempre aplicável)
        codigo_alvenaria = self.ELEMENT_SERVICE_MAP["wall"]["alvenaria"]
        info_alv = self.importer.SERVICE_CATALOG.get(codigo_alvenaria, {})
        custo_alv = self.importer.get_price(codigo_alvenaria, self.regiao)
        if custo_alv is None:
            custo_alv = self.importer._get_estimated_price(codigo_alvenaria)

        itens.append(self.pricing.calcular_item(
            codigo=codigo_alvenaria,
            descricao=info_alv.get("descricao", "ALVENARIA"),
            unidade="M2",
            quantidade=area_m2,
            custo_unit_direto=custo_alv
        ))

        # Reboco (assume ambos os lados da parede)
        reboco_codigo = self.ELEMENT_SERVICE_MAP["wall"]["reboco_interno"]
        info_reb = self.importer.SERVICE_CATALOG.get(reboco_codigo, {})
        custo_reb = self.importer.get_price(reboco_codigo, self.regiao)
        if custo_reb is None:
            custo_reb = self.importer._get_estimated_price(reboco_codigo)

        itens.append(self.pricing.calcular_item(
            codigo=reboco_codigo,
            descricao=info_reb.get("descricao", "REBOCO"),
            unidade="M2",
            quantidade=area_m2 * 2,  # Ambos os lados
            custo_unit_direto=custo_reb
        ))

        # Pintura
        pintura_codigo = self.ELEMENT_SERVICE_MAP["wall"]["pintura_interna"]
        info_pint = self.importer.SERVICE_CATALOG.get(pintura_codigo, {})
        custo_pint = self.importer.get_price(pintura_codigo, self.regiao)
        if custo_pint is None:
            custo_pint = self.importer._get_estimated_price(pintura_codigo)

        itens.append(self.pricing.calcular_item(
            codigo=pintura_codigo,
            descricao=info_pint.get("descricao", "PINTURA"),
            unidade="M2",
            quantidade=area_m2 * 2,
            custo_unit_direto=custo_pint
        ))

        return itens

    def _budget_door(self, door: Dict, overrides: Optional[Dict]) -> List[Dict]:
        """Gera itens orçamentários para uma porta."""
        door_type = overrides.get("door_type", "porta_leve") if overrides else "porta_leve"
        codigo = self.ELEMENT_SERVICE_MAP["door"].get(door_type, "91367")

        info = self.importer.SERVICE_CATALOG.get(codigo, {})
        custo = self.importer.get_price(codigo, self.regiao)
        if custo is None:
            custo = self.importer._get_estimated_price(codigo)

        return [self.pricing.calcular_item(
            codigo=codigo,
            descricao=info.get("descricao", "PORTA"),
            unidade="UN",
            quantidade=1,
            custo_unit_direto=custo
        )]

    def _budget_window(self, window: Dict, overrides: Optional[Dict]) -> List[Dict]:
        """Gera itens orçamentários para uma janela."""
        # Escolhe tamanho baseado na largura detectada
        width = window.get("width_m", 1.2)
        if width > 1.35:
            codigo = self.ELEMENT_SERVICE_MAP["window"]["janela_aluminio_150"]
        else:
            codigo = self.ELEMENT_SERVICE_MAP["window"]["janela_aluminio_120"]

        info = self.importer.SERVICE_CATALOG.get(codigo, {})
        custo = self.importer.get_price(codigo, self.regiao)
        if custo is None:
            custo = self.importer._get_estimated_price(codigo)

        return [self.pricing.calcular_item(
            codigo=codigo,
            descricao=info.get("descricao", "JANELA"),
            unidade="UN",
            quantidade=1,
            custo_unit_direto=custo
        )]

    def _budget_room(self, room: Dict, overrides: Optional[Dict]) -> List[Dict]:
        """Gera itens orçamentários para um ambiente (piso)."""
        itens = []
        area_m2 = room.get("area_m2", 0)
        if area_m2 <= 0:
            return itens

        floor_type = overrides.get("floor_type", "piso_ceramico") if overrides else "piso_ceramico"

        # Contrapiso
        contrapiso_codigo = self.ELEMENT_SERVICE_MAP["room"]["contrapiso"]
        info_cp = self.importer.SERVICE_CATALOG.get(contrapiso_codigo, {})
        custo_cp = self.importer.get_price(contrapiso_codigo, self.regiao)
        if custo_cp is None:
            custo_cp = self.importer._get_estimated_price(contrapiso_codigo)

        itens.append(self.pricing.calcular_item(
            codigo=contrapiso_codigo,
            descricao=info_cp.get("descricao", "CONTRAPISO"),
            unidade="M2",
            quantidade=area_m2,
            custo_unit_direto=custo_cp
        ))

        # Piso de acabamento
        piso_codigo = self.ELEMENT_SERVICE_MAP["room"].get(floor_type, "87636")
        info_piso = self.importer.SERVICE_CATALOG.get(piso_codigo, {})
        custo_piso = self.importer.get_price(piso_codigo, self.regiao)
        if custo_piso is None:
            custo_piso = self.importer._get_estimated_price(piso_codigo)

        itens.append(self.pricing.calcular_item(
            codigo=piso_codigo,
            descricao=info_piso.get("descricao", "PISO"),
            unidade="M2",
            quantidade=area_m2,
            custo_unit_direto=custo_piso
        ))

        return itens

    def _budget_inferred_services(self, rooms: List[Dict], overrides: Optional[Dict]) -> List[Dict]:
        """
        Adiciona serviços que não foram detectados diretamente mas podem ser
        inferidos proporcionalmente à área total da edificação.

        Exemplos:
        - Estrutura (concreto armado) proporcional à área construída
        - Cobertura proporcional à área do térreo
        - Instalações elétricas e hidráulicas (estimativa por m²)
        """
        itens = []
        total_area = sum(r.get("area_m2", 0) for r in rooms)
        if total_area <= 0:
            return itens

        # Estimativa de estrutura (concreto armado) - ~0.3 m³ por m² construído
        # (considerando fundação, pilares, vigas, laje)
        volume_concreto = total_area * 0.3
        codigo_concreto = "92265"  # Concreto viga (média)
        info_concr = self.importer.SERVICE_CATALOG.get(codigo_concreto, {})
        custo_concr = self.importer.get_price(codigo_concreto, self.regiao)
        if custo_concr is None:
            custo_concr = self.importer._get_estimated_price(codigo_concreto)

        if custo_concr > 0:
            itens.append(self.pricing.calcular_item(
                codigo=codigo_concreto,
                descricao=f"ESTRUTURA CONCRETO ARMADO (INFERIDO) - {info_concr.get('descricao', '')}",
                unidade="M3",
                quantidade=volume_concreto,
                custo_unit_direto=custo_concr
            ))

        # Instalações elétricas - R$ 80,00 por m² (estimativa nacional simplificada)
        # Como não temos código SINAPI direto "instalação elétrica por m²",
        # fazemos uma estimativa agregada
        itens.append({
            "codigo": "INF_ELETRICA",
            "descricao": "INSTALAÇÕES ELÉTRICAS - ESTIMATIVA PROPORCIONAL",
            "unidade": "M2",
            "quantidade": total_area,
            "custo_unit_direto": 80.00,
            "custo_unit_com_bdi": round(80.00 * (1 + self.pricing.bdi_config["coeficiente"]), 2),
            "custo_direto_total": round(80.00 * total_area, 2),
            "custo_total": round(80.00 * total_area * (1 + self.pricing.bdi_config["coeficiente"]), 2),
            "bdi_aplicado": self.pricing.bdi_config["percentual"],
            "regiao": self.regiao,
            "desonerado": self.desonerado,
            "observacao": "Estimativa baseada em R$ 80/m² (média nacional)"
        })

        # Instalações hidráulicas - R$ 65,00 por m²
        itens.append({
            "codigo": "INF_HIDRAULICA",
            "descricao": "INSTALAÇÕES HIDRÁULICAS - ESTIMATIVA PROPORCIONAL",
            "unidade": "M2",
            "quantidade": total_area,
            "custo_unit_direto": 65.00,
            "custo_unit_com_bdi": round(65.00 * (1 + self.pricing.bdi_config["coeficiente"]), 2),
            "custo_direto_total": round(65.00 * total_area, 2),
            "custo_total": round(65.00 * total_area * (1 + self.pricing.bdi_config["coeficiente"]), 2),
            "bdi_aplicado": self.pricing.bdi_config["percentual"],
            "regiao": self.regiao,
            "desonerado": self.desonerado,
            "observacao": "Estimativa baseada em R$ 65/m² (média nacional)"
        })

        return itens

    def get_available_services(self, categoria: Optional[str] = None) -> Dict:
        """
        Lista serviços SINAPI disponíveis para seleção manual.

        Args:
            categoria: Filtro opcional (ex: 'ALVENARIA', 'PINTURA', 'ELETRICA')

        Returns:
            Dicionário com serviços agrupados
        """
        catalog = self.importer.load_default_catalog()

        if categoria:
            catalog["services"] = [
                s for s in catalog["services"]
                if categoria.upper() in s["descricao"].upper()
            ]

        return catalog

    def update_service_price(self, codigo: str, novo_preco: float,
                             regiao: str, mes_ano: str) -> Dict:
        """
        Atualiza preço de um serviço específico (override manual pelo usuário).
        """
        key = f"{regiao}_{mes_ano}_{codigo}"

        # Atualiza cache em memória
        self.importer.prices_cache[key] = {
            "codigo": codigo,
            "preco_unitario": novo_preco,
            "regiao": regiao,
            "mes_ano": mes_ano,
            "modified_at": "manual_override"
        }

        return {
            "status": "success",
            "message": f"Preço do serviço {codigo} atualizado para R$ {novo_preco:.2f}",
            "codigo": codigo,
            "novo_preco": novo_preco
        }