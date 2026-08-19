"""
TRAÇO - Sistema de Orçamento Inteligente de Obras
Backend principal com FastAPI
"""

import os
import shutil
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

from processors import process_file, save_processing_result
from vision import PlantAnalyzer
from sinapi import CompositionMapper
from editor import BudgetEditor

# Configuração
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

PROJECTS_DIR = BASE_DIR / "projects"
PROJECTS_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {
    "pdf": [".pdf"],
    "dwg": [".dwg", ".dxf"],
    "image": [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"]
}

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

app = FastAPI(
    title="TRAÇO API",
    description="API para upload e processamento de plantas arquitetônicas",
    version="0.2.0"
)

# CORS para o frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir arquivos estáticos (uploads e thumbnails)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: str
    status: str
    files: list


class FileUpload(BaseModel):
    filename: str
    original_name: str
    file_type: str
    size: int
    uploaded_at: str
    project_id: str


def get_file_type(filename: str) -> str:
    """Determina o tipo do arquivo baseado na extensão"""
    ext = Path(filename).suffix.lower()

    for file_type, extensions in ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            return file_type

    raise HTTPException(status_code=400, detail=f"Tipo de arquivo não suportado: {ext}")


def validate_file(file: UploadFile):
    """Valida o arquivo antes do upload"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome do arquivo inválido")

    # Verifica extensão
    try:
        get_file_type(file.filename)
    except HTTPException:
        raise

    # Verifica tamanho (leitura parcial)
    file.file.seek(0, 2)  # Vai para o final
    size = file.file.tell()
    file.file.seek(0)  # Volta para o início

    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Arquivo muito grande. Máximo: {MAX_FILE_SIZE // (1024*1024)}MB"
        )


@app.get("/")
async def root():
    return {
        "message": "TRAÇO API - Sistema de Orçamento Inteligente",
        "version": "0.2.0",
        "endpoints": {
            "projects": "/api/projects",
            "upload": "/api/upload/{project_id}",
            "project_files": "/api/projects/{project_id}/files",
            "file_metadata": "/api/projects/{project_id}/files/{filename}/metadata",
            "file_thumbnail": "/api/projects/{project_id}/files/{filename}/thumbnail",
            "health": "/health"
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/api/projects")
async def create_project(name: str, description: Optional[str] = None):
    """Cria um novo projeto"""
    project_id = str(uuid.uuid4())[:8]
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(exist_ok=True)

    project_data = {
        "id": project_id,
        "name": name,
        "description": description or "",
        "created_at": datetime.now().isoformat(),
        "status": "created",
        "files": []
    }

    # Salva metadados do projeto
    with open(project_dir / "project.json", "w", encoding="utf-8") as f:
        json.dump(project_data, f, indent=2, ensure_ascii=False)

    return project_data


@app.get("/api/projects")
async def list_projects():
    """Lista todos os projetos"""
    projects = []
    for project_dir in PROJECTS_DIR.iterdir():
        if project_dir.is_dir():
            project_file = project_dir / "project.json"
            if project_file.exists():
                with open(project_file, "r", encoding="utf-8") as f:
                    projects.append(json.load(f))

    return sorted(projects, key=lambda x: x["created_at"], reverse=True)


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Retorna detalhes de um projeto específico"""
    project_file = PROJECTS_DIR / project_id / "project.json"
    if not project_file.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    with open(project_file, "r", encoding="utf-8") as f:
        return json.load(f)


@app.post("/api/upload/{project_id}")
async def upload_file(project_id: str, file: UploadFile = File(...)):
    """
    Faz upload de um arquivo para um projeto específico.
    Suporta: PDF, DWG, DXF, e imagens (JPG, PNG, etc.)
    Processa automaticamente o arquivo após o upload para extrair metadados.
    """
    # Verifica se o projeto existe
    project_file = PROJECTS_DIR / project_id / "project.json"
    if not project_file.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    # Valida o arquivo
    validate_file(file)

    # Cria diretório de uploads do projeto
    project_upload_dir = UPLOAD_DIR / project_id
    project_upload_dir.mkdir(exist_ok=True)

    # Gera nome único
    file_ext = Path(file.filename).suffix.lower()
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = project_upload_dir / unique_filename

    # Salva o arquivo
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Obtém informações do arquivo
    file_size = file_path.stat().st_size
    file_type = get_file_type(file.filename)

    # Cria registro do arquivo
    file_record = {
        "filename": unique_filename,
        "original_name": file.filename,
        "file_type": file_type,
        "size": file_size,
        "uploaded_at": datetime.now().isoformat(),
        "project_id": project_id,
        "path": str(file_path),
        "url": f"/uploads/{project_id}/{unique_filename}",
        "processing_status": "pending"
    }

    # Processa o arquivo automaticamente (extrai metadados, gera thumbnail, etc.)
    try:
        project_dir = PROJECTS_DIR / project_id
        processing_result = process_file(str(file_path), str(project_dir))

        # Salva resultado do processamento
        metadata_path = save_processing_result(str(project_dir), unique_filename, processing_result)

        file_record["processing_status"] = "completed" if not processing_result.get("error") else "error"
        file_record["metadata_file"] = metadata_path

        # Adiciona thumbnail URL se disponível
        if processing_result.get("thumbnail"):
            file_record["thumbnail_url"] = f"/api/projects/{project_id}/files/{unique_filename}/thumbnail"

    except Exception as e:
        file_record["processing_status"] = "error"
        file_record["processing_error"] = str(e)

    # Atualiza metadados do projeto
    with open(project_file, "r", encoding="utf-8") as f:
        project_data = json.load(f)

    project_data["files"].append(file_record)
    project_data["status"] = "files_uploaded"
    project_data["updated_at"] = datetime.now().isoformat()

    with open(project_file, "w", encoding="utf-8") as f:
        json.dump(project_data, f, indent=2, ensure_ascii=False)

    return {
        "message": "Arquivo enviado e processado com sucesso",
        "file": file_record
    }


@app.delete("/api/projects/{project_id}/files/{filename}")
async def delete_file(project_id: str, filename: str):
    """Remove um arquivo do projeto"""
    project_file = PROJECTS_DIR / project_id / "project.json"
    if not project_file.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    with open(project_file, "r", encoding="utf-8") as f:
        project_data = json.load(f)

    # Localiza o arquivo na lista
    file_record = None
    for f in project_data["files"]:
        if f["filename"] == filename:
            file_record = f
            break

    if not file_record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    # Remove da lista
    project_data["files"] = [
        f for f in project_data["files"]
        if f["filename"] != filename
    ]

    # Remove o arquivo físico
    file_path = UPLOAD_DIR / project_id / filename
    if file_path.exists():
        file_path.unlink()

    # Remove metadados processados
    project_dir = PROJECTS_DIR / project_id
    processing_dir = project_dir / "processing"
    if processing_dir.exists():
        stem = Path(filename).stem
        for meta_file in processing_dir.glob(f"{stem}*"):
            meta_file.unlink()

    # Remove thumbnail
    thumbs_dir = project_dir / "thumbnails"
    if thumbs_dir.exists():
        for thumb in thumbs_dir.glob(f"{stem}*"):
            thumb.unlink()

    # Atualiza projeto
    project_data["updated_at"] = datetime.now().isoformat()
    with open(project_file, "w", encoding="utf-8") as f:
        json.dump(project_data, f, indent=2, ensure_ascii=False)

    return {"message": "Arquivo removido com sucesso"}


@app.get("/api/projects/{project_id}/files")
async def list_project_files(project_id: str):
    """Lista todos os arquivos de um projeto"""
    project_file = PROJECTS_DIR / project_id / "project.json"
    if not project_file.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    with open(project_file, "r", encoding="utf-8") as f:
        project_data = json.load(f)

    return project_data["files"]


@app.get("/api/projects/{project_id}/files/{filename}/metadata")
async def get_file_metadata(project_id: str, filename: str):
    """
    Retorna os metadados extraídos automaticamente de um arquivo.
    Inclui dimensões, DPI, número de páginas, layers (DXF), etc.
    """
    project_file = PROJECTS_DIR / project_id / "project.json"
    if not project_file.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    # Verifica se o arquivo pertence ao projeto
    with open(project_file, "r", encoding="utf-8") as f:
        project_data = json.load(f)

    file_record = None
    for f in project_data["files"]:
        if f["filename"] == filename:
            file_record = f
            break

    if not file_record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no projeto")

    # Lê metadados processados
    project_dir = PROJECTS_DIR / project_id
    processing_dir = project_dir / "processing"
    stem = Path(filename).stem
    meta_file = processing_dir / f"{stem}_processed.json"

    if not meta_file.exists():
        return {
            "status": "not_processed",
            "message": "Metadados ainda não disponíveis. O arquivo pode estar em processamento."
        }

    with open(meta_file, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/projects/{project_id}/files/{filename}/thumbnail")
async def get_file_thumbnail(project_id: str, filename: str):
    """
    Retorna o thumbnail gerado automaticamente para imagens e PDFs.
    """
    project_file = PROJECTS_DIR / project_id / "project.json"
    if not project_file.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    # Verifica se o arquivo pertence ao projeto
    with open(project_file, "r", encoding="utf-8") as f:
        project_data = json.load(f)

    file_record = None
    for f in project_data["files"]:
        if f["filename"] == filename:
            file_record = f
            break

    if not file_record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no projeto")

    # Localiza thumbnail
    project_dir = PROJECTS_DIR / project_id
    thumbs_dir = project_dir / "thumbnails"
    stem = Path(filename).stem

    # Procura por qualquer thumbnail correspondente
    thumb_candidates = list(thumbs_dir.glob(f"{stem}*")) if thumbs_dir.exists() else []

    if not thumb_candidates:
        raise HTTPException(status_code=404, detail="Thumbnail não disponível para este arquivo")

    return FileResponse(
        thumb_candidates[0],
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"}
    )


@app.post("/api/projects/{project_id}/reprocess/{filename}")
async def reprocess_file(project_id: str, filename: str):
    """
    Reprocessa um arquivo para extrair metadados novamente.
    Útil quando o processamento falhou ou quando atualizações nos
    algoritmos de extração ficam disponíveis.
    """
    project_file = PROJECTS_DIR / project_id / "project.json"
    if not project_file.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    with open(project_file, "r", encoding="utf-8") as f:
        project_data = json.load(f)

    # Localiza o arquivo
    file_record = None
    for f in project_data["files"]:
        if f["filename"] == filename:
            file_record = f
            break

    if not file_record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    # Verifica se o arquivo físico ainda existe
    file_path = UPLOAD_DIR / project_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo físico não encontrado")

    # Reprocessa
    try:
        project_dir = PROJECTS_DIR / project_id
        processing_result = process_file(str(file_path), str(project_dir))
        metadata_path = save_processing_result(str(project_dir), filename, processing_result)

        # Atualiza registro
        file_record["processing_status"] = "completed" if not processing_result.get("error") else "error"
        file_record["metadata_file"] = metadata_path
        file_record["reprocessed_at"] = datetime.now().isoformat()

        if processing_result.get("thumbnail"):
            file_record["thumbnail_url"] = f"/api/projects/{project_id}/files/{filename}/thumbnail"

        # Salva projeto
        with open(project_file, "w", encoding="utf-8") as f:
            json.dump(project_data, f, indent=2, ensure_ascii=False)

        return {
            "message": "Arquivo reprocessado com sucesso",
            "result": processing_result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao reprocessar: {str(e)}")


@app.post("/api/projects/{project_id}/analyze/{filename}")
async def analyze_plant(project_id: str, filename: str, regiao: str = "SP"):
    """
    Executa análise completa de visão computacional em uma planta.
    Detecta paredes, portas, janelas e ambientes com estimativa de dimensões reais.
    """
    project_file = PROJECTS_DIR / project_id / "project.json"
    if not project_file.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    with open(project_file, "r", encoding="utf-8") as f:
        project_data = json.load(f)

    # Localiza o arquivo
    file_record = None
    for f in project_data["files"]:
        if f["filename"] == filename:
            file_record = f
            break

    if not file_record:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    # Verifica se é uma imagem (análise só funciona em imagens)
    if file_record["file_type"] != "image":
        raise HTTPException(
            status_code=400,
            detail="Análise de visão computacional disponível apenas para imagens (JPG, PNG, etc.)"
        )

    # Caminho do arquivo
    file_path = UPLOAD_DIR / project_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo físico não encontrado")

    # Executa análise
    try:
        project_dir = PROJECTS_DIR / project_id
        analyzer = PlantAnalyzer()
        analysis_result = analyzer.analyze(str(file_path), str(project_dir))

        # Atualiza projeto
        project_data["status"] = "analyzed"
        project_data["updated_at"] = datetime.now().isoformat()

        with open(project_file, "w", encoding="utf-8") as f:
            json.dump(project_data, f, indent=2, ensure_ascii=False)

        return {
            "message": "Análise concluída com sucesso",
            "analysis": analysis_result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na análise: {str(e)}")


@app.post("/api/projects/{project_id}/budget")
async def generate_budget(
    project_id: str,
    filename: str,
    regiao: str = "SP",
    desonerado: bool = False,
    overrides: Optional[dict] = None
):
    """
    Gera orçamento completo baseado na análise da planta e dados SINAPI.

    Args:
        filename: Nome do arquivo da planta analisada
        regiao: Código da região (SP, RJ, MG, etc.)
        desonerado: Se True, aplica encargos com desoneração
        overrides: Dicionário para sobrescrever padrões:
                   {"floor_type": "porcelanato", "door_type": "porta_pesada"}
    """
    project_file = PROJECTS_DIR / project_id / "project.json"
    if not project_file.exists():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    # Carrega análise da planta
    project_dir = PROJECTS_DIR / project_id
    stem = Path(filename).stem
    analysis_file = project_dir / "analysis" / f"{stem}_analysis.json"

    if not analysis_file.exists():
        raise HTTPException(
            status_code=400,
            detail="Análise não encontrada. Execute primeiro /api/projects/{project_id}/analyze/{filename}"
        )

    with open(analysis_file, "r", encoding="utf-8") as f:
        analysis_result = json.load(f)

    # Gera orçamento
    try:
        mapper = CompositionMapper(regiao=regiao, desonerado=desonerado)
        budget = mapper.generate_budget(analysis_result, overrides)

        # Salva orçamento
        budget_dir = project_dir / "budget"
        budget_dir.mkdir(exist_ok=True)
        budget_file = budget_dir / f"{project_id}_budget.json"

        with open(budget_file, "w", encoding="utf-8") as f:
            json.dump(budget, f, indent=2, ensure_ascii=False, default=str)

        # Atualiza projeto
        with open(project_file, "r", encoding="utf-8") as f:
            project_data = json.load(f)

        project_data["status"] = "budget_generated"
        project_data["budget_file"] = str(budget_file)
        project_data["updated_at"] = datetime.now().isoformat()

        with open(project_file, "w", encoding="utf-8") as f:
            json.dump(project_data, f, indent=2, ensure_ascii=False)

        return {
            "message": "Orçamento gerado com sucesso",
            "budget": budget
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar orçamento: {str(e)}")


@app.get("/api/projects/{project_id}/analysis/{filename}")
async def get_analysis(project_id: str, filename: str):
    """Retorna a análise de visão computacional existente para um arquivo."""
    project_dir = PROJECTS_DIR / project_id
    stem = Path(filename).stem
    analysis_file = project_dir / "analysis" / f"{stem}_analysis.json"

    if not analysis_file.exists():
        raise HTTPException(status_code=404, detail="Análise não encontrada para este arquivo")

    with open(analysis_file, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/projects/{project_id}/budget")
async def get_budget(project_id: str):
    """Retorna o orçamento gerado para um projeto."""
    project_dir = PROJECTS_DIR / project_id
    budget_file = project_dir / "budget" / f"{project_id}_budget.json"

    if not budget_file.exists():
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")

    with open(budget_file, "r", encoding="utf-8") as f:
        return json.load(f)


@app.put("/api/projects/{project_id}/budget/edit/{item_index}")
async def edit_budget_item(project_id: str, item_index: int, updates: dict):
    """
    Edita um item específico do orçamento.

    Args:
        item_index: Índice do item na lista (0-based)
        updates: Dicionário com campos a atualizar
                 Ex: {"quantidade": 15.5, "custo_unit_direto": 45.00}
    """
    project_dir = PROJECTS_DIR / project_id
    editor = BudgetEditor(str(project_dir))

    result = editor.edit_budget_item(project_id, item_index, updates)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@app.post("/api/projects/{project_id}/budget/add")
async def add_budget_item(project_id: str, item: dict):
    """
    Adiciona novo item ao orçamento.

    Args:
        item: Dicionário com dados do item:
              {
                "codigo": "87498",
                "descricao": "ALVENARIA...",
                "unidade": "M2",
                "quantidade": 10.5,
                "custo_unit_direto": 45.50
              }
    """
    project_dir = PROJECTS_DIR / project_id
    editor = BudgetEditor(str(project_dir))

    result = editor.add_budget_item(project_id, item)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@app.delete("/api/projects/{project_id}/budget/remove/{item_index}")
async def remove_budget_item(project_id: str, item_index: int):
    """Remove item do orçamento."""
    project_dir = PROJECTS_DIR / project_id
    editor = BudgetEditor(str(project_dir))

    result = editor.remove_budget_item(project_id, item_index)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@app.get("/api/projects/{project_id}/edits/history")
async def get_edit_history(project_id: str):
    """Retorna histórico de edições do orçamento."""
    project_dir = PROJECTS_DIR / project_id
    editor = BudgetEditor(str(project_dir))

    return {
        "project_id": project_id,
        "history": editor.get_edit_history(project_id)
    }


@app.get("/api/sinapi/services")
async def list_sinapi_services(search: Optional[str] = None):
    """
    Lista serviços SINAPI disponíveis.
    Opcionalmente filtra por termo de busca.
    """
    from sinapi import SinapiImporter

    importer = SinapiImporter()

    if search:
        services = importer.search_services(search)
    else:
        catalog = importer.load_default_catalog()
        services = catalog["services"]

    return {
        "count": len(services),
        "services": services
    }


@app.get("/api/sinapi/service/{codigo}")
async def get_sinapi_service(codigo: str, regiao: str = "SP"):
    """Retorna informações de um serviço SINAPI específico."""
    from sinapi import SinapiImporter

    importer = SinapiImporter()
    info = importer.get_service_info(codigo)

    if not info:
        raise HTTPException(status_code=404, detail=f"Serviço {codigo} não encontrado")

    price = importer.get_price(codigo, regiao)

    return {
        "codigo": codigo,
        **info,
        "preco_unitario": price,
        "regiao": regiao
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)