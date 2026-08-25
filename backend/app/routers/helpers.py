"""Helpers comuns de routers."""
from sqlalchemy.orm import Session


def paginate(query, page: int, page_size: int):
    """Aplica paginação e retorna (items, total)."""
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def clamp_page(page: int, page_size: int) -> tuple[int, int]:
    page = max(1, page)
    page_size = min(max(1, page_size), 200)
    return page, page_size


def client_name_map(db: Session, client_ids) -> dict:
    from app.models.clients import Client

    ids = {c for c in client_ids if c is not None}
    if not ids:
        return {}
    rows = db.query(Client.id, Client.nome_fantasia, Client.razao_social).filter(
        Client.id.in_(list(ids))
    ).all()
    return {str(r[0]): r[1] or r[2] for r in rows}
