"""Módulo financeiro: categorias, pagar, receber, fluxo de caixa, conciliação, DRE, inadimplência."""
import csv
import io
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.auth import User
from app.models.clients import Client
from app.models.financial import (
    BankTransaction,
    Cashflow,
    Category,
    Payable,
    Receivable,
)
from app.routers.helpers import clamp_page, client_name_map, paginate
from app.schemas.common import MessageOut
from app.schemas.financial import (
    BankTransactionCreate,
    BankTransactionOut,
    CashflowCreate,
    CashflowOut,
    CategoryCreate,
    CategoryOut,
    ConciliateIn,
    PayableCreate,
    PayableOut,
    PayableUpdate,
    ReceivableCreate,
    ReceivableOut,
    ReceivableUpdate,
)
from app.security.auth import get_current_user, require_roles
from app.services.audit import register_audit
from app.services.cashflow import daily, monthly, projection, summary, trend, weekly
from app.services.dre import compute_dre
from app.services.inadimplencia import compute_panel
from app.utils.dates import last_months

router = APIRouter(prefix="/financial", tags=["financial"])

_EDITORES = ("ADMIN", "GERENTE", "AUXILIAR")
_GESTORES = ("ADMIN", "GERENTE")


# ============================================================================
# CATEGORIAS
# ============================================================================
@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    tipo: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Category).filter(Category.ativo.is_(True))
    if tipo:
        q = q.filter(Category.tipo == tipo)
    return q.order_by(Category.nome).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    cat = Category(**payload.model_dump())
    db.add(cat)
    db.commit()
    return cat


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id,
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    cat = db.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="Categoria não encontrada.")
    for k, v in payload.model_dump().items():
        setattr(cat, k, v)
    db.commit()
    return cat


@router.delete("/categories/{category_id}", response_model=MessageOut)
def delete_category(
    category_id,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN")),
):
    cat = db.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="Categoria não encontrada.")
    cat.ativo = False
    db.commit()
    return MessageOut(message="Categoria desativada.")


# ============================================================================
# CONTAS A PAGAR
# ============================================================================
def _payable_out(db: Session, p: Payable) -> dict:
    data = PayableOut.model_validate(p).model_dump()
    if p.categoria_id:
        cat = db.get(Category, p.categoria_id)
        data["categoria_nome"] = cat.nome if cat else None
    if p.client_id:
        cli = db.get(Client, p.client_id)
        data["client_name"] = cli.nome_fantasia or cli.razao_social if cli else None
    return data


@router.get("/payables", response_model=dict)
def list_payables(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    status: str | None = None,
    periodo_inicio: date | None = None,
    periodo_fim: date | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Payable)
    if client_id:
        q = q.filter(Payable.client_id == client_id)
    if status:
        q = q.filter(Payable.status == status)
    if periodo_inicio:
        q = q.filter(Payable.vencimento >= periodo_inicio)
    if periodo_fim:
        q = q.filter(Payable.vencimento <= periodo_fim)
    if search:
        q = q.filter(Payable.fornecedor.ilike(f"%{search}%"))
    q = q.order_by(Payable.vencimento)
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_payable_out(db, p) for p in items],
    }


