"""Testes do cálculo de precificação (3 cenários)."""
from decimal import Decimal

from app.services.precificacao import calculate


def test_tres_cenarios():
    payload = {
        "servico": "Projeto Arquitetônico",
        "horas": 100,
        "custo_hora": 100,
        "equipe": [{"funcao": "Sênior", "horas": 50, "custo_hora": 120}],
        "despesas": 1000,
        "impostos_pct": 8,
        "margem_desejada_pct": 30,
    }
    cenarios = calculate(payload)
    assert [c["cenario"] for c in cenarios] == ["CONSERVADOR", "RECOMENDADO", "AGRESSIVO"]

    # custo direto = 100*100 + 50*120 + 1000 = 16.600
    assert cenarios[0]["custo_direto"] == 16600.0
    # indiretos = 20% = 3.320
    assert cenarios[0]["custos_indiretos"] == 3320.0

    for c in cenarios:
        preco = Decimal(str(c["preco_sugerido"]))
        # preço > base (custo direto + indiretos)
        assert preco > Decimal("19920")
        # consistência: preco - impostos - margem = base
        base = Decimal(str(c["custo_direto"])) + Decimal(str(c["custos_indiretos"]))
        resto = preco - Decimal(str(c["impostos_valor"])) - Decimal(str(c["margem_valor"]))
        assert abs(resto - base) < Decimal("0.01")

    # Agressivo (margem 37,5%) deve sugerir preço maior que Conservador (22,5%)
    assert cenarios[2]["preco_sugerido"] > cenarios[0]["preco_sugerido"]
