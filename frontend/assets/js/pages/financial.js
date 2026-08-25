/* ============================================================================
   Build Flow BPO — Financeiro (fluxo de caixa, pagar, receber, conciliação, DRE, inadimplência)
   ============================================================================ */
(() => {
  "use strict";
  window.Pages = window.Pages || {};

  let _clientOptions = [];

  async function clientsSelect() {
    if (_clientOptions.length) return _clientOptions;
    const data = await API.get("/clients", { page_size: 200 });
    _clientOptions = data.items.map((c) => [c.id, c.nome_fantasia || c.razao_social]);
    return _clientOptions;
  }

  async function categoriesByType(tipo) {
    const data = await API.get("/financial/categories", { tipo });
    return data.map((c) => [c.id, c.nome]);
  }

  function periodoPadrao() {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
    return {
      ini: inicio.toISOString().slice(0, 10),
      fim: hoje.toISOString().slice(0, 10),
    };
  }

  function barraFiltros(fields) {
    return `<div class="filter-bar">${fields.join("")}</div>`;
  }

  function goTo(hash) {
    location.hash = hash;
  }

  /* ------------------------------ FLUXO DE CAIXA --------------------------- */
  async function cashflow(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    const cats = await categoriesByType("despesa");
    const catsAll = await API.get("/financial/categories");
    const catsReceita = catsAll.filter((c) => c.tipo === "receita");
    let state = { page: 1, client_id: "", tipo: "", data_inicio: "", data_fim: "" };

    async function render() {
      const data = await API.get("/financial/cashflow", {
        page: state.page, page_size: 15, client_id: state.client_id || undefined,
        tipo: state.tipo || undefined, data_inicio: state.data_inicio || undefined,
        data_fim: state.data_fim || undefined,
      });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Fluxo de Caixa</div><div class="page-sub">Entradas e saídas diárias, semanais e mensais.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-novo">${UI.icon("plus")} Novo lançamento</button></div>
        </div>
        ${barraFiltros([
          `<label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>`,
          `<label class="field"><span>Tipo</span><select id="f-tipo"><option value="">Todos</option><option value="entrada" ${state.tipo === "entrada" ? "selected" : ""}>Entrada</option><option value="saida" ${state.tipo === "saida" ? "selected" : ""}>Saída</option></select></label>`,
          `<label class="field"><span>De</span><input type="date" id="f-ini" value="${state.data_inicio}" /></label>`,
          `<label class="field"><span>Até</span><input type="date" id="f-fim" value="${state.data_fim}" /></label>`,
        ])}
        <div id="resumo"></div>
        <div id="tbl"></div>
        <div id="pag"></div>`;

      ["f-cliente", "f-tipo"].forEach((id) => {
        document.getElementById(id).addEventListener("change", (e) => {
          state[id === "f-cliente" ? "client_id" : "tipo"] = e.target.value;
          state.page = 1; render();
        });
      });
      document.getElementById("f-ini").addEventListener("change", (e) => { state.data_inicio = e.target.value; state.page = 1; render(); });
      document.getElementById("f-fim").addEventListener("change", (e) => { state.data_fim = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-novo").addEventListener("click", () => openCashflowModal(render));

      // resumo (filtro cliente)
      if (state.client_id) {
        const res = document.getElementById("resumo");
        const s = await API.get("/financial/cashflow/summary", { client_id: state.client_id, data_inicio: state.data_inicio || undefined, data_fim: state.data_fim || undefined });
        res.innerHTML = `<div class="kpi-grid">
          ${UI.kpi({ label: "Entradas", value: UI.money(s.entradas), iconName: "receive", tone: "positive" })}
          ${UI.kpi({ label: "Saídas", value: UI.money(s.saidas), iconName: "pay", tone: "negative" })}
          ${UI.kpi({ label: "Saldo do período", value: UI.money(s.saldo_final), iconName: "wallet", tone: s.saldo_final >= 0 ? "positive" : "negative" })}
        </div>`;
      } else {
        document.getElementById("resumo").innerHTML = `<p class="muted" style="margin:6px 0 12px">Selecione um cliente para ver o resumo e a projeção do período.</p>`;
      }

      const box = document.getElementById("tbl");
      if (!data.items.length) { box.innerHTML = UI.emptyState("Nenhum lançamento no período.", "wallet"); }
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Data", render: (r) => UI.date(r.data) },
            { label: "Tipo", render: (r) => UI.badge(r.tipo) },
            { label: "Descrição", render: (r) => `<strong>${UI.esc(r.descricao || "—")}</strong><div class="muted" style="font-size:11px">${UI.esc(r.client_name || "BPO interno")}</div>` },
            { label: "Categoria", render: (r) => UI.esc(r.categoria_nome || "—") },
            { label: "Valor", align: "right", render: (r) => `<span class="${r.tipo === "entrada" ? "positive" : "negative"} strong">${r.tipo === "entrada" ? "+" : "−"}${UI.money(r.valor)}</span>` },
            { label: "", align: "right", render: (r) => `
              <button class="btn btn-ghost btn-sm" data-edit="${r.id}">${UI.icon("edit")}</button>
              <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
          ],
          rows: data.items,
        });
        box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openCashflowModal(render, data.items.find((x) => x.id === b.dataset.edit))));
        box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
          UI.confirm({ title: "Excluir lançamento", message: "Deseja excluir este lançamento de fluxo de caixa?", onConfirm: async () => {
            try { await API.del(`/financial/cashflow/${b.dataset.del}`); UI.toast("Lançamento excluído.", "success"); render(); }
            catch (e) { UI.toast(e.message, "error"); }
          } });
        }));
      }
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 15, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }

    function openCashflowModal(onDone, item = null) {
      (async () => {
        const clienteSel = await clientsSelect();
        const catsSel = await API.get("/financial/categories");
        const body = `
          <form id="form-cf">
            <div class="field-row">
              <label class="field"><span>Tipo *</span><select name="tipo">
                <option value="entrada" ${item && item.tipo === "entrada" ? "selected" : !item ? "selected" : ""}>Entrada</option>
                <option value="saida" ${item && item.tipo === "saida" ? "selected" : ""}>Saída</option>
              </select></label>
              <label class="field"><span>Data *</span><input type="date" name="data" required value="${item ? item.data : new Date().toISOString().slice(0, 10)}" /></label>
            </div>
            <div class="field-row">
              <label class="field"><span>Cliente</span><select name="client_id"><option value="">BPO interno</option>${clienteSel.map(([v, l]) => `<option value="${v}" ${item && item.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
              <label class="field"><span>Categoria</span><select name="categoria_id"><option value="">—</option>${catsSel.map((c) => `<option value="${c.id}" ${item && item.categoria_id === c.id ? "selected" : ""}>${UI.esc(c.nome)}</option>`).join("")}</select></label>
            </div>
            <label class="field"><span>Valor (R$) *</span><input type="number" step="0.01" min="0.01" name="valor" required value="${item ? item.valor : ""}" /></label>
            <label class="field"><span>Descrição</span><input name="descricao" value="${UI.esc(item ? item.descricao || "" : "")}" placeholder="Ex.: Recebimento parcela 2 — Alameda" /></label>
            <label class="field"><span>Forma de pagamento</span><input name="forma_pagamento" value="${UI.esc(item ? item.forma_pagamento || "" : "")}" placeholder="PIX, boleto, transferência…" /></label>
          </form>`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">${item ? "Salvar" : "Criar"}</button>`;
        const m = UI.modal({ title: item ? "Editar lançamento" : "Novo lançamento", body, footer });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
        footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
          const data = UI.formData(document.getElementById("form-cf"));
          data.valor = Number(data.valor);
          if (!data.client_id) data.client_id = null;
          if (!data.categoria_id) data.categoria_id = null;
          try {
            if (item) await API.put(`/financial/cashflow/${item.id}`, data);
            else await API.post("/financial/cashflow", data);
            UI.toast(item ? "Lançamento atualizado." : "Lançamento criado.", "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        });
      })();
    }
    await render();
  }

  /* ------------------------------ CONTAS A PAGAR --------------------------- */
  async function payables(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    const cats = await categoriesByType("despesa");
    let state = { page: 1, client_id: "", status: "PENDENTE" };

    async function render() {
      const data = await API.get("/financial/payables", {
        page: state.page, page_size: 15, client_id: state.client_id || undefined,
        status: state.status || undefined,
      });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Contas a Pagar</div><div class="page-sub">Compromissos do escritório com fornecedores e despesas.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-novo">${UI.icon("plus")} Nova conta</button></div>
        </div>
        ${barraFiltros([
          `<label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>`,
          `<label class="field"><span>Status</span><select id="f-status"><option value="">Todos</option>${["PENDENTE", "PAGO", "ATRASADO", "CANCELADO"].map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${UI.esc(s)}</option>`).join("")}</select></label>`,
        ])}
        <div id="tbl"></div><div id="pag"></div>`;
      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; state.page = 1; render(); });
      document.getElementById("f-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-novo").addEventListener("click", () => openModal(render));

      const box = document.getElementById("tbl");
      if (!data.items.length) box.innerHTML = UI.emptyState("Nenhuma conta a pagar.", "pay");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Fornecedor", render: (r) => `<strong>${UI.esc(r.fornecedor)}</strong><div class="muted" style="font-size:11px">${UI.esc(r.client_name || "BPO interno")}</div>` },
            { label: "Descrição", key: "descricao" },
            { label: "Categoria", key: "categoria_nome" },
            { label: "Vencimento", render: (r) => UI.date(r.vencimento) },
            { label: "Valor", align: "right", render: (r) => UI.money(r.valor) },
            { label: "Status", render: (r) => UI.badge(r.status) },
            { label: "", align: "right", render: (r) => `
              ${r.status !== "PAGO" ? `<button class="btn btn-success btn-sm" data-pay="${r.id}">Pagar</button>` : ""}
              <button class="btn btn-ghost btn-sm" data-edit="${r.id}">${UI.icon("edit")}</button>
              <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
          ],
          rows: data.items,
        });
        box.querySelectorAll("[data-pay]").forEach((b) => b.addEventListener("click", async () => {
          try { await API.post(`/financial/payables/${b.dataset.pay}/pay`, {}); UI.toast("Conta quitada.", "success"); render(); }
          catch (e) { UI.toast(e.message, "error"); }
        }));
        box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(render, data.items.find((x) => x.id === b.dataset.edit))));
        box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
          UI.confirm({ title: "Excluir conta", message: "Deseja excluir esta conta a pagar?", onConfirm: async () => {
            try { await API.del(`/financial/payables/${b.dataset.del}`); UI.toast("Conta excluída.", "success"); render(); }
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
        const catsSel = await API.get("/financial/categories");
        const catsDesp = catsSel.filter((c) => c.tipo === "despesa");
        const body = `
          <form id="form-pay">
            <label class="field"><span>Fornecedor *</span><input name="fornecedor" required value="${UI.esc(item ? item.fornecedor : "")}" placeholder="Nome do fornecedor" /></label>
            <div class="field-row">
              <label class="field"><span>Cliente</span><select name="client_id"><option value="">BPO interno</option>${clienteSel.map(([v, l]) => `<option value="${v}" ${item && item.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
              <label class="field"><span>Categoria</span><select name="categoria_id"><option value="">—</option>${catsDesp.map((c) => `<option value="${c.id}" ${item && item.categoria_id === c.id ? "selected" : ""}>${UI.esc(c.nome)}</option>`).join("")}</select></label>
            </div>
            <div class="field-row">
              <label class="field"><span>Valor (R$) *</span><input type="number" step="0.01" min="0.01" name="valor" required value="${item ? item.valor : ""}" /></label>
              <label class="field"><span>Vencimento</span><input type="date" name="vencimento" value="${item ? item.vencimento || "" : ""}" /></label>
            </div>
            <div class="field-row">
              <label class="field"><span>Centro de custo</span><input name="centro_custo" value="${UI.esc(item ? item.centro_custo || "" : "")}" placeholder="Ex.: PROJETO_ALAMEDA" /></label>
              <label class="field"><span>Status</span><select name="status">${["PENDENTE", "PAGO", "ATRASADO", "CANCELADO"].map((s) => `<option ${(!item && s === "PENDENTE") || (item && item.status === s) ? "selected" : ""}>${s}</option>`).join("")}</select></label>
            </div>
            <label class="field"><span>Descrição</span><input name="descricao" value="${UI.esc(item ? item.descricao || "" : "")}" /></label>
            <label class="field"><span>Observações</span><textarea name="observacoes" rows="2">${UI.esc(item ? item.observacoes || "" : "")}</textarea></label>
          </form>`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">${item ? "Salvar" : "Criar"}</button>`;
        const m = UI.modal({ title: item ? "Editar conta a pagar" : "Nova conta a pagar", body, footer });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
        footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
          const data = UI.formData(document.getElementById("form-pay"));
          data.valor = Number(data.valor);
          if (!data.client_id) data.client_id = null;
          if (!data.categoria_id) data.categoria_id = null;
          try {
            if (item) await API.put(`/financial/payables/${item.id}`, data);
            else await API.post("/financial/payables", data);
            UI.toast(item ? "Conta atualizada." : "Conta criada.", "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        });
      })();
    }
    await render();
  }

  /* ------------------------------ CONTAS A RECEBER ------------------------- */
  async function receivables(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    let state = { page: 1, client_id: "", status: "" };

    async function render() {
      const data = await API.get("/financial/receivables", {
        page: state.page, page_size: 15, client_id: state.client_id || undefined,
        status: state.status || undefined,
      });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Contas a Receber</div><div class="page-sub">Faturamento, parcelas de contratos e acompanhamento de recebimento.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-novo">${UI.icon("plus")} Nova conta</button></div>
        </div>
        ${barraFiltros([
          `<label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>`,
          `<label class="field"><span>Status</span><select id="f-status"><option value="">Todos</option>${["A_RECEBER", "RECEBIDO", "ATRASADO", "CANCELADO"].map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${UI.esc(s.replace("_", " "))}</option>`).join("")}</select></label>`,
        ])}
        <div id="tbl"></div><div id="pag"></div>`;
      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; state.page = 1; render(); });
      document.getElementById("f-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-novo").addEventListener("click", () => openModal(render));

      const box = document.getElementById("tbl");
      if (!data.items.length) box.innerHTML = UI.emptyState("Nenhuma conta a receber.", "receive");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Descrição", render: (r) => `<strong>${UI.esc(r.descricao || "—")}</strong><div class="muted" style="font-size:11px">${UI.esc(r.client_name || "")}</div>` },
            { label: "Parcela", key: "parcela" },
            { label: "Vencimento", render: (r) => UI.date(r.vencimento) },
            { label: "Valor", align: "right", render: (r) => UI.money(r.valor) },
            { label: "Status", render: (r) => UI.badge(r.status) },
            { label: "", align: "right", render: (r) => `
              ${r.status !== "RECEBIDO" ? `<button class="btn btn-success btn-sm" data-rec="${r.id}">Receber</button>` : ""}
              <button class="btn btn-ghost btn-sm" data-edit="${r.id}">${UI.icon("edit")}</button>
              <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
          ],
          rows: data.items,
        });
        box.querySelectorAll("[data-rec]").forEach((b) => b.addEventListener("click", async () => {
          try { await API.post(`/financial/receivables/${b.dataset.rec}/receive`, {}); UI.toast("Recebimento registrado e lançado no fluxo de caixa.", "success"); render(); }
          catch (e) { UI.toast(e.message, "error"); }
        }));
        box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(render, data.items.find((x) => x.id === b.dataset.edit))));
        box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
          UI.confirm({ title: "Excluir conta", message: "Deseja excluir esta conta a receber?", onConfirm: async () => {
            try { await API.del(`/financial/receivables/${b.dataset.del}`); UI.toast("Conta excluída.", "success"); render(); }
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
          <form id="form-rec">
            <div class="field-row">
              <label class="field"><span>Cliente *</span><select name="client_id" required><option value="">Selecione…</option>${clienteSel.map(([v, l]) => `<option value="${v}" ${item && item.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
              <label class="field"><span>Parcela</span><input type="number" name="parcela" value="${item ? item.parcela || "" : ""}" /></label>
            </div>
            <label class="field"><span>Descrição</span><input name="descricao" value="${UI.esc(item ? item.descricao || "" : "")}" placeholder="Ex.: Honorários — Parcela 1" /></label>
            <div class="field-row">
              <label class="field"><span>Valor (R$) *</span><input type="number" step="0.01" min="0.01" name="valor" required value="${item ? item.valor : ""}" /></label>
              <label class="field"><span>Vencimento</span><input type="date" name="vencimento" value="${item ? item.vencimento || "" : ""}" /></label>
            </div>
            <div class="field-row-3">
              <label class="field"><span>Juros</span><input type="number" step="0.01" name="juros" value="${item ? item.juros : 0}" /></label>
              <label class="field"><span>Multa</span><input type="number" step="0.01" name="multa" value="${item ? item.multa : 0}" /></label>
              <label class="field"><span>Status</span><select name="status">${["A_RECEBER", "RECEBIDO", "ATRASADO", "CANCELADO"].map((s) => `<option ${(!item && s === "A_RECEBER") || (item && item.status === s) ? "selected" : ""}>${s}</option>`).join("")}</select></label>
            </div>
            <label class="field"><span>Observações</span><textarea name="observacoes" rows="2">${UI.esc(item ? item.observacoes || "" : "")}</textarea></label>
          </form>`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">${item ? "Salvar" : "Criar"}</button>`;
        const m = UI.modal({ title: item ? "Editar conta a receber" : "Nova conta a receber", body, footer });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
        footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
          const data = UI.formData(document.getElementById("form-rec"));
          data.valor = Number(data.valor);
          data.juros = Number(data.juros || 0);
          data.multa = Number(data.multa || 0);
          if (!data.parcela) data.parcela = null;
          try {
            if (item) await API.put(`/financial/receivables/${item.id}`, data);
            else await API.post("/financial/receivables", data);
            UI.toast(item ? "Conta atualizada." : "Conta criada.", "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        });
      })();
    }
    await render();
  }

  /* ------------------------------ CONCILIAÇÃO ------------------------------ */
  async function bank(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    let state = { page: 1, client_id: clients.length ? clients[0][0] : "", status: "" };

    async function render() {
      const data = await API.get("/financial/bank", {
        page: state.page, page_size: 15, client_id: state.client_id || undefined,
        status: state.status || undefined,
      });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Conciliação Bancária</div><div class="page-sub">Extratos, lançamentos e identificação de divergências.</div></div>
          <div class="page-actions">
            <button class="btn btn-primary" id="btn-import">${UI.icon("download")} Importar CSV</button>
            <button class="btn btn-ghost" id="btn-novo">${UI.icon("plus")} Manual</button>
          </div>
        </div>
        ${barraFiltros([
          `<label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>`,
          `<label class="field"><span>Status</span><select id="f-status"><option value="">Todos</option>${["CONCILIADO", "PENDENTE", "DIVERGENTE"].map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${UI.esc(s)}</option>`).join("")}</select></label>`,
        ])}
        <div class="card" style="margin-bottom:16px">
          <div class="card-header"><div><div class="card-title">Como conciliar</div><div class="card-sub">Importe o extrato CSV (data;descrição;valor — negativo para saída) e vincule cada transação a um lançamento do fluxo de caixa. Divergências de valor ficam sinalizadas.</div></div></div>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; state.page = 1; render(); });
      document.getElementById("f-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-import").addEventListener("click", openImport);
      document.getElementById("btn-novo").addEventListener("click", openManual);

      const box = document.getElementById("tbl");
      if (!data.items.length) box.innerHTML = UI.emptyState("Nenhuma transação bancária.", "bank");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Data", render: (r) => UI.date(r.data_movimento) },
            { label: "Descrição", render: (r) => `<strong>${UI.esc(r.descricao || "—")}</strong><div class="muted" style="font-size:11px">${UI.esc(r.conta || "")} · ${UI.esc(r.client_name || "")}</div>` },
            { label: "Valor", align: "right", render: (r) => `<span class="${r.tipo === "entrada" ? "positive" : "negative"} strong">${r.tipo === "entrada" ? "+" : "−"}${UI.money(r.valor)}</span>` },
            { label: "Status", render: (r) => UI.badge(r.status_conciliacao) },
            { label: "", align: "right", render: (r) => `
              ${r.status_conciliacao !== "CONCILIADO" ? `<button class="btn btn-primary btn-sm" data-conc="${r.id}">Conciliar</button>` : ""}
              <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
          ],
          rows: data.items,
        });
        box.querySelectorAll("[data-conc]").forEach((b) => b.addEventListener("click", () => openConciliar(b.dataset.conc, render)));
        box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
          UI.confirm({ title: "Excluir transação", message: "Deseja excluir esta transação bancária?", onConfirm: async () => {
            try { await API.del(`/financial/bank/${b.dataset.del}`); UI.toast("Excluída.", "success"); render(); }
            catch (e) { UI.toast(e.message, "error"); }
          } });
        }));
      }
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 15, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }

    function openImport() {
      const body = `
        <form id="form-import">
          <label class="field"><span>Cliente *</span><select name="client_id">${clients.map(([v, l]) => `<option value="${v}">${UI.esc(l)}</option>`).join("")}</select></label>
          <label class="field"><span>Conta</span><input name="conta" value="Conta bancária" /></label>
          <label class="field"><span>Arquivo CSV *</span><input type="file" name="file" accept=".csv" required /></label>
        </form>`;
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
      footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">Importar</button>`;
      const m = UI.modal({ title: "Importar extrato (CSV)", body, footer });
      footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
      footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
        const form = document.getElementById("form-import");
        const fd = new FormData(form);
        try {
          const r = await API.upload(`/financial/bank/import`, fd);
          UI.toast(`${r.importadas} transação(ões) importada(s).`, "success");
          m.close();
          render();
        } catch (e) { UI.toast(e.message, "error"); }
      });
    }

    function openManual() {
      const body = `
        <form id="form-bank">
          <label class="field"><span>Cliente *</span><select name="client_id" required>${clients.map(([v, l]) => `<option value="${v}">${UI.esc(l)}</option>`).join("")}</select></label>
          <div class="field-row">
            <label class="field"><span>Data *</span><input type="date" name="data_movimento" required value="${new Date().toISOString().slice(0, 10)}" /></label>
            <label class="field"><span>Tipo</span><select name="tipo"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
          </div>
          <div class="field-row">
            <label class="field"><span>Valor (R$) *</span><input type="number" step="0.01" name="valor" required /></label>
            <label class="field"><span>Conta</span><input name="conta" value="Conta bancária" /></label>
          </div>
          <label class="field"><span>Descrição</span><input name="descricao" /></label>
        </form>`;
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
      footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">Criar</button>`;
      const m = UI.modal({ title: "Lançamento manual no extrato", body, footer });
      footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
      footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
        const data = UI.formData(document.getElementById("form-bank"));
        data.valor = Number(data.valor);
        try { await API.post("/financial/bank", data); UI.toast("Transação criada.", "success"); m.close(); render(); }
        catch (e) { UI.toast(e.message, "error"); }
      });
    }

    function openConciliar(bankId, onDone) {
      (async () => {
        const cf = await API.get("/financial/cashflow", { client_id: state.client_id || undefined, page_size: 200 });
        const body = `
          <p class="muted" style="margin-bottom:12px">Selecione o lançamento do fluxo de caixa que corresponde à transação do extrato.</p>
          <label class="field"><span>Lançamento do fluxo de caixa</span>
            <select id="sel-cf">
              ${cf.items.map((x) => `<option value="${x.id}">${UI.date(x.data)} · ${UI.esc(x.descricao || "—")} · ${UI.money(x.valor)} (${x.tipo})</option>`).join("")}
            </select></label>`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">Conciliar</button>`;
        const m = UI.modal({ title: "Conciliar transação", body, footer, wide: true });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
        footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
          try {
            await API.post(`/financial/bank/${bankId}/conciliate`, { cashflow_id: document.getElementById("sel-cf").value });
            UI.toast("Transação conciliada.", "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        });
      })();
    }
    await render();
  }

  /* ---------------------------------- DRE ---------------------------------- */
  async function dre(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    const hoje = new Date();
    let state = { client_id: clients.length ? clients[0][0] : "", mes: hoje.getMonth() + 1, ano: hoje.getFullYear() };

    async function render() {
      const data = await API.get("/financial/dre", { client_id: state.client_id, mes: state.mes, ano: state.ano });
      const d = data.atual;
      const linhas = [
        ["Receita Bruta", d.receita_bruta, false],
        ["(−) Impostos", d.impostos, false],
        ["= Receita Líquida", d.receita_liquida, true],
        ["(−) Custos Diretos", d.custos_diretos, false],
        ["= Margem de Contribuição", d.margem_contribuicao, true],
        ["(−) Despesas Operacionais", d.despesas_operacionais, false],
        ["= Resultado Operacional", d.resultado_operacional, true],
        ["(−) Despesas Financeiras", d.despesas_financeiras, false],
        ["= Resultado Líquido", d.resultado_liquido, true],
      ];
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">DRE Gerencial</div><div class="page-sub">Demonstração de resultados do mês — realizado × orçado.</div></div>
        </div>
        ${barraFiltros([
          `<label class="field"><span>Cliente</span><select id="f-cliente">${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>`,
          `<label class="field"><span>Mês</span><select id="f-mes">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${state.mes === i + 1 ? "selected" : ""}>${String(i + 1).padStart(2, "0")}</option>`).join("")}</select></label>`,
          `<label class="field"><span>Ano</span><select id="f-ano">${[hoje.getFullYear(), hoje.getFullYear() - 1].map((a) => `<option value="${a}" ${state.ano === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>`,
        ])}
        <div class="kpi-grid">
          ${UI.kpi({ label: "Receita bruta", value: UI.money(d.receita_bruta), iconName: "receive", tone: "positive" })}
          ${UI.kpi({ label: "Resultado líquido", value: UI.money(d.resultado_liquido), iconName: "trendUp", tone: d.resultado_liquido >= 0 ? "positive" : "negative" })}
          ${UI.kpi({ label: "Orçado (previsto)", value: UI.money(d.orcado), iconName: "target" })}
          ${UI.kpi({ label: "Variação realizado × orçado", value: `${d.variacao >= 0 ? "+" : ""}${UI.money(d.variacao)}`, iconName: "chart", tone: d.variacao >= 0 ? "positive" : "negative" })}
        </div>
        <div class="grid-2-1">
          <div class="card">
            <div class="card-header"><div><div class="card-title">Estrutura do DRE</div></div></div>
            ${UI.table({
              columns: [
                { label: "Conta", render: (r) => `<span class="${r.bold ? "strong" : ""}">${UI.esc(r.nome)}</span>` },
                { label: "Valor", align: "right", render: (r) => `<span class="${r.bold ? "strong" : ""}">${UI.money(r.valor)}</span>` },
              ],
              rows: linhas.map(([nome, valor, bold]) => ({ nome, valor: Number(valor), bold })),
            })}
          </div>
          <div class="card">
            <div class="card-header"><div><div class="card-title">Evolução (meses anteriores)</div></div></div>
            <div class="chart-box"><canvas id="c-dre"></canvas></div>
          </div>
        </div>`;

      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; render(); });
      document.getElementById("f-mes").addEventListener("change", (e) => { state.mes = Number(e.target.value); render(); });
      document.getElementById("f-ano").addEventListener("change", (e) => { state.ano = Number(e.target.value); render(); });

      const serie = data.serie || [];
      const p = Charts.palette();
      Charts.bar("c-dre", serie.map((s) => `${String(s.mes).padStart(2, "0")}/${s.ano}`), [
        { label: "Resultado líquido", data: serie.map((s) => s.resultado_liquido), backgroundColor: serie.map((s) => (s.resultado_liquido >= 0 ? p.success : p.danger)) },
      ]);
    }
    await render();
  }

  /* ------------------------------ INADIMPLÊNCIA ---------------------------- */
  async function inadimplencia(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    let state = { client_id: "" };

    async function render() {
      const data = await API.get("/financial/inadimplencia", { client_id: state.client_id || undefined });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Inadimplência</div><div class="page-sub">Painel de títulos vencidos, faixas de atraso e ranking por cliente.</div></div>
        </div>
        ${barraFiltros([
          `<label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>`,
        ])}
        <div class="kpi-grid">
          ${UI.kpi({ label: "Total vencido", value: UI.money(data.total_vencido), iconName: "alert", tone: data.total_vencido ? "negative" : "positive" })}
          ${UI.kpi({ label: "Títulos vencidos", value: data.quantidade_titulos, iconName: "doc" })}
          ${UI.kpi({ label: "Dias médios de atraso", value: data.dias_medio_atraso, iconName: "calendar", tone: data.dias_medio_atraso > 30 ? "negative" : "" })}
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div><div class="card-title">Valores por faixa de atraso</div></div></div>
            <div class="chart-box sm"><canvas id="c-faixas"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><div><div class="card-title">Ranking de inadimplência por cliente</div></div></div>
            <div id="tbl-rank"></div>
          </div>
        </div>`;

      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; render(); });

      const faixas = data.faixas || [];
      const p = Charts.palette();
      Charts.bar("c-faixas", faixas.map((f) => f.faixa), [
        { label: "Valor vencido", data: faixas.map((f) => f.valor), backgroundColor: [p.accent, p.warning, p.danger, "#7C3AED", p.accent2] },
      ]);

      const box = document.getElementById("tbl-rank");
      box.innerHTML = (data.ranking || []).length
        ? UI.table({
            columns: [
              { label: "Cliente", render: (r) => `<strong>${UI.esc(r.client_name || "—")}</strong>` },
              { label: "Títulos", key: "titulos", align: "right" },
              { label: "Valor", align: "right", render: (r) => `<span class="negative strong">${UI.money(r.valor)}</span>` },
            ],
            rows: data.ranking,
          })
        : UI.emptyState("Nenhum título vencido.", "check");
    }
    await render();
  }

  window.Pages.financial = { cashflow, payables, receivables, bank, dre, inadimplencia };
})();
