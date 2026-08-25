"""Contratos e parcelas."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.auth import User
from app.models.clients import Client
from app.models.contracts import Contract, ContractInstallment
from app.models.financial import Receivable
from app.models.projects import Project
from app.routers.helpers import clamp_page, paginate
from app.schemas.admin import ContractCreate, ContractOut, ContractUpdate, InstallmentOut
from app.schemas.common import MessageOut
from app.security.auth import get_current_user, require_roles
from app.services.audit import register_audit

router = APIRouter(prefix="/contracts", tags=["contracts"])

_EDITORES = ("ADMIN", "GERENTE", "AUXILIAR")
_GESTORES = ("ADMIN", "GERENTE")


def _serialize(c: Contract, db: Session) -> dict:
    data = ContractOut.model_validate(c).model_dump()
    client = db.get(Client, c.client_id)
    data["client_name"] = client.nome_fantasia or client.razao_social if client else None
    if c.projeto_id:
        p = db.get(Project, c.projeto_id)
        data["project_name"] = p.nome if p else None
    data["installments"] = [
        InstallmentOut.model_validate(i).model_dump()
        for i in c.installments
    ]
    return data


@router.get("", response_model=dict)
def list_contracts(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    status: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Contract)
    if client_id:
        q = q.filter(Contract.client_id == client_id)
    if status:
        q = q.filter(Contract.status == status)
    if search:
        q = q.filter(Contract.numero.ilike(f"%{search}%"))
    q = q.order_by(Contract.created_at.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_serialize(c, db) for c in items],
    }


@router.post("", response_model=ContractOut, status_code=201)
def create_contract(
    payload: ContractCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    data = payload.model_dump(exclude={"installments"})
    contrato = Contract(**data)
    db.add(contrato)
    db.flush()

    parcelas = payload.installments
    if not parcelas and payload.numero_parcelas > 1 and payload.valor:
        # Gera parcelas automáticas quando informado apenas o número
        valor_parcela = round(payload.valor / payload.numero_parcelas, 2)
        inicio = payload.inicio or payload.data
        for i in range(1, payload.numero_parcelas + 1):
            venc = None
            if inicio:
                from datetime import timedelta

                venc = inicio + timedelta(days=30 * i)
            parcelas.append(
                {
                    "numero": i,
                    "valor": valor_parcela,
                    "vencimento": venc,
                    "status": "A_RECEBER",
                }
            )

    for p in parcelas:
        dados = p.model_dump() if not isinstance(p, dict) else p
        db.add(ContractInstallment(contract_id=contrato.id, **dados))
    register_audit(
        db, user, "Contrato criado", "CONTRACTS", registro_id=contrato.id,
        valor_novo={"numero": contrato.numero, "valor": float(contrato.valor or 0)},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _serialize(contrato, db)


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(contract_id, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = db.get(Contract, contract_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    return _serialize(c, db)


@router.put("/{contract_id}", response_model=ContractOut)
def update_contract(
    contract_id,
    payload: ContractUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    c = db.get(Contract, contract_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    before = {"numero": c.numero, "status": c.status}
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    register_audit(
        db, user, "Contrato alterado", "CONTRACTS", registro_id=contract_id,
        valor_anterior=before, valor_novo={"numero": c.numero, "status": c.status},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _serialize(c, db)


@router.delete("/{contract_id}", response_model=MessageOut)
def delete_contract(
    contract_id,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_GESTORES)),
):
    c = db.get(Contract, contract_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    db.delete(c)
    register_audit(
        db, user, "Contrato excluído", "CONTRACTS", registro_id=contract_id,
        valor_anterior={"numero": c.numero},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return MessageOut(message="Contrato excluído.")


@router.post("/{contract_id}/installments", response_model=InstallmentOut, status_code=201)
def add_installment(
    contract_id,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    c = db.get(Contract, contract_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    parcela = ContractInstallment(contract_id=c.id, **payload)
    db.add(parcela)
    db.commit()
    return parcela


@router.post("/{contract_id}/installments/{inst_id}/receive", response_model=InstallmentOut)
def receive_installment(
    contract_id,
    inst_id,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    p = db.get(ContractInstallment, inst_id)
    if p is None or str(p.contract_id) != contract_id:
        raise HTTPException(status_code=404, detail="Parcela não encontrada.")
    from datetime import date

    p.status = "RECEBIDO"
    p.recebimento = date.today()
    db.commit()
    return p
