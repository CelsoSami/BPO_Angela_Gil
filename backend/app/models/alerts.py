"""Alertas."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.database.session import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("clients.id"))
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    prioridade: Mapped[str] = mapped_column(String(10), nullable=False, default="MEDIA")
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    mensagem: Mapped[str | None] = mapped_column(Text)
    data: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    responsavel_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ABERTO")
    origem: Mapped[str | None] = mapped_column(String(50))
    registro_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
