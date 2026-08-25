# BUILD FLOW BPO — Fase 1

Plataforma profissional para **BPO financeiro e administrativo** de escritórios de
**Arquitetura, Engenharia e Design de Interiores** (e escritórios multidisciplinares
relacionados a projetos e serviços técnicos).

Fluxo central: **CADASTRO → COLETA → DOCUMENTOS → ORGANIZAÇÃO → CONTROLE
FINANCEIRO → INDICADORES → RELATÓRIOS → ACOMPANHAMENTO**

> A **Inteligência Artificial não faz parte da Fase 1**. A arquitetura foi
> construída de forma modular (pasta `backend/app/ai/` reservada) para que a
> **Fase 2 — Build Flow Intelligence** adicione diagnóstico, estratégias,
> precificação inteligente e benchmarking **sem reconstrução do sistema**.

---

## 1. Requisitos

| Componente | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript moderno (SPA, módulos), Chart.js, SVG |
| Backend | Python 3.10+, FastAPI, SQLAlchemy 2.0 |
| Banco | Supabase (PostgreSQL 15+) |
| Segurança | Argon2id (hash de senha), sessões com expiração, CORS, rate limiting |

Bibliotecas Python (ver `backend/requirements.txt`): fastapi, uvicorn, sqlalchemy,
psycopg2-binary, pydantic, pydantic-settings, argon2-cffi, slowapi, pypdf,
openpyxl, reportlab, python-multipart.

---

## 2. Instalação

```bash
# 1. Clone/extraia o projeto
cd build-flow

# 2. Backend — ambiente virtual
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt

# 3. Variáveis de ambiente
copy ..\.env.example ..\.env     # Windows
# cp ../.env.example ../.env     # Linux/macOS
```

---

## 3. Configuração do Supabase

1. Crie um projeto no painel do Supabase (ou use o existente).
2. Em **Project Settings → Database**, copie a **Connection string** (PostgreSQL)
   e a senha do banco — ela vai em `DATABASE_URL` no `.env`.
3. Em **Project Settings → API**, copie a **publishable/anon key** para
   `SUPABASE_ANON_KEY` (referência; o backend usa `DATABASE_URL`).
4. **(Segurança)** Nunca coloque `SERVICE_ROLE_KEY` ou a senha do Postgres em
   código ou no frontend. Elas vivem apenas no servidor / `.env`.

---

## 4. Configuração do PostgreSQL (tabelas)

Abra o **SQL Editor** do Supabase e execute `database/schema.sql` (cria todas as
tabelas, índices, CHECKs e o trigger de `updated_at`).

> Nota sobre RLS: a Fase 1 usa autenticação própria no backend, que é o único
> gateway de acesso ao banco. As tabelas não habilitam Row Level Security por
> padrão. Para produção avançada, pode-se habilitar RLS por role do banco.

---

## 5. Variáveis de ambiente (`.env`)

```dotenv
DATABASE_URL=postgresql://postgres:SUA_SENHA@db.<ref>.supabase.co:5432/postgres
SECRET_KEY=<64 caracteres hex aleatórios>
SESSION_EXPIRE_MINUTES=720
PASSWORD_HASH_ALGORITHM=argon2id
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<defina na implantação>
STORAGE_BACKEND=local
UPLOAD_DIR=./uploads
CORS_ORIGINS=*
```

Gere a `SECRET_KEY` com: `python -c "import secrets; print(secrets.token_hex(32))"`
(não é usada para JWT — as sessões ficam no banco com token aleatório).

---

## 6. Criação do banco (ordem correta)

```bash
# 1) Tabelas — execute database/schema.sql no SQL Editor do Supabase
#    ou (se preferir via backend):  cd backend && python -m app.cli health

# 2) Criar o primeiro administrador (recomendado — não há cadastro público)
cd backend
python -m app.cli create-admin
# Usa ADMIN_USERNAME/ADMIN_PASSWORD do .env (ou pergunta interativamente).

# 3) Dados demonstrativos (opcional, 100% fictícios)
python -m app.cli seed-demo
# ou execute database/seed.sql no SQL Editor (não depende do admin).
```

