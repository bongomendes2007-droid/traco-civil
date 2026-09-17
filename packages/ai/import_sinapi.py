"""
TRAÇO CIVIL — Script de Importação SINAPI (CAIXA)
===================================================
Lê a planilha oficial SINAPI_Referência_YYYY_MM.xlsx e popula as tabelas:
  - sinapi_composicoes (código, descrição, unidade, grupo)
  - sinapi_composicao_custos (custo por UF, com/sem desoneração)

Estratégia:
  - Aba "Analítico": fonte de verdade para código, descrição, unidade, grupo.
    Índices fixos: grupo=0, codigo=1, tipo_item=2, codigo_item=3, descricao=4, unidade=5.
    Linhas onde tipo_item (col 2) é None são cabeçalhos de composição.
  - Aba "CSD" (Sem Desoneração): custo por UF. Coluna "código" é ignorada (sempre 0/quebrada).
    Cruzamento 1:1 posicional com cabeçalhos do Analítico (por descrição).
  - Aba "CCD" (Com Desoneração): mesma lógica que CSD.

Uso:
  python import_sinapi.py --xlsx <caminho> --db <connection_string> [--mes 2026-07] [--dry-run]

Exemplo:
  python import_sinapi.py --xlsx "data/extracted/SINAPI_Refere^ncia_2026_07.xlsx" \
      --db "postgresql://tracocivil:tracocivil@localhost:5432/tracocivil" --mes 2026-07 --dry-run
"""

import argparse
import glob as glob_mod
import io
import os
import re
import sys
from collections import defaultdict

# Fix Windows console encoding (cp1252 can't print ê, ç, etc.)
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import openpyxl
import psycopg2
from psycopg2.extras import execute_values


# ── Índices fixos da aba Analítico (confirmados por inspeção) ──────────────
IDX_GRUPO = 0
IDX_CODIGO = 1        # Código da Composição
IDX_TIPO_ITEM = 2     # None = cabeçalho de composição; preenchido = ingrediente
IDX_CODIGO_ITEM = 3   # Código do insumo (ignorado para composições)
IDX_DESCRICAO = 4
IDX_UNIDADE = 5


def find_sheet(wb, *candidates):
    """Encontra uma aba pelo nome, tolerando variações de encoding/acento."""
    available = wb.sheetnames
    for cand in candidates:
        if cand in available:
            return wb[cand]
        cand_norm = re.sub(r'[^a-z0-9]', '', cand.lower())
        for name in available:
            name_norm = re.sub(r'[^a-z0-9]', '', name.lower())
            if cand_norm in name_norm or name_norm in cand_norm:
                return wb[name]
    return None


