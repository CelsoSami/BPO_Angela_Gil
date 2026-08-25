"""Smoke test: a aplicação importa e expõe as rotas esperadas."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_rotas_principais_registradas():
    rotas = {route.path for route in app.routes}
    esperadas = [
        "/auth/login",
        "/users",
        "/clients",
        "/plans",
        "/projects",
        "/contracts",
        "/financial/cashflow",
        "/financial/dre",
        "/financial/inadimplencia",
        "/documents",
        "/collections",
        "/alerts",
        "/reports/monthly/generate",
        "/dashboard/overview",
        "/admin/audit",
    ]
    for rota in esperadas:
        assert rota in rotas, f"Rota ausente: {rota}"


def test_login_exige_credenciais():
    r = client.post("/auth/login", json={"username": "x", "password": "y"})
    # Sem DATABASE_URL configurada, o engine não é criado (500 amigável);
    # com banco configurado, espera-se 401 (credenciais inválidas).
    assert r.status_code in (401, 422, 500)