Outros comandos CLI: `python -m app.cli create-user` e `python -m app.cli health`.

---

## 7. Execução do backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

- API + docs interativas: <http://localhost:8000/docs>
- Frontend: <http://localhost:8000> (servido pelo próprio FastAPI)
- Health check: <http://localhost:8000/api/health>

O primeiro admin pode também ser criado automaticamente na inicialização se
`ADMIN_PASSWORD` estiver definido no `.env` e a tabela de usuários estiver vazia.

---

## 8. Execução do frontend

O frontend é estático e servido pelo backend (sem build). Em desenvolvimento,
basta abrir <http://localhost:8000> — nenhum passo extra.

Estrutura:

```text
frontend/
├── index.html            # shell (login + aplicação)
├── assets/
│   ├── css/app.css       # design system (dark/light, water glass)
│   └── js/
│       ├── api.js        # cliente HTTP (Bearer, erros amigáveis)
│       ├── ui.js         # componentes (tabelas, modais, toasts, badges…)
│       ├── charts.js     # Chart.js com cores do tema
│       ├── app.js        # bootstrap, roteador (hash), menu, tema, login
│       └── pages/        # um módulo por área (dashboard, clients, financial…)
```

O Chart.js é carregado via CDN; para intranet sem internet, baixe
`chart.umd.min.js` e troque o `<script>` no `index.html`.

---

## 9. Primeiro acesso

1. `python -m app.cli create-admin` (cria `admin`).
2. Entre em <http://localhost:8000> com o usuário/senha definidos.
3. Altere a senha em **Configurações → Minhas credenciais**.
4. Crie os demais usuários (perfis: `ADMIN`, `GERENTE`, `AUXILIAR`, `CONSULTOR`)
   em **Administração → Usuários** (somente ADMIN).

Perfis e permissões:

| Perfil | Acesso |
|---|---|
| ADMIN | Tudo + usuários, planos, configurações, auditoria |
| GERENTE | Gestão completa de clientes/financeiro/projetos/relatórios; exclui registros |
| AUXILIAR | Lançamentos, coleta semanal, documentos, alertas (não exclui) |
| CONSULTOR | Leitura de dashboards, indicadores, relatórios e clientes |

---

## 10. Publicação (deploy)

> **Recomendado: Render (grátis) + Supabase.** O GitHub Pages NÃO serve esta
> aplicação (é estático — não roda Python nem banco). O frontend é servido pelo
> próprio FastAPI, então basta publicar o backend.

### Opção A — Render (passo a passo para iniciantes)

**1. Suba o código para o GitHub primeiro** (o Render publica a partir do GitHub):

```bash
cd build-flow
git init
git add .
git commit -m "Build Flow BPO — Fase 1"
# crie um repositório vazio em github.com (ex.: build-flow-bpo) e então:
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/build-flow-bpo.git
git push -u origin main
```

> O `.gitignore` já impede o envio do `.env` — segredos nunca vão para o GitHub.

**2. Prepare o banco no Supabase** (painel do projeto `dummxpzffyeofphxbbzg`):
- **SQL Editor** → execute o conteúdo de `database/schema.sql`;
- (opcional) execute `database/seed.sql` para dados demonstrativos;
- **Project Settings → Database → Connection string** → copie a URI e a **senha real**
  do Postgres (crie uma em "Database Password" se ainda não tiver).

**3. Crie o serviço no Render** (você já está logado):
- **New → Blueprint** → conecte seu GitHub → escolha o repositório.
- O Render lê o `render.yaml` já incluído no projeto (Python 3.12 fixado,
  `rootDir: backend`, build/start commands prontos) e cria o serviço automaticamente.

> **Por que Python 3.12?** O padrão do Render (3.14) não tem binários
> pré-compilados para `psycopg2-binary` e `pydantic-core`; a compilação a partir
> do código-fonte falha no ambiente de build. O `render.yaml` fixa
> `PYTHON_VERSION=3.12.7`. Se já criou o serviço, adicione essa variável em
> **Environment** e clique em **Deploy** (ou **Manual Deploy → Deploy latest commit**).