def parse_analitico(wb, verbose=False):
    """
    Extrai composições únicas da aba Analítico usando índices fixos.
    Retorna dict: codigo -> {descricao, unidade, grupo}
    E também retorna lista ordenada de descrições para cruzamento posicional.
    """
    sheet = find_sheet(wb, 'Analítico', 'Analitico', 'ANALÍTICO')
    if sheet is None:
        print("ERRO: Aba 'Analítico' não encontrada. Abas disponíveis:", wb.sheetnames)
        sys.exit(1)

    composicoes = {}
    desc_order = []       # descrições na ordem em que aparecem (para cruzamento CSD/CCD)
    row_count = 0
    header_skipped = False

    for i, row in enumerate(sheet.iter_rows(values_only=True), 1):
        if not row or all(c is None for c in row):
            continue

        # Pular linhas de header (primeiras ~10 linhas ou até encontrar dados válidos)
        if not header_skipped:
            # Heurística: se col 2 (tipo_item) tem texto tipo "Tipo" ou "Item", é header
            if len(row) > IDX_TIPO_ITEM and row[IDX_TIPO_ITEM] is not None:
                val = str(row[IDX_TIPO_ITEM]).strip().lower()
                if val in ('tipo', 'item', 'tipo item', 'tipo_item'):
                    if verbose:
                        print(f"  Header detectado na linha {i}, pulando")
                    header_skipped = True
                    continue
            # Se col 1 (codigo) não parece número, também pode ser header
            if len(row) > IDX_CODIGO and row[IDX_CODIGO] is not None:
                cod_val = str(row[IDX_CODIGO]).strip()
                if not re.match(r'^\d+$', cod_val.replace('.', '').replace(',', '')):
                    if verbose:
                        print(f"  Header detectado na linha {i} (codigo={cod_val!r}), pulando")
                    header_skipped = True
                    continue
            header_skipped = True  # passou das primeiras linhas, considerar dados

        row_count += 1

        # Verificar se é cabeçalho de composição: tipo_item (col 2) deve ser None
        if len(row) <= IDX_TIPO_ITEM:
            continue
        tipo_item = row[IDX_TIPO_ITEM]
        if tipo_item is not None and str(tipo_item).strip():
            # É um ingrediente, não a composição em si — pular
            continue

        # Extrair código da composição (col 1)
        if len(row) <= IDX_CODIGO or row[IDX_CODIGO] is None:
            continue
        codigo_raw = row[IDX_CODIGO]
        codigo = str(codigo_raw).strip().replace('.', '').replace(',', '').replace(' ', '')
        if not codigo or not re.match(r'^\d+$', codigo):
            continue

        # Descrição (col 4)
        descricao = ''
        if len(row) > IDX_DESCRICAO and row[IDX_DESCRICAO]:
            descricao = str(row[IDX_DESCRICAO]).strip()

        # Unidade (col 5)
        unidade = ''
        if len(row) > IDX_UNIDADE and row[IDX_UNIDADE]:
            unidade = str(row[IDX_UNIDADE]).strip().upper()

        # Grupo (col 0)
        grupo = ''
        if len(row) > IDX_GRUPO and row[IDX_GRUPO]:
            grupo = str(row[IDX_GRUPO]).strip()

        if codigo not in composicoes:
            composicoes[codigo] = {
                'descricao': descricao,
                'unidade': unidade,
                'grupo': grupo,
            }
            desc_order.append(descricao)
        elif descricao and not composicoes[codigo]['descricao']:
            composicoes[codigo]['descricao'] = descricao
            if unidade:
                composicoes[codigo]['unidade'] = unidade
            if grupo:
                composicoes[codigo]['grupo'] = grupo

    if verbose:
        print(f"  Analítico: {row_count} linhas processadas, {len(composicoes)} composições únicas")

    return composicoes, desc_order


def parse_custos_positional(wb, sheet_name_candidates, desoneracao,
                            analitico_desc_order, composicoes_by_desc, verbose=False):
    """
    Extrai custos por UF de CSD/CCD usando cruzamento POSICIONAL com o Analítico.
    Ignora a coluna "código" (sempre 0/quebrada). Faz match 1:1 por ordem de linhas.
    """
    sheet = find_sheet(wb, *sheet_name_candidates)
    if sheet is None:
        print(f"AVISO: Aba {sheet_name_candidates[0]} não encontrada. Pulando.")
        return [], 0, 0

    custos = []
    uf_columns = {}
    data_row_index = 0
    header_found = False
    total_data_rows = 0
    rejected = 0

    for i, row in enumerate(sheet.iter_rows(values_only=True), 1):
        if not row or all(c is None for c in row):
            continue

        # Detectar header: procurar colunas de UF
        if not header_found:
            for j, cell in enumerate(row):
                if cell is None:
                    continue
                val = str(cell).strip().upper()
                if val in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
                           'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                           'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'):
                    uf_columns[j] = val
                m = re.match(r'^([A-Z]{2})\s*[-–]', val)
                if m:
                    uf_columns[j] = m.group(1)

            if uf_columns:
                header_found = True
                if verbose:
                    print(f"  {sheet_name_candidates[0]}: header na linha {i}, "
                          f"{len(uf_columns)} UFs detectadas: {sorted(uf_columns.values())}")
                continue

        if not header_found:
            continue

        total_data_rows += 1

        # Cruzamento posicional: data_row_index corresponde à N-ésima composição do Analítico
        if data_row_index >= len(analitico_desc_order):
            rejected += 1
            data_row_index += 1
            continue

        desc_analitico = analitico_desc_order[data_row_index]
        codigo = composicoes_by_desc.get(desc_analitico)

        if codigo is None:
            rejected += 1
            data_row_index += 1
            continue

        # Extrair custos por UF
        has_value = False
        for col_idx, uf in uf_columns.items():
            if col_idx >= len(row):
                continue
            val = row[col_idx]
            if val is None:
                continue
            try:
                custo = float(val)
                if custo > 0:
                    custos.append({
                        'codigo': codigo,
                        'uf': uf,
                        'custo': round(custo, 2),
                    })
                    has_value = True
            except (ValueError, TypeError):
                continue

        if not has_value:
            rejected += 1

        data_row_index += 1

    if verbose:
        print(f"  {sheet_name_candidates[0]}: {total_data_rows} linhas de dados, "
              f"{len(custos)} custos extraídos, {rejected} rejeitados")

    return custos, total_data_rows, rejected


