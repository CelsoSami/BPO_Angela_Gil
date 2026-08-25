"""Fluxo de caixa: resumo, diário, semanal, mensal e projeção."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.financial import Cashflow, Payable, Receivable


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


def _entries(db: Session, client_id, start: date | None = None, end: date | None = None):
    q = db.query(Cashflow).filter(Cashflow.client_id == client_id)
    if start:
        q = q.filter(Cashflow.data >= start)
    if end:
        q = q.filter(Cashflow.data <= end)
    return q.all()


def summary(db: Session, client_id, start: date | None = None, end: date | None = None) -> dict:
    rows = _entries(db, client_id, start, end)
    entradas = _dec(sum(r.valor for r in rows if r.tipo == "entrada"))
    saidas = _dec(sum(r.valor for r in rows if r.tipo == "saida"))
    return {
        "entradas": float(entradas),
        "saidas": float(saidas),
        "saldo_final": float(entradas - saidas),
    }


def daily(db: Session, client_id, start: date, end: date) -> list[dict]:
    rows = _entries(db, client_id, start, end)
    out: dict[date, dict] = {}
    for r in rows:
        d = out.setdefault(r.data, {"data": r.data, "entradas": 0.0, "saidas": 0.0})
        d["entradas"] += float(r.valor) if r.tipo == "entrada" else 0
        d["saidas"] += float(r.valor) if r.tipo == "saida" else 0
    return sorted(out.values(), key=lambda x: x["data"])


def weekly(db: Session, client_id, start: date, end: date) -> list[dict]:
    rows = _entries(db, client_id, start, end)
    out: dict[date, dict] = {}
    for r in rows:
        seg = r.data - timedelta(days=r.data.weekday())
        w = out.setdefault(seg, {"semana": seg, "entradas": 0.0, "saidas": 0.0})
        w["entradas"] += float(r.valor) if r.tipo == "entrada" else 0
        w["saidas"] += float(r.valor) if r.tipo == "saida" else 0
    return sorted(out.values(), key=lambda x: x["semana"])


def monthly(db: Session, client_id, start: date, end: date) -> list[dict]:
    rows = _entries(db, client_id, start, end)
    out: dict[tuple, dict] = {}
    for r in rows:
        key = (r.data.year, r.data.month)
        m = out.setdefault(
            key, {"mes": r.data.month, "ano": r.data.year, "entradas": 0.0, "saidas": 0.0}
        )
        m["entradas"] += float(r.valor) if r.tipo == "entrada" else 0
        m["saidas"] += float(r.valor) if r.tipo == "saida" else 0
    return [out[k] for k in sorted(out.keys())]


def projection(db: Session, client_id, days: int = 90) -> dict:
    """Projeção: saldo atual + recebimentos/pagamentos previstos nos próximos dias."""
    today = date.today()
    end = today + timedelta(days=days)

    entradas = _dec(
        db.query(func.coalesce(func.sum(Cashflow.valor), 0))
        .filter(Cashflow.client_id == client_id, Cashflow.tipo == "entrada")
        .scalar()
    )
    saidas = _dec(
        db.query(func.coalesce(func.sum(Cashflow.valor), 0))
        .filter(Cashflow.client_id == client_id, Cashflow.tipo == "saida")
        .scalar()
    )
    saldo_atual = entradas - saidas

    recebimentos = _dec(
        db.query(func.coalesce(func.sum(Receivable.valor), 0))
        .filter(
            Receivable.client_id == client_id,
            Receivable.status == "A_RECEBER",
            Receivable.vencimento >= today,
            Receivable.vencimento <= end,
        )
        .scalar()
    )
    pagamentos = _dec(
        db.query(func.coalesce(func.sum(Payable.valor), 0))
        .filter(
            Payable.client_id == client_id,
            Payable.status == "PENDENTE",
            Payable.vencimento >= today,
            Payable.vencimento <= end,
        )
        .scalar()
    )

    return {
        "saldo_inicial": float(saldo_atual),
        "entradas": float(entradas),
        "saidas": float(saidas),
        "saldo_final": float(saldo_atual),
        "recebimentos_previstos": float(recebimentos),
        "pagamentos_previstos": float(pagamentos),
        "saldo_projetado": float(saldo_atual + recebimentos - pagamentos),
        "dias": days,
    }


def trend(db: Session, client_id=None, months: int = 6) -> list[dict]:
    """Série mensal de entradas/saídas/resultado para gráficos."""
    q = db.query(
        func.date_trunc("month", Cashflow.data).label("mes"),
        Cashflow.tipo,
        func.coalesce(func.sum(Cashflow.valor), 0).label("total"),
    )
    if client_id:
        q = q.filter(Cashflow.client_id == client_id)
    q = q.group_by("mes", Cashflow.tipo).order_by("mes")
    rows = q.all()

    agg: dict[str, dict] = {}
    for mes, tipo, total in rows:
        key = mes.strftime("%Y-%m")
        entry = agg.setdefault(key, {"mes": key, "entradas": 0.0, "saidas": 0.0})
        entry["entradas" if tipo == "entrada" else "saidas"] += float(total)
    out = list(agg.values())
    for e in out:
        e["resultado"] = round(e["entradas"] - e["saidas"], 2)
    return out[-months:]
