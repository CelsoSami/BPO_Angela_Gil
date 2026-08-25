"""Schemas financeiros: categorias, pagar, receber, fluxo de caixa, conciliação, DRE."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import BaseCreate, BaseUpdate, ORMModel


class CategoryCreate(BaseCreate):
    nome: str = Field(min_length=2)
    tipo: str = Field(pattern="^(receita|despesa)$")
    dre_line: str | None = Field(
        default=None,
        pattern="^(receita_bruta|impostos|custos_diretos|despesas_operacionais|despesas_financeiras)$",
    )
    ativo: bool = True


class CategoryOut(ORMModel):
    id: uuid.UUID
    nome: str
    tipo: str
    dre_line: str | None
    ativo: bool


class PayableCreate(BaseCreate):
    client_id: uuid.UUID | None = None
    projeto_id: uuid.UUID | None = None
    fornecedor: str = Field(min_length=2)
    categoria_id: uuid.UUID | None = None
    descricao: str | None = None
    valor: float = Field(gt=0)
    vencimento: date | None = None
    data_pagamento: date | None = None
    status: str = "PENDENTE"
    centro_custo: str | None = None
    documento_id: uuid.UUID | None = None
    observacoes: str | None = None


class PayableUpdate(BaseUpdate):
    fornecedor: str | None = None
    categoria_id: uuid.UUID | None = None
    descricao: str | None = None
    valor: float | None = Field(default=None, gt=0)
    vencimento: date | None = None
    data_pagamento: date | None = None
    status: str | None = None
    centro_custo: str | None = None
    documento_id: uuid.UUID | None = None
    observacoes: str | None = None


class PayableOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID | None
    projeto_id: uuid.UUID | None
    fornecedor: str
    categoria_id: uuid.UUID | None
    descricao: str | None
    valor: Decimal
    vencimento: date | None
    data_pagamento: date | None
    status: str
    centro_custo: str | None
    documento_id: uuid.UUID | None
    observacoes: str | None
    created_at: datetime
    categoria_nome: str | None = None
    client_name: str | None = None


class ReceivableCreate(BaseCreate):
    client_id: uuid.UUID
    projeto_id: uuid.UUID | None = None
    contrato_id: uuid.UUID | None = None
    descricao: str | None = None
    parcela: int | None = None
    valor: float = Field(gt=0)
    vencimento: date | None = None
    recebimento: date | None = None
    status: str = "A_RECEBER"
    juros: float = 0
    multa: float = 0
    documento_id: uuid.UUID | None = None
    observacoes: str | None = None


class ReceivableUpdate(BaseUpdate):
    projeto_id: uuid.UUID | None = None
    contrato_id: uuid.UUID | None = None
    descricao: str | None = None
    parcela: int | None = None
    valor: float | None = Field(default=None, gt=0)
    vencimento: date | None = None
    recebimento: date | None = None
    status: str | None = None
    juros: float | None = None
    multa: float | None = None
    documento_id: uuid.UUID | None = None
    observacoes: str | None = None


class ReceivableOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID
    projeto_id: uuid.UUID | None
    contrato_id: uuid.UUID | None
    descricao: str | None
    parcela: int | None
    valor: Decimal
    vencimento: date | None
    recebimento: date | None
    status: str
    juros: Decimal
    multa: Decimal
    documento_id: uuid.UUID | None
    observacoes: str | None
    created_at: datetime
    client_name: str | None = None
    dias_atraso: int | None = None


class CashflowCreate(BaseCreate):
    client_id: uuid.UUID | None = None
    projeto_id: uuid.UUID | None = None
    data: date
    tipo: str = Field(pattern="^(entrada|saida)$")
    categoria_id: uuid.UUID | None = None
    valor: float = Field(gt=0)
    descricao: str | None = None
    forma_pagamento: str | None = None
    conciliado: bool = False


class CashflowOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID | None
    projeto_id: uuid.UUID | None
    data: date
    tipo: str
    categoria_id: uuid.UUID | None
    valor: Decimal
    descricao: str | None
    forma_pagamento: str | None
    conciliado: bool
    origem: str
    origem_id: uuid.UUID | None
    created_at: datetime
    categoria_nome: str | None = None
    client_name: str | None = None


class BankTransactionCreate(BaseCreate):
    client_id: uuid.UUID
    conta: str | None = None
    data_movimento: date
    descricao: str | None = None
    valor: float
    tipo: str | None = Field(default=None, pattern="^(entrada|saida)$")
    status_conciliacao: str = "PENDENTE"
    documento_id: uuid.UUID | None = None


class BankTransactionOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID
    conta: str | None
    data_movimento: date
    descricao: str | None
    valor: Decimal
    tipo: str | None
    status_conciliacao: str
    cashflow_id: uuid.UUID | None
    documento_id: uuid.UUID | None
    importado_em: datetime
    client_name: str | None = None


class ConciliateIn(BaseModel):
    cashflow_id: uuid.UUID


class DreLine(BaseModel):
    label: str
    value: Decimal = 0


class DreOut(BaseModel):
    mes: int
    ano: int
    receita_bruta: Decimal = 0
    impostos: Decimal = 0
    receita_liquida: Decimal = 0
    custos_diretos: Decimal = 0
    margem_contribuicao: Decimal = 0
    despesas_operacionais: Decimal = 0
    resultado_operacional: Decimal = 0
    despesas_financeiras: Decimal = 0
    resultado_liquido: Decimal = 0
    orcado: Decimal = 0
    variacao: Decimal = 0


class CashflowSummary(BaseModel):
    saldo_inicial: Decimal = 0
    entradas: Decimal = 0
    saidas: Decimal = 0
    saldo_final: Decimal = 0


class ProjectionOut(CashflowSummary):
    saldo_projetado: Decimal = 0
    recebimentos_previstos: Decimal = 0
    pagamentos_previstos: Decimal = 0
    dias: int = 90
