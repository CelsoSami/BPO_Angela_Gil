"""Central de alertas (regras objetivas + gestão manual)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.alerts import Alert
from app.models.auth import User
from app.models.clients import Client
from app.routers.helpers import clamp_page, paginate
from app.schemas.admin import AlertCreate, AlertOut, AlertUpdate
from app.schemas.common import MessageOut
from app.security.auth import get_current_user, require_roles
from app.services.alertas import generate_alerts
from app.services.audit import register_audit

router = APIRouter(prefix="/alerts", tags=["alerts"])

_EDITORES = ("ADMIN", "GERENTE", "AUXILIAR")


def _serialize(db: Session, a: Alert) -> dict:
    data = AlertOut.model_validate(a).model_dump()
    if a.client_id:
        cli = db.get(Client, a.client_id)
        data["client_name"] = cli.nome_fantasia or cli.razao_social if cli else None
    return data


@router.get("", response_model=dict)
def list_alerts(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    status: str | None = None,
    prioridade: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Alert)
    if client_id:
        q = q.filter(Alert.client_id == client_id)
    if status:
        q = q.filter(Alert.status == status)
    if prioridade:
        q = q.filter(Alert.prioridade == prioridade)
    q = q.order_by(Alert.data.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_serialize(db, a) for a in items],
    }


@router.get("/stats", response_model=dict)
def alert_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    abertos = (
        db.query(func.count(Alert.id))
        .filter(Alert.status.in_(["ABERTO", "EM_ANDAMENTO"]))
        .scalar() or 0
    )
    alta = (
        db.query(func.count(Alert.id))
        .filter(Alert.prioridade == "ALTA", Alert.status.in_(["ABERTO", "EM_ANDAMENTO"]))
        .scalar() or 0
    )
    por_tipo = dict(
        db.query(Alert.tipo, func.count(Alert.id))
        .filter(Alert.status.in_(["ABERTO", "EM_ANDAMENTO"]))
        .group_by(Alert.tipo)
        .all()
    )
    return {"abertos": abertos, "prioridade_alta": alta, "por_tipo": por_tipo}


@router.post("/generate", response_model=dict)
def run_generate_alerts(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    """Executa a varredura de regras e cria alertas novos."""
    criados = generate_alerts(db)
    register_audit(
        db, user, "Alertas gerados", "ALERTAS",
        valor_novo={"criados": criados},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return {"criados": criados, "message": f"{criados} alerta(s) criado(s)."}


@router.post("", response_model=AlertOut, status_code=201)
def create_alert(
    payload: AlertCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    a = Alert(**payload.model_dump())
    db.add(a)
    db.commit()
    return a


@router.put("/{alert_id}", response_model=AlertOut)
def update_alert(
    alert_id,
    payload: AlertUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    a = db.get(Alert, alert_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Alerta não encontrado.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    if a.status == "RESOLVIDO" and not a.resolved_at:
        a.resolved_at = datetime.now(timezone.utc)
    register_audit(
        db, user, "Alerta atualizado", "ALERTAS", registro_id=alert_id,
        valor_novo={"status": a.status},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return a


@router.delete("/{alert_id}", response_model=MessageOut)
def delete_alert(
    alert_id,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "GERENTE")),
):
    a = db.get(Alert, alert_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Alerta não encontrado.")
    db.delete(a)
    db.commit()
    return MessageOut(message="Alerta excluído.")
