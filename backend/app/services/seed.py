"""Execução do seed de demonstração — reutilizada pela CLI e pelo startup."""
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # build-flow/backend
SEED_PATH = BACKEND_DIR.parent / "database" / "seed.sql"


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


def run_seed(db: Session, caminho: Path | None = None) -> int:
    """Executa o seed.sql e retorna quantos statements foram aplicados."""
    caminho = caminho or SEED_PATH
    if not caminho.exists():
        raise FileNotFoundError(f"Seed não encontrado: {caminho}")
    sql = caminho.read_text(encoding="utf-8")
    n = 0
    for stmt in split_sql(sql):
        db.execute(text(stmt))
        n += 1
    db.commit()
    return n
