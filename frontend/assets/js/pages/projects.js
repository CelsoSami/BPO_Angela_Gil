/* ============================================================================
   Build Flow BPO — Projetos, Rentabilidade e Precificação
   ============================================================================ */
(() => {
  "use strict";
  window.Pages = window.Pages || {};

  const STATUS_PROJETO = [
    ["PLANEJAMENTO", "Planejamento"], ["EM_ANDAMENTO", "Em andamento"],
    ["PAUSADO", "Pausado"], ["CONCLUIDO", "Concluído"], ["CANCELADO", "Cancelado"],
  ];
  let _clientOptions = [];
  async function clientsSelect() {
    if (_clientOptions.length) return _clientOptions;
    const data = await API.get("/clients", { page_size: 200 });
    _clientOptions = data.items.map((c) => [c.id, c.nome_fantasia || c.razao_social]);
    return _clientOptions;
  }

  /* ------------------------------- LISTA ---------------------------------- */
  async function list(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    let state = { page: 1, client_id: "", status: "", search: "" };

    async function render() {
      const data = await API.get("/projects", {
        page: state.page, page_size: 15, client_id: state.client_id || undefined,
        status: state.status || undefined, search: state.search || undefined,
      });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Projetos</div><div class="page-sub">Portfólio de projetos dos escritórios, custos, receitas e status.</div></div>
          <div class="page-actions">
            <button class="btn btn-ghost" data-go="#/projects/profitability">${UI.icon("trendUp")} Rentabilidade</button>
            <button class="btn btn-primary" id="btn-novo">${UI.icon("plus")} Novo projeto</button>
          </div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Buscar</span><input id="f-search" placeholder="Nome ou código…" value="${UI.esc(state.search)}" /></label>
          <label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
          <label class="field"><span>Status</span><select id="f-status"><option value="">Todos</option>${STATUS_PROJETO.map(([v, l]) => `<option value="${v}" ${state.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("f-search").addEventListener("input", (e) => { state.search = e.target.value; state.page = 1; render(); });
      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; state.page = 1; render(); });
      document.getElementById("f-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-novo").addEventListener("click", () => openModal(render));
      container.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => (location.hash = b.dataset.go)));

      const box = document.getElementById("tbl");
      if (!data.items.length) box.innerHTML = UI.emptyState("Nenhum projeto cadastrado.", "box");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Projeto", render: (r) => `<strong>${UI.esc(r.nome)}</strong><div class="muted" style="font-size:11px">${UI.esc(r.codigo || "")}</div>` },
            { label: "Cliente", key: "client_name" },
            { label: "Tipo", key: "tipo" },
            { label: "Status", render: (r) => UI.badge(r.status) },
            { label: "Receita", align: "right", render: (r) => UI.money(r.receita) },
            { label: "Custo real.", align: "right", render: (r) => UI.money(r.custo_realizado) },
            { label: "Lucro", align: "right", render: (r) => `<span class="${r.lucro >= 0 ? "positive" : "negative"} strong">${UI.money(r.lucro)}</span>` },
            { label: "Margem", align: "right", render: (r) => UI.pct(r.margem) },
            { label: "", align: "right", render: (r) => `
              <button class="btn btn-ghost btn-sm" data-edit="${r.id}">${UI.icon("edit")}</button>
              <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
          ],
          rows: data.items,
        });
        box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(render, data.items.find((x) => x.id === b.dataset.edit))));
        box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
          UI.confirm({ title: "Excluir projeto", message: "Deseja excluir este projeto?", onConfirm: async () => {
            try { await API.del(`/projects/${b.dataset.del}`); UI.toast("Projeto excluído.", "success"); render(); }
            catch (e) { UI.toast(e.message, "error"); }
          } });
        }));
      }
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 15, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }

    function openModal(onDone, item = null) {
      (async () => {
        const clienteSel = await clientsSelect();
        const body = `
          <form id="form-proj">
            <div class="field-row">
              <label class="field"><span>Cliente *</span><select name="client_id" required><option value="">Selecione…</option>${clienteSel.map(([v, l]) => `<option value="${v}" ${item && item.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
              <label class="field"><span>Código</span><input name="codigo" value="${UI.esc(item ? item.codigo || "" : "")}" placeholder="PRJ-0001" /></label>
            </div>
            <label class="field"><span>Nome do projeto *</span><input name="nome" required value="${UI.esc(item ? item.nome : "")}" /></label>
            <div class="field-row">
              <label class="field"><span>Tipo</span><input name="tipo" value="${UI.esc(item ? item.tipo || "" : "")}" placeholder="Projeto Arquitetônico" /></label>
              <label class="field"><span>Responsável</span><input name="responsavel" value="${UI.esc(item ? item.responsavel || "" : "")}" /></label>
            </div>
            <div class="field-row">
              <label class="field"><span>Início</span><input type="date" name="data_inicio" value="${item ? item.data_inicio || "" : ""}" /></label>
              <label class="field"><span>Previsão</span><input type="date" name="data_prevista" value="${item ? item.data_prevista || "" : ""}" /></label>
              <label class="field"><span>Prazo</span><input name="prazo" value="${UI.esc(item ? item.prazo || "" : "")}" placeholder="6 meses" /></label>
            </div>
            <div class="field-row-3">
              <label class="field"><span>Orçamento</span><input type="number" step="0.01" name="orcamento" value="${item ? item.orcamento : 0}" /></label>
              <label class="field"><span>Receita</span><input type="number" step="0.01" name="receita" value="${item ? item.receita : 0}" /></label>
              <label class="field"><span>Custo estimado</span><input type="number" step="0.01" name="custo_estimado" value="${item ? item.custo_estimado : 0}" /></label>
            </div>
            <div class="field-row">
              <label class="field"><span>Custo realizado</span><input type="number" step="0.01" name="custo_realizado" value="${item ? item.custo_realizado : 0}" /></label>
              <label class="field"><span>Status</span><select name="status">${STATUS_PROJETO.map(([v, l]) => `<option value="${v}" ${(!item && v === "PLANEJAMENTO") || (item && item.status === v) ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            </div>
          </form>`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">${item ? "Salvar" : "Criar"}</button>`;
        const m = UI.modal({ title: item ? "Editar projeto" : "Novo projeto", body, footer });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
        footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
          const data = UI.formData(document.getElementById("form-proj"));
          ["orcamento", "receita", "custo_estimado", "custo_realizado"].forEach((k) => { data[k] = Number(data[k] || 0); });
          try {
            if (item) await API.put(`/projects/${item.id}`, data);
            else await API.post("/projects", data);
            UI.toast(item ? "Projeto atualizado." : "Projeto criado.", "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        });
      })();
    }
    await render();
  }

  /* ----------------------------- RENTABILIDADE ----------------------------- */
  async function profitability(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    let state = { client_id: "" };

    async function render() {
      const data = await API.get("/projects/profitability/all", { client_id: state.client_id || undefined });
      const rank = await API.get("/projects/rankings/all", { client_id: state.client_id || undefined });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Rentabilidade</div><div class="page-sub">Receita − custos = lucro; margem por projeto.</div></div>
          <div class="page-actions"><button class="btn btn-ghost" data-go="#/projects">${UI.icon("box")} Projetos</button></div>
        </div>
        ${barraFiltros([`<label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>`])}
        <div id="tbl"></div>
        <div class="grid-2">
          <div class="card"><div class="card-header"><div><div class="card-title">Projetos mais rentáveis</div></div></div><div id="box-mais"></div></div>
          <div class="card"><div class="card-header"><div><div class="card-title">Menor rentabilidade</div></div></div><div id="box-menos"></div></div>
        </div>`;

      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; render(); });
      container.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => (location.hash = b.dataset.go)));

      const box = document.getElementById("tbl");
      if (!data.length) box.innerHTML = UI.emptyState("Sem projetos para calcular rentabilidade.", "chart");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Projeto", render: (r) => `<strong>${UI.esc(r.nome)}</strong><div class="muted" style="font-size:11px">${UI.esc(r.client_name || "")}</div>` },
            { label: "Receita", align: "right", render: (r) => UI.money(r.receita) },
            { label: "Custo realizado", align: "right", render: (r) => UI.money(r.custo_realizado) },
            { label: "Custo est. × real.", align: "right", render: (r) => `<span class="${r.variacao_custo > 0 ? "negative" : "positive"}">${r.variacao_custo > 0 ? "+" : ""}${UI.money(r.variacao_custo)}</span>` },
            { label: "Lucro", align: "right", render: (r) => `<span class="${r.lucro >= 0 ? "positive" : "negative"} strong">${UI.money(r.lucro)}</span>` },
            { label: "Margem", align: "right", render: (r) => `<span class="${r.margem >= 15 ? "positive" : r.margem >= 0 ? "" : "negative"} strong">${UI.pct(r.margem)}</span>` },
          ],
          rows: data,
        });
      }
      const mini = (items, boxId) => {
        const el = document.getElementById(boxId);
        el.innerHTML = items.length
          ? UI.table({
              columns: [
                { label: "Projeto", render: (r) => UI.esc(r.nome) },
                { label: "Lucro", align: "right", render: (r) => UI.money(r.lucro) },
                { label: "Margem", align: "right", render: (r) => UI.pct(r.margem) },
              ],
              rows: items,
            })
          : UI.emptyState("Sem dados.", "chart");
      };
      mini(rank.mais_rentaveis || [], "box-mais");
      mini(rank.menos_rentaveis || [], "box-menos");
    }
    await render();
  }

  /* ------------------------------ PRECIFICAÇÃO ----------------------------- */
  async function pricing(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();

    async function renderList() {
      const data = await API.get("/reports/pricing", { page_size: 20 });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Precificação</div><div class="page-sub">Simulação de preço sugerido por serviço com três cenários.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-nova">${UI.icon("plus")} Nova simulação</button></div>
        </div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-header"><div><div class="card-title">Como funciona</div><div class="card-sub">Custo direto (horas × custo/hora + equipe + despesas) + custos indiretos (20%) + impostos + margem desejada = preço sugerido. Cenários: Conservador (margem × 0,75), Recomendado e Agressivo (margem × 1,25).</div></div></div>
        </div>
        <div id="tbl"></div>`;
      document.getElementById("btn-nova").addEventListener("click", () => openCalc(renderList));
      const box = document.getElementById("tbl");
      if (!data.items.length) box.innerHTML = UI.emptyState("Nenhuma simulação salva.", "tag");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Serviço", render: (r) => `<strong>${UI.esc(r.servico)}</strong><div class="muted" style="font-size:11px">${UI.esc(r.titulo || "")}</div>` },
            { label: "Cenário", render: (r) => UI.badge(r.cenario) },
            { label: "Horas", align: "right", render: (r) => r.horas },
            { label: "Custo/hora", align: "right", render: (r) => UI.money(r.custo_hora) },
            { label: "Custo direto", align: "right", render: (r) => UI.money(r.custo_direto) },
            { label: "Preço sugerido", align: "right", render: (r) => `<span class="strong">${UI.money(r.preco_sugerido)}</span>` },
            { label: "", align: "right", render: (r) => `<button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
          ],
          rows: data.items,
        });
        box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
          UI.confirm({ title: "Excluir simulação", message: "Deseja excluir esta simulação?", onConfirm: async () => {
            try { await API.del(`/reports/pricing/${b.dataset.del}`); UI.toast("Excluída.", "success"); renderList(); }
            catch (e) { UI.toast(e.message, "error"); }
          } });
        }));
      }
    }

    function openCalc(onDone) {
      const body = `
        <form id="form-pricing">
          <div class="field-row">
            <label class="field"><span>Cliente</span><select name="client_id"><option value="">BPO / geral</option>${clients.map(([v, l]) => `<option value="${v}">${UI.esc(l)}</option>`).join("")}</select></label>
            <label class="field"><span>Título</span><input name="titulo" placeholder="Ex.: Residencial 300m²" /></label>
          </div>
          <label class="field"><span>Serviço *</span><input name="servico" required placeholder="Projeto Arquitetônico Completo" /></label>
          <div class="field-row-3">
            <label class="field"><span>Horas</span><input type="number" step="0.5" name="horas" value="0" /></label>
            <label class="field"><span>Custo/hora (R$)</span><input type="number" step="0.01" name="custo_hora" value="0" /></label>
            <label class="field"><span>Despesas (R$)</span><input type="number" step="0.01" name="despesas" value="0" /></label>
          </div>
          <div class="field-row-3">
            <label class="field"><span>Impostos (%)</span><input type="number" step="0.1" name="impostos_pct" value="8" /></label>
            <label class="field"><span>Margem desejada (%)</span><input type="number" step="0.1" name="margem_desejada_pct" value="30" /></label>
            <label class="field"><span>Prazo (dias)</span><input type="number" name="prazo_dias" value="" /></label>
          </div>
          <label class="field"><span>Complexidade</span><select name="complexidade"><option value="">—</option><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option></select></label>
          <div id="resultado-pricing"></div>
        </form>`;
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
      footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Fechar</button><button class="btn btn-primary btn-sm" data-act="s">Calcular</button>`;
      const m = UI.modal({ title: "Nova simulação de precificação", body, footer, wide: true });
      footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
      footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
        const data = UI.formData(document.getElementById("form-pricing"));
        ["horas", "custo_hora", "despesas", "impostos_pct", "margem_desejada_pct", "prazo_dias"].forEach((k) => { data[k] = Number(data[k] || 0) || null; });
        data.equipe = [];
        try {
          const cenarios = await API.post("/reports/pricing/calculate", data);
          const box = document.getElementById("resultado-pricing");
          box.innerHTML = `<div class="section-title">Preço sugerido por cenário</div>
            <div class="grid-3">
              ${cenarios.map((c) => `
                <div class="card" style="text-align:center">
                  <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.6px">${UI.esc(c.cenario)}</div>
                  <div class="page-title" style="font-size:19px;margin:6px 0">${UI.money(c.preco_sugerido)}</div>
                  <div class="muted" style="font-size:11.5px">Impostos ${UI.money(c.impostos_valor)} · Margem ${UI.money(c.margem_valor)}</div>
                  <button class="btn btn-primary btn-sm" style="margin-top:10px" data-save="${c.cenario}" data-preco="${c.preco_sugerido}">Salvar cenário ${UI.esc(c.cenario)}</button>
                </div>`).join("")}
            </div>`;
          box.querySelectorAll("[data-save]").forEach((b) => b.addEventListener("click", async () => {
            const payload = { ...data, cenario: b.dataset.save };
            try {
              await API.post("/reports/pricing", payload);
              UI.toast(`Simulação salva (${b.dataset.save}) — ${UI.money(b.dataset.preco)}.`, "success");
              m.close();
              onDone();
            } catch (e) { UI.toast(e.message, "error"); }
          }));
        } catch (e) { UI.toast(e.message, "error"); }
      });
    }
    await renderList();
  }

  function barraFiltros(fields) {
    return `<div class="filter-bar">${fields.join("")}</div>`;
  }

  window.Pages.projects = { list, profitability, pricing };
})();
