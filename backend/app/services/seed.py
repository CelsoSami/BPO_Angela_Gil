"""Execução de arquivos SQL (schema e seed) — CLI e startup."""
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # build-flow/backend
DATABASE_DIR = BACKEND_DIR.parent / "database"
SCHEMA_PATH = DATABASE_DIR / "schema.sql"
SEED_PATH = DATABASE_DIR / "seed.sql"


def split_sql(texto: str) -> list[str]:
    """Divide um arquivo SQL em statements (sem suporte a dollar-quoting)."""
    statements, atual = [], []
    for linha in texto.splitlines():
        strip = linha.strip()
        if not strip or strip.startswith("--"):
            continue
        atual.append(linha)
        if strip.endswith(";"):
            statements.append("\n".join(atual))
            atual = []
    if atual:
        statements.append("\n".join(atual))
    return statements


def run_sql_file(db: Session, caminho: Path) -> int:
    """Executa um arquivo .sql e retorna quantos statements foram aplicados."""
    if not caminho.exists():
        raise FileNotFoundError(f"Arquivo SQL não encontrado: {caminho}")
    sql = caminho.read_text(encoding="utf-8")
    n = 0
    for stmt in split_sql(sql):
        db.execute(text(stmt))
        n += 1
    db.commit()
    return n


def run_seed(db: Session, caminho: Path | None = None) -> int:
    """Executa o seed.sql e retorna quantos statements foram aplicados."""
    return run_sql_file(db, caminho or SEED_PATH)


def run_schema(db: Session, caminho: Path | None = None) -> int:
    """Executa o schema.sql (criação de tabelas). Retorna nº de statements."""
    return run_sql_file(db, caminho or SCHEMA_PATH)
