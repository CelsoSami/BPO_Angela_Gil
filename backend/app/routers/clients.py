"""Clientes, contatos e planos."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.auth import User
from app.models.clients import Client, ClientContact
from app.models.plans import Plan, PlanFeature
from app.routers.helpers import clamp_page, paginate
from app.schemas.clients import (
    ClientCreate,
    ClientOut,
    ClientUpdate,
    ContactCreate,
    PlanOut,
)
from app.schemas.common import MessageOut
from app.security.auth import get_current_user, require_roles
from app.services.audit import register_audit
from app.services.indicators import compute_client_kpis

router = APIRouter(prefix="/clients", tags=["clients"])

_EDITORES = ("ADMIN", "GERENTE", "AUXILIAR")
_GESTORES = ("ADMIN", "GERENTE")


def _serialize(client: Client, with_contacts: bool = True) -> dict:
    data = ClientOut.model_validate(client).model_dump()
    if not with_contacts:
        data.pop("contacts", None)
    return data


@router.get("", response_model=dict)
def list_clients(
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    status: str | None = None,
    plano: str | None = None,
    segmento: str | None = None,
    responsavel: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Client)
    if search:
        like = f"%{search}%"
        q = q.filter(
            Client.razao_social.ilike(like)
            | Client.nome_fantasia.ilike(like)
            | Client.cnpj_cpf.ilike(like)
            | Client.email.ilike(like)
        )
    if status:
        q = q.filter(Client.status == status)
    if segmento:
        q = q.filter(Client.segmento == segmento)
    if plano:
        q = q.join(Plan, Client.plano_id == Plan.id).filter(Plan.codigo == plano)
    if responsavel:
        q = q.filter(Client.responsavel_bpo == responsavel)
    q = q.order_by(Client.nome_fantasia)
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_serialize(c) for c in items],
    }


@router.post("", response_model=ClientOut, status_code=201)
def create_client(
    payload: ClientCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    if payload.cnpj_cpf:
        existe = (
            db.query(Client).filter(Client.cnpj_cpf == payload.cnpj_cpf).first()
        )
        if existe:
            raise HTTPException(status_code=409, detail="CNPJ/CPF já cadastrado.")
    client = Client(**payload.model_dump(exclude={"contacts"}))
    db.add(client)
    db.flush()
    for c in payload.contacts:
        db.add(ClientContact(client_id=client.id, **c.model_dump()))
    register_audit(
        db, user, "Cliente criado", "CLIENTS", registro_id=client.id,
        valor_novo={"razao_social": client.razao_social, "status": client.status},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return client


@router.put("/{client_id}", response_model=ClientOut)
def update_client(
    client_id,
    payload: ClientUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    data = payload.model_dump(exclude_unset=True)
    if "cnpj_cpf" in data and data["cnpj_cpf"] and data["cnpj_cpf"] != client.cnpj_cpf:
        existe = db.query(Client.id).filter(Client.cnpj_cpf == data["cnpj_cpf"]).first()
        if existe:
            raise HTTPException(status_code=409, detail="CNPJ/CPF já cadastrado.")
    before = {"razao_social": client.razao_social, "status": client.status}
    for k, v in data.items():
        setattr(client, k, v)
    register_audit(
        db, user, "Cliente alterado", "CLIENTS", registro_id=client_id,
        valor_anterior=before,
        valor_novo={"razao_social": client.razao_social, "status": client.status},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", response_model=MessageOut)
def delete_client(
    client_id,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_GESTORES)),
):
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    db.delete(client)
    register_audit(
        db, user, "Cliente excluído", "CLIENTS", registro_id=client_id,
        valor_anterior={"razao_social": client.razao_social},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return MessageOut(message="Cliente excluído.")


@router.get("/{client_id}/360", response_model=dict)
def client_360(client_id, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return {
        "cliente": _serialize(client),
        "kpis": compute_client_kpis(db, client_id),
    }


@router.post("/{client_id}/contacts", response_model=dict, status_code=201)
def add_contact(
    client_id,
    payload: ContactCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    contact = ClientContact(client_id=client.id, **payload.model_dump())
    db.add(contact)
    db.commit()
    return {"id": str(contact.id)}


# ------------------------------------------------------------------ PLANOS
plans_router = APIRouter(prefix="/plans", tags=["plans"])


@plans_router.get("", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Plan).order_by(Plan.preco_mensal).all()


@plans_router.post("", response_model=PlanOut, status_code=201)
def create_plan(
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    plan = Plan(
        codigo=payload["codigo"].upper(),
        nome=payload["nome"],
        descricao=payload.get("descricao"),
        preco_mensal=payload.get("preco_mensal", 0),
    )
    db.add(plan)
    db.flush()
    for f in payload.get("features", []):
        db.add(
            PlanFeature(
                plan_id=plan.id,
                codigo=f.get("codigo", ""),
                nome=f.get("nome", ""),
                grupo=f.get("grupo"),
            )
        )
    db.commit()
    db.refresh(plan)
    return plan


@plans_router.put("/{plan_id}", response_model=PlanOut)
def update_plan(
    plan_id,
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plano não encontrado.")
    for campo in ("codigo", "nome", "descricao", "preco_mensal", "ativo"):
        if campo in payload:
            setattr(plan, campo, payload[campo])
    if "features" in payload:
        for f in plan.features:
            db.delete(f)
        db.flush()
        for f in payload["features"]:
            db.add(
                PlanFeature(
                    plan_id=plan.id,
                    codigo=f.get("codigo", ""),
                    nome=f.get("nome", ""),
                    grupo=f.get("grupo"),
                )
            )
    db.commit()
    db.refresh(plan)
    return plan
