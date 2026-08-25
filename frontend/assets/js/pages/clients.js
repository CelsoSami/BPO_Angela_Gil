/* ============================================================================
   Build Flow BPO — Clientes (lista, formulário, Cliente 360°, planos)
   ============================================================================ */
(() => {
  "use strict";
  window.Pages = window.Pages || {};

  const STATUS_CLIENTE = [
    ["EM_IMPLANTACAO", "Em implantação"], ["ATIVO", "Ativo"],
    ["SUSPENSO", "Suspenso"], ["ENCERRADO", "Encerrado"],
  ];
  const SEGMENTOS = [
    ["ARQUITETURA", "Arquitetura"], ["ENGENHARIA", "Engenharia"],
    ["DESIGN_INTERIORES", "Design de Interiores"], ["MULTIDISCIPLINAR", "Multidisciplinar"],
    ["OUTRO", "Outro"],
  ];

  async function loadPlans() {
    return API.get("/plans");
  }

  /* =============================== LISTA ================================== */
  async function list(container) {
    UI.pageLoader(container);
    let state = { page: 1, search: "", status: "", plano: "" };
    const plans = await loadPlans();

    async function render() {
      const data = await API.get("/clients", {
        page: state.page, page_size: 12, search: state.search,
        status: state.status, plano: state.plano,
      });
      container.innerHTML = `
        <div class="page-head">
          <div>
            <div class="page-title">Clientes</div>
            <div class="page-sub">Escritórios sob gestão do BPO · ${data.total} registros</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" data-go="#/clients/new">${UI.icon("plus")} Novo cliente</button>
            <button class="btn btn-ghost" data-go="#/plans">${UI.icon("tag")} Planos</button>
          </div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Buscar</span><input id="f-search" placeholder="Razão social, CNPJ, e-mail…" value="${UI.esc(state.search)}" /></label>
          <label class="field"><span>Status</span><select id="f-status"><option value="">Todos</option>${STATUS_CLIENTE.map(([v, l]) => `<option value="${v}" ${state.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="field"><span>Plano</span><select id="f-plano"><option value="">Todos</option>${plans.map((p) => `<option value="${UI.esc(p.codigo)}" ${state.plano === p.codigo ? "selected" : ""}>${UI.esc(p.nome)}</option>`).join("")}</select></label>
        </div>
        <div id="tabela"></div>
        <div id="pag"></div>`;

      document.getElementById("f-search").addEventListener("input", (e) => { state.search = e.target.value; state.page = 1; render(); });
      document.getElementById("f-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(); });
      document.getElementById("f-plano").addEventListener("change", (e) => { state.plano = e.target.value; state.page = 1; render(); });

      const tabela = document.getElementById("tabela");
      if (!data.items.length) {
        tabela.innerHTML = UI.emptyState("Nenhum cliente encontrado. Cadastre o primeiro escritório.", "building");
      } else {
        tabela.innerHTML = UI.table({
          columns: [
            { label: "Escritório", render: (c) => `<strong>${UI.esc(c.nome_fantasia || c.razao_social)}</strong><div class="muted" style="font-size:11px">${UI.esc(c.razao_social)} · ${UI.esc(c.cnpj_cpf || "—")}</div>` },
            { label: "Segmento", render: (c) => UI.esc((SEGMENTOS.find((s) => s[0] === c.segmento) || [c.segmento, c.segmento || "—"])[1]) },
            { label: "Plano", render: (c) => (c.plan ? `<span class="badge blue">${UI.esc(c.plan.nome)}</span>` : "—") },
            { label: "Cidade", key: "cidade" },
            { label: "Status", render: (c) => UI.badge(c.status) },
            { label: "", align: "right", render: (c) => `<button class="btn btn-ghost btn-sm" data-open="${c.id}">Abrir</button>` },
          ],
          rows: data.items,
        });
        tabela.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => (location.hash = `#/clients/${b.dataset.open}`)));
      }

      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 12, total: data.total, onChange: (p) => { state.page = p; render(); } });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
      container.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => (location.hash = b.dataset.go)));
    }
    await render();
  }

  /* ============================ NOVO CLIENTE ============================== */
  async function newClient(container) {
    const plans = await loadPlans();
    container.innerHTML = `
      <div class="page-head">
        <div><div class="page-title">Novo cliente</div><div class="page-sub">Cadastro do escritório e plano contratado.</div></div>
        <div class="page-actions"><button class="btn btn-ghost" data-go="#/clients">${UI.icon("arrow")} Voltar</button></div>
      </div>
      <div class="card" style="max-width:860px">
        <form id="form-cliente">
          <div class="section-title">Dados do escritório</div>
          <div class="field-row">
            ${UI.field({ label: "Razão social", name: "razao_social", required: true, placeholder: "Nome da empresa Ltda" })}
            ${UI.field({ label: "Nome fantasia", name: "nome_fantasia" })}
          </div>
          <div class="field-row-3">
            ${UI.field({ label: "CNPJ/CPF", name: "cnpj_cpf", placeholder: "00.000.000/0000-00" })}
            ${UI.field({ label: "E-mail", name: "email", type: "email" })}
            ${UI.field({ label: "Telefone", name: "telefone" })}
          </div>
          <div class="field-row-3">
            ${UI.field({ label: "Endereço", name: "endereco" })}
            ${UI.field({ label: "Cidade", name: "cidade" })}
            ${UI.field({ label: "Estado", name: "estado", placeholder: "UF" })}
          </div>
          <div class="field-row-3">
            ${UI.field({ label: "Segmento", name: "segmento", type: "select", options: SEGMENTOS })}
            ${UI.field({ label: "Plano contratado", name: "plano_id", type: "select", options: plans.map((p) => [p.id, `${p.nome} — ${UI.money(p.preco_mensal)}/mês`]) })}
            ${UI.field({ label: "Status", name: "status", type: "select", options: STATUS_CLIENTE })}
          </div>
          <div class="field-row">
            ${UI.field({ label: "Data de início", name: "data_inicio", type: "date" })}
            ${UI.field({ label: "Data de término", name: "data_termino", type: "date" })}
          </div>
          <div class="section-title">Contato principal</div>
          <div class="field-row-3">
            ${UI.field({ label: "Nome", name: "contact_nome" })}
            ${UI.field({ label: "Cargo", name: "contact_cargo" })}
            ${UI.field({ label: "Telefone", name: "contact_telefone" })}
          </div>
          <label class="field"><span>Observações</span><textarea name="observacoes" rows="3"></textarea></label>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost" data-go="#/clients">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar cliente</button>
          </div>
        </form>
      </div>`;

    container.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => (location.hash = b.dataset.go)));

    document.getElementById("form-cliente").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = UI.formData(e.target);
      const payload = {
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia,
        cnpj_cpf: data.cnpj_cpf,
        email: data.email,
        telefone: data.telefone,
        endereco: data.endereco,
        cidade: data.cidade,
        estado: data.estado,
        segmento: data.segmento,
        plano_id: data.plano_id,
        data_inicio: data.data_inicio,
        data_termino: data.data_termino,
        status: data.status || "ATIVO",
        observacoes: data.observacoes,
        contacts: data.contact_nome ? [{ nome: data.contact_nome, cargo: data.contact_cargo, telefone: data.contact_telefone, principal: true }] : [],
      };
      try {
        const cli = await API.post("/clients", payload);
        UI.toast("Cliente cadastrado com sucesso.", "success");
        location.hash = `#/clients/${cli.id}`;
      } catch (err) { UI.toast(err.message, "error"); }
    });
  }

  /* ============================ CLIENTE 360° ============================== */
  const TABS = [
    ["resumo", "Resumo"], ["financeiro", "Financeiro"], ["projetos", "Projetos"],
    ["contratos", "Contratos"], ["documentos", "Documentos"], ["indicadores", "Indicadores"],
    ["relatorios", "Relatórios"], ["historico", "Histórico"],
  ];

  async function detail(container, { id }) {
    UI.pageLoader(container);
    let aba = "resumo";
    const dash = await API.get(`/dashboard/client/${id}`);
    const cli = dash.cliente;
    const user = JSON.parse(localStorage.getItem("bf_user") || "{}");

    async function render() {
      container.innerHTML = `
        <div class="client-hero">
          <div class="avatar avatar-lg" style="font-size:22px">${UI.esc((cli.nome || "?").charAt(0))}</div>
          <div style="flex:1">
            <div class="page-title" style="font-size:19px">${UI.esc(cli.nome)}</div>
            <div class="page-sub" style="margin-top:4px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              ${UI.badge(cli.status)} ${cli.plano ? `<span class="badge blue">Plano ${UI.esc(cli.plano)}</span>` : ""}
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost" data-edit-client>${UI.icon("edit")} Editar</button>
            <button class="btn btn-ghost" data-go="#/clients">${UI.icon("arrow")} Clientes</button>
          </div>
        </div>
        <div class="tabs">
          ${TABS.map(([k, l]) => `<button class="tab ${aba === k ? "active" : ""}" data-tab="${k}">${l}</button>`).join("")}
        </div>
        <div id="tab-body"></div>`;

      container.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { aba = b.dataset.tab; render(); }));
      container.querySelector("[data-edit-client]").addEventListener("click", () => openEditClient(cli.id));
      container.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => (location.hash = b.dataset.go)));

      const body = container.querySelector("#tab-body");
      const handlers = {
        resumo: () => tabResumo(body),
        financeiro: () => tabFinanceiro(body),
        projetos: () => tabProjetos(body),
        contratos: () => tabContratos(body),
        documentos: () => tabDocumentos(body),
        indicadores: () => tabIndicadores(body),
        relatorios: () => tabRelatorios(body),
        historico: () => tabHistorico(body),
      };
      await handlers[aba]();
    }

    /* ---- Resumo ---- */
    async function tabResumo(body) {
      const k = dash.kpis;
      body.innerHTML = `
        <div class="kpi-grid">
          ${UI.kpi({ label: "Receita", value: UI.money(k.receita), iconName: "receive", tone: "positive" })}
          ${UI.kpi({ label: "Despesas", value: UI.money(k.despesas), iconName: "pay", tone: "negative" })}
          ${UI.kpi({ label: "Resultado", value: UI.money(k.resultado), iconName: "trendUp", tone: k.resultado >= 0 ? "positive" : "negative", sub: `Margem ${UI.pct(k.margem)}` })}
          ${UI.kpi({ label: "A receber", value: UI.money(k.a_receber), iconName: "receive", sub: `${UI.money(k.atrasado)} em atraso` })}
          ${UI.kpi({ label: "Projetos ativos", value: k.projetos_ativos, iconName: "box", sub: `${k.projetos_concluidos} concluídos` })}
          ${UI.kpi({ label: "Contratos ativos", value: k.contratos_ativos, iconName: "doc", sub: `${k.contratos_proximos_vencimento} próximos do vencimento` })}
          ${UI.kpi({ label: "Documentos", value: k.total_documentos, iconName: "doc", sub: `${k.documentos_pendentes} pendentes` })}
          ${UI.kpi({ label: "Saúde financeira", value: k.saude_financeira ? `<span class="health-pill ${(k.saude_financeira.classificacao || "").toLowerCase()}">${UI.esc(k.saude_financeira.classificacao)}</span>` : "—", iconName: "target", sub: k.saude_financeira ? `Score ${k.saude_financeira.score}/100` : "Classifique no mês" })}
        </div>
        <div class="grid-2-1">
          <div class="card">
            <div class="card-header"><div><div class="card-title">Tendência de fluxo de caixa</div></div></div>
            <div class="chart-box"><canvas id="c-trend"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><div><div class="card-title">Inadimplência por faixa</div></div></div>
            <div class="chart-box sm"><canvas id="c-inad"></canvas></div>
          </div>
        </div>`;
      const p = Charts.palette();
      const t = dash.tendencia || [];
      Charts.bar("c-trend", t.map((r) => r.mes), [
        { label: "Entradas", data: t.map((r) => r.entradas), backgroundColor: p.accent },
        { label: "Saídas", data: t.map((r) => r.saidas), backgroundColor: p.danger },
      ]);
      const faixas = (dash.inadimplencia.faixas || []);
      Charts.doughnut("c-inad", faixas.map((f) => f.faixa), faixas.map((f) => f.valor), [p.accent, p.warning, p.danger, "#7C3AED", p.accent2]);
    }

    /* ---- Financeiro ---- */
    async function tabFinanceiro(body) {
      UI.pageLoader(body);
      const [fc, receber, pagar, dre] = await Promise.all([
        API.get("/financial/cashflow", { client_id: id, page_size: 6 }),
        API.get("/financial/receivables", { client_id: id, page_size: 6, status: "A_RECEBER" }),
        API.get("/financial/payables", { client_id: id, page_size: 6, status: "PENDENTE" }),
        API.get("/financial/dre", { client_id: id }),
      ]);
      const d = dre.atual;
      body.innerHTML = `
        <div class="kpi-grid">
          ${UI.kpi({ label: "Receita bruta (mês)", value: UI.money(d.receita_bruta), iconName: "receive", tone: "positive" })}
          ${UI.kpi({ label: "Resultado líquido (mês)", value: UI.money(d.resultado_liquido), iconName: "trendUp", tone: d.resultado_liquido >= 0 ? "positive" : "negative" })}
          ${UI.kpi({ label: "Margem de contribuição", value: UI.pct(d.receita_bruta ? (d.margem_contribuicao / d.receita_bruta) * 100 : 0), iconName: "chart" })}
          ${UI.kpi({ label: "Saldo do mês", value: UI.money(fc.items.reduce((s, x) => s + (x.tipo === "entrada" ? Number(x.valor) : -Number(x.valor)), 0)), iconName: "wallet" })}
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div><div class="card-title">Últimos lançamentos</div></div><a href="#/financial/cashflow" class="muted">ver tudo →</a></div>
            <div id="fc-mini"></div>
          </div>
          <div class="card">
            <div class="card-header"><div><div class="card-title">DRE do mês</div></div></div>
            <div id="dre-mini"></div>
          </div>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div><div class="card-title">A receber (aberto)</div></div><a href="#/financial/receivables" class="muted">ver tudo →</a></div>
            <div id="rec-mini"></div>
          </div>
          <div class="card">
            <div class="card-header"><div><div class="card-title">A pagar (pendente)</div></div><a href="#/financial/payables" class="muted">ver tudo →</a></div>
            <div id="pag-mini"></div>
          </div>
        </div>`;

      const miniFC = document.getElementById("fc-mini");
      miniFC.innerHTML = fc.items.length ? fc.items.slice(0, 6).map((x) => `
        <div class="alert-item" style="padding:9px 12px">
          <div class="alert-icon" style="background:${x.tipo === "entrada" ? "rgba(34,197,94,.14)" : "rgba(239,68,68,.14)"};color:${x.tipo === "entrada" ? "var(--success)" : "var(--danger)"}">${UI.icon(x.tipo === "entrada" ? "receive" : "pay")}</div>
          <div style="flex:1"><div class="alert-title" style="font-size:12.5px">${UI.esc(x.descricao || "Lançamento")}</div><div class="alert-msg">${UI.date(x.data)}</div></div>
          <strong class="${x.tipo === "entrada" ? "positive" : "negative"}">${x.tipo === "entrada" ? "+" : "−"}${UI.money(x.valor)}</strong>
        </div>`).join("") : UI.emptyState("Sem lançamentos.", "wallet");

      const dreLinhas = [
        ["Receita Bruta", d.receita_bruta], ["(−) Impostos", d.impostos], ["= Receita Líquida", d.receita_liquida],
        ["(−) Custos Diretos", d.custos_diretos], ["= Margem de Contribuição", d.margem_contribuicao],
        ["(−) Despesas Operacionais", d.despesas_operacionais], ["= Resultado Operacional", d.resultado_operacional],
        ["(−) Despesas Financeiras", d.despesas_financeiras], ["= Resultado Líquido", d.resultado_liquido],
      ];
      document.getElementById("dre-mini").innerHTML = UI.table({
        columns: [
          { label: "Conta", key: "nome", render: (r) => `<span class="${r.bold ? "strong" : ""}">${UI.esc(r.nome)}</span>` },
          { label: "Valor", align: "right", render: (r) => `<span class="${r.bold ? "strong" : ""}">${UI.money(r.valor)}</span>` },
        ],
        rows: dreLinhas.map(([nome, valor], i) => ({ nome, valor: Number(valor), bold: nome.startsWith("=") })),
      });

      const recMini = document.getElementById("rec-mini");
      recMini.innerHTML = receber.items.length ? UI.table({
        columns: [
          { label: "Descrição", render: (r) => UI.esc(r.descricao || "—") },
          { label: "Venc.", render: (r) => UI.date(r.vencimento) },
          { label: "Valor", align: "right", render: (r) => UI.money(r.valor) },
          { label: "", align: "right", render: (r) => `<button class="btn btn-success btn-sm" data-rec="${r.id}">Receber</button>` },
        ],
        rows: receber.items,
      }) : UI.emptyState("Nada a receber.", "receive");
      recMini.querySelectorAll("[data-rec]").forEach((b) => b.addEventListener("click", async () => {
        try { await API.post(`/financial/receivables/${b.dataset.rec}/receive`, {}); UI.toast("Recebimento registrado.", "success"); render(); }
        catch (e) { UI.toast(e.message, "error"); }
      }));

      const pagMini = document.getElementById("pag-mini");
      pagMini.innerHTML = pagar.items.length ? UI.table({
        columns: [
          { label: "Fornecedor", key: "fornecedor" },
          { label: "Venc.", render: (r) => UI.date(r.vencimento) },
          { label: "Valor", align: "right", render: (r) => UI.money(r.valor) },
          { label: "", align: "right", render: (r) => `<button class="btn btn-success btn-sm" data-pay="${r.id}">Pagar</button>` },
        ],
        rows: pagar.items,
      }) : UI.emptyState("Nada a pagar.", "pay");
      pagMini.querySelectorAll("[data-pay]").forEach((b) => b.addEventListener("click", async () => {
        try { await API.post(`/financial/payables/${b.dataset.pay}/pay`, {}); UI.toast("Pagamento registrado.", "success"); render(); }
        catch (e) { UI.toast(e.message, "error"); }
      }));
    }

    /* ---- Projetos ---- */
    async function tabProjetos(body) {
      UI.pageLoader(body);
      const data = await API.get("/projects", { client_id: id, page_size: 100 });
      body.innerHTML = `
        <div class="page-actions" style="margin-bottom:14px">
          <button class="btn btn-primary btn-sm" data-go="#/projects">${UI.icon("plus")} Gerenciar projetos</button>
        </div>
        <div id="tbl"></div>`;
      body.querySelector("[data-go]").addEventListener("click", () => (location.hash = "#/projects"));
      const box = document.getElementById("tbl");
      if (!data.items.length) { box.innerHTML = UI.emptyState("Nenhum projeto para este cliente.", "box"); return; }
      box.innerHTML = UI.table({
        columns: [
          { label: "Projeto", render: (r) => `<strong>${UI.esc(r.nome)}</strong><div class="muted" style="font-size:11px">${UI.esc(r.codigo || "")}</div>` },
          { label: "Tipo", key: "tipo" },
          { label: "Status", render: (r) => UI.badge(r.status) },
          { label: "Receita", align: "right", render: (r) => UI.money(r.receita) },
          { label: "Custo realizado", align: "right", render: (r) => UI.money(r.custo_realizado) },
          { label: "Lucro", align: "right", render: (r) => `<span class="${r.lucro >= 0 ? "positive" : "negative"} strong">${UI.money(r.lucro)}</span>` },
          { label: "Margem", align: "right", render: (r) => UI.pct(r.margem) },
        ],
        rows: data.items,
      });
    }

    /* ---- Contratos ---- */
    async function tabContratos(body) {
      UI.pageLoader(body);
      const data = await API.get("/contracts", { client_id: id, page_size: 100 });
      body.innerHTML = `
        <div class="page-actions" style="margin-bottom:14px">
          <button class="btn btn-primary btn-sm" data-go="#/contracts">${UI.icon("plus")} Gerenciar contratos</button>
        </div>
        <div id="tbl"></div>`;
      body.querySelector("[data-go]").addEventListener("click", () => (location.hash = "#/contracts"));
      const box = document.getElementById("tbl");
      if (!data.items.length) { box.innerHTML = UI.emptyState("Nenhum contrato.", "doc"); return; }
      box.innerHTML = UI.table({
        columns: [
          { label: "Número", key: "numero", render: (r) => `<strong>${UI.esc(r.numero)}</strong>` },
          { label: "Projeto", key: "project_name" },
          { label: "Início", render: (r) => UI.date(r.inicio) },
          { label: "Término", render: (r) => UI.date(r.termino) },
          { label: "Valor", align: "right", render: (r) => UI.money(r.valor) },
          { label: "Parcelas", render: (r) => `${r.installments.filter((i) => i.status === "RECEBIDO").length}/${r.numero_parcelas}` },
          { label: "Status", render: (r) => UI.badge(r.status) },
        ],
        rows: data.items,
      });
    }

    /* ---- Documentos ---- */
    async function tabDocumentos(body) {
      UI.pageLoader(body);
      const data = await API.get("/documents", { client_id: id, page_size: 100 });
      body.innerHTML = `
        <div class="page-actions" style="margin-bottom:14px">
          <button class="btn btn-primary btn-sm" data-doc-upload>${UI.icon("plus")} Enviar documento</button>
        </div>
        <div id="tbl"></div>`;
      body.querySelector("[data-doc-upload]").addEventListener("click", () => openUpload(id, render));
      const box = document.getElementById("tbl");
      if (!data.items.length) { box.innerHTML = UI.emptyState("Nenhum documento.", "doc"); return; }
      box.innerHTML = UI.table({
        columns: [
          { label: "Arquivo", render: (r) => `<strong>${UI.esc(r.arquivo_nome)}</strong>` },
          { label: "Tipo", render: (r) => UI.esc(r.tipo.replace(/_/g, " ")) },
          { label: "Data", render: (r) => UI.date(r.data_documento) },
          { label: "Extração", render: (r) => (r.extractions.length ? `${r.extractions.length} campos` : "—") },
          { label: "Status", render: (r) => UI.badge(r.status) },
          { label: "", align: "right", render: (r) => `<button class="btn btn-ghost btn-sm" data-open-doc="${r.id}">Detalhes</button>` },
        ],
        rows: data.items,
      });
      box.querySelectorAll("[data-open-doc]").forEach((b) => b.addEventListener("click", () => openDocDetail(b.dataset.open_doc, render)));
    }

    /* ---- Indicadores ---- */
    async function tabIndicadores(body) {
      UI.pageLoader(body);
      const [health, inad] = await Promise.all([
        API.get("/admin/health", { client_id: id }),
        API.get("/financial/inadimplencia", { client_id: id }),
      ]);
      const k = dash.kpis;
      const h = health.items[0];
      body.innerHTML = `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div><div class="card-title">Saúde financeira</div><div class="card-sub">Classificação por regras objetivas (sem IA)</div></div>
            <button class="btn btn-primary btn-sm" id="btn-classify">${UI.icon("target")} Classificar mês atual</button>
          </div>
          <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
            ${h ? `<span class="health-pill ${h.classificacao.toLowerCase()}">${UI.esc(h.classificacao)} — Score ${h.score}</span><span class="muted">${h.mes}/${h.ano}</span>` : `<span class="muted">Nenhuma classificação ainda.</span>`}
            <div style="flex:1;min-width:220px"><div class="progress"><div style="width:${h ? h.score : 0}%"></div></div></div>
          </div>
          ${h && h.regras ? `<div class="muted" style="margin-top:10px;font-size:12px">${(h.regras.motivos || []).map((m) => `• ${UI.esc(m)}`).join(" ")}</div>` : ""}
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div><div class="card-title">Inadimplência</div></div></div>
            <div id="tbl-inad"></div>
          </div>
          <div class="card">
            <div class="card-header"><div><div class="card-title">KPIs operacionais</div></div></div>
            <div id="tbl-kpi"></div>
          </div>
        </div>`;
      document.getElementById("btn-classify").addEventListener("click", async () => {
        try {
          const r = await API.request("POST", `/admin/health/classify?client_id=${id}`, {});
          UI.toast(`Classificação: ${r.classificacao} (score ${r.score})`, "success");
          render();
        } catch (e) { UI.toast(e.message, "error"); }
      });
      const inadTbl = document.getElementById("tbl-inad");
      inadTbl.innerHTML = UI.table({
        columns: [
          { label: "Faixa", key: "faixa" },
          { label: "Títulos", key: "titulos", align: "right" },
          { label: "Valor", key: "valor", align: "right", render: (r) => UI.money(r.valor) },
        ],
        rows: inad.faixas || [],
      });
      document.getElementById("tbl-kpi").innerHTML = UI.table({
        columns: [
          { label: "Indicador", key: "k" },
          { label: "Valor", key: "v", align: "right" },
        ],
        rows: [
          { k: "Faturamento", v: UI.money(k.receita) }, { k: "Despesas", v: UI.money(k.despesas) },
          { k: "Margem", v: UI.pct(k.margem) }, { k: "Ticket médio", v: k.total_projetos ? UI.money(k.receita / k.total_projetos) : "—" },
          { k: "Projetos ativos", v: k.projetos_ativos }, { k: "Projetos concluídos", v: k.projetos_concluidos },
          { k: "Contratos ativos", v: k.contratos_ativos }, { k: "Contratos próximos do vencimento", v: k.contratos_proximos_vencimento },
          { k: "Documentos pendentes", v: k.documentos_pendentes }, { k: "Total vencido", v: UI.money(inad.total_vencido) },
        ],
      });
    }

    /* ---- Relatórios ---- */
    async function tabRelatorios(body) {
      UI.pageLoader(body);
      const data = await API.get("/reports", { client_id: id, page_size: 20 });
      body.innerHTML = `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div><div class="card-title">Gerar relatório gerencial mensal</div><div class="card-sub">Baseado nos dados do sistema (sem IA) · PDF, Excel e CSV</div></div>
            <button class="btn btn-primary btn-sm" id="btn-gerar">${UI.icon("report")} Gerar</button>
          </div>
          <div class="field-row" style="max-width:420px">
            ${UI.field({ label: "Mês", name: "mes", type: "select", options: Array.from({ length: 12 }, (_, i) => [i + 1, String(i + 1).padStart(2, "0")]) })}
            ${UI.field({ label: "Ano", name: "ano", type: "select", options: [new Date().getFullYear(), new Date().getFullYear() - 1] })}
          </div>
        </div>
        <div id="tbl"></div>`;
      document.getElementById("btn-gerar").addEventListener("click", async () => {
        const mes = body.querySelector("[name=mes]").value;
        const ano = body.querySelector("[name=ano]").value;
        try {
          const r = await API.post(`/reports/monthly/generate?client_id=${id}&mes=${mes}&ano=${ano}`, {});
          UI.toast("Relatório gerado com sucesso.", "success");
          render();
        } catch (e) { UI.toast(e.message, "error"); }
      });
      const box = document.getElementById("tbl");
      if (!data.items.length) { box.innerHTML = UI.emptyState("Nenhum relatório gerado.", "report"); return; }
      box.innerHTML = UI.table({
        columns: [
          { label: "Relatório", render: (r) => `<strong>${UI.esc(r.titulo)}</strong>` },
          { label: "Período", render: (r) => `${String(r.mes).padStart(2, "0")}/${r.ano}` },
          { label: "Gerado em", render: (r) => UI.datetime(r.created_at) },
          { label: "", align: "right", render: (r) => `
            <button class="btn btn-ghost btn-sm" data-exp="pdf" data-m="${r.mes}" data-a="${r.ano}">PDF</button>
            <button class="btn btn-ghost btn-sm" data-exp="xlsx" data-m="${r.mes}" data-a="${r.ano}">Excel</button>
            <button class="btn btn-ghost btn-sm" data-exp="csv" data-m="${r.mes}" data-a="${r.ano}">CSV</button>` },
        ],
        rows: data.items,
      });
      box.querySelectorAll("[data-exp]").forEach((b) => b.addEventListener("click", () => {
        const fmt = b.dataset.exp;
        window.open(`/reports/monthly/export?client_id=${id}&mes=${b.dataset.m}&ano=${b.dataset.a}&formato=${fmt}`, "_blank");
      }));
    }

    /* ---- Histórico ---- */
    async function tabHistorico(body) {
      UI.pageLoader(body);
      const audit = await API.get("/admin/audit", { registro_id: id, page_size: 30 });
      const acoes = await API.get("/admin/action-plans", { client_id: id, page_size: 20 });
      body.innerHTML = `
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div><div class="card-title">Auditoria do cliente</div><div class="card-sub">Trilha de operações</div></div></div>
            <div id="tbl-audit"></div>
          </div>
          <div class="card">
            <div class="card-header"><div><div class="card-title">Plano de acompanhamento</div></div></div>
            <div id="tbl-acoes"></div>
          </div>
        </div>`;
      const boxA = document.getElementById("tbl-audit");
      boxA.innerHTML = audit.items.length
        ? UI.table({
            columns: [
              { label: "Data", render: (r) => UI.datetime(r.created_at) },
              { label: "Ação", render: (r) => `<strong>${UI.esc(r.acao)}</strong>` },
              { label: "Usuário", render: (r) => UI.esc(r.user_name || "Sistema") },
            ],
            rows: audit.items,
          })
        : UI.emptyState("Sem registros de auditoria.", "search");
      const boxP = document.getElementById("tbl-acoes");
      boxP.innerHTML = acoes.items.length
        ? UI.table({
            columns: [
              { label: "Ação", key: "titulo", render: (r) => `<strong>${UI.esc(r.titulo)}</strong>` },
              { label: "Prazo", render: (r) => UI.date(r.prazo) },
              { label: "Status", render: (r) => UI.badge(r.status) },
            ],
            rows: acoes.items,
          })
        : UI.emptyState("Nenhuma ação registrada.", "check");
    }

    async function openEditClient(cid) {
      const cli = await API.get(`/clients/${cid}`);
      const plans = await loadPlans();
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
      footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">Salvar</button>`;
      const m = UI.modal({
        title: `Editar — ${cli.nome_fantasia || cli.razao_social}`,
        wide: true,
        body: `
          <form id="form-edit">
            <div class="field-row">
              ${UI.field({ label: "Razão social", name: "razao_social", value: cli.razao_social, required: true })}
              ${UI.field({ label: "Nome fantasia", name: "nome_fantasia", value: cli.nome_fantasia || "" })}
            </div>
            <div class="field-row-3">
              ${UI.field({ label: "CNPJ/CPF", name: "cnpj_cpf", value: cli.cnpj_cpf || "" })}
              ${UI.field({ label: "E-mail", name: "email", value: cli.email || "" })}
              ${UI.field({ label: "Telefone", name: "telefone", value: cli.telefone || "" })}
            </div>
            <div class="field-row-3">
              ${UI.field({ label: "Segmento", name: "segmento", type: "select", options: SEGMENTOS, value: cli.segmento || "" })}
              ${UI.field({ label: "Plano", name: "plano_id", type: "select", options: plans.map((p) => [p.id, p.nome]), value: cli.plano_id || "" })}
              ${UI.field({ label: "Status", name: "status", type: "select", options: STATUS_CLIENTE, value: cli.status })}
            </div>
            <div class="field-row">
              ${UI.field({ label: "Início", name: "data_inicio", type: "date", value: cli.data_inicio || "" })}
              ${UI.field({ label: "Término", name: "data_termino", type: "date", value: cli.data_termino || "" })}
            </div>
            <label class="field"><span>Observações</span><textarea name="observacoes" rows="3">${UI.esc(cli.observacoes || "")}</textarea></label>
          </form>`,
        footer,
      });
      footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
      footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
        const data = UI.formData(document.getElementById("form-edit"));
        try {
          await API.put(`/clients/${cid}`, data);
          UI.toast("Cliente atualizado.", "success");
          m.close();
          render();
        } catch (e) { UI.toast(e.message, "error"); }
      });
    }

    await render();
  }

  /* ------------------- upload de documento (cliente 360) ------------------- */
  function openUpload(clientId, onDone) {
    const body = `
      <form id="form-upload">
        <div class="field"><span>Arquivo *</span><input type="file" name="file" required accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg" /></div>
        <div class="field-row">
          <label class="field"><span>Tipo</span>
            <select name="tipo">
              ${["CONTRATO", "NOTA_FISCAL", "RECIBO", "COMPROVANTE", "EXTRATO", "ADMINISTRATIVO", "FINANCEIRO", "OUTRO"].map((t) => `<option>${t}</option>`).join("")}
            </select></label>
          <label class="field"><span>Data do documento</span><input type="date" name="data_documento" /></label>
        </div>
        <label class="field"><span>Observação</span><textarea name="observacao" rows="2"></textarea></label>
      </form>`;
    const footer = document.createElement("div");
    footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
    footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">Enviar e processar</button>`;
    const m = UI.modal({ title: "Enviar documento", body, footer });
    footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
    footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
      const form = document.getElementById("form-upload");
      const fd = new FormData(form);
      fd.append("client_id", clientId);
      try {
        const doc = await API.upload("/documents/upload", fd);
        UI.toast("Documento enviado e processado. Campos extraídos aguardam validação.", "success");
        m.close();
        onDone();
      } catch (e) { UI.toast(e.message, "error"); }
    });
  }

  function openDocDetail(docId, onDone) {
    (async () => {
      const d = await API.get(`/documents/${docId}`);
      const rows = d.extractions.length
        ? d.extractions.map((e) => `
          <tr>
            <td><strong>${UI.esc(e.campo)}</strong></td>
            <td><input class="input" style="width:100%" data-campo="${e.campo}" data-eid="${e.id}" value="${UI.esc(e.valor || "")}" /></td>
            <td>${UI.badge(e.status)}</td>
            <td style="display:flex;gap:6px">
              <button class="btn btn-success btn-sm" data-st="VALIDADA">Validar</button>
              <button class="btn btn-ghost btn-sm" data-st="REJEITADA">Rejeitar</button>
            </td>
          </tr>`).join("")
        : `<tr><td colspan="4" class="muted">Nenhum campo extraído. Ajuste os campos manualmente abaixo.</td></tr>`;
      const body = `
        <div class="muted" style="margin-bottom:10px">${UI.esc(d.arquivo_nome)} · ${UI.badge(d.status)}</div>
        <table class="tbl"><thead><tr><th>Campo</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table>`;
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
      footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Fechar</button>`;
      const m = UI.modal({ title: "Validação de extração", body, footer, wide: true });
      footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
      m.backdrop.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", async () => {
        const eid = b.closest("tr").querySelector("[data-eid]").dataset.eid;
        const valor = b.closest("tr").querySelector("[data-campo]").value;
        try {
          await API.put(`/documents/${docId}/extractions/${eid}`, { valor, status: b.dataset.st });
          UI.toast("Extração atualizada.", "success");
          m.close();
          onDone();
        } catch (e) { UI.toast(e.message, "error"); }
      }));
    })();
  }

  /* =============================== PLANOS ================================= */
  async function plans(container) {
    UI.pageLoader(container);
    const data = await API.get("/plans");
    container.innerHTML = `
      <div class="page-head">
        <div><div class="page-title">Planos</div><div class="page-sub">Planos mensais contratáveis e suas funcionalidades.</div></div>
      </div>
      <div class="grid-3">
        ${data.map((p) => `
          <div class="card" style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <h3>${UI.esc(p.nome)}</h3>
              ${UI.badge(p.codigo)}
            </div>
            <div class="page-title" style="font-size:24px">${UI.money(p.preco_mensal)}<span class="muted" style="font-size:13px">/mês</span></div>
            <p class="muted" style="font-size:12.5px;min-height:40px">${UI.esc(p.descricao || "")}</p>
            <ul style="list-style:none;display:grid;gap:6px">
              ${p.features.map((f) => `<li style="display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--text-2)"><span style="color:var(--accent-2)">${UI.icon("check")}</span>${UI.esc(f.nome)}</li>`).join("")}
            </ul>
          </div>`).join("")}
      </div>`;
  }

  window.Pages.clients = { list, new: newClient, detail, plans };
})();
