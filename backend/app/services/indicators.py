"""Indicadores (KPIs) globais e por cliente."""
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.admin import FinancialHealth
from app.models.alerts import Alert
from app.models.clients import Client
from app.models.contracts import Contract
from app.models.documents import Document
from app.models.financial import Cashflow, Receivable
from app.models.projects import Project


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


def compute_global_kpis(db: Session, days: int = 90) -> dict:
    """KPIs executivos da Visão Geral."""
    today = date.today()
    start = today - timedelta(days=days)

    clientes_ativos = (
        db.query(func.count(Client.id))
        .filter(Client.status == "ATIVO")
        .scalar()
        or 0
    )

    receita = (
        db.query(func.coalesce(func.sum(Cashflow.valor), 0))
        .filter(Cashflow.tipo == "entrada", Cashflow.data >= start)
        .scalar()
    )
    despesas = (
        db.query(func.coalesce(func.sum(Cashflow.valor), 0))
        .filter(Cashflow.tipo == "saida", Cashflow.data >= start)
        .scalar()
    )
    receita = _dec(receita)
    despesas = _dec(despesas)
    resultado = receita - despesas
    margem = (resultado / receita * 100) if receita else Decimal("0")

    contas_vencidas = (
        db.query(func.count(Receivable.id))
        .filter(
            or_(
                Receivable.status == "ATRASADO",
                and_(
                    Receivable.status == "A_RECEBER",
                    Receivable.vencimento < today,
                ),
            )
        )
        .scalar()
        or 0
    )
    valor_vencido = (
        db.query(func.coalesce(func.sum(Receivable.valor), 0))
        .filter(
            or_(
                Receivable.status == "ATRASADO",
                and_(
                    Receivable.status == "A_RECEBER",
                    Receivable.vencimento < today,
                ),
            )
        )
        .scalar()
    )

    projetos_ativos = (
        db.query(func.count(Project.id))
        .filter(Project.status.in_(["PLANEJAMENTO", "EM_ANDAMENTO"]))
        .scalar()
        or 0
    )
    contratos_ativos = (
        db.query(func.count(Contract.id))
        .filter(Contract.status == "ATIVO")
        .scalar()
        or 0
    )
    alertas_abertos = (
        db.query(func.count(Alert.id)).filter(Alert.status.in_(["ABERTO", "EM_ANDAMENTO"])).scalar() or 0
    )
    documentos_pendentes = (
        db.query(func.count(Document.id))
        .filter(Document.status.in_(["PENDENTE", "PROCESSADO", "AGUARDANDO_VALIDACAO"]))
        .scalar()
        or 0
    )

    return {
        "clientes_ativos": clientes_ativos,
        "receita": float(receita),
        "despesas": float(despesas),
        "resultado": float(resultado),
        "margem": float(margem),
        "contas_vencidas": contas_vencidas,
        "valor_vencido": float(valor_vencido),
        "projetos_ativos": projetos_ativos,
        "contratos_ativos": contratos_ativos,
        "alertas_abertos": alertas_abertos,
        "documentos_pendentes": documentos_pendentes,
    }


def compute_client_kpis(db: Session, client_id) -> dict:
    """KPIs do Cliente 360°."""
    today = date.today()

    receita = _dec(
        db.query(func.coalesce(func.sum(Cashflow.valor), 0))
        .filter(Cashflow.client_id == client_id, Cashflow.tipo == "entrada")
        .scalar()
    )
    despesas = _dec(
        db.query(func.coalesce(func.sum(Cashflow.valor), 0))
        .filter(Cashflow.client_id == client_id, Cashflow.tipo == "saida")
        .scalar()
    )
    resultado = receita - despesas
    margem = (resultado / receita * 100) if receita else Decimal("0")

    recebido = _dec(
        db.query(func.coalesce(func.sum(Receivable.valor), 0))
        .filter(Receivable.client_id == client_id, Receivable.status == "RECEBIDO")
        .scalar()
    )
    a_receber = _dec(
        db.query(func.coalesce(func.sum(Receivable.valor), 0))
        .filter(Receivable.client_id == client_id, Receivable.status == "A_RECEBER")
        .scalar()
    )
    atrasado = _dec(
        db.query(func.coalesce(func.sum(Receivable.valor), 0))
        .filter(
            Receivable.client_id == client_id,
            or_(
                Receivable.status == "ATRASADO",
                and_(Receivable.status == "A_RECEBER", Receivable.vencimento < today),
            ),
        )
        .scalar()
    )

    projetos = db.query(Project).filter(Project.client_id == client_id).all()
    projetos_ativos = sum(1 for p in projetos if p.status in ("PLANEJAMENTO", "EM_ANDAMENTO"))
    projetos_concluidos = sum(1 for p in projetos if p.status == "CONCLUIDO")
    projetos_rentaveis = sum(1 for p in projetos if (p.receita or 0) > (p.custo_realizado or 0))

    contratos = db.query(Contract).filter(Contract.client_id == client_id).all()
    contratos_ativos = sum(1 for c in contratos if c.status == "ATIVO")
    proximos_vencimento = sum(
        1
        for c in contratos
        if c.status == "ATIVO" and c.termino and 0 <= (c.termino - today).days <= 60
    )

    docs = db.query(Document).filter(Document.client_id == client_id).all()
    docs_validados = sum(1 for d in docs if d.status == "VALIDADO")
    docs_pendentes = sum(1 for d in docs if d.status == "PENDENTE")
    docs_validacao = sum(1 for d in docs if d.status == "AGUARDANDO_VALIDACAO")

    health = (
        db.query(FinancialHealth)
        .filter(FinancialHealth.client_id == client_id)
        .order_by(FinancialHealth.ano.desc(), FinancialHealth.mes.desc())
        .first()
    )

    return {
        "receita": float(receita),
        "despesas": float(despesas),
        "resultado": float(resultado),
        "margem": float(margem),
        "recebido": float(recebido),
        "a_receber": float(a_receber),
        "atrasado": float(atrasado),
        "projetos_ativos": projetos_ativos,
        "projetos_concluidos": projetos_concluidos,
        "projetos_rentaveis": projetos_rentaveis,
        "total_projetos": len(projetos),
        "contratos_ativos": contratos_ativos,
        "contratos_proximos_vencimento": proximos_vencimento,
        "total_contratos": len(contratos),
        "documentos_validados": docs_validados,
        "documentos_pendentes": docs_pendentes,
        "documentos_aguardando_validacao": docs_validacao,
        "total_documentos": len(docs),
        "saude_financeira": (
            {
                "classificacao": health.classificacao,
                "score": float(health.score),
            }
            if health
            else None
        ),
    }
