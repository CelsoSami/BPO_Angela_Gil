"""Precificação de projetos/serviços com três cenários."""
from decimal import Decimal

INDIRETOS_PCT = Decimal("0.20")  # % de custos indiretos sobre custo direto


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


def _calc(custo_direto, custos_indiretos, impostos_pct, margem_pct) -> dict:
    base = custo_direto + custos_indiretos
    taxa = (impostos_pct + margem_pct) / Decimal("100")
    if taxa >= 1:
        taxa = Decimal("0.90")
    preco = base / (Decimal("1") - taxa)
    return {
        "custo_direto": float(custo_direto),
        "custos_indiretos": float(custos_indiretos),
        "impostos_valor": float(preco * impostos_pct / Decimal("100")),
        "margem_valor": float(preco * margem_pct / Decimal("100")),
        "preco_sugerido": float(preco),
    }


def calculate(payload) -> list[dict]:
    """Calcula os três cenários (Conservador, Recomendado, Agressivo)."""
    horas = _dec(payload.get("horas"))
    custo_hora = _dec(payload.get("custo_hora"))
    despesas = _dec(payload.get("despesas"))
    impostos_pct = _dec(payload.get("impostos_pct"))
    margem_pct = _dec(payload.get("margem_desejada_pct"))
    equipe = payload.get("equipe") or []

    mao_obra = horas * custo_hora
    for membro in equipe:
        mao_obra += _dec(membro.get("horas")) * _dec(membro.get("custo_hora"))

    custo_direto = mao_obra + despesas
    custos_indiretos = custo_direto * INDIRETOS_PCT

    cenarios = {
        "CONSERVADOR": margem_pct * Decimal("0.75"),
        "RECOMENDADO": margem_pct,
        "AGRESSIVO": margem_pct * Decimal("1.25"),
    }
    result = []
    for nome, margem in cenarios.items():
        r = _calc(custo_direto, custos_indiretos, impostos_pct, margem)
        r["cenario"] = nome
        result.append(r)
    return result