@router.post("/payables", response_model=PayableOut, status_code=201)
def create_payable(
    payload: PayableCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    p = Payable(**payload.model_dump())
    db.add(p)
    db.flush()
    register_audit(
        db, user, "Conta a pagar criada", "FINANCEIRO", registro_id=p.id,
        valor_novo={"fornecedor": p.fornecedor, "valor": float(p.valor)},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _payable_out(db, p)


@router.put("/payables/{payable_id}", response_model=PayableOut)
def update_payable(
    payable_id,
    payload: PayableUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    p = db.get(Payable, payable_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Conta a pagar não encontrada.")
    before = {"fornecedor": p.fornecedor, "status": p.status, "valor": float(p.valor)}
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    _sync_payable_cashflow(db, p, user)
    register_audit(
        db, user, "Conta a pagar alterada", "FINANCEIRO", registro_id=payable_id,
        valor_anterior=before,
        valor_novo={"fornecedor": p.fornecedor, "status": p.status, "valor": float(p.valor)},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _payable_out(db, p)


@router.delete("/payables/{payable_id}", response_model=MessageOut)
def delete_payable(
    payable_id,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_GESTORES)),
):
    p = db.get(Payable, payable_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Conta a pagar não encontrada.")
    db.delete(p)
    register_audit(
        db, user, "Conta a pagar excluída", "FINANCEIRO", registro_id=payable_id,
        valor_anterior={"fornecedor": p.fornecedor},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return MessageOut(message="Conta a pagar excluída.")


@router.post("/payables/{payable_id}/pay", response_model=PayableOut)
def pay_payable(
    payable_id,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    p = db.get(Payable, payable_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Conta a pagar não encontrada.")
    p.status = "PAGO"
    p.data_pagamento = date.today()
    _sync_payable_cashflow(db, p, user)
    register_audit(
        db, user, "Conta a pagar quitada", "FINANCEIRO", registro_id=payable_id,
        valor_novo={"status": "PAGO"},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _payable_out(db, p)


def _sync_payable_cashflow(db: Session, p: Payable, user: User) -> None:
    """Espelha o pagamento no fluxo de caixa (evita duplicidade)."""
    q = db.query(Cashflow).filter(
        Cashflow.origem == "pagavel", Cashflow.origem_id == p.id
    )
    if p.status == "PAGO":
        if q.first() is None:
            db.add(
                Cashflow(
                    client_id=p.client_id,
                    projeto_id=p.projeto_id,
                    data=p.data_pagamento or date.today(),
                    tipo="saida",
                    categoria_id=p.categoria_id,
                    valor=p.valor,
                    descricao=f"Pagamento — {p.fornecedor}",
                    conciliado=False,
                    origem="pagavel",
                    origem_id=p.id,
                    created_by=user.id,
                )
            )
    else:
        for cf in q.all():
            db.delete(cf)


# ============================================================================
# CONTAS A RECEBER
# ============================================================================
def _receivable_out(db: Session, r: Receivable) -> dict:
    data = ReceivableOut.model_validate(r).model_dump()
    if r.client_id:
        cli = db.get(Client, r.client_id)
        data["client_name"] = cli.nome_fantasia or cli.razao_social if cli else None
    if r.vencimento:
        data["dias_atraso"] = max(0, (date.today() - r.vencimento).days) if r.status in ("A_RECEBER", "ATRASADO") else 0
    return data


@router.get("/receivables", response_model=dict)
def list_receivables(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    status: str | None = None,
    periodo_inicio: date | None = None,
    periodo_fim: date | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Receivable)
    if client_id:
        q = q.filter(Receivable.client_id == client_id)
    if status:
        q = q.filter(Receivable.status == status)
    if periodo_inicio:
        q = q.filter(Receivable.vencimento >= periodo_inicio)
    if periodo_fim:
        q = q.filter(Receivable.vencimento <= periodo_fim)
    if search:
        q = q.filter(Receivable.descricao.ilike(f"%{search}%"))
    q = q.order_by(Receivable.vencimento)
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_receivable_out(db, r) for r in items],
    }


@router.post("/receivables", response_model=ReceivableOut, status_code=201)
def create_receivable(
    payload: ReceivableCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    r = Receivable(**payload.model_dump())
    db.add(r)
    db.flush()
    register_audit(
        db, user, "Conta a receber criada", "FINANCEIRO", registro_id=r.id,
        valor_novo={"descricao": r.descricao, "valor": float(r.valor)},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _receivable_out(db, r)


@router.put("/receivables/{receivable_id}", response_model=ReceivableOut)
def update_receivable(
    receivable_id,
    payload: ReceivableUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    r = db.get(Receivable, receivable_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")
    before = {"status": r.status, "valor": float(r.valor)}
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    _sync_receivable_cashflow(db, r, user)
    register_audit(
        db, user, "Conta a receber alterada", "FINANCEIRO", registro_id=receivable_id,
        valor_anterior=before, valor_novo={"status": r.status, "valor": float(r.valor)},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _receivable_out(db, r)


@router.delete("/receivables/{receivable_id}", response_model=MessageOut)
def delete_receivable(
    receivable_id,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_GESTORES)),
):
    r = db.get(Receivable, receivable_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")
    db.delete(r)
    register_audit(
        db, user, "Conta a receber excluída", "FINANCEIRO", registro_id=receivable_id,
        valor_anterior={"descricao": r.descricao},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return MessageOut(message="Conta a receber excluída.")


@router.post("/receivables/{receivable_id}/receive", response_model=ReceivableOut)
def receive_receivable(
    receivable_id,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    r = db.get(Receivable, receivable_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Conta a receber não encontrada.")
    r.status = "RECEBIDO"
    r.recebimento = date.today()
    _sync_receivable_cashflow(db, r, user)
    register_audit(
        db, user, "Conta a receber quitada", "FINANCEIRO", registro_id=receivable_id,
        valor_novo={"status": "RECEBIDO"},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _receivable_out(db, r)


def _sync_receivable_cashflow(db: Session, r: Receivable, user: User) -> None:
    q = db.query(Cashflow).filter(
        Cashflow.origem == "recebivel", Cashflow.origem_id == r.id
    )
    if r.status == "RECEBIDO":
        if q.first() is None:
            valor_total = float(r.valor) + float(r.juros or 0) + float(r.multa or 0)
            db.add(
                Cashflow(
                    client_id=r.client_id,
                    projeto_id=r.projeto_id,
                    data=r.recebimento or date.today(),
                    tipo="entrada",
                    valor=valor_total,
                    descricao=r.descricao or "Recebimento",
                    conciliado=False,
                    origem="recebivel",
                    origem_id=r.id,
                    created_by=user.id,
                )
            )
    else:
        for cf in q.all():
            db.delete(cf)


# ============================================================================
# FLUXO DE CAIXA
# ============================================================================
def _cashflow_out(db: Session, cf: Cashflow) -> dict:
    data = CashflowOut.model_validate(cf).model_dump()
    if cf.categoria_id:
        cat = db.get(Category, cf.categoria_id)
        data["categoria_nome"] = cat.nome if cat else None
    if cf.client_id:
        cli = db.get(Client, cf.client_id)
        data["client_name"] = cli.nome_fantasia or cli.razao_social if cli else None
    return data


@router.get("/cashflow", response_model=dict)
def list_cashflow(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    tipo: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Cashflow)
    if client_id:
        q = q.filter(Cashflow.client_id == client_id)
    if tipo:
        q = q.filter(Cashflow.tipo == tipo)
    if data_inicio:
        q = q.filter(Cashflow.data >= data_inicio)
    if data_fim:
        q = q.filter(Cashflow.data <= data_fim)
    q = q.order_by(Cashflow.data.desc(), Cashflow.created_at.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_cashflow_out(db, cf) for cf in items],
    }


@router.post("/cashflow", response_model=CashflowOut, status_code=201)
def create_cashflow(
    payload: CashflowCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    cf = Cashflow(**payload.model_dump(), origem="manual", created_by=user.id)
    db.add(cf)
    db.flush()
    register_audit(
        db, user, "Lançamento de fluxo criado", "FINANCEIRO", registro_id=cf.id,
        valor_novo={"tipo": cf.tipo, "valor": float(cf.valor)},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return _cashflow_out(db, cf)


@router.put("/cashflow/{cf_id}", response_model=CashflowOut)
def update_cashflow(
    cf_id,
    payload: CashflowCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    cf = db.get(Cashflow, cf_id)
    if cf is None:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")
    for k, v in payload.model_dump().items():
        setattr(cf, k, v)
    db.commit()
    return _cashflow_out(db, cf)


@router.delete("/cashflow/{cf_id}", response_model=MessageOut)
def delete_cashflow(
    cf_id,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_GESTORES)),
):
    cf = db.get(Cashflow, cf_id)
    if cf is None:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")
    db.delete(cf)
    register_audit(
        db, user, "Lançamento de fluxo excluído", "FINANCEIRO", registro_id=cf_id,
        valor_anterior={"valor": float(cf.valor)},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return MessageOut(message="Lançamento excluído.")


@router.get("/cashflow/summary", response_model=dict)
def cashflow_summary(
    client_id=None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if client_id is None:
        raise HTTPException(status_code=400, detail="Informe client_id.")
    return summary(db, client_id, data_inicio, data_fim)


@router.get("/cashflow/daily", response_model=list)
def cashflow_daily(
    client_id,
    data_inicio: date,
    data_fim: date,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return daily(db, client_id, data_inicio, data_fim)


@router.get("/cashflow/weekly", response_model=list)
def cashflow_weekly(
    client_id,
    data_inicio: date,
    data_fim: date,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return weekly(db, client_id, data_inicio, data_fim)


@router.get("/cashflow/monthly", response_model=list)
def cashflow_monthly(
    client_id,
    data_inicio: date,
    data_fim: date,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return monthly(db, client_id, data_inicio, data_fim)


@router.get("/cashflow/projection", response_model=dict)
def cashflow_projection(
    client_id,
    dias: int = 90,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return projection(db, client_id, dias)


@router.get("/cashflow/trend", response_model=list)
def cashflow_trend(
    client_id=None,
    meses: int = 6,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return trend(db, client_id, meses)


# ============================================================================
# CONCILIAÇÃO BANCÁRIA
# ============================================================================
def _bank_out(db: Session, bt: BankTransaction) -> dict:
    data = BankTransactionOut.model_validate(bt).model_dump()
    if bt.client_id:
        cli = db.get(Client, bt.client_id)
        data["client_name"] = cli.nome_fantasia or cli.razao_social if cli else None
    return data


@router.get("/bank", response_model=dict)
def list_bank(
    page: int = 1,
    page_size: int = 50,
    client_id=None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(BankTransaction)
    if client_id:
        q = q.filter(BankTransaction.client_id == client_id)
    if status:
        q = q.filter(BankTransaction.status_conciliacao == status)
    q = q.order_by(BankTransaction.data_movimento.desc())
    page, page_size = clamp_page(page, page_size)
    items, total = paginate(q, page, page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_bank_out(db, bt) for bt in items],
    }


@router.post("/bank", response_model=BankTransactionOut, status_code=201)
def create_bank(
    payload: BankTransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    bt = BankTransaction(**payload.model_dump())
    db.add(bt)
    db.commit()
    return _bank_out(db, bt)


@router.post("/bank/import", response_model=dict)
def import_bank_csv(
    client_id: str = Form(...),
    conta: str = Form("Conta bancária"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    """Importa extrato CSV com colunas: data;descricao;valor (negativo = saída)."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv.")
    raw = file.file.read().decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(raw), delimiter=";")
    criadas = 0
    erros = 0
    for linha in reader:
        if not linha or len(linha) < 3:
            continue
        try:
            dt = date.fromisoformat(linha[0].strip())
            desc = linha[1].strip()
            valor = float(linha[2].replace(",", ".").replace("R$", "").strip())
        except Exception:
            erros += 1
            continue
        tipo = "saida" if valor < 0 else "entrada"
        db.add(
            BankTransaction(
                client_id=uuid.UUID(client_id),
                conta=conta,
                data_movimento=dt,
                descricao=desc,
                valor=abs(valor),
                tipo=tipo,
                status_conciliacao="PENDENTE",
            )
        )
        criadas += 1
    db.commit()
    return {"importadas": criadas, "erros": erros}


@router.post("/bank/{bank_id}/conciliate", response_model=BankTransactionOut)
def conciliate_bank(
    bank_id,
    payload: ConciliateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDITORES)),
):
    bt = db.get(BankTransaction, bank_id)
    if bt is None:
        raise HTTPException(status_code=404, detail="Transação bancária não encontrada.")
    cf = db.get(Cashflow, payload.cashflow_id)
    if cf is None:
        raise HTTPException(status_code=400, detail="Lançamento de fluxo inválido.")
    # valida cliente e direção (entrada/saída) antes de conciliar
    if cf.client_id and bt.client_id != cf.client_id:
        raise HTTPException(
            status_code=400,
            detail="A transação e o lançamento pertencem a clientes diferentes.",
        )
    tipo_esperado = "saida" if float(bt.valor) < 0 else "entrada"
    if bt.tipo and cf.tipo != bt.tipo and cf.tipo != tipo_esperado:
        raise HTTPException(
            status_code=400,
            detail="Direção (entrada/saída) incompatível entre extrato e lançamento.",
        )
    # o extrato registra saídas com valor negativo; o fluxo de caixa guarda valores positivos
    divergencia = abs(abs(float(bt.valor)) - float(cf.valor))
    if divergencia > 0.01:
        bt.status_conciliacao = "DIVERGENTE"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Divergência de R$ {divergencia:.2f} entre extrato e lançamento.",
        )
    bt.status_conciliacao = "CONCILIADO"
    bt.cashflow_id = cf.id
    cf.conciliado = True
    db.commit()
    return _bank_out(db, bt)


@router.delete("/bank/{bank_id}", response_model=MessageOut)
def delete_bank(
    bank_id,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_GESTORES)),
):
    bt = db.get(BankTransaction, bank_id)
    if bt is None:
        raise HTTPException(status_code=404, detail="Transação bancária não encontrada.")
    db.delete(bt)
    db.commit()
    return MessageOut(message="Transação bancária excluída.")


# ============================================================================
# DRE E INADIMPLÊNCIA
# ============================================================================
@router.get("/dre", response_model=dict)
def get_dre(
    client_id,
    mes: int | None = None,
    ano: int | None = None,
    comparar: int = 1,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    hoje = date.today()
    mes = min(max(mes or hoje.month, 1), 12)
    ano = ano or hoje.year
    comparar = min(max(comparar, 1), 24)
    serie = [
        compute_dre(db, client_id, m, a) for m, a in last_months(mes, ano, comparar)
    ]
    return {"atual": serie[-1], "serie": serie}


@router.get("/inadimplencia", response_model=dict)
def get_inadimplencia(
    client_id=None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return compute_panel(db, client_id)
