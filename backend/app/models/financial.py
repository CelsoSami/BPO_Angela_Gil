"""Entidades financeiras: categorias, pagar, receber, fluxo de caixa, bancos."""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.database.session import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    dre_line: Mapped[str | None] = mapped_column(String(40))
    cliente_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("clients.id"))
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Payable(Base):
    __tablename__ = "payables"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("clients.id"))
    projeto_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("projects.id"))
    fornecedor: Mapped[str] = mapped_column(String(255), nullable=False)
    categoria_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("categories.id"))
    descricao: Mapped[str | None] = mapped_column(String(255))
    valor: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    vencimento: Mapped[date | None] = mapped_column(Date)
    data_pagamento: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDENTE")
    centro_custo: Mapped[str | None] = mapped_column(String(120))
    documento_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("documents.id"))
    observacoes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Receivable(Base):
    __tablename__ = "receivables"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    projeto_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("projects.id"))
    contrato_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("contracts.id"))
    descricao: Mapped[str | None] = mapped_column(String(255))
    parcela: Mapped[int | None] = mapped_column(Integer)
    valor: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    vencimento: Mapped[date | None] = mapped_column(Date)
    recebimento: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="A_RECEBER")
    juros: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    multa: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    documento_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("documents.id"))
    observacoes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Cashflow(Base):
    __tablename__ = "cashflow"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("clients.id"))
    projeto_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("projects.id"))
    data: Mapped[date] = mapped_column(Date, nullable=False)
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)
    categoria_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("categories.id"))
    valor: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    descricao: Mapped[str | None] = mapped_column(String(255))
    forma_pagamento: Mapped[str | None] = mapped_column(String(60))
    conciliado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    origem: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    origem_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    conta: Mapped[str | None] = mapped_column(String(120))
    data_movimento: Mapped[date] = mapped_column(Date, nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(255))
    valor: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    tipo: Mapped[str | None] = mapped_column(String(10))
    status_conciliacao: Mapped[str] = mapped_column(
        String(20), nullable=False, default="PENDENTE"
    )
    cashflow_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("cashflow.id"))
    documento_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("documents.id"))
    importado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
