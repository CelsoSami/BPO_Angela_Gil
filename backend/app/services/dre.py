"""Cálculo do DRE gerencial a partir do fluxo de caixa por categoria."""
from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.financial import Cashflow, Category
from app.utils.dates import month_range


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


def _sum_group(db: Session, client_id, start: date, end: date, tipo: str, dre_line=None):
    q = db.query(func.coalesce(func.sum(Cashflow.valor), 0)).filter(
        Cashflow.client_id == client_id,
        Cashflow.data >= start,
        Cashflow.data <= end,
        Cashflow.tipo == tipo,
    )
    if dre_line is not None:
        q = q.join(Category, Cashflow.categoria_id == Category.id).filter(
            Category.dre_line == dre_line
        )
    return _dec(q.scalar())


def compute_dre(db: Session, client_id, mes: int, ano: int) -> dict:
    start, end = month_range(mes, ano)

    receita_bruta = _sum_group(db, client_id, start, end, "entrada")
    impostos = _sum_group(db, client_id, start, end, "saida", "impostos")
    custos_diretos = _sum_group(db, client_id, start, end, "saida", "custos_diretos")
    despesas_op = _sum_group(db, client_id, start, end, "saida", "despesas_operacionais")
    despesas_fin = _sum_group(db, client_id, start, end, "saida", "despesas_financeiras")

    # Saídas sem categoria entram como despesas operacionais (outras despesas)
    sem_categoria = _dec(
        db.query(func.coalesce(func.sum(Cashflow.valor), 0))
        .filter(
            Cashflow.client_id == client_id,
            Cashflow.data >= start,
            Cashflow.data <= end,
            Cashflow.tipo == "saida",
            Cashflow.categoria_id.is_(None),
        )
        .scalar()
    )
    despesas_op += sem_categoria

    receita_liquida = receita_bruta - impostos
    margem_contribuicao = receita_liquida - custos_diretos
    resultado_operacional = margem_contribuicao - despesas_op
    resultado_liquido = resultado_operacional - despesas_fin

    # Orçado: receitas previstas (recebíveis com vencimento no mês)
    from app.models.financial import Receivable

    orcado = _dec(
        db.query(func.coalesce(func.sum(Receivable.valor), 0))
        .filter(
            Receivable.client_id == client_id,
            Receivable.vencimento >= start,
            Receivable.vencimento <= end,
            Receivable.status.in_(["A_RECEBER", "RECEBIDO"]),
        )
        .scalar()
    )

    return {
        "mes": mes,
        "ano": ano,
        "receita_bruta": float(receita_bruta),
        "impostos": float(impostos),
        "receita_liquida": float(receita_liquida),
        "custos_diretos": float(custos_diretos),
        "margem_contribuicao": float(margem_contribuicao),
        "despesas_operacionais": float(despesas_op),
        "resultado_operacional": float(resultado_operacional),
        "despesas_financeiras": float(despesas_fin),
        "resultado_liquido": float(resultado_liquido),
        "orcado": float(orcado),
        "variacao": float(receita_bruta - orcado),
    }
