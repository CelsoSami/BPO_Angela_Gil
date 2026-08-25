"""Administração: planos de ação, ativos, processos, configurações, auditoria, saúde."""
import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.admin import ActionPlan, Asset, AuditLog, FinancialHealth, Process, Setting
from app.models.auth import User
from app.models.clients import Client
from app.routers.helpers import clamp_page, paginate
from app.schemas.admin import (
    ActionPlanCreate,
    ActionPlanOut,
    ActionPlanUpdate,
    AssetCreate,
    AssetOut,
    ProcessCreate,
    ProcessOut,
    SettingIn,
)
from app.schemas.common import MessageOut
from app.security.auth import get_current_user, require_roles
from app.services.audit import register_audit
from app.services.saude import classify

router = APIRouter(prefix="/admin", tags=["admin"])

_EDITORES = ("ADMIN", "GERENTE", "AUXILIAR")
_ADMIN = ("ADMIN",)


# ============================================================================
# PLANO DE ACOMPANHAMENTO
# ============================================================================
@router.get("/action-plans", response_model=dict)
def list_action_plans(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ActionPlan)
    if client_id:
        q = q.filter(ActionPlan.client_id == client_id)
    if status:
        q = q.filter(ActionPlan.status == status)
    q = q.order_by(ActionPlan.created_at.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    out = []
    for a in items:
        data = ActionPlanOut.model_validate(a).model_dump()
        if a.client_id:
            cli = db.get(Client, a.client_id)
            data["client_name"] = cli.nome_fantasia or cli.razao_social if cli else None
        out.append(data)
    return {"total": total, "page": page, "page_size": page_size, "items": out}


@router.post("/action-plans", response_model=ActionPlanOut, status_code=201)
def create_action_plan(
    payload: ActionPlanCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    a = ActionPlan(**payload.model_dump())
    db.add(a)
    db.flush()
    register_audit(
        db, user, "Ação criada", "ACOES", registro_id=a.id,
        valor_novo={"titulo": a.titulo}, ip=request.client.host if request.client else None,
    )
    db.commit()
    return a


@router.put("/action-plans/{plan_id}", response_model=ActionPlanOut)
def update_action_plan(
    plan_id,
    payload: ActionPlanUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    a = db.get(ActionPlan, plan_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Ação não encontrada.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    register_audit(
        db, user, "Ação atualizada", "ACOES", registro_id=plan_id,
        valor_novo={"status": a.status}, ip=request.client.host if request.client else None,
    )
    db.commit()
    return a


@router.delete("/action-plans/{plan_id}", response_model=MessageOut)
def delete_action_plan(
    plan_id,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "GERENTE")),
):
    a = db.get(ActionPlan, plan_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Ação não encontrada.")
    db.delete(a)
    db.commit()
    return MessageOut(message="Ação excluída.")


# ============================================================================
# ATIVOS
# ============================================================================
@router.get("/assets", response_model=dict)
def list_assets(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Asset)
    if client_id:
        q = q.filter(Asset.client_id == client_id)
    q = q.order_by(Asset.nome)
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    out = []
    for a in items:
        data = AssetOut.model_validate(a).model_dump()
        if a.client_id:
            cli = db.get(Client, a.client_id)
            data["client_name"] = cli.nome_fantasia or cli.razao_social if cli else None
        out.append(data)
    return {"total": total, "page": page, "page_size": page_size, "items": out}


@router.post("/assets", response_model=AssetOut, status_code=201)
def create_asset(
    payload: AssetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    a = Asset(**payload.model_dump())
    db.add(a)
    db.commit()
    return a


@router.put("/assets/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id,
    payload: AssetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    a = db.get(Asset, asset_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Ativo não encontrado.")
    for k, v in payload.model_dump().items():
        setattr(a, k, v)
    db.commit()
    return a


@router.delete("/assets/{asset_id}", response_model=MessageOut)
def delete_asset(
    asset_id,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "GERENTE")),
):
    a = db.get(Asset, asset_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Ativo não encontrado.")
    db.delete(a)
    db.commit()
    return MessageOut(message="Ativo excluído.")


# ============================================================================
# PROCESSOS INTERNOS
# ============================================================================
@router.get("/processes", response_model=dict)
def list_processes(
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Process).order_by(Process.nome)
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [ProcessOut.model_validate(p).model_dump() for p in items],
    }


@router.post("/processes", response_model=ProcessOut, status_code=201)
def create_process(
    payload: ProcessCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    p = Process(**payload.model_dump())
    db.add(p)
    db.commit()
    return p


@router.put("/processes/{process_id}", response_model=ProcessOut)
def update_process(
    process_id,
    payload: ProcessCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    p = db.get(Process, process_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Processo não encontrado.")
    for k, v in payload.model_dump().items():
        setattr(p, k, v)
    db.commit()
    return p


@router.delete("/processes/{process_id}", response_model=MessageOut)
def delete_process(
    process_id,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN")),
):
    p = db.get(Process, process_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Processo não encontrado.")
    db.delete(p)
    db.commit()
    return MessageOut(message="Processo excluído.")


# ============================================================================
# CONFIGURAÇÕES
# ============================================================================
@router.get("/settings", response_model=list)
def list_settings(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Setting).order_by(Setting.chave).all()
    return [{"chave": s.chave, "valor": s.valor, "descricao": s.descricao} for s in rows]


@router.put("/settings", response_model=MessageOut)
def update_settings(
    payload: SettingIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    s = db.query(Setting).filter(Setting.chave == payload.chave).first()
    if s is None:
        s = Setting(chave=payload.chave)
        db.add(s)
    s.valor = payload.valor
    s.descricao = payload.descricao
    register_audit(
        db, admin, "Configuração alterada", "CONFIG", valor_novo={"chave": payload.chave},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return MessageOut(message="Configuração salva.")


# ============================================================================
# AUDITORIA
# ============================================================================
@router.get("/audit", response_model=dict)
def list_audit(
    page: int = 1,
    page_size: int = 50,
    modulo: str | None = None,
    search: str | None = None,
    registro_id: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "GERENTE")),
):
    q = db.query(AuditLog)
    if modulo:
        q = q.filter(AuditLog.modulo == modulo)
    if search:
        q = q.filter(AuditLog.acao.ilike(f"%{search}%"))
    if registro_id:
        q = q.filter(AuditLog.registro_id == registro_id)
    q = q.order_by(AuditLog.created_at.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    out = []
    for a in items:
        user = db.get(User, a.usuario_id) if a.usuario_id else None
        out.append(
            {
                "id": str(a.id),
                "usuario_id": str(a.usuario_id) if a.usuario_id else None,
                "user_name": user.nome if user else "Sistema",
                "acao": a.acao,
                "modulo": a.modulo,
                "registro_id": a.registro_id,
                "valor_anterior": a.valor_anterior,
                "valor_novo": a.valor_novo,
                "ip": a.ip,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
        )
    return {"total": total, "page": page, "page_size": page_size, "items": out}


# ============================================================================
# SAÚDE FINANCEIRA (regras objetivas)
# ============================================================================
@router.post("/health/classify", response_model=dict)
def classify_health(
    client_id: str,
    mes: int | None = None,
    ano: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    hoje = date.today()
    mes = mes or hoje.month
    ano = ano or hoje.year
    resultado = classify(db, client_id, mes, ano)
    db.commit()
    return resultado


@router.get("/health", response_model=dict)
def list_health(
    client_id=None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(FinancialHealth)
    if client_id:
        q = q.filter(FinancialHealth.client_id == client_id)
    q = q.order_by(FinancialHealth.ano.desc(), FinancialHealth.mes.desc())
    rows = q.all()
    out = []
    for h in rows:
        cli = db.get(Client, h.client_id)
        out.append(
            {
                "id": str(h.id),
                "client_id": str(h.client_id),
                "client_name": cli.nome_fantasia or cli.razao_social if cli else None,
                "mes": h.mes,
                "ano": h.ano,
                "classificacao": h.classificacao,
                "score": float(h.score or 0),
                "regras": h.regras_json,
            }
        )
    return {"items": out}
