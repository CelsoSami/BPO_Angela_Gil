"""Helpers de datas."""
from datetime import date, datetime, timedelta


def parse_date(value: str | date | None) -> date | None:
    """Converte string ISO (YYYY-MM-DD) ou date em date."""
    if value is None or isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    return date.fromisoformat(str(value)[:10])


def monday_of_week(ref: date | None = None) -> date:
    """Retorna a segunda-feira da semana de referência."""
    ref = ref or date.today()
    return ref - timedelta(days=ref.weekday())


def month_range(mes: int, ano: int) -> tuple[date, date]:
    """Retorna (primeiro_dia, ultimo_dia) de um mês."""
    first = date(ano, mes, 1)
    if mes == 12:
        nxt = date(ano + 1, 1, 1)
    else:
        nxt = date(ano, mes + 1, 1)
    return first, nxt - timedelta(days=1)


def last_months(mes: int, ano: int, qtd: int) -> list[tuple[int, int]]:
    """Lista os últimos `qtd` meses (mes, ano) terminando em (mes, ano)."""
    out = []
    m, a = mes, ano
    for _ in range(qtd):
        out.append((m, a))
        m -= 1
        if m == 0:
            m, a = 12, a - 1
    return list(reversed(out))
