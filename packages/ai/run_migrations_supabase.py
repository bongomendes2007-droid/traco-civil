"""Aplica migrations V1-V11 contra Supabase PostgreSQL em ordem."""
import glob
import os
import re
import sys
import psycopg2

MIGRATION_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..",
    "apps", "backend", "src", "main", "resources", "db", "migration",
)


def _load_dotenv(path: str = ".env"):
    """Carrega pares CHAVE=VALOR de um .env simples, sem sobrescrever o ambiente."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def _conn_str() -> str:
    """Monta a connection string do superuser a partir de variáveis de ambiente.

    A senha NUNCA deve ser commitada — use SUPABASE_POSTGRES_PASSWORD no
    packages/ai/.env (ou no ambiente do shell).
    """
    _load_dotenv()
    password = os.environ.get("SUPABASE_POSTGRES_PASSWORD")
    if not password:
        sys.exit(
            "ERRO: SUPABASE_POSTGRES_PASSWORD não definida. "
            "Defina no ambiente ou em packages/ai/.env (ver .env.example)."
        )
    host = os.environ.get("SUPABASE_DB_HOST", "db.khpmbksseiwmaurxtxwk.supabase.co")
    port = os.environ.get("SUPABASE_DB_PORT", "5432")
    dbname = os.environ.get("SUPABASE_DB_NAME", "postgres")
    return f"postgresql://postgres:{password}@{host}:{port}/{dbname}"


CONN_STR = _conn_str()

def natural_sort_key(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', s)]

files = sorted(glob.glob(os.path.join(MIGRATION_DIR, "V*.sql")), key=natural_sort_key)
print(f"Encontradas {len(files)} migrations")

conn = psycopg2.connect(CONN_STR)
conn.autocommit = True
cur = conn.cursor()

if "--check" in sys.argv:
    # Modo leve: apenas valida a conexão/credencial. NÃO aplica DDL.
    cur.execute("SELECT 1")
    cur.execute("SELECT current_user, current_database()")
    user, db = cur.fetchone()
    cur.close()
    conn.close()
    print(f"CONNECTION_OK user={user} db={db}")
    sys.exit(0)

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