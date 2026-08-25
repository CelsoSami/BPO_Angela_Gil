"""Contratos e parcelas."""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.database.session import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    projeto_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("projects.id"))
    numero: Mapped[str] = mapped_column(String(60), nullable=False)
    data: Mapped[date | None] = mapped_column(Date)
    inicio: Mapped[date | None] = mapped_column(Date)
    termino: Mapped[date | None] = mapped_column(Date)
    valor: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    forma_pagamento: Mapped[str | None] = mapped_column(String(120))
    numero_parcelas: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="EM_ANALISE")
    arquivo_documento_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("documents.id")
    )
    responsavel: Mapped[str | None] = mapped_column(String(120))
    observacoes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    installments: Mapped[list["ContractInstallment"]] = relationship(
        back_populates="contract", cascade="all, delete-orphan",
        order_by="ContractInstallment.numero",
    )


class ContractInstallment(Base):
    __tablename__ = "contract_installments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False
    )
    numero: Mapped[int] = mapped_column(Integer, nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
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

    contract: Mapped["Contract"] = relationship(back_populates="installments")
