/* ============================================================================
   Build Flow BPO — Administração (usuários, processos, ativos, auditoria,
   plano de acompanhamento, saúde financeira)
   ============================================================================ */
(() => {
  "use strict";
  window.Pages = window.Pages || {};

  const ROLES = [
    ["ADMIN", "Admin"], ["GERENTE", "Gerente"], ["AUXILIAR", "Auxiliar"], ["CONSULTOR", "Consultor"],
  ];
  const user = () => JSON.parse(localStorage.getItem("bf_user") || "{}");

  /* -------------------------------- USUÁRIOS ------------------------------- */
  async function users(container) {
    UI.pageLoader(container);
    let state = { page: 1, search: "" };

    async function render() {
      const data = await API.get("/users", { page: state.page, page_size: 15, search: state.search || undefined });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Usuários</div><div class="page-sub">Acesso restrito — somente ADMIN gerencia usuários e permissões.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-novo">${UI.icon("plus")} Novo usuário</button></div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Buscar</span><input id="f-search" placeholder="Nome, usuário, e-mail…" value="${UI.esc(state.search)}" /></label>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("f-search").addEventListener("input", (e) => { state.search = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-novo").addEventListener("click", () => openModal(render));

      const box = document.getElementById("tbl");
      box.innerHTML = UI.table({
        columns: [
          { label: "Usuário", render: (r) => `<div class="avatar" style="width:28px;height:28px;font-size:12px;display:inline-flex;margin-right:8px">${UI.esc((r.nome || "?").charAt(0))}</div><strong>${UI.esc(r.nome)}</strong><div class="muted" style="font-size:11px">@${UI.esc(r.username)}</div>` },
          { label: "E-mail", key: "email" },
          { label: "Cargo", key: "cargo" },
          { label: "Perfil", render: (r) => UI.badge(r.role) },
          { label: "Status", render: (r) => (r.ativo ? `<span class="badge green">Ativo</span>` : `<span class="badge gray">Inativo</span>`) },
          { label: "Último login", render: (r) => UI.datetime(r.ultimo_login) },
          { label: "", align: "right", render: (r) => `
            <button class="btn btn-ghost btn-sm" data-edit="${r.id}">${UI.icon("edit")}</button>
            <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
        ],
        rows: data.items,
      });
      box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(render, data.items.find((x) => x.id === b.dataset.edit))));
      box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        UI.confirm({ title: "Excluir usuário", message: "Deseja excluir este usuário?", onConfirm: async () => {
          try { await API.del(`/users/${b.dataset.del}`); UI.toast("Usuário excluído.", "success"); render(); }
          catch (e) { UI.toast(e.message, "error"); }
        } });
      }));
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 15, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }

    function openModal(onDone, item = null) {
      const body = `
        <form id="form-user">
          <div class="field-row">
            <label class="field"><span>Username *</span><input name="username" required value="${UI.esc(item ? item.username : "")}" ${item ? "disabled" : ""} /></label>
            <label class="field"><span>Nome completo *</span><input name="nome" required value="${UI.esc(item ? item.nome : "")}" /></label>
          </div>
          <div class="field-row">
            <label class="field"><span>E-mail *</span><input type="email" name="email" required value="${UI.esc(item ? item.email : "")}" /></label>
            <label class="field"><span>Cargo</span><input name="cargo" value="${UI.esc(item ? item.cargo || "" : "")}" /></label>
          </div>
          <div class="field-row">
            <label class="field"><span>Perfil</span><select name="role">${ROLES.map(([v, l]) => `<option value="${v}" ${(!item && v === "AUXILIAR") || (item && item.role === v) ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="field"><span>${item ? "Nova senha (opcional)" : "Senha *"} ${item ? "" : "*"}</span><input type="password" name="password" ${item ? "" : "required"} minlength="8" placeholder="mín. 8 caracteres" /></label>
          </div>
          ${item ? `<label class="field" style="display:flex;align-items:center;gap:10px"><input type="checkbox" name="ativo" ${item.ativo ? "checked" : ""} style="width:auto" /> Usuário ativo</label>` : ""}
        </form>`;
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
      footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">${item ? "Salvar" : "Criar"}</button>`;
      const m = UI.modal({ title: item ? "Editar usuário" : "Novo usuário", body, footer });
      footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
      footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
        const data = UI.formData(document.getElementById("form-user"));
        if (item) {
          const payload = { nome: data.nome, email: data.email, cargo: data.cargo, role: data.role, ativo: !!data.ativo };
          if (data.password) payload.password = data.password;
          try { await API.put(`/users/${item.id}`, payload); UI.toast("Usuário atualizado.", "success"); m.close(); onDone(); }
          catch (e) { UI.toast(e.message, "error"); }
        } else {
          try { await API.post("/users", data); UI.toast("Usuário criado.", "success"); m.close(); onDone(); }
          catch (e) { UI.toast(e.message, "error"); }
        }
      });
    }
    await render();
  }

  /* ------------------------------ PLANO DE AÇÕES --------------------------- */
  async function actions(container) {
    UI.pageLoader(container);
    const clients = await API.get("/clients", { page_size: 200 });
    const usersOpts = await API.get("/users", { page_size: 200 });
    let state = { page: 1, status: "" };

    async function render() {
      const data = await API.get("/admin/action-plans", { page: state.page, page_size: 15, status: state.status || undefined });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Plano de Acompanhamento</div><div class="page-sub">Ações manuais registradas pela equipe do BPO.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-nova">${UI.icon("plus")} Nova ação</button></div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Status</span><select id="f-status"><option value="">Todos</option>${["NAO_INICIADO", "EM_ANDAMENTO", "CONCLUIDO", "CANCELADO"].map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${UI.esc(s.replace("_", " "))}</option>`).join("")}</select></label>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("f-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-nova").addEventListener("click", () => openModal(render));

      const box = document.getElementById("tbl");
      if (!data.items.length) box.innerHTML = UI.emptyState("Nenhuma ação registrada.", "check");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Ação", render: (r) => `<strong>${UI.esc(r.titulo)}</strong><div class="muted" style="font-size:11px">${UI.esc(r.descricao || "")}</div>` },
            { label: "Cliente", key: "client_name" },
            { label: "Prioridade", render: (r) => UI.badge(r.prioridade) },
            { label: "Prazo", render: (r) => UI.date(r.prazo) },
            { label: "Status", render: (r) => UI.badge(r.status) },
            { label: "", align: "right", render: (r) => `
              <button class="btn btn-ghost btn-sm" data-edit="${r.id}">${UI.icon("edit")}</button>
              <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
          ],
          rows: data.items,
        });
        box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(render, data.items.find((x) => x.id === b.dataset.edit))));
        box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
          UI.confirm({ title: "Excluir ação", message: "Deseja excluir esta ação?", onConfirm: async () => {
            try { await API.del(`/admin/action-plans/${b.dataset.del}`); UI.toast("Ação excluída.", "success"); render(); }
            catch (e) { UI.toast(e.message, "error"); }
          } });
        }));
      }
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 15, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }

    function openModal(onDone, item = null) {
      const body = `
        <form id="form-acao">
          <label class="field"><span>Título *</span><input name="titulo" required value="${UI.esc(item ? item.titulo : "")}" /></label>
          <label class="field"><span>Descrição</span><textarea name="descricao" rows="2">${UI.esc(item ? item.descricao || "" : "")}</textarea></label>
          <div class="field-row">
            <label class="field"><span>Cliente</span><select name="client_id"><option value="">—</option>${clients.items.map((c) => `<option value="${c.id}" ${item && item.client_id === c.id ? "selected" : ""}>${UI.esc(c.nome_fantasia || c.razao_social)}</option>`).join("")}</select></label>
            <label class="field"><span>Responsável</span><select name="responsavel_id"><option value="">—</option>${usersOpts.items.map((u) => `<option value="${u.id}" ${item && item.responsavel_id === u.id ? "selected" : ""}>${UI.esc(u.nome)}</option>`).join("")}</select></label>
          </div>
          <div class="field-row">
            <label class="field"><span>Prioridade</span><select name="prioridade">${["ALTA", "MEDIA", "BAIXA"].map((p) => `<option ${(!item && p === "MEDIA") || (item && item.prioridade === p) ? "selected" : ""}>${p}</option>`).join("")}</select></label>
            <label class="field"><span>Prazo</span><input type="date" name="prazo" value="${item ? item.prazo || "" : ""}" /></label>
            <label class="field"><span>Status</span><select name="status">${["NAO_INICIADO", "EM_ANDAMENTO", "CONCLUIDO", "CANCELADO"].map((s) => `<option ${(!item && s === "NAO_INICIADO") || (item && item.status === s) ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          </div>
        </form>`;
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
      footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">${item ? "Salvar" : "Criar"}</button>`;
      const m = UI.modal({ title: item ? "Editar ação" : "Nova ação", body, footer });
      footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
      footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
        const data = UI.formData(document.getElementById("form-acao"));
        if (!data.client_id) data.client_id = null;
        if (!data.responsavel_id) data.responsavel_id = null;
        try {
          if (item) await API.put(`/admin/action-plans/${item.id}`, data);
          else await API.post("/admin/action-plans", data);
          UI.toast(item ? "Ação atualizada." : "Ação criada.", "success");
          m.close();
          onDone();
        } catch (e) { UI.toast(e.message, "error"); }
      });
    }
    await render();
  }

  /* --------------------------------- ATIVOS -------------------------------- */
  async function assets(container) {
    UI.pageLoader(container);
    const clients = await API.get("/clients", { page_size: 200 });
    let state = { page: 1 };

    async function render() {
      const data = await API.get("/admin/assets", { page: state.page, page_size: 15 });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Ativos e Equipamentos</div><div class="page-sub">Controle de ativos dos clientes e internos do BPO.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-novo">${UI.icon("plus")} Novo ativo</button></div>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("btn-novo").addEventListener("click", () => openModal(render));
      const box = document.getElementById("tbl");
      box.innerHTML = UI.table({
        columns: [
          { label: "Ativo", render: (r) => `<strong>${UI.esc(r.nome)}</strong><div class="muted" style="font-size:11px">${UI.esc(r.numero_serie || "")}</div>` },
          { label: "Cliente", key: "client_name" },
          { label: "Tipo", key: "tipo" },
          { label: "Valor", align: "right", render: (r) => UI.money(r.valor) },
          { label: "Aquisição", render: (r) => UI.date(r.data_aquisicao) },
          { label: "Status", render: (r) => UI.badge(r.status) },
          { label: "", align: "right", render: (r) => `
            <button class="btn btn-ghost btn-sm" data-edit="${r.id}">${UI.icon("edit")}</button>
            <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
        ],
        rows: data.items,
      });
      box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(render, data.items.find((x) => x.id === b.dataset.edit))));
      box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        UI.confirm({ title: "Excluir ativo", message: "Deseja excluir este ativo?", onConfirm: async () => {
          try { await API.del(`/admin/assets/${b.dataset.del}`); UI.toast("Ativo excluído.", "success"); render(); }
          catch (e) { UI.toast(e.message, "error"); }
        } });
      }));
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 15, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }

    function openModal(onDone, item = null) {
      const body = `
        <form id="form-ativo">
          <div class="field-row">
            <label class="field"><span>Nome *</span><input name="nome" required value="${UI.esc(item ? item.nome : "")}" /></label>
            <label class="field"><span>Tipo</span><input name="tipo" value="${UI.esc(item ? item.tipo || "" : "")}" placeholder="EQUIPAMENTO, MOBILIARIO…" /></label>
          </div>
          <div class="field-row-3">
            <label class="field"><span>Cliente (vazio = interno)</span><select name="client_id"><option value="">BPO interno</option>${clients.items.map((c) => `<option value="${c.id}" ${item && item.client_id === c.id ? "selected" : ""}>${UI.esc(c.nome_fantasia || c.razao_social)}</option>`).join("")}</select></label>
            <label class="field"><span>Nº de série</span><input name="numero_serie" value="${UI.esc(item ? item.numero_serie || "" : "")}" /></label>
            <label class="field"><span>Valor</span><input type="number" step="0.01" name="valor" value="${item ? item.valor : 0}" /></label>
          </div>
          <div class="field-row">
            <label class="field"><span>Aquisição</span><input type="date" name="data_aquisicao" value="${item ? item.data_aquisicao || "" : ""}" /></label>
            <label class="field"><span>Status</span><select name="status">${["ATIVO", "EM_MANUTENCAO", "BAIXADO"].map((s) => `<option ${(!item && s === "ATIVO") || (item && item.status === s) ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          </div>
          <label class="field"><span>Observações</span><textarea name="observacoes" rows="2">${UI.esc(item ? item.observacoes || "" : "")}</textarea></label>
        </form>`;
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
      footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">${item ? "Salvar" : "Criar"}</button>`;
      const m = UI.modal({ title: item ? "Editar ativo" : "Novo ativo", body, footer });
      footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
      footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
        const data = UI.formData(document.getElementById("form-ativo"));
        data.valor = Number(data.valor || 0);
        if (!data.client_id) data.client_id = null;
        try {
          if (item) await API.put(`/admin/assets/${item.id}`, data);
          else await API.post("/admin/assets", data);
          UI.toast(item ? "Ativo atualizado." : "Ativo criado.", "success");
          m.close();
          onDone();
        } catch (e) { UI.toast(e.message, "error"); }
      });
    }
    await render();
  }

  /* ------------------------------- PROCESSOS ------------------------------- */
  async function processes(container) {
    UI.pageLoader(container);
    let state = { page: 1 };

    async function render() {
      const data = await API.get("/admin/processes", { page: state.page, page_size: 15 });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Processos Internos</div><div class="page-sub">Organização dos processos que rodam no BPO.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-novo">${UI.icon("plus")} Novo processo</button></div>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("btn-novo").addEventListener("click", () => openModal(render));
      const box = document.getElementById("tbl");
      box.innerHTML = UI.table({
        columns: [
          { label: "Processo", render: (r) => `<strong>${UI.esc(r.nome)}</strong>` },
          { label: "Descrição", key: "descricao" },
          { label: "Frequência", key: "frequencia" },
          { label: "Status", render: (r) => UI.badge(r.status) },
          { label: "", align: "right", render: (r) => `
            <button class="btn btn-ghost btn-sm" data-edit="${r.id}">${UI.icon("edit")}</button>
            <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
        ],
        rows: data.items,
      });
      box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(render, data.items.find((x) => x.id === b.dataset.edit))));
      box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        UI.confirm({ title: "Excluir processo", message: "Deseja excluir este processo?", onConfirm: async () => {
          try { await API.del(`/admin/processes/${b.dataset.del}`); UI.toast("Processo excluído.", "success"); render(); }
          catch (e) { UI.toast(e.message, "error"); }
        } });
      }));
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 15, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }

    function openModal(onDone, item = null) {
      const body = `
        <form id="form-proc">
          <label class="field"><span>Nome *</span><input name="nome" required value="${UI.esc(item ? item.nome : "")}" /></label>
          <label class="field"><span>Descrição</span><textarea name="descricao" rows="3">${UI.esc(item ? item.descricao || "" : "")}</textarea></label>
          <div class="field-row">
            <label class="field"><span>Frequência</span><input name="frequencia" value="${UI.esc(item ? item.frequencia || "" : "")}" placeholder="SEMANAL, MENSAL…" /></label>
            <label class="field"><span>Status</span><select name="status"><option value="ATIVO" ${item && item.status === "ATIVO" ? "selected" : ""}>Ativo</option><option value="INATIVO" ${item && item.status === "INATIVO" ? "selected" : ""}>Inativo</option></select></label>
          </div>
        </form>`;
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
      footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">${item ? "Salvar" : "Criar"}</button>`;
      const m = UI.modal({ title: item ? "Editar processo" : "Novo processo", body, footer });
      footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
      footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
        const data = UI.formData(document.getElementById("form-proc"));
        try {
          if (item) await API.put(`/admin/processes/${item.id}`, data);
          else await API.post("/admin/processes", data);
          UI.toast(item ? "Processo atualizado." : "Processo criado.", "success");
          m.close();
          onDone();
        } catch (e) { UI.toast(e.message, "error"); }
      });
    }
    await render();
  }

  /* -------------------------------- AUDITORIA ------------------------------ */
  async function audit(container) {
    UI.pageLoader(container);
    let state = { page: 1, search: "" };

    async function render() {
      const data = await API.get("/admin/audit", { page: state.page, page_size: 20, search: state.search || undefined });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Auditoria</div><div class="page-sub">Trilha de auditoria das operações (quem, o quê, quando).</div></div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Buscar ação</span><input id="f-search" placeholder="Ex.: Cliente criado, Relatório gerado…" value="${UI.esc(state.search)}" /></label>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("f-search").addEventListener("input", (e) => { state.search = e.target.value; state.page = 1; render(); });
      const box = document.getElementById("tbl");
      box.innerHTML = UI.table({
        columns: [
          { label: "Data", render: (r) => UI.datetime(r.created_at) },
          { label: "Usuário", render: (r) => UI.esc(r.user_name || "Sistema") },
          { label: "Ação", render: (r) => `<strong>${UI.esc(r.acao)}</strong>` },
          { label: "Módulo", render: (r) => `<span class="badge gray">${UI.esc(r.modulo)}</span>` },
          { label: "IP", key: "ip" },
        ],
        rows: data.items,
      });
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 20, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }
    await render();
  }

  /* ------------------------------ SAÚDE FINANCEIRA ------------------------- */
  async function health(container) {
    UI.pageLoader(container);
    const clients = await API.get("/clients", { page_size: 200 });
    let state = { client_id: clients.items.length ? clients.items[0].id : "" };

    async function render() {
      const healthData = state.client_id ? await API.get("/admin/health", { client_id: state.client_id }) : { items: [] };
      const snap = healthData.items[0];
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Saúde Financeira</div><div class="page-sub">Classificação por regras objetivas configuráveis (sem IA).</div></div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Cliente</span><select id="f-cliente">${clients.items.map((c) => `<option value="${c.id}" ${state.client_id === c.id ? "selected" : ""}>${UI.esc(c.nome_fantasia || c.razao_social)}</option>`).join("")}</select></label>
          <button class="btn btn-primary" id="btn-classificar">${UI.icon("target")} Classificar mês atual</button>
        </div>
        <div id="card"></div>`;

      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; render(); });
      document.getElementById("btn-classificar").addEventListener("click", async () => {
        try {
          const r = await API.request("POST", `/admin/health/classify?client_id=${state.client_id}`, {});
          UI.toast(`Classificação: ${r.classificacao} (score ${r.score})`, "success");
          render();
        } catch (e) { UI.toast(e.message, "error"); }
      });

      const card = document.getElementById("card");
      if (!snap) {
        card.innerHTML = UI.emptyState("Nenhuma classificação para este cliente. Clique em classificar.", "target");
        return;
      }
      const regras = snap.regras || {};
      card.innerHTML = `
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div><div class="card-title">${UI.esc(snap.client_name)} — ${snap.mes}/${snap.ano}</div><div class="card-sub">Snapshot mensal</div></div></div>
            <div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap">
              <span class="health-pill ${snap.classificacao.toLowerCase()}" style="font-size:16px">${UI.esc(snap.classificacao)}</span>
              <div style="flex:1;min-width:200px">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);margin-bottom:4px"><span>Score</span><strong>${snap.score}/100</strong></div>
                <div class="progress"><div style="width:${snap.score}%;background:${snap.score >= 70 ? "var(--success)" : snap.score >= 45 ? "var(--warning)" : "var(--danger)"}"></div></div>
              </div>
            </div>
            ${regras.motivos && regras.motivos.length ? `<div style="margin-top:14px;display:grid;gap:6px">${regras.motivos.map((mo) => `<div style="display:flex;gap:8px;align-items:center;color:var(--text-2);font-size:13px"><span style="color:var(--warning)">${UI.icon("alert")}</span>${UI.esc(mo)}</div>`).join("")}</div>` : `<div style="margin-top:14px;color:var(--success);font-size:13px;display:flex;gap:8px;align-items:center">${UI.icon("check")} Sem motivos de penalização.</div>`}
          </div>
          <div class="card">
            <div class="card-header"><div><div class="card-title">Fatores considerados</div></div></div>
            <div id="tbl-fatores"></div>
          </div>
        </div>`;
      document.getElementById("tbl-fatores").innerHTML = UI.table({
        columns: [{ label: "Fator", key: "k" }, { label: "Valor", key: "v", align: "right" }],
        rows: [
          { k: "Inadimplência", v: `${regras.inadimplencia_pct != null ? regras.inadimplencia_pct.toFixed(1) + "%" : "—"}` },
          { k: "Margem", v: `${regras.margem != null ? regras.margem.toFixed(1) + "%" : "—"}` },
          { k: "Resultado líquido", v: UI.money(regras.resultado) },
          { k: "Títulos vencidos", v: regras.vencidas },
        ],
      });
    }
    await render();
  }

  window.Pages.admin = { users, actions, assets, processes, audit, health };
})();