def build_desc_to_codigo(composicoes):
    """Inverte o dict composicoes para descricao -> codigo (para cruzamento posicional)."""
    mapping = {}
    for codigo, data in composicoes.items():
        desc = data['descricao']
        if desc and desc not in mapping:
            mapping[desc] = codigo
    return mapping


def import_to_db(conn, composicoes, custos_csd, custos_ccd, mes_referencia, dry_run=False):
    """Insere composições e custos no Postgres."""
    # 1. Inserir composições
    comp_rows = []
    codigo_to_id = {}

    for codigo, data in composicoes.items():
        comp_rows.append((codigo, data['descricao'], data['unidade'], data['grupo'], mes_referencia))

    if dry_run:
        print(f"\n[DRY-RUN] Seriam inseridas {len(comp_rows)} composições")
        # No dry-run, simular codigo_to_id para contar custos corretamente
        for codigo, data in composicoes.items():
            codigo_to_id[codigo] = int(codigo)  # placeholder
    else:
        cur = conn.cursor()
        insert_sql = """
            INSERT INTO sinapi_composicoes (codigo, descricao, unidade, grupo, mes_referencia)
            VALUES %s
            ON CONFLICT (codigo) DO UPDATE SET
                descricao = EXCLUDED.descricao,
                unidade = EXCLUDED.unidade,
                grupo = EXCLUDED.grupo
            RETURNING id, codigo
        """
        try:
            execute_values(cur, insert_sql, comp_rows, fetch=True)
            results = cur.fetchall()
            cur.execute("SELECT id, codigo FROM sinapi_composicoes WHERE mes_referencia = %s OR codigo IN %s",
                        (mes_referencia, tuple(composicoes.keys())))
            for row in cur.fetchall():
                codigo_to_id[row[1]] = row[0]
            print(f"  Composições: {len(results)} inseridas/atualizadas, {len(codigo_to_id)} IDs mapeados")
        except Exception as e:
            print(f"  Aviso: batch insert falhou ({e}), tentando individual...")
            conn.rollback()
            for codigo, data in composicoes.items():
                try:
                    cur.execute("""
                        INSERT INTO sinapi_composicoes (codigo, descricao, unidade, grupo, mes_referencia)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (codigo) DO UPDATE SET
                            descricao = EXCLUDED.descricao,
                            unidade = EXCLUDED.unidade,
                            grupo = EXCLUDED.grupo
                        RETURNING id
                    """, (codigo, data['descricao'], data['unidade'], data['grupo'], mes_referencia))
                    codigo_to_id[codigo] = cur.fetchone()[0]
                except Exception as e2:
                    print(f"    ERRO ao inserir {codigo}: {e2}")
                    conn.rollback()
            print(f"  Composições: {len(codigo_to_id)} inseridas individualmente")

    # 2. Inserir custos
    custo_rows = []
    for c in custos_csd:
        cid = codigo_to_id.get(c['codigo'])
        if cid:
            custo_rows.append((cid, c['uf'], False, c['custo'], mes_referencia))

    for c in custos_ccd:
        cid = codigo_to_id.get(c['codigo'])
        if cid:
            custo_rows.append((cid, c['uf'], True, c['custo'], mes_referencia))

    if dry_run:
        print(f"[DRY-RUN] Seriam inseridos {len(custo_rows)} custos ({len(custos_csd)} CSD + {len(custos_ccd)} CCD)")
    else:
        if custo_rows:
            insert_cost_sql = """
                INSERT INTO sinapi_composicao_custos (composicao_id, uf, desoneracao, custo, mes_referencia)
                VALUES %s
                ON CONFLICT (composicao_id, uf, desoneracao, mes_referencia) DO UPDATE SET
                    custo = EXCLUDED.custo
            """
            try:
                execute_values(cur, insert_cost_sql, custo_rows, page_size=1000)
                print(f"  Custos: {len(custo_rows)} inseridos/atualizados")
            except Exception as e:
                print(f"  ERRO ao inserir custos: {e}")
                conn.rollback()
        else:
            print("  Nenhum custo para inserir (verifique se as UFs foram detectadas)")

    if not dry_run:
        conn.commit()
        cur.execute("SELECT COUNT(*) FROM sinapi_composicoes")
        total_comp = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM sinapi_composicao_custos")
        total_custos = cur.fetchone()[0]
        cur.execute("SELECT COUNT(DISTINCT uf) FROM sinapi_composicao_custos")
        total_ufs = cur.fetchone()[0]
    else:
        total_comp = len(comp_rows)
        total_custos = len(custo_rows)
        total_ufs = 0

    return {
        'composicoes_importadas': len(codigo_to_id) if not dry_run else len(comp_rows),
        'custos_importados': len(custo_rows),
        'total_composicoes_db': total_comp,
        'total_custos_db': total_custos,
        'ufs_detectadas': total_ufs,
    }


