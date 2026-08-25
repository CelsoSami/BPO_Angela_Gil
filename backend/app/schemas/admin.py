"""Schemas de contratos, documentos, coleta, alertas, precificação e admin."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import BaseCreate, BaseUpdate, ORMModel


# ------------------------------------------------------------------ CONTRATOS
class InstallmentCreate(BaseCreate):
    numero: int
    valor: float = 0
    vencimento: date | None = None
    recebimento: date | None = None
    status: str = "A_RECEBER"
    juros: float = 0
    multa: float = 0
    observacoes: str | None = None


class InstallmentOut(ORMModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    numero: int
    valor: Decimal
    vencimento: date | None
    recebimento: date | None
    status: str
    juros: Decimal
    multa: Decimal
    observacoes: str | None


class ContractCreate(BaseCreate):
    client_id: uuid.UUID
    projeto_id: uuid.UUID | None = None
    numero: str = Field(min_length=2)
    data: date | None = None
    inicio: date | None = None
    termino: date | None = None
    valor: float = 0
    forma_pagamento: str | None = None
    numero_parcelas: int = 1
    status: str = "EM_ANALISE"
    arquivo_documento_id: uuid.UUID | None = None
    responsavel: str | None = None
    observacoes: str | None = None
    installments: list[InstallmentCreate] = []


class ContractUpdate(BaseUpdate):
    projeto_id: uuid.UUID | None = None
    numero: str | None = None
    data: date | None = None
    inicio: date | None = None
    termino: date | None = None
    valor: float | None = None
    forma_pagamento: str | None = None
    numero_parcelas: int | None = None
    status: str | None = None
    arquivo_documento_id: uuid.UUID | None = None
    responsavel: str | None = None
    observacoes: str | None = None


class ContractOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID
    projeto_id: uuid.UUID | None
    numero: str
    data: date | None
    inicio: date | None
    termino: date | None
    valor: Decimal
    forma_pagamento: str | None
    numero_parcelas: int
    status: str
    arquivo_documento_id: uuid.UUID | None
    responsavel: str | None
    observacoes: str | None
    created_at: datetime
    client_name: str | None = None
    project_name: str | None = None
    installments: list[InstallmentOut] = []


# ------------------------------------------------------------------ DOCUMENTOS
class DocumentCreate(BaseCreate):
    client_id: uuid.UUID | None = None
    projeto_id: uuid.UUID | None = None
    tipo: str = "OUTRO"
    data_documento: date | None = None
    observacao: str | None = None


class DocumentUpdate(BaseUpdate):
    client_id: uuid.UUID | None = None
    projeto_id: uuid.UUID | None = None
    tipo: str | None = None
    data_documento: date | None = None
    status: str | None = None
    observacao: str | None = None


class ExtractionOut(ORMModel):
    id: uuid.UUID
    document_id: uuid.UUID
    campo: str
    valor: str | None
    status: str


class ExtractionUpdate(BaseUpdate):
    valor: str | None = None
    status: str = Field(pattern="^(EXTRAIDA|VALIDADA|CORRIGIDA|REJEITADA)$")


class DocumentOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID | None
    projeto_id: uuid.UUID | None
    tipo: str
    data_documento: date | None
    usuario_id: uuid.UUID | None
    arquivo_nome: str
    arquivo_url: str | None
    tamanho: int
    mime_type: str | None
    status: str
    observacao: str | None
    created_at: datetime
    client_name: str | None = None
    extractions: list[ExtractionOut] = []


# ------------------------------------------------------------------ COLETA SEMANAL
class CollectionItemCreate(BaseCreate):
    tipo: str = Field(pattern="^(CONTRATO|GASTO_EXTRA|ENTRADA|SAIDA|PAGAMENTO|RECEBIMENTO|DIVERGENCIA|DOCUMENTO)$")
    descricao: str | None = None
    valor: float = 0
    data_item: date | None = None
    projeto_id: uuid.UUID | None = None
    contrato_id: uuid.UUID | None = None
    status: str | None = "REGISTRADO"


class CollectionCreate(BaseCreate):
    client_id: uuid.UUID
    semana: date
    status: str = "EM_ANDAMENTO"
    observacoes: str | None = None
    items: list[CollectionItemCreate] = []


class CollectionUpdate(BaseUpdate):
    status: str | None = None
    observacoes: str | None = None


class CollectionItemOut(ORMModel):
    id: uuid.UUID
    collection_id: uuid.UUID
    tipo: str
    descricao: str | None
    valor: Decimal
    data_item: date | None
    status: str | None
    created_at: datetime


class CollectionOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID
    usuario_id: uuid.UUID | None = None
    semana: date
    data_coleta: datetime
    status: str
    observacoes: str | None
    created_at: datetime
    client_name: str | None = None
    user_name: str | None = None
    items: list[CollectionItemOut] = []


# ------------------------------------------------------------------ ALERTAS
class AlertCreate(BaseCreate):
    client_id: uuid.UUID | None = None
    tipo: str = Field(min_length=2)
    prioridade: str = "MEDIA"
    titulo: str = Field(min_length=2)
    mensagem: str | None = None
    responsavel_id: uuid.UUID | None = None
    status: str = "ABERTO"
    origem: str | None = None
    registro_id: str | None = None


class AlertUpdate(BaseUpdate):
    prioridade: str | None = None
    mensagem: str | None = None
    responsavel_id: uuid.UUID | None = None
    status: str | None = None


class AlertOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID | None
    tipo: str
    prioridade: str
    titulo: str
    mensagem: str | None
    data: datetime
    responsavel_id: uuid.UUID | None
    status: str
    origem: str | None
    registro_id: str | None
    client_name: str | None = None


# ------------------------------------------------------------------ PRECIFICAÇÃO
class PricingCreate(BaseCreate):
    client_id: uuid.UUID | None = None
    titulo: str | None = None
    servico: str = Field(min_length=2)
    horas: float = 0
    custo_hora: float = 0
    equipe: list[dict] = []
    despesas: float = 0
    impostos_pct: float = 0
    margem_desejada_pct: float = 0
    prazo_dias: int | None = None
    complexidade: str | None = None
    cenario: str = "RECOMENDADO"


class PricingOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID | None
    titulo: str | None
    servico: str
    horas: Decimal
    custo_hora: Decimal
    equipe: list | None
    despesas: Decimal
    impostos_pct: Decimal
    margem_desejada_pct: Decimal
    prazo_dias: int | None
    complexidade: str | None
    custo_direto: Decimal
    custos_indiretos: Decimal
    impostos_valor: Decimal
    margem_valor: Decimal
    preco_sugerido: Decimal
    cenario: str
    created_at: datetime


# ------------------------------------------------------------------ ADMIN
class ActionPlanCreate(BaseCreate):
    client_id: uuid.UUID | None = None
    titulo: str = Field(min_length=2)
    descricao: str | None = None
    responsavel_id: uuid.UUID | None = None
    prioridade: str = "MEDIA"
    prazo: date | None = None
    status: str = "NAO_INICIADO"
    observacoes: str | None = None


class ActionPlanUpdate(BaseUpdate):
    titulo: str | None = None
    descricao: str | None = None
    responsavel_id: uuid.UUID | None = None
    prioridade: str | None = None
    prazo: date | None = None
    status: str | None = None
    observacoes: str | None = None


class ActionPlanOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID | None
    titulo: str
    descricao: str | None
    responsavel_id: uuid.UUID | None
    prioridade: str
    prazo: date | None
    status: str
    observacoes: str | None
    created_at: datetime
    client_name: str | None = None


class AssetCreate(BaseCreate):
    client_id: uuid.UUID | None = None
    nome: str = Field(min_length=2)
    tipo: str | None = None
    numero_serie: str | None = None
    valor: float = 0
    data_aquisicao: date | None = None
    status: str = "ATIVO"
    observacoes: str | None = None


class AssetOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID | None
    nome: str
    tipo: str | None
    numero_serie: str | None
    valor: Decimal
    data_aquisicao: date | None
    status: str
    observacoes: str | None
    client_name: str | None = None


class ProcessCreate(BaseCreate):
    nome: str = Field(min_length=2)
    descricao: str | None = None
    responsavel_id: uuid.UUID | None = None
    frequencia: str | None = None
    status: str = "ATIVO"


class ProcessOut(ORMModel):
    id: uuid.UUID
    nome: str
    descricao: str | None
    responsavel_id: uuid.UUID | None
    frequencia: str | None
    status: str
    created_at: datetime


class SettingIn(BaseModel):
    chave: str = Field(min_length=1)
    valor: str | None = None
    descricao: str | None = None


class SettingOut(ORMModel):
    chave: str
    valor: str | None
    descricao: str | None


class AuditOut(ORMModel):
    id: uuid.UUID
    usuario_id: uuid.UUID | None
    acao: str
    modulo: str
    registro_id: str | None
    valor_anterior: dict | None
    valor_novo: dict | None
    ip: str | None
    created_at: datetime
    user_name: str | None = None


class ReportOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID | None
    tipo: str
    mes: int | None
    ano: int | None
    titulo: str | None
    conteudo_json: dict | None
    arquivo_url: str | None
    criado_por: uuid.UUID | None
    created_at: datetime
    client_name: str | None = None


class HealthOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID
    mes: int
    ano: int
    classificacao: str
    score: float
    regras_json: dict | None
