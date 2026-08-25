"""Helpers de valores monetários."""
from decimal import Decimal, ROUND_HALF_UP


def to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def money(value) -> str:
    """Formata número como moeda brasileira (string)."""
    v = to_decimal(value)
    neg = v < 0
    v = abs(v).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    body = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-R$ {body}" if neg else f"R$ {body}"


def pct(value) -> str:
    v = to_decimal(value)
    return f"{v:.1f}%".replace(".", ",")


def quantize(value) -> Decimal:
    return to_decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
