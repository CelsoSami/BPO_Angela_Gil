"""Coleta semanal de informações dos clientes."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.auth import User
from app.models.clients import Client
from app.models.collections import CollectionItem, WeeklyCollection
from app.routers.helpers import clamp_page, paginate
from app.schemas.admin import (
    CollectionCreate,
    CollectionItemCreate,
    CollectionOut,
    CollectionUpdate,
)
from app.schemas.common import MessageOut
from app.security.auth import get_current_user, require_roles
from app.services.audit import register_audit
from app.utils.dates import monday_of_week

router = APIRouter(prefix="/collections", tags=["collections"])

_EDITORES = ("ADMIN", "GERENTE", "AUXILIAR")


def _serialize(db: Session, c: WeeklyCollection) -> dict:
    from app.models.auth import User as UserModel

    data = CollectionOut.model_validate(c).model_dump()
    cli = db.get(Client, c.client_id)
    data["client_name"] = cli.nome_fantasia or cli.razao_social if cli else None
    usuario = db.get(UserModel, c.usuario_id)
    data["user_name"] = usuario.nome if usuario else None
    data["items"] = [
        {
            "id": str(i.id),
            "collection_id": str(i.collection_id),
            "tipo": i.tipo,
            "descricao": i.descricao,
            "valor": float(i.valor or 0),
            "data_item": i.data_item.isoformat() if i.data_item else None,
            "status": i.status,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in c.items
    ]
    return data


@router.get("", response_model=dict)
def list_collections(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(WeeklyCollection)
    if client_id:
        q = q.filter(WeeklyCollection.client_id == client_id)
    if status:
        q = q.filter(WeeklyCollection.status == status)
    q = q.order_by(WeeklyCollection.semana.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_serialize(db, c) for c in items],
    }


@router.get("/pending", response_model=list)
def pending_collections(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Clientes ativos sem coleta registrada na semana atual."""
    seg = monday_of_week()
    ativos = db.query(Client).filter(Client.status == "ATIVO").all()
    pendentes = []
    for cli in ativos:
        existe = (
            db.query(WeeklyCollection.id)
            .filter(
                WeeklyCollection.client_id == cli.id,
                WeeklyCollection.semana == seg,
            )
            .first()
        )
        if not existe:
            pendentes.append(
                {
                    "client_id": str(cli.id),
                    "client_name": cli.nome_fantasia or cli.razao_social,
                    "semana": seg.isoformat(),
                }
            )
    return pendentes


@router.post("", response_model=CollectionOut, status_code=201)
def create_collection(
    payload: CollectionCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    semana = payload.semana
    if not isinstance(semana, date):
        raise HTTPException(status_code=400, detail="Data da semana inválida.")
    existente = (
        db.query(WeeklyCollection)
        .filter(
            WeeklyCollection.client_id == payload.client_id,
            WeeklyCollection.semana == semana,
        )
        .first()
    )
    if existente:
        raise HTTPException(
            status_code=409,
            detail="Já existe coleta para este cliente na semana informada.",
        )
    coleta = WeeklyCollection(
        client_id=payload.client_id,
        usuario_id=user.id,
        semana=semana,
        status=payload.status,
        observacoes=payload.observacoes,
    )
    db.add(coleta)
    db.flush()
    for item in payload.items:
        db.add(CollectionItem(collection_id=coleta.id, **item.model_dump()))
    register_audit(
        db, user, "Coleta semanal criada", "COLETA", registro_id=coleta.id,
        valor_novo={"client_id": str(coleta.client_id), "semana": semana.isoformat()},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _serialize(db, coleta)


@router.get("/{collection_id}", response_model=CollectionOut)
def get_collection(collection_id, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = db.get(WeeklyCollection, collection_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Coleta não encontrada.")
    return _serialize(db, c)


@router.put("/{collection_id}", response_model=CollectionOut)
def update_collection(
    collection_id,
    payload: CollectionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    c = db.get(WeeklyCollection, collection_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Coleta não encontrada.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    register_audit(
        db, user, "Coleta semanal atualizada", "COLETA", registro_id=collection_id,
        valor_novo={"status": c.status},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _serialize(db, c)


@router.post("/{collection_id}/items", response_model=dict, status_code=201)
def add_collection_item(
    collection_id,
    payload: CollectionItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    c = db.get(WeeklyCollection, collection_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Coleta não encontrada.")
    item = CollectionItem(collection_id=c.id, **payload.model_dump())
    db.add(item)
    db.commit()
    return {"id": str(item.id), "tipo": item.tipo}


@router.delete("/{collection_id}", response_model=MessageOut)
def delete_collection(
    collection_id,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    c = db.get(WeeklyCollection, collection_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Coleta não encontrada.")
    db.delete(c)
    db.commit()
    return MessageOut(message="Coleta excluída.")
