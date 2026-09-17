"""Aplica migration V20260904 (rooms_detail JSONB) no Supabase e registra no flyway_schema_history."""
import os
import sys
from pathlib import Path

# Carrega .env local (onde SUPABASE_POSTGRES_PASSWORD está definida após auditoria)
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

password = os.environ.get("SUPABASE_POSTGRES_PASSWORD")
if not password:
    print("ERRO: SUPABASE_POSTGRES_PASSWORD nao encontrada no .env ou ambiente")
    sys.exit(1)

import psycopg2

conn_str = f"postgresql://postgres.khpmbksseiwmaurxtxwk:{password}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require"

try:
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cur = conn.cursor()

    # 1. Aplicar ALTER TABLE
    print("Aplicando ALTER TABLE analyses ADD COLUMN rooms_detail JSONB...")
    try:
        cur.execute("ALTER TABLE analyses ADD COLUMN IF NOT EXISTS rooms_detail JSONB;")
        print("OK - coluna criada/confirmada")
    except Exception as e:
        print(f"ERRO ao aplicar migration: {e}")
        sys.exit(1)

    # 2. Verificar que a coluna existe
    cur.execute("""
        SELECT data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'analyses' AND column_name = 'rooms_detail'
    """)
    row = cur.fetchone()
    if row:
        print(f"Confirmado: coluna rooms_detail existe (type={row[0]}, nullable={row[1]})")
    else:
        print("ERRO: coluna rooms_detail NAO encontrada apos ALTER TABLE")
        sys.exit(1)

    # 3. Registrar no flyway_schema_history
    cur.execute("""
        SELECT version FROM flyway_schema_history
        WHERE script LIKE '%rooms_detail%'
    """)
    if cur.fetchone():
        print("Migration ja registrada no flyway_schema_history")
    else:
        # Pegar o maior installed_rank para incrementar
        cur.execute("SELECT COALESCE(MAX(installed_rank), 0) FROM flyway_schema_history")
        max_rank = cur.fetchone()[0]
        next_rank = max_rank + 1

        cur.execute("""
            INSERT INTO flyway_schema_history
                (installed_rank, version, description, type, script, checksum, installed_by, execution_time, success)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            next_rank,
            "20260904",
            "add rooms detail jsonb",
            "SQL",
            "V20260904__add_rooms_detail_jsonb.sql",
            None,
            "claude",
            0,
            True,
        ))
        print(f"Registrado no flyway_schema_history com installed_rank={next_rank}")

    cur.close()
    conn.close()
    print("\nMIGRATION_ROOMS_DETAIL_DONE")

except Exception as e:
    print(f"ERRO de conexao ou execucao: {e}")
    sys.exit(1)