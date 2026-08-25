"""Testes da extração estruturada de documentos (engine regex)."""
from app.documents.extraction import extract_fields, _normalize_amount


def test_extrai_campos_de_contrato():
    texto = """
    CONTRATO DE PRESTAÇÃO DE SERVIÇOS
    Número: CT-2024-001
    Fornecedor: Ateliê Horizonte Arquitetura
    Data de emissão: 10/11/2024
    Vencimento: 10/09/2025
    Valor total: R$ 60.000,00
    """
    campos = extract_fields(texto)
    assert campos["document_type"] == "CONTRATO"
    assert campos["document_number"] == "CT-2024-001"
    assert campos["supplier"] and "Ateliê" in campos["supplier"]
    assert campos["issue_date"] == "10/11/2024"
    assert campos["due_date"] == "10/09/2025"
    assert campos["amount"] == "60000.00"


def test_normaliza_valores():
    assert _normalize_amount("R$ 1.234,56") == "1234.56"
    assert _normalize_amount("1234,56") == "1234.56"
    assert _normalize_amount("1234.56") == "1234.56"
    assert _normalize_amount("1.234.567,89") == "1234567.89"
