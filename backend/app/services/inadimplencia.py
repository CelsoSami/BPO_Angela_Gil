"""Painel de inadimplência: totais, faixas de atraso e ranking por cliente."""
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.clients import Client
from app.models.financial import Receivable


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


def _dias_atraso(r: Receivable) -> int:
    ref = r.vencimento or date.today()
    return (date.today() - ref).days


def compute_panel(db: Session, client_id=None) -> dict:
    today = date.today()
    rows = (
        db.query(Receivable)
        .filter(
            or_(
                Receivable.status == "ATRASADO",
                Receivable.status == "A_RECEBER",
            ),
            Receivable.vencimento < today,
        )
        .all()
    )
    if client_id:
        rows = [r for r in rows if r.client_id == client_id]

    faixas = [
        ["1-15", 0, 0],
        ["16-30", 0, 0],
        ["31-60", 0, 0],
        ["61-90", 0, 0],
        ["+90", 0, 0],
    ]
    faixa_map = {f[0]: f for f in faixas}

    total = _dec(0)
    atrasos: list[int] = []
    por_cliente: dict = {}

    for r in rows:
        dias = _dias_atraso(r)
        valor = _dec(r.valor) + _dec(r.juros) + _dec(r.multa)
        total += valor
        atrasos.append(dias)

        if dias <= 15:
            key = "1-15"
        elif dias <= 30:
            key = "16-30"
        elif dias <= 60:
            key = "31-60"
        elif dias <= 90:
            key = "61-90"
        else:
            key = "+90"
        f = faixa_map[key]
        f[1] += 1
        f[2] += float(valor)

        cid = str(r.client_id)
        c = por_cliente.setdefault(
            cid, {"client_id": r.client_id, "client_name": None, "valor": 0.0, "titulos": 0}
        )
        c["valor"] += float(valor)
        c["titulos"] += 1

    # nomes dos clientes
    if por_cliente:
        clients = db.query(Client).filter(Client.id.in_([k for k in por_cliente])).all()
        names = {str(c.id): c.nome_fantasia or c.razao_social for c in clients}
        for cid, c in por_cliente.items():
            c["client_name"] = names.get(cid)

    ranking = sorted(por_cliente.values(), key=lambda x: -x["valor"])

    return {
        "total_vencido": float(total),
        "quantidade_titulos": len(rows),
        "dias_medio_atraso": round(sum(atrasos) / len(atrasos), 1) if atrasos else 0,
        "faixas": [
            {"faixa": k, "titulos": v[1], "valor": v[2]} for k, v in faixa_map.items()
        ],
        "ranking": ranking,
    }
