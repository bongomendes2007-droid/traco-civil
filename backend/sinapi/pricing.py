"""
TRAÇO - Motor de Precificação
Sistema de cálculo de custos com BDI, encargos sociais e variações regionais.
Baseado nas metodologias SINAPI/CAIXA e TCU.
"""

from typing import Dict, List, Optional
from datetime import datetime


class PricingEngine:
    """
    Motor de precificação para orçamento de obras.
    Aplica BDI, encargos sociais e regras fiscais aos custos diretos SINAPI.
    """

    # Encargos sociais por região (valores de referência SINAPI/TCU)
    # Inclui INSS, FGTS, férias, 13º, aviso prévio, etc.
    ENCARGOS_SOCIAIS_PADRAO = {
        "HORISTA": {
            "SEM_DESONERACAO": 1.6781,   # 167,81% sobre salário (padrão CAIXA 2024)
            "COM_DESONERACAO": 0.8374,   # 83,74% com desoneração
        },
        "MENSALISTA": {
            "SEM_DESONERACAO": 1.2645,   # 126,45%
            "COM_DESONERACAO": 0.6593,   # 65,93%
        }
    }

    # Parâmetros de BDI (referência TCU Acórdão 2622/2013 e 2362/2015)
    BDI_DEFAULT = {
        "administracao_local": 0.0400,   # 4% Administração local
        "seguro_garantia": 0.0080,       # 0,8% Seguro e garantia
        "risco": 0.0100,                 # 1% Risco
        "despesas_financeiras": 0.0120,  # 1,2% Despesas financeiras
        "lucro": 0.0800,                 # 8% Lucro
        "impostos": {
            "ISS": 0.0500,               # 5% ISS (média municipal)
            "COFINS": 0.0300,            # 3% COFINS
            "PIS": 0.0065,               # 0,65% PIS
            "CPRB": 0.0000,              # 0% Contribuição Previdenciária (se desonerado)
        }
    }

    def __init__(self, desonerado: bool = False, regiao: str = "SP"):
        """
        Args:
            desonerado: Se True, usa encargos com desoneração da folha
            regiao: Código da região (SP, RJ, MG, etc.)
        """
        self.desonerado = desonerado
        self.regiao = regiao
        self.bdi_config = self._calc_bdi()

    def _calc_bdi(self) -> Dict:
        """
        Calcula o coeficiente BDI conforme fórmula do TCU:

        BDI = [(1 + AC + S + R + G) / (1 - TM - DF)] - 1

        Onde:
        - AC = Administração central (não aplicável em obras pequenas)
        - S  = Seguros e garantias
        - R  = Risco
        - G  = Despesas financeiras
        - TM = Taxa de mercado (impostos sobre receita)
        - DF = Despesas financeiras indiretas
        """
        cfg = self.BDI_DEFAULT
        impostos = cfg["impostos"]

        # Numerador: custos indiretos + lucro
        numerador = 1 + cfg["administracao_local"] + cfg["seguro_garantia"] + \
                    cfg["risco"] + cfg["lucro"]

        # Denominador: descontando impostos sobre faturamento
        taxa_impostos = impostos["ISS"] + impostos["COFINS"] + \
                        impostos["PIS"] + impostos["CPRB"]
        denominador = 1 - taxa_impostos - cfg["despesas_financeiras"]

        if denominador <= 0:
            denominador = 0.01  # Proteção contra divisão por zero

        bdi_coeficiente = (numerador / denominador) - 1

        return {
            "coeficiente": round(bdi_coeficiente, 4),
            "percentual": f"{bdi_coeficiente * 100:.2f}%",
            "formula": "[(1+AC+S+R+L) / (1-TM-DF)] - 1",
            "componentes": cfg,
            "desonerado": self.desonerado
        }

    def aplicar_bdi(self, custo_direto: float) -> float:
        """Aplica BDI sobre um custo direto unitário."""
        return custo_direto * (1 + self.bdi_config["coeficiente"])

    def aplicar_encargos(self, custo_mao_obra: float,
                         tipo: str = "HORISTA") -> float:
        """
        Aplica encargos sociais sobre custo de mão de obra.

        Args:
            custo_mao_obra: Valor base (salário/hora)
            tipo: 'HORISTA' ou 'MENSALISTA'
        """
        if self.desonerado:
            fator = self.ENCARGOS_SOCIAIS_PADRAO[tipo]["COM_DESONERACAO"]
        else:
            fator = self.ENCARGOS_SOCIAIS_PADRAO[tipo]["SEM_DESONERACAO"]

        return custo_mao_obra * fator

    def calcular_item(self, codigo: str, descricao: str, unidade: str,
                      quantidade: float, custo_unit_direto: float,
                      composicao: Optional[Dict] = None) -> Dict:
        """
        Calcula o custo completo de um item orçamentário.

        Args:
            codigo: Código SINAPI
            descricao: Descrição do serviço
            unidade: Unidade de medida (M2, M, UN, M3)
            quantidade: Quantidade a executar
            custo_unit_direto: Custo unitário direto do SINAPI
            composicao: Detalhamento opcional (material/mão de obra/equipamento)
        """
        # Custo direto unitário
        custo_direto_unit = custo_unit_direto

        # Aplica BDI
        custo_com_bdi = self.aplicar_bdi(custo_direto_unit)

        # Totais
        custo_direto_total = custo_direto_unit * quantidade
        custo_total = custo_com_bdi * quantidade

        # Detalhamento por componentes (se composição disponível)
        detalhamento = None
        if composicao:
            detalhamento = self._detalhar_composicao(
                composicao, quantidade, custo_com_bdi
            )

        return {
            "codigo": codigo,
            "descricao": descricao,
            "unidade": unidade,
            "quantidade": quantidade,
            "custo_unit_direto": round(custo_direto_unit, 2),
            "custo_unit_com_bdi": round(custo_com_bdi, 2),
            "custo_direto_total": round(custo_direto_total, 2),
            "custo_total": round(custo_total, 2),
            "bdi_aplicado": self.bdi_config["percentual"],
            "regiao": self.regiao,
            "desonerado": self.desonerado,
            "detalhamento": detalhamento,
            "calculado_em": datetime.now().isoformat()
        }

    def _detalhar_composicao(self, composicao: Dict, quantidade: float,
                              custo_unit_bdi: float) -> Dict:
        """
        Detalha uma composição SINAPI em:
        - Material
        - Mão de obra (com encargos)
        - Equipamento
        - Serviço auxiliar
        """
        detalhamento = {
            "material": 0.0,
            "mao_obra": 0.0,
            "equipamento": 0.0,
            "servico_auxiliar": 0.0
        }

        # Distribuição típica baseada em composições SINAPI
        # (valores podem ser sobrescritos por composição real)
        distribuicao = composicao.get("distribuicao", {
            "material": 0.55,
            "mao_obra": 0.35,
            "equipamento": 0.05,
            "servico_auxiliar": 0.05
        })

        custo_unit_direto = custo_unit_bdi / (1 + self.bdi_config["coeficiente"])

        for categoria, percentual in distribuicao.items():
            valor_base = custo_unit_direto * percentual

            # Mão de obra recebe encargos sociais
            if categoria == "mao_obra":
                valor_com_encargos = self.aplicar_encargos(valor_base)
                detalhamento[categoria] = round(valor_com_encargos * quantidade, 2)
            else:
                detalhamento[categoria] = round(valor_base * quantidade, 2)

        detalhamento["total"] = round(sum(detalhamento.values()), 2)
        detalhamento["percentuais"] = distribuicao

        return detalhamento

    def gerar_orcamento(self, itens: List[Dict]) -> Dict:
        """
        Gera orçamento completo a partir de uma lista de itens calculados.

        Args:
            itens: Lista de dicionários retornados por calcular_item()

        Returns:
            Resumo orçamentário completo
        """
        subtotal_direto = sum(i["custo_direto_total"] for i in itens)
        subtotal_com_bdi = sum(i["custo_total"] for i in itens)

        # Agrupa por categoria (baseado em prefixo do código)
        categorias = self._agrupar_por_categoria(itens)

        return {
            "resumo": {
                "subtotal_custo_direto": round(subtotal_direto, 2),
                "bdi_total": round(subtotal_com_bdi - subtotal_direto, 2),
                "valor_total": round(subtotal_com_bdi, 2),
                "bdi_aplicado": self.bdi_config["percentual"],
                "regiao": self.regiao,
                "desonerado": self.desonerado,
                "quantidade_itens": len(itens),
                "gerado_em": datetime.now().isoformat()
            },
            "por_categoria": categorias,
            "itens": itens
        }

    def _agrupar_por_categoria(self, itens: List[Dict]) -> Dict:
        """Agrega valores por categoria de serviço."""
        CATEGORIAS = {
            "ESTRUTURA": ["92263", "92265", "92267", "96534"],
            "ALVENARIA": ["87498", "87500", "92697"],
            "REVESTIMENTOS": ["87644", "87645", "87651", "87652"],
            "PISOS": ["87634", "87636", "87637"],
            "PINTURA": ["88485", "88487", "88489"],
            "ELETRICA": ["93651", "93653", "93655", "93657", "93659"],
            "HIDRAULICA": ["89712", "89714", "89716", "89718", "89720"],
            "COBERTURA": ["94210", "94212", "94214"],
            "ESQUADRIAS": ["91367", "91369", "91371", "91373"],
        }

        agrupado = {cat: {"itens": 0, "valor": 0.0} for cat in CATEGORIAS}
        agrupado["OUTROS"] = {"itens": 0, "valor": 0.0}

        for item in itens:
            codigo = item["codigo"]
            encontrado = False

            for categoria, codigos in CATEGORIAS.items():
                if codigo in codigos:
                    agrupado[categoria]["itens"] += 1
                    agrupado[categoria]["valor"] += item["custo_total"]
                    encontrado = True
                    break

            if not encontrado:
                agrupado["OUTROS"]["itens"] += 1
                agrupado["OUTROS"]["valor"] += item["custo_total"]

        # Remove categorias vazias
        agrupado = {k: {**v, "valor": round(v["valor"], 2)}
                    for k, v in agrupado.items() if v["itens"] > 0}

        return agrupado

    def get_bdi_info(self) -> Dict:
        """Retorna informações completas sobre o BDI configurado."""
        return {
            "bdi": self.bdi_config,
            "encargos_sociais": self.ENCARGOS_SOCIAIS_PADRAO,
            "desonerado": self.desonerado,
            "regiao": self.regiao
        }