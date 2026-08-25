"""Simulações de precificação."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.database.session import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class PricingSimulation(Base):
    __tablename__ = "pricing_simulations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("clients.id"))
    titulo: Mapped[str | None] = mapped_column(String(255))
    servico: Mapped[str] = mapped_column(String(255), nullable=False)
    horas: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    custo_hora: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    equipe: Mapped[list | None] = mapped_column(JSON, default=list)
    despesas: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    impostos_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    margem_desejada_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    prazo_dias: Mapped[int | None] = mapped_column(Integer)
    complexidade: Mapped[str | None] = mapped_column(String(10))
    custo_direto: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    custos_indiretos: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    impostos_valor: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    margem_valor: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    preco_sugerido: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    cenario: Mapped[str] = mapped_column(String(20), nullable=False, default="RECOMENDADO")
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
