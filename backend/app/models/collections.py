"""Coleta semanal e itens."""
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.database.session import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class WeeklyCollection(Base):
    __tablename__ = "weekly_collections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id")
    )
    semana: Mapped[date] = mapped_column(Date, nullable=False)
    data_coleta: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="EM_ANDAMENTO")
    observacoes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    items: Mapped[list["CollectionItem"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan",
        order_by="CollectionItem.id",
    )


class CollectionItem(Base):
    __tablename__ = "collection_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    collection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("weekly_collections.id", ondelete="CASCADE"), nullable=False
    )
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(255))
    valor: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    data_item: Mapped[date | None] = mapped_column(Date)
    projeto_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("projects.id"))
    contrato_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("contracts.id"))
    status: Mapped[str | None] = mapped_column(String(30), default="REGISTRADO")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    collection: Mapped["WeeklyCollection"] = relationship(back_populates="items")
