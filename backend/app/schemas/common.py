"""Base comum dos schemas."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def empty_to_none(v: Any) -> Any:
    if isinstance(v, str) and v.strip() == "":
        return None
    return v


class BaseCreate(ORMModel):
    @field_validator("*", mode="before")
    @classmethod
    def _empty_to_none(cls, v):
        return empty_to_none(v)


class BaseUpdate(BaseCreate):
    pass


class MessageOut(BaseModel):
    message: str
    ok: bool = True


class Paginated(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[Any]