**4. Preencha as variáveis de ambiente** no painel do serviço → **Environment**:
- `DATABASE_URL` = `postgresql://postgres:SUA_SENHA_REAL@db.dummxpzffyeofphxbbzg.supabase.co:5432/postgres`
- `ADMIN_PASSWORD` = senha inicial do admin (mín. 8 caracteres)
- (`SECRET_KEY` é gerada automaticamente; `CORS_ORIGINS=*` em homologação)

**5. Nada de Shell (que é pago):** no **primeiro boot**, o próprio aplicativo:
- cria o administrador usando `ADMIN_USERNAME`/`ADMIN_PASSWORD`; e
- popula os dados demonstrativos (porque `SEED_DEMO_ON_STARTUP=true`).

Ou seja: **defina as variáveis → deploy → abra o app → login**.
O Shell só seria necessário para manutenção avançada (e não é).

**6. Abra o app**: `https://build-flow-bpo.onrender.com` e entre com
`admin` + a senha definida. (No plano free, o serviço "dorme" após ~15 min de
inatividade e o primeiro acesso demora ~50 s para acordar.)

### Backup gratuito — Hugging Face Spaces (Docker)

Se o Render não funcionar, o mesmo código sobe no **Hugging Face Spaces**
(plano free) em poucos minutos, usando o `Dockerfile` da raiz:

1. Crie um Space: **New Space** → nome → **SDK: Docker** → **Public**.
2. Em **Settings → Variables and secrets**, adicione as mesmas variáveis
   (`DATABASE_URL`, `ADMIN_PASSWORD`, `SEED_DEMO_ON_STARTUP=true`, …).
3. Faça push do repositório para o Space. URL: `https://huggingface.co/spaces/SEU_USUARIO/NOME`.
4. O espaço roda o `Dockerfile` automaticamente (a porta é lida de `$PORT=7860`).

### Opção A2 — Render / Railway / Fly.io (manual, sem blueprint)

1. Build command: `pip install -r requirements.txt` (root dir `backend`)
2. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Configure as variáveis de ambiente do `.env` no painel (incluindo `DATABASE_URL`).
4. Crie o admin uma vez: `python -m app.cli create-admin`.
5. Adicione um domínio customizado e ative HTTPS.

### Opção A3 — Render Postgres free (tudo gratuito, sem SQL Editor)

Se o Supabase estiver com restrição de IPv6 (host `db.*.supabase.co` resolve só para
IPv6 e o Render não tem rota IPv6 → "Network is unreachable"), use o banco gratuito
**do próprio Render** — mesma rede, sem esse problema:

1. Render → **New → PostgreSQL** → plano **Free** (1 GB; expira em 30 dias — ideal
   para apresentação/MVP).
2. Copie a **Internal Database URL** do painel do Postgres.
3. No Web Service → **Environment**, ajuste:
   - `DATABASE_URL` = a URL interna do passo 2;
   - `SETUP_SCHEMA_ON_STARTUP` = `true` (cria as tabelas no 1º boot);
   - `SEED_DEMO_ON_STARTUP` = `true` (popula dados demonstrativos);
   - `ADMIN_PASSWORD` = senha inicial.
4. **Manual Deploy → Deploy latest commit** — no boot o app cria tabelas + admin +
   dados de demonstração sozinho. Login com `admin` + a senha definida.

> O Supabase **gratuito também tem o Session Pooler** (host
> `aws-0-<região>.pooler.supabase.com`, IPv4) — o requisito "IPv4 = Pro" vale só
> para a **conexão direta**. Tente o pooler antes de trocar de banco.

### Opção B — VPS / Docker

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend ./backend
COPY frontend ./frontend
COPY database ./database
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`docker build -t build-flow . && docker run -p 8000:8000 --env-file .env build-flow`

---

## 11. Manutenção

- **Backup**: o Supabase oferece backups automáticos (Project Settings → Database Backups).
- **Logs**: os erros técnicos ficam nos logs do backend; a interface nunca expõe
  traceback/SQL (mensagens amigáveis).
