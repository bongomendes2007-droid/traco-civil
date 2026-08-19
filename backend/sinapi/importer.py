"""
TRAÇO - Importador de Dados SINAPI
Importa e estrutura dados dos relatórios mensais do SINAPI (XLSX/CSV)
para uso no sistema de orçamentação.

Fontes:
- Relatórios Mensais SINAPI (CAIXA)
- Cadernos Técnicos de Composições
- Fichas de Especificação Técnica de Insumos
"""

import json
import csv
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime


class SinapiImporter:
    """
    Importador de bases de dados SINAPI.
    Converte relatórios XLSX/CSV em estruturas JSON otimizadas para consulta.
    """

    # Códigos de serviço comuns em edificações residenciais (SINAPI)
    SERVICE_CATALOG = {
        # Alvenaria
        "87498": {"descricao": "ALVENARIA DE BLOCOS CERÂMICOS FUROS VERTICAIS", "unidade": "M2"},
        "87500": {"descricao": "ALVENARIA DE BLOCOS CERÂMICOS 9x19x39cm", "unidade": "M2"},
        "92697": {"descricao": "ALVENARIA EM TIJOLO CERÂMICO MACIÇO", "unidade": "M2"},

        # Revestimentos
        "87644": {"descricao": "REBOCO ARGAMASSA TRACO 1:6 INTERNO", "unidade": "M2"},
        "87645": {"descricao": "REBOCO ARGAMASSA TRACO 1:6 EXTERNO", "unidade": "M2"},
        "87651": {"descricao": "EMBOÇO ARGAMASSA TRACO 1:6 INTERNO", "unidade": "M2"},
        "87652": {"descricao": "EMBOÇO ARGAMASSA TRACO 1:6 EXTERNO", "unidade": "M2"},

        # Pisos
        "87634": {"descricao": "CONTRAPISO ARGAMASSA TRACO 1:4 ESPESSURA 3CM", "unidade": "M2"},
        "87636": {"descricao": "PISO CERÂMICO ESMALTADO PEI-4 35x35cm", "unidade": "M2"},
        "87637": {"descricao": "PISO PORCELANATO POLIDO 60x60cm", "unidade": "M2"},

        # Pintura
        "88485": {"descricao": "PINTURA LÁTEX ACRÍLICA DUAS DEMÃOS", "unidade": "M2"},
        "88487": {"descricao": "PINTURA ESMALTE SINTÉTICO BRILHANTE", "unidade": "M2"},
        "88489": {"descricao": "MASSA CORRIDA PVA UMA DEMÃO", "unidade": "M2"},

        # Instalações Elétricas
        "93651": {"descricao": "CABO ELÉTRICO FLEXÍVEL 2,5MM2", "unidade": "M"},
        "93653": {"descricao": "CABO ELÉTRICO FLEXÍVEL 4,0MM2", "unidade": "M"},
        "93655": {"descricao": "ELETRODUTO PVC RÍGIDO ROSCÁVEL 20mm", "unidade": "M"},
        "93657": {"descricao": "TOMADA SIMPLES 2P+T 10A", "unidade": "UN"},
        "93659": {"descricao": "INTERRUPTOR SIMPLES 1 SEÇÃO", "unidade": "UN"},

        # Instalações Hidráulicas
        "89712": {"descricao": "TUBO PVC SOLDÁVEL MARROM 25mm", "unidade": "M"},
        "89714": {"descricao": "TUBO PVC SOLDÁVEL MARROM 32mm", "unidade": "M"},
        "89716": {"descricao": "TORNEIRA METÁLICA CROMADA LAVATÓRIO", "unidade": "UN"},
        "89718": {"descricao": "VASO SANITÁRIO COM CAIXA ACOPLADA", "unidade": "UN"},
        "89720": {"descricao": "PIA COZINHA INOX 120x50cm", "unidade": "UN"},

        # Estrutura
        "92263": {"descricao": "CONCRETO ARMADO FCK=25MPA PILAR", "unidade": "M3"},
        "92265": {"descricao": "CONCRETO ARMADO FCK=25MPA VIGA", "unidade": "M3"},
        "92267": {"descricao": "CONCRETO ARMADO FCK=25MPA LAJE", "unidade": "M3"},
        "96534": {"descricao": "FORMA MADEIRA COMPENSADA RESINADA", "unidade": "M2"},

        # Cobertura
        "94210": {"descricao": "TELHA CERÂMICA TIPO ROMANA", "unidade": "M2"},
        "94212": {"descricao": "TELHA CONCRETO TIPO PORTUGUESA", "unidade": "M2"},
        "94214": {"descricao": "IMPERMEABILIZAÇÃO MANTA ASFÁLTICA 4mm", "unidade": "M2"},

        # Esquadrias
        "91367": {"descricao": "PORTA MADEIRA LEVE 80x210cm", "unidade": "UN"},
        "91369": {"descricao": "PORTA MADEIRA PESADA 80x210cm", "unidade": "UN"},
        "91371": {"descricao": "JANELA ALUMÍNIO CORRER 2 FOLHAS 120x120cm", "unidade": "UN"},
        "91373": {"descricao": "JANELA ALUMÍNIO CORRER 2 FOLHAS 150x120cm", "unidade": "UN"},
    }

    def __init__(self, data_dir: Optional[str] = None):
        """
        Args:
            data_dir: Diretório contendo arquivos SINAPI (XLSX/CSV).
                     Se None, usa diretório padrão 'data/sinapi'.
        """
        if data_dir:
            self.data_dir = Path(data_dir)
        else:
            self.data_dir = Path(__file__).parent.parent / "data" / "sinapi"

        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.prices_cache: Dict[str, Dict] = {}
        self.compositions_cache: Dict[str, Dict] = {}

    def get_service_info(self, codigo: str) -> Optional[Dict]:
        """Retorna informações básicas de um serviço pelo código SINAPI."""
        return self.SERVICE_CATALOG.get(codigo)

    def search_services(self, termo: str) -> List[Dict]:
        """Busca serviços por termo na descrição."""
        termo_lower = termo.lower()
        results = []
        for codigo, info in self.SERVICE_CATALOG.items():
            if termo_lower in info["descricao"].lower():
                results.append({
                    "codigo": codigo,
                    **info
                })
        return results

    def import_prices_from_csv(self, csv_path: str, regiao: str, mes_ano: str) -> Dict:
        """
        Importa preços unitários de arquivo CSV exportado do SINAPI.

        Formato esperado do CSV:
        CODIGO;DESCRICAO;UNIDADE;PRECO_UNITARIO;ENCARGOS_SOCIAIS

        Args:
            csv_path: Caminho para o arquivo CSV
            regiao: Código da região (ex: 'SP', 'RJ', 'MG')
            mes_ano: Período de referência (ex: '2024-01')

        Returns:
            Dicionário com estatísticas da importação
        """
        imported_count = 0
        error_count = 0
        prices = {}

        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f, delimiter=';')

                for row in reader:
                    try:
                        codigo = row.get('CODIGO', '').strip()
                        descricao = row.get('DESCRICAO', '').strip()
                        unidade = row.get('UNIDADE', '').strip()
                        preco_str = row.get('PRECO_UNITARIO', '0').replace(',', '.')
                        preco = float(preco_str)

                        if codigo and preco > 0:
                            key = f"{regiao}_{mes_ano}_{codigo}"
                            prices[key] = {
                                "codigo": codigo,
                                "descricao": descricao,
                                "unidade": unidade,
                                "preco_unitario": preco,
                                "regiao": regiao,
                                "mes_ano": mes_ano,
                                "imported_at": datetime.now().isoformat()
                            }
                            imported_count += 1
                    except (ValueError, KeyError) as e:
                        error_count += 1
                        continue

            # Salva em cache local
            output_file = self.data_dir / f"prices_{regiao}_{mes_ano}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(prices, f, indent=2, ensure_ascii=False)

            # Atualiza cache em memória
            self.prices_cache.update(prices)

            return {
                "status": "success",
                "imported": imported_count,
                "errors": error_count,
                "output_file": str(output_file),
                "regiao": regiao,
                "mes_ano": mes_ano
            }

        except FileNotFoundError:
            return {"status": "error", "message": f"Arquivo não encontrado: {csv_path}"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_price(self, codigo: str, regiao: str = "SP", mes_ano: str = "2024-01") -> Optional[float]:
        """
        Retorna preço unitário de um serviço.

        Busca primeiro no cache, depois em arquivos JSON salvos.
        Se não encontrar, retorna None (preço deve ser informado manualmente).
        """
        key = f"{regiao}_{mes_ano}_{codigo}"

        # Cache em memória
        if key in self.prices_cache:
            return self.prices_cache[key]["preco_unitario"]

        # Tenta carregar de arquivo
        file_path = self.data_dir / f"prices_{regiao}_{mes_ano}.json"
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if key in data:
                    self.prices_cache[key] = data[key]
                    return data[key]["preco_unitario"]

        return None

    def load_default_catalog(self) -> Dict:
        """
        Carrega catálogo padrão de serviços para edificações residenciais.
        Útil quando não há dados SINAPI importados ainda.
        """
        catalog = []
        for codigo, info in self.SERVICE_CATALOG.items():
            catalog.append({
                "codigo": codigo,
                "descricao": info["descricao"],
                "unidade": info["unidade"],
                "preco_estimado": self._get_estimated_price(codigo),
                "fonte": "catalogo_padrao"
            })
        return {"services": catalog, "count": len(catalog)}

    def _get_estimated_price(self, codigo: str) -> float:
        """
        Retorna preço estimado para serviços do catálogo padrão.
        Valores aproximados baseados em média nacional (referência 2024).
        DEVEM ser substituídos por dados SINAPI reais quando disponíveis.
        """
        estimated_prices = {
            "87498": 45.50,   # Alvenaria bloco cerâmico m²
            "87500": 48.00,   # Alvenaria bloco 9x19x39 m²
            "92697": 65.00,   # Alvenaria tijolo maciço m²
            "87644": 22.00,   # Reboco interno m²
            "87645": 25.00,   # Reboco externo m²
            "87651": 18.00,   # Emboço interno m²
            "87652": 20.00,   # Emboço externo m²
            "87634": 28.00,   # Contrapiso m²
            "87636": 55.00,   # Piso cerâmico m²
            "87637": 95.00,   # Porcelanato m²
            "88485": 12.00,   # Pintura látex m²
            "88487": 18.00,   # Esmalte sintético m²
            "88489": 8.00,    # Massa corrida m²
            "93651": 3.50,    # Cabo 2,5mm m
            "93653": 5.00,    # Cabo 4,0mm m
            "93655": 8.00,    # Eletroduto 20mm m
            "93657": 15.00,   # Tomada un
            "93659": 12.00,   # Interruptor un
            "89712": 6.00,    # Tubo PVC 25mm m
            "89714": 8.50,    # Tubo PVC 32mm m
            "89716": 85.00,   # Torneira lavatório un
            "89718": 450.00,  # Vaso sanitário un
            "89720": 380.00,  # Pia cozinha un
            "92263": 550.00,  # Concreto pilar m³
            "92265": 580.00,  # Concreto viga m³
            "92267": 520.00,  # Concreto laje m³
            "96534": 65.00,   # Forma compensada m²
            "94210": 45.00,   # Telha cerâmica m²
            "94212": 55.00,   # Telha concreto m²
            "94214": 85.00,   # Manta asfáltica m²
            "91367": 280.00,  # Porta leve un
            "91369": 450.00,  # Porta pesada un
            "91371": 650.00,  # Janela alum 120x120 un
            "91373": 780.00,  # Janela alum 150x120 un
        }
        return estimated_prices.get(codigo, 0.0)

    def list_available_data(self) -> Dict:
        """Lista todos os arquivos de dados SINAPI disponíveis."""
        files = []
        for f in self.data_dir.glob("*.json"):
            files.append({
                "filename": f.name,
                "size_bytes": f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat()
            })
        return {
            "data_directory": str(self.data_dir),
            "files": files,
            "cache_entries": len(self.prices_cache)
        }