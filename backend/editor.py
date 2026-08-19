"""
TRAÇO - Editor de Análises e Orçamentos
Sistema de correção e edição manual pelo usuário para análises de plantas
e orçamentos gerados automaticamente.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from copy import deepcopy


class BudgetEditor:
    """
    Editor de orçamentos e análises.
    Permite ao usuário ajustar quantitativos, preços, adicionar/remover itens
    e sobrescrever resultados automáticos.
    """

    def __init__(self, project_dir: str):
        self.project_dir = Path(project_dir)
        self.analysis_dir = self.project_dir / "analysis"
        self.budget_dir = self.project_dir / "budget"
        self.edits_dir = self.project_dir / "edits"

        self.analysis_dir.mkdir(exist_ok=True)
        self.budget_dir.mkdir(exist_ok=True)
        self.edits_dir.mkdir(exist_ok=True)

    def load_analysis(self, filename: str) -> Optional[Dict]:
        """Carrega análise salva de uma planta."""
        stem = Path(filename).stem
        analysis_file = self.analysis_dir / f"{stem}_analysis.json"

        if not analysis_file.exists():
            return None

        with open(analysis_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def save_analysis(self, filename: str, analysis: Dict) -> str:
        """Salva análise modificada."""
        stem = Path(filename).stem
        analysis_file = self.analysis_dir / f"{stem}_analysis.json"

        with open(analysis_file, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, indent=2, ensure_ascii=False, default=str)

        return str(analysis_file)

    def load_budget(self, project_id: str) -> Optional[Dict]:
        """Carrega orçamento gerado do projeto."""
        budget_file = self.budget_dir / f"{project_id}_budget.json"

        if not budget_file.exists():
            return None

        with open(budget_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def save_budget(self, project_id: str, budget: Dict) -> str:
        """Salva orçamento modificado."""
        budget_file = self.budget_dir / f"{project_id}_budget.json"

        with open(budget_file, 'w', encoding='utf-8') as f:
            json.dump(budget, f, indent=2, ensure_ascii=False, default=str)

        return str(budget_file)

    def edit_element(self, filename: str, element_type: str,
                     element_id: int, updates: Dict) -> Dict:
        """
        Edita um elemento específico da análise (parede, porta, janela, ambiente).

        Args:
            filename: Nome do arquivo da planta
            element_type: 'walls', 'doors', 'windows', 'rooms'
            element_id: ID do elemento
            updates: Dicionário com campos a atualizar
                     Ex: {"length_m": 5.5, "thickness_m": 0.20}

        Returns:
            Análise atualizada
        """
        analysis = self.load_analysis(filename)
        if not analysis:
            return {"error": "Análise não encontrada"}

        elements = analysis.get("elements", {}).get(element_type, [])

        # Encontra o elemento pelo ID
        element = None
        for e in elements:
            if e.get("id") == element_id:
                element = e
                break

        if not element:
            return {"error": f"Elemento {element_type} #{element_id} não encontrado"}

        # Aplica atualizações
        element.update(updates)
        element["edited_at"] = datetime.now().isoformat()
        element["manual_edit"] = True

        # Recalcula resumo se necessário
        if element_type in ["walls", "rooms"]:
            self._recalculate_summary(analysis)

        # Salva
        self.save_analysis(filename, analysis)

        # Log da edição
        self._log_edit("element", {
            "filename": filename,
            "element_type": element_type,
            "element_id": element_id,
            "updates": updates
        })

        return {
            "status": "success",
            "message": f"Elemento {element_type} #{element_id} atualizado",
            "element": element
        }

    def edit_budget_item(self, project_id: str, item_index: int,
                         updates: Dict) -> Dict:
        """
        Edita um item específico do orçamento.

        Args:
            project_id: ID do projeto
            item_index: Índice do item na lista (0-based)
            updates: Dicionário com campos a atualizar
                     Ex: {"quantidade": 15.5, "custo_unit_direto": 45.00}

        Returns:
            Orçamento atualizado
        """
        budget = self.load_budget(project_id)
        if not budget:
            return {"error": "Orçamento não encontrado"}

        itens = budget.get("itens", [])

        if item_index < 0 or item_index >= len(itens):
            return {"error": f"Índice {item_index} fora dos limites (0-{len(itens)-1})"}

        item = itens[item_index]

        # Aplica atualizações
        item.update(updates)
        item["edited_at"] = datetime.now().isoformat()
        item["manual_edit"] = True

        # Recalcula totais se quantidade ou preço mudaram
        if "quantidade" in updates or "custo_unit_direto" in updates:
            quantidade = item["quantidade"]
            custo_unit = item.get("custo_unit_direto", 0)
            bdi_coef = self._extract_bdi_coef(budget)

            item["custo_direto_total"] = round(custo_unit * quantidade, 2)
            item["custo_unit_com_bdi"] = round(custo_unit * (1 + bdi_coef), 2)
            item["custo_total"] = round(item["custo_unit_com_bdi"] * quantidade, 2)

        # Recalcula resumo do orçamento
        self._recalculate_budget_summary(budget)

        # Salva
        self.save_budget(project_id, budget)

        # Log da edição
        self._log_edit("budget_item", {
            "project_id": project_id,
            "item_index": item_index,
            "item_codigo": item.get("codigo"),
            "updates": updates
        })

        return {
            "status": "success",
            "message": f"Item '{item.get('descricao', 'N/A')}' atualizado",
            "item": item
        }

    def add_budget_item(self, project_id: str, item: Dict) -> Dict:
        """
        Adiciona novo item ao orçamento.

        Args:
            project_id: ID do projeto
            item: Dicionário com dados do item:
                  {
                    "codigo": "87498",
                    "descricao": "ALVENARIA...",
                    "unidade": "M2",
                    "quantidade": 10.5,
                    "custo_unit_direto": 45.50
                  }

        Returns:
            Orçamento atualizado
        """
        budget = self.load_budget(project_id)
        if not budget:
            return {"error": "Orçamento não encontrado"}

        # Valida campos obrigatórios
        required = ["codigo", "descricao", "unidade", "quantidade", "custo_unit_direto"]
        for field in required:
            if field not in item:
                return {"error": f"Campo obrigatório ausente: {field}"}

        # Calcula totais
        bdi_coef = self._extract_bdi_coef(budget)
        item["custo_direto_total"] = round(item["custo_unit_direto"] * item["quantidade"], 2)
        item["custo_unit_com_bdi"] = round(item["custo_unit_direto"] * (1 + bdi_coef), 2)
        item["custo_total"] = round(item["custo_unit_com_bdi"] * item["quantidade"], 2)
        item["added_at"] = datetime.now().isoformat()
        item["manual_add"] = True

        # Adiciona à lista
        budget["itens"].append(item)

        # Recalcula resumo
        self._recalculate_budget_summary(budget)

        # Salva
        self.save_budget(project_id, budget)

        # Log
        self._log_edit("add_budget_item", {
            "project_id": project_id,
            "item_codigo": item["codigo"],
            "item_descricao": item["descricao"]
        })

        return {
            "status": "success",
            "message": f"Item '{item['descricao']}' adicionado",
            "item": item,
            "new_index": len(budget["itens"]) - 1
        }

    def remove_budget_item(self, project_id: str, item_index: int) -> Dict:
        """
        Remove item do orçamento.

        Args:
            project_id: ID do projeto
            item_index: Índice do item na lista (0-based)

        Returns:
            Orçamento atualizado
        """
        budget = self.load_budget(project_id)
        if not budget:
            return {"error": "Orçamento não encontrado"}

        itens = budget.get("itens", [])

        if item_index < 0 or item_index >= len(itens):
            return {"error": f"Índice {item_index} fora dos limites"}

        removed = itens.pop(item_index)

        # Recalcula resumo
        self._recalculate_budget_summary(budget)

        # Salva
        self.save_budget(project_id, budget)

        # Log
        self._log_edit("remove_budget_item", {
            "project_id": project_id,
            "item_index": item_index,
            "item_codigo": removed.get("codigo"),
            "item_descricao": removed.get("descricao")
        })

        return {
            "status": "success",
            "message": f"Item '{removed.get('descricao', 'N/A')}' removido",
            "removed_item": removed
        }

    def update_price(self, project_id: str, item_index: int,
                     new_price: float) -> Dict:
        """
        Atualiza preço unitário de um item.
        Convenience method para edit_budget_item.
        """
        return self.edit_budget_item(
            project_id,
            item_index,
            {"custo_unit_direto": new_price}
        )

    def update_quantity(self, project_id: str, item_index: int,
                        new_quantity: float) -> Dict:
        """
        Atualiza quantidade de um item.
        Convenience method para edit_budget_item.
        """
        return self.edit_budget_item(
            project_id,
            item_index,
            {"quantidade": new_quantity}
        )

    def apply_bulk_edits(self, project_id: str, edits: List[Dict]) -> Dict:
        """
        Aplica múltiplas edições de uma vez.

        Args:
            project_id: ID do projeto
            edits: Lista de edições, cada uma com:
                   {
                     "type": "edit_item" | "add_item" | "remove_item",
                     "item_index": int (para edit/remove),
                     "updates": dict (para edit),
                     "item": dict (para add)
                   }

        Returns:
            Resumo das edições aplicadas
        """
        results = []

        for edit in edits:
            edit_type = edit.get("type")

            if edit_type == "edit_item":
                result = self.edit_budget_item(
                    project_id,
                    edit["item_index"],
                    edit["updates"]
                )
                results.append(result)

            elif edit_type == "add_item":
                result = self.add_budget_item(project_id, edit["item"])
                results.append(result)

            elif edit_type == "remove_item":
                result = self.remove_budget_item(project_id, edit["item_index"])
                results.append(result)

            else:
                results.append({"error": f"Tipo de edição desconhecido: {edit_type}"})

        success_count = sum(1 for r in results if r.get("status") == "success")
        error_count = len(results) - success_count

        return {
            "status": "success" if error_count == 0 else "partial",
            "total_edits": len(edits),
            "successful": success_count,
            "failed": error_count,
            "results": results
        }

    def get_edit_history(self, project_id: str) -> List[Dict]:
        """Retorna histórico de edições do projeto."""
        history_file = self.edits_dir / f"{project_id}_history.json"

        if not history_file.exists():
            return []

        with open(history_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _recalculate_summary(self, analysis: Dict):
        """Recalcula resumo da análise após edições."""
        elements = analysis.get("elements", {})

        total_wall_length = sum(w.get("length_m", 0) for w in elements.get("walls", []))
        total_wall_area = sum(w.get("area_m2", 0) for w in elements.get("walls", []))
        total_room_area = sum(r.get("area_m2", 0) for r in elements.get("rooms", []))

        analysis["summary"] = {
            "total_walls": len(elements.get("walls", [])),
            "total_wall_length_m": round(total_wall_length, 2),
            "total_wall_area_m2": round(total_wall_area, 2),
            "total_doors": len(elements.get("doors", [])),
            "total_windows": len(elements.get("windows", [])),
            "total_rooms": len(elements.get("rooms", [])),
            "total_area_m2": round(total_room_area, 2),
            "recalculated_at": datetime.now().isoformat()
        }

    def _recalculate_budget_summary(self, budget: Dict):
        """Recalcula resumo do orçamento após edições."""
        itens = budget.get("itens", [])

        subtotal_direto = sum(i.get("custo_direto_total", 0) for i in itens)
        subtotal_com_bdi = sum(i.get("custo_total", 0) for i in itens)

        budget["resumo"]["subtotal_custo_direto"] = round(subtotal_direto, 2)
        budget["resumo"]["bdi_total"] = round(subtotal_com_bdi - subtotal_direto, 2)
        budget["resumo"]["valor_total"] = round(subtotal_com_bdi, 2)
        budget["resumo"]["quantidade_itens"] = len(itens)
        budget["resumo"]["atualizado_em"] = datetime.now().isoformat()

    def _extract_bdi_coef(self, budget: Dict) -> float:
        """Extrai coeficiente BDI do orçamento."""
        bdi_percent = budget.get("resumo", {}).get("bdi_aplicado", "0%")
        try:
            return float(bdi_percent.replace("%", "")) / 100
        except:
            return 0.0

    def _log_edit(self, edit_type: str, details: Dict):
        """Registra edição no histórico."""
        # Extrai project_id dos details
        project_id = details.get("project_id") or details.get("filename", "unknown")

        history_file = self.edits_dir / f"{project_id}_history.json"

        # Carrega histórico existente
        history = []
        if history_file.exists():
            with open(history_file, 'r', encoding='utf-8') as f:
                history = json.load(f)

        # Adiciona nova entrada
        history.append({
            "type": edit_type,
            "timestamp": datetime.now().isoformat(),
            "details": details
        })

        # Salva
        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False, default=str)