- **Auditoria**: toda operação relevante fica em `audit_logs` (quem, o quê, quando, IP).
- **Uploads**: `STORAGE_BACKEND=local` salva em `UPLOAD_DIR` (fora do repositório).
  A integração com **Supabase Storage** (bucket privado + URLs assinadas) está
  preparada em `backend/app/documents/storage.py` (`_save_supabase`).
- **Extração de documentos**: engine `regex` (Fase 1). A interface de extração
  (`extract_fields`) permite plugar OCR/LLM na Fase 2 sem mudar o restante.
- **IA (Fase 2)**: a estrutura `backend/app/ai/{services,prompts,models,providers}`
  está reservada e **desativada** nesta fase.

---

## 12. Estrutura do projeto

```text
build-flow/
├── frontend/                  # SPA (HTML/CSS/JS)
│   ├── index.html
│   └── assets/{css,js}/       # design system + módulos + pages
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI (API + frontend estático + uploads)
│   │   ├── config.py          # settings (.env)
│   │   ├── cli.py             # create-admin, create-user, seed-demo, health
│   │   ├── database/          # engine/sessão SQLAlchemy
│   │   ├── models/            # ORM (27 entidades)
│   │   ├── schemas/           # Pydantic (entrada/saída)
│   │   ├── routers/           # API (auth, users, clients, financial, …)
│   │   ├── services/          # regras de negócio (DRE, inadimplência, …)
│   │   ├── documents/         # storage + extração estruturada
│   │   ├── security/          # hash, sessões, autorização, rate limit
│   │   ├── utils/             # datas, moeda
│   │   └── ai/                # reservado para a Fase 2 (desativado)
│   ├── tests/                 # testes unitários (pytest)
│   └── requirements.txt
├── database/
│   ├── schema.sql             # tabelas, índices, triggers
│   ├── seed.sql               # dados demonstrativos (fictícios)
│   └── migrations/            # (evoluções futuras do schema)
├── .env.example
└── README.md
```

---

## Funcionalidades da Fase 1

- **Autenticação** segura (Argon2id, sessões expiráveis, rate limit no login).
- **Clientes 360°**: resumo, financeiro, projetos, contratos, documentos,
  indicadores, relatórios e histórico.
- **Planos** Essencial / Flow / Pro (estrutura `plans` + `plan_features` extensível).
- **Financeiro**: fluxo de caixa (diário/semanal/mensal + projeção), contas a
  pagar/receber (com baixa automática no caixa), conciliação bancária (import CSV),
  DRE gerencial (realizado × orçado), inadimplência (faixas + ranking), categorias.
- **Projetos**: cadastro, custos, receitas, rentabilidade (lucro/margem/variação),
  rankings, simulação de **precificação** em 3 cenários.
- **Contratos**: parcelas automáticas, baixa, alertas de vencimento.
- **Documentos**: upload (PDF/XLSX/CSV/imagem), extração estruturada (regex),
  validação humana campo a campo, download.
- **Coleta semanal**: checklist por cliente (contratos, gastos, financeiro,
  documentação) com pendências.
- **Indicadores e dashboards**: KPIs executivos, receita × despesa, inadimplência,
  rentabilidade, alertas automáticos por regras objetivas.
- **Saúde financeira** (Saudável/Atenção/Crítico) por regras configuráveis (sem IA).
- **Relatórios gerenciais mensais** (13 seções) com exportação **PDF, Excel e CSV**.
- **Administração**: usuários/perfis, planos, ativos, processos, plano de
  acompanhamento, auditoria, configurações.
- **UI**: dark/light sem reload, Water Glass com moderação, tabelas com
  busca/filtros/ordenação/paginação, microinterações funcionais.

---

## Segurança (resumo)

- Senhas com **Argon2id** (fallback bcrypt); nunca em texto puro.
- Sessões com token aleatório no banco + expiração configurável.
- `SECRET_KEY`, `DATABASE_URL` e chaves do Supabase **nunca** no frontend.
- Validação de entrada (Pydantic), proteção contra SQL Injection (SQLAlchemy),
  XSS (escape no frontend), MIME/size limit no upload, CORS e rate limiting.
- Erros amigáveis na interface; detalhes técnicos apenas nos logs.
