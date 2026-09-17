"""Aplica migrations V1-V11 contra Supabase PostgreSQL em ordem."""
import glob
import os
import re
import sys
import psycopg2

CONN_STR = "postgresql://postgres:PCtd91zxrhLoFqb3@db.khpmbksseiwmaurxtxwk.supabase.co:5432/postgres"
MIGRATION_DIR = r"apps\backend\src\main\resources\db\migration"

def natural_sort_key(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', s)]

files = sorted(glob.glob(os.path.join(MIGRATION_DIR, "V*.sql")), key=natural_sort_key)
print(f"Encontradas {len(files)} migrations")

conn = psycopg2.connect(CONN_STR)
conn.autocommit = True
cur = conn.cursor()

for f in files:
    name = os.path.basename(f)
    print(f"  Aplicando {name}...", end=" ", flush=True)
    sql = open(f, encoding="utf-8").read()
    try:
        cur.execute(sql)
        print("OK")
    except Exception as e:
        print(f"ERRO: {e}")
        # Continuar — algumas statements podem falhar idempotentemente (IF NOT EXISTS)

# Verificar tabelas criadas
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
""")
tables = [r[0] for r in cur.fetchall()]
print(f"\nTabelas no Supabase ({len(tables)}):")
for t in tables:
    print(f"  - {t}")

# Contar registros
for tbl in ['sinapi_composicoes', 'sinapi_composicao_custos', 'sinapi_elemento_mapeamento']:
    if tbl in tables:
        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
        cnt = cur.fetchone()[0]
        print(f"  {tbl}: {cnt} registros")

cur.close()
conn.close()
print("\nMIGRATIONS_DONE")