def main():
    parser = argparse.ArgumentParser(description='Importar dados SINAPI para o banco TRAÇO CIVIL')
    parser.add_argument('--xlsx', required=True, help='Caminho para o arquivo SINAPI_Referência_YYYY_MM.xlsx')
    parser.add_argument('--db', required=True, help='Connection string PostgreSQL (ex: postgresql://user:pass@host/db)')
    parser.add_argument('--mes', default=None, help='Mês de referência (YYYY-MM). Auto-detectado do nome do arquivo se omitido.')
    parser.add_argument('--dry-run', action='store_true', help='Não gravar no banco, apenas reportar')
    parser.add_argument('--verbose', '-v', action='store_true', help='Saída detalhada')
    args = parser.parse_args()

    # Auto-detectar mês do nome do arquivo
    mes = args.mes
    if not mes:
        m = re.search(r'(\d{4})[_\-](\d{2})', os.path.basename(args.xlsx))
        if m:
            mes = f"{m.group(1)}-{m.group(2)}"
        else:
            print("ERRO: Não foi possível detectar o mês. Use --mes YYYY-MM")
            sys.exit(1)

    print(f"=== SINAPI Import ===")
    print(f"Arquivo: {args.xlsx}")
    print(f"Mês: {mes}")
    if not args.dry_run:
        print(f"DB: {args.db[:30]}...")
    print(f"Dry-run: {args.dry_run}")
    print()

    # Resolver caminho do arquivo (glob para tolerar encoding/acentos no Windows)
    xlsx_path = args.xlsx
    if not os.path.isfile(xlsx_path):
        candidates = glob_mod.glob(os.path.join(os.path.dirname(xlsx_path), '*Refere*.xlsx'))
        if candidates:
            xlsx_path = candidates[0]
            print(f"Caminho original não encontrado, usando: {xlsx_path}")
        else:
            print(f"ERRO: Arquivo não encontrado: {args.xlsx}")
            sys.exit(1)

    # Abrir workbook (read_only + data_only para performance e valores calculados)
    print("Abrindo workbook...")
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    print(f"Abas disponíveis: {wb.sheetnames}")
    print()

    # 1. Parse Analítico (com índices corrigidos)
    print("[1/3] Lendo aba Analítico...")
    composicoes, desc_order = parse_analitico(wb, verbose=args.verbose)
    print(f"  → {len(composicoes)} composições únicas encontradas")

    # Construir mapa descricao -> codigo para cruzamento posicional
    desc_to_codigo = build_desc_to_codigo(composicoes)

    if args.verbose and composicoes:
        print("  Amostra (primeiros 5):")
        for i, (cod, data) in enumerate(list(composicoes.items())[:5]):
            print(f"    {cod}: {data['descricao'][:60]} | {data['unidade']} | {data['grupo']}")

    # 2. Parse CSD (Sem Desoneração) — cruzamento posicional
    print("\n[2/3] Lendo aba CSD (Sem Desoneração)...")
    custos_csd, csd_rows, csd_rejected = parse_custos_positional(
        wb, ['CSD', 'Sem Desoneração', 'SEM DESONERACAO'],
        False, desc_order, desc_to_codigo, verbose=args.verbose)
    print(f"  → {len(custos_csd)} registros de custo CSD ({csd_rows} linhas, {csd_rejected} rejeitados)")

    # 3. Parse CCD (Com Desoneração) — cruzamento posicional
    print("\n[3/3] Lendo aba CCD (Com Desoneração)...")
    custos_ccd, ccd_rows, ccd_rejected = parse_custos_positional(
        wb, ['CCD', 'Com Desoneração', 'COM DESONERACAO'],
        True, desc_order, desc_to_codigo, verbose=args.verbose)
    print(f"  → {len(custos_ccd)} registros de custo CCD ({ccd_rows} linhas, {ccd_rejected} rejeitados)")

    wb.close()

    # 4. Importar para o banco (ou dry-run)
    print(f"\n{'='*50}")
    print("Importando para o banco..." if not args.dry_run else "Simulando importação (dry-run)...")

    if args.dry_run:
        stats = import_to_db(None, composicoes, custos_csd, custos_ccd, mes, dry_run=True)
    else:
        # Se --db não foi passado ou é placeholder, tentar ler credenciais do postgres.
        # Prioridade: packages/ai/.env (local seguro para scripts) > apps/backend/.env (fallback legado).
        # A senha do superuser NÃO deve residir no .env do backend em produção.
        db_conn_str = args.db
        if not db_conn_str or db_conn_str == 'FROM_ENV':
            local_env = os.path.join(os.path.dirname(__file__), '.env')
            backend_env = os.path.join(os.path.dirname(__file__), '..', '..', 'apps', 'backend', '.env')
            pg_pass = None
            for env_path in (local_env, backend_env):
                if pg_pass is not None:
                    break
                if os.path.isfile(env_path):
                    with open(env_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith('SUPABASE_POSTGRES_PASSWORD='):
                                pg_pass = line.split('=', 1)[1].strip()
                                break
            if not pg_pass:
                print("ERRO: SUPABASE_POSTGRES_PASSWORD não encontrada em packages/ai/.env nem apps/backend/.env")
                sys.exit(1)
            db_conn_str = (
                "postgresql://postgres.khpmbksseiwmaurxtxwk:"
                f"{pg_pass}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
                "?sslmode=require"
            )
            print("Conectando como postgres (owner) via pooler...")

        conn = psycopg2.connect(db_conn_str)
        try:
            stats = import_to_db(conn, composicoes, custos_csd, custos_ccd, mes, dry_run=False)
        finally:
            conn.close()

    # Relatório final
    print(f"\n{'='*50}")
    print("RELATÓRIO FINAL")
    print(f"{'='*50}")
    print(f"Composições parseadas:      {stats['composicoes_importadas']}")
    print(f"Custos parseados:           {stats['custos_importados']}")
    print(f"  ├─ CSD (sem deson.):      {len(custos_csd)}")
    print(f"  └─ CCD (com deson.):      {len(custos_ccd)}")
    print(f"Linhas CSD rejeitadas:      {csd_rejected}")
    print(f"Linhas CCD rejeitadas:      {ccd_rejected}")
    if not args.dry_run:
        print(f"Total composições no DB:    {stats['total_composicoes_db']}")
        print(f"Total custos no DB:         {stats['total_custos_db']}")
        print(f"UFs detectadas:             {stats['ufs_detectadas']}")
    print(f"\nMês de referência:          {mes}")
    print(f"Status:                     {'DRY-RUN (nada gravado)' if args.dry_run else 'CONCLUÍDO'}")


if __name__ == '__main__':
    main()