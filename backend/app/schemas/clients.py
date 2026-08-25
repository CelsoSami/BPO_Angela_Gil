"""Schemas de planos, clientes e projetos."""
import uuid
from datetime import date, datetime

from pydantic import Field

from app.schemas.common import BaseCreate, BaseUpdate, ORMModel


# ------------------------------------------------------------------ PLANOS
class PlanFeatureOut(ORMModel):
    id: uuid.UUID
    codigo: str
    nome: str
    grupo: str | None
    ativo: bool


class PlanOut(ORMModel):
    id: uuid.UUID
    codigo: str
    nome: str
    descricao: str | None
    preco_mensal: float
    ativo: bool
    features: list[PlanFeatureOut] = []


# ------------------------------------------------------------------ CLIENTES
class ContactCreate(BaseCreate):
    nome: str = Field(min_length=2)
    cargo: str | None = None
    email: str | None = None
    telefone: str | None = None
    principal: bool = False


class ContactOut(ORMModel):
    id: uuid.UUID
    nome: str
    cargo: str | None
    email: str | None
    telefone: str | None
    principal: bool


class ClientCreate(BaseCreate):
    razao_social: str = Field(min_length=2, max_length=255)
    nome_fantasia: str | None = None
    cnpj_cpf: str | None = None
    email: str | None = None
    telefone: str | None = None
    endereco: str | None = None
    cidade: str | None = None
    estado: str | None = Field(default=None, max_length=2)
    segmento: str | None = None
    plano_id: uuid.UUID | None = None
    responsavel_bpo: uuid.UUID | None = None
    data_inicio: date | None = None
    data_termino: date | None = None
    status: str = "ATIVO"
    observacoes: str | None = None
    contacts: list[ContactCreate] = []


class ClientUpdate(BaseUpdate):
    razao_social: str | None = None
    nome_fantasia: str | None = None
    cnpj_cpf: str | None = None
    email: str | None = None
    telefone: str | None = None
    endereco: str | None = None
    cidade: str | None = None
    estado: str | None = None
    segmento: str | None = None
    plano_id: uuid.UUID | None = None
    responsavel_bpo: uuid.UUID | None = None
    data_inicio: date | None = None
    data_termino: date | None = None
    status: str | None = None
    observacoes: str | None = None


class ClientOut(ORMModel):
    id: uuid.UUID
    razao_social: str
    nome_fantasia: str | None
    cnpj_cpf: str | None
    email: str | None
    telefone: str | None
    endereco: str | None
    cidade: str | None
    estado: str | None
    segmento: str | None
    plano_id: uuid.UUID | None
    responsavel_bpo: uuid.UUID | None
    data_inicio: date | None
    data_termino: date | None
    status: str
    observacoes: str | None
    created_at: datetime
    updated_at: datetime
    contacts: list[ContactOut] = []
    plan: PlanOut | None = None


# ------------------------------------------------------------------ PROJETOS
class ProjectCreate(BaseCreate):
    client_id: uuid.UUID
    nome: str = Field(min_length=2)
    codigo: str | None = None
    tipo: str | None = None
    responsavel: str | None = None
    data_inicio: date | None = None
    prazo: str | None = None
    data_prevista: date | None = None
    data_conclusao: date | None = None
    orcamento: float = 0
    receita: float = 0
    custo_estimado: float = 0
    custo_realizado: float = 0
    status: str = "PLANEJAMENTO"


class ProjectUpdate(BaseUpdate):
    nome: str | None = None
    codigo: str | None = None
    tipo: str | None = None
    responsavel: str | None = None
    data_inicio: date | None = None
    prazo: str | None = None
    data_prevista: date | None = None
    data_conclusao: date | None = None
    orcamento: float | None = None
    receita: float | None = None
    custo_estimado: float | None = None
    custo_realizado: float | None = None
    status: str | None = None


class ProjectOut(ORMModel):
    id: uuid.UUID
    client_id: uuid.UUID
    nome: str
    codigo: str | None
    tipo: str | None
    responsavel: str | None
    data_inicio: date | None
    prazo: str | None
    data_prevista: date | None
    data_conclusao: date | None
    orcamento: float
    receita: float
    custo_estimado: float
    custo_realizado: float
    status: str
    created_at: datetime
    updated_at: datetime


class ProjectProfitOut(ProjectOut):
    lucro: float = 0
    margem: float = 0
    variacao_custo: float = 0
    client_name: str | None = None
