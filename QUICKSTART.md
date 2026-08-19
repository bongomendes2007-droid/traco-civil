# TRAÇO — Guia Rápido de Desenvolvimento

## Status Atual (Agosto 2026)

### ✅ Concluído — Passo 1: Core Product

| Módulo | Arquivo | Status |
|--------|---------|--------|
| Upload de Plantas | `backend/main.py` | ✅ PDF, DWG, DXF, Imagens |
| Processamento de Arquivos | `backend/processors.py` | ✅ Metadados + Thumbnails |
| Visão Computacional | `backend/vision/detector.py` | ✅ Paredes, Portas, Janelas, Ambientes |
| Análise de Plantas | `backend/vision/analyzer.py` | ✅ Escala + Relatório |
| Integração SINAPI | `backend/sinapi/importer.py` | ✅ Catálogo + Preços Estimados |
| Motor de Precificação | `backend/sinapi/pricing.py` | ✅ BDI + Encargos Sociais |
| Mapeador de Composições | `backend/sinapi/compositions.py` | ✅ Elemento → Serviço SINAPI |
| Editor Manual | `backend/editor.py` | ✅ Editar/Adicionar/Remover Itens |
| Frontend Upload | `frontend/index.html` | ✅ Drag-drop + Projetos |
| Visualizador + Orçamento | `frontend/viewer.html` | ✅ Análise + Budget + Edição |
| API REST Completa | `backend/main.py` | ✅ 15+ endpoints |

---

## Como Executar

### 1. Backend

```powershell
cd traco\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Acesse: http://localhost:8000/docs (Swagger UI)

### 2. Frontend

```powershell
cd traco\frontend
python -m http.server 3000
```

Acesse: http://localhost:3000

---

## Fluxo Completo

```
1. Criar Projeto     → POST /api/projects
2. Upload Planta     → POST /api/upload/{id}
3. Analisar com IA   → POST /api/projects/{id}/analyze/{file}
4. Gerar Orçamento   → POST /api/projects/{id}/budget
5. Editar Itens      → PUT /api/projects/{id}/budget/edit/{idx}
6. Exportar          → GET /api/projects/{id}/budget
```

---

## Próximos Passos (Roadmap)

### Passo 2: Refinamento da IA
- [ ] Treinar modelo com plantas reais brasileiras
- [ ] Melhorar detecção de escala (referência por cota textual)
- [ ] Reconhecimento de ambientes por nome (cozinha, banheiro, etc.)
- [ ] Suporte a PDF vetorial (extração de linhas sem rasterização)

### Passo 3: Base SINAPI Real
- [ ] Importador automático de XLSX mensais da CAIXA
- [ ] Atualização mensal automática via script
- [ ] Cache regional por estado
- [ ] Histórico de preços para projeção

### Passo 4: Exportação e Relatórios
- [ ] Exportar orçamento em PDF formatado
- [ ] Exportar planilha XLSX compatível com TCU
- [ ] Relatório fotográfico com anotações na planta
- [ ] Curva ABC de insumos

### Passo 5: Colaboração
- [ ] Multi-usuário por projeto
- [ ] Comentários e marcações na planta
- [ ] Versionamento de orçamentos
- [ ] Dashboard comparativo entre versões

---

## Estrutura de Dados

### Projeto
```
projects/{id}/
├── project.json          # Metadados do projeto
├── analysis/             # Resultados de análise IA
│   └── {file}_analysis.json
├── budget/               # Orçamentos gerados
│   └── {id}_budget.json
├── edits/                # Histórico de edições
│   └── {id}_history.json
├── processing/           # Metadados extraídos
│   └── {file}_processed.json
└── thumbnails/           # Previews gerados
    └── {file}_thumb.jpg
```

### Orçamento (JSON)
```json
{
  "resumo": {
    "valor_total": 125000.00,
    "bdi_aplicado": "18.52%",
    "regiao": "SP"
  },
  "itens": [
    {
      "codigo": "87498",
      "descricao": "ALVENARIA DE BLOCOS CERÂMICOS",
      "quantidade": 120.5,
      "unidade": "M2",
      "custo_total": 5482.75
    }
  ]
}
```

---

## Referências Técnicas

- **SINAPI Metodologias**: `E:\Donwloads\Livro_SINAPI_Metodologias_Conceitos.pdf`
- **SINAPI Cálculos**: `E:\Donwloads\Livro_SINAPI_Calculos_Parametros.pdf`
- **Guia IA Orçamento**: `E:\Donwloads\GUIA_COMPLETO_IA_ORCAMENTO_OBRAS.pdf`
- **Biblioteca V2**: `E:\Donwloads\Biblioteca_IA_Orcamento_Obras_V2\`

---

**TRAÇO** — Precisão no traço, confiança no orçamento.