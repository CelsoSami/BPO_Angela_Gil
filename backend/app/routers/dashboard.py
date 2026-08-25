"""Dashboard executivo (Visão Geral) e dashboard do cliente."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.auth import User
from app.models.clients import Client
from app.models.contracts import Contract
from app.models.documents import Document
from app.models.financial import Cashflow
from app.security.auth import get_current_user
from app.services.alertas import generate_alerts
from app.services.cashflow import trend
from app.services.indicators import compute_client_kpis, compute_global_kpis
from app.services.inadimplencia import compute_panel
from app.services.rentabilidade import rankings

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=dict)
def overview(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Visão Geral: KPIs + gráficos + alertas + pendências."""
    kpis = compute_global_kpis(db)
    tendencia = trend(db, months=6)

    # receita x despesa por mês (últimos 6 meses)
    receita_despesa = [
        {
            "mes": t["mes"],
            "entradas": t["entradas"],
            "saidas": t["saidas"],
            "resultado": t["resultado"],
        }
        for t in tendencia
    ]

    inad = compute_panel(db)

    contratos_proximos = (
        db.query(Contract)
        .filter(Contract.status == "ATIVO", Contract.termino.isnot(None))
        .all()
    )
    from datetime import timedelta

    hoje = date.today()
    contratos = [
        {
            "id": str(c.id),
            "numero": c.numero,
            "client_id": str(c.client_id),
            "termino": c.termino.isoformat(),
            "dias": (c.termino - hoje).days,
        }
        for c in contratos_proximos
        if 0 <= (c.termino - hoje).days <= 60
    ]

    docs_pendentes = (
        db.query(Document)
        .filter(Document.status.in_(["PENDENTE", "AGUARDANDO_VALIDACAO"]))
        .count()
    )

    ranking = rankings(db)

    return {
        "kpis": kpis,
        "receita_despesa": receita_despesa,
        "inadimplencia": inad,
        "contratos_proximos": contratos,
        "documentos_pendentes": docs_pendentes,
        "rankings": ranking,
    }


@router.get("/client/{client_id}", response_model=dict)
def client_dashboard(client_id, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cli = db.get(Client, client_id)
    if cli is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return {
        "cliente": {
            "id": str(cli.id),
            "nome": cli.nome_fantasia or cli.razao_social,
            "status": cli.status,
            "plano": cli.plan.codigo if cli.plan else None,
        },
        "kpis": compute_client_kpis(db, client_id),
        "tendencia": trend(db, client_id=client_id, months=6),
        "inadimplencia": compute_panel(db, client_id=client_id),
        "rankings": rankings(db, client_id=client_id),
    }
