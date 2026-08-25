"""Rentabilidade por projeto + rankings."""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.clients import Client
from app.models.projects import Project


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


def project_profit(p: Project) -> dict:
    receita = _dec(p.receita)
    custo = _dec(p.custo_realizado)
    custo_est = _dec(p.custo_estimado)
    lucro = receita - custo
    margem = (lucro / receita * 100) if receita else Decimal("0")
    return {
        "lucro": float(lucro),
        "margem": float(margem),
        "variacao_custo": float(custo - custo_est),
    }


def compute_profitability(db: Session, client_id=None) -> list[dict]:
    q = db.query(Project)
    if client_id:
        q = q.filter(Project.client_id == client_id)
    projects = q.all()

    names = {}
    if projects:
        cids = {p.client_id for p in projects}
        clients = db.query(Client).filter(Client.id.in_(list(cids))).all()
        names = {c.id: c.nome_fantasia or c.razao_social for c in clients}

    out = []
    for p in projects:
        data = {
            "id": str(p.id),
            "client_id": str(p.client_id),
            "client_name": names.get(p.client_id),
            "nome": p.nome,
            "codigo": p.codigo,
            "status": p.status,
            "receita": float(_dec(p.receita)),
            "custo_estimado": float(_dec(p.custo_estimado)),
            "custo_realizado": float(_dec(p.custo_realizado)),
        }
        data.update(project_profit(p))
        out.append(data)
    return out


def rankings(db: Session, client_id=None) -> dict:
    data = compute_profitability(db, client_id)
    data = [d for d in data if d["status"] != "CANCELADO"]
    data.sort(key=lambda x: -x["lucro"])
    return {
        "mais_rentaveis": data[:5],
        "menos_rentaveis": list(reversed(data[-5:])) if data else [],
    }
