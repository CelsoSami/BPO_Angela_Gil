"""Execução de arquivos SQL (schema e seed) — CLI e startup."""
import re
from pathlib import Path

from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # build-flow/backend
DATABASE_DIR = BACKEND_DIR.parent / "database"
SCHEMA_PATH = DATABASE_DIR / "schema.sql"
SEED_PATH = DATABASE_DIR / "seed.sql"
DEMO_GENERATE_PATH = DATABASE_DIR / "demo_generate.sql"
DEMO_CLEAN_PATH = DATABASE_DIR / "demo_clean.sql"

# Padrão de dollar-quoting do PostgreSQL: $$ ... $$ ou $tag$ ... $tag$
_DOLLAR_QUOTE = re.compile(r"\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$")


def split_sql(texto: str) -> list[str]:
    """Divide um arquivo SQL em statements, respeitando dollar-quoting."""
    statements, atual = [], []
    in_dq = False
    for linha in texto.splitlines():
        strip = linha.strip()
        if not strip or strip.startswith("--"):
            continue
        atual.append(linha)
        n_dq = len(_DOLLAR_QUOTE.findall(linha))
        if n_dq % 2 == 1:
            in_dq = not in_dq
        if strip.endswith(";") and not in_dq:
            statements.append("\n".join(atual))
            atual = []
    if atual:
        statements.append("\n".join(atual))
    return statements


def run_sql_file(db: Session, caminho: Path) -> int:
    """Executa um arquivo .sql e retorna quantos statements foram aplicados.

    Usa a conexão bruta do driver (psycopg2) para executar o SQL sem a
    maquinaria de binds do SQLAlchemy — assim valores como JSON com ':140'
    ou operadores '%' não são interpretados como parâmetros.
    """
    if not caminho.exists():
        raise FileNotFoundError(f"Arquivo SQL não encontrado: {caminho}")
    sql = caminho.read_text(encoding="utf-8")
    raw = db.connection().connection  # conexão DBAPI (psycopg2)
    cursor = raw.cursor()
    n = 0
    try:
        for stmt in split_sql(sql):
            cursor.execute(stmt)
            n += 1
        db.commit()  # commit pela sessão para manter o estado do SQLAlchemy
    except Exception:
        db.rollback()
        raise
    return n


def run_seed(db: Session, caminho: Path | None = None) -> int:
    """Executa o seed.sql e retorna quantos statements foram aplicados."""
    return run_sql_file(db, caminho or SEED_PATH)


def run_schema(db: Session, caminho: Path | None = None) -> int:
    """Executa o schema.sql (criação de tabelas). Retorna nº de statements."""
    return run_sql_file(db, caminho or SCHEMA_PATH)


def run_demo_generate(db: Session, caminho: Path | None = None) -> int:
    """Executa o gerador de dados estendido (demo_generate.sql)."""
    return run_sql_file(db, caminho or DEMO_GENERATE_PATH)


def run_demo_clean(db: Session, caminho: Path | None = None) -> int:
    """Executa a limpeza dos dados de demonstração (demo_clean.sql)."""
    return run_sql_file(db, caminho or DEMO_CLEAN_PATH)
