/* ============================================================================
   Build Flow BPO — Contratos (cadastro, parcelas, vencimentos, alertas)
   ============================================================================ */
(() => {
  "use strict";
  window.Pages = window.Pages || {};

  const STATUS_CONTRATO = [
    ["EM_ANALISE", "Em análise"], ["PENDENTE", "Pendente"], ["ATIVO", "Ativo"],
    ["CONCLUIDO", "Concluído"], ["CANCELADO", "Cancelado"],
  ];
  let _clientOptions = [];
  async function clientsSelect() {
    if (_clientOptions.length) return _clientOptions;
    const data = await API.get("/clients", { page_size: 200 });
    _clientOptions = data.items.map((c) => [c.id, c.nome_fantasia || c.razao_social]);
    return _clientOptions;
  }

  async function list(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    let state = { page: 1, client_id: "", status: "" };

    async function render() {
      const data = await API.get("/contracts", {
        page: state.page, page_size: 15, client_id: state.client_id || undefined,
        status: state.status || undefined,
      });
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Contratos</div><div class="page-sub">Contratos de projetos, parcelas e alertas de vencimento.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-novo">${UI.icon("plus")} Novo contrato</button></div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
          <label class="field"><span>Status</span><select id="f-status"><option value="">Todos</option>${STATUS_CONTRATO.map(([v, l]) => `<option value="${v}" ${state.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; state.page = 1; render(); });
      document.getElementById("f-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-novo").addEventListener("click", () => openModal(render));

      const box = document.getElementById("tbl");
      if (!data.items.length) box.innerHTML = UI.emptyState("Nenhum contrato cadastrado.", "doc");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Número", render: (r) => `<strong>${UI.esc(r.numero)}</strong><div class="muted" style="font-size:11px">${UI.esc(r.client_name || "")}</div>` },
            { label: "Projeto", key: "project_name" },
            { label: "Início / Término", render: (r) => `${UI.date(r.inicio)} → ${UI.date(r.termino)}` },
            { label: "Valor", align: "right", render: (r) => UI.money(r.valor) },
            { label: "Parcelas", render: (r) => `${r.installments.filter((i) => i.status === "RECEBIDO").length}/${r.numero_parcelas}` },
            { label: "Status", render: (r) => UI.badge(r.status) },
            { label: "", align: "right", render: (r) => `
              <button class="btn btn-ghost btn-sm" data-detail="${r.id}">Abrir</button>
              <button class="btn btn-ghost btn-sm" data-edit="${r.id}">${UI.icon("edit")}</button>
              <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
          ],
          rows: data.items,
        });
        box.querySelectorAll("[data-detail]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.detail, render)));
        box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(render, data.items.find((x) => x.id === b.dataset.edit))));
        box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
          UI.confirm({ title: "Excluir contrato", message: "Deseja excluir este contrato e suas parcelas?", onConfirm: async () => {
            try { await API.del(`/contracts/${b.dataset.del}`); UI.toast("Contrato excluído.", "success"); render(); }
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
        const projetos = item ? await API.get("/projects", { client_id: item.client_id, page_size: 100 }) : { items: [] };
        const body = `
          <form id="form-cont">
            <div class="field-row">
              <label class="field"><span>Cliente *</span><select name="client_id" required id="sel-cli">${clienteSel.map(([v, l]) => `<option value="${v}" ${item && item.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
              <label class="field"><span>Número *</span><input name="numero" required value="${UI.esc(item ? item.numero : "")}" placeholder="CT-2025-001" /></label>
            </div>
            <div class="field-row">
              <label class="field"><span>Projeto</span><select name="projeto_id" id="sel-proj"><option value="">—</option>${projetos.items.map((p) => `<option value="${p.id}" ${item && item.projeto_id === p.id ? "selected" : ""}>${UI.esc(p.nome)}</option>`).join("")}</select></label>
              <label class="field"><span>Responsável</span><input name="responsavel" value="${UI.esc(item ? item.responsavel || "" : "")}" /></label>
            </div>
            <div class="field-row-3">
              <label class="field"><span>Data</span><input type="date" name="data" value="${item ? item.data || "" : ""}" /></label>
              <label class="field"><span>Início</span><input type="date" name="inicio" value="${item ? item.inicio || "" : ""}" /></label>
              <label class="field"><span>Término</span><input type="date" name="termino" value="${item ? item.termino || "" : ""}" /></label>
            </div>
            <div class="field-row-3">
              <label class="field"><span>Valor (R$)</span><input type="number" step="0.01" name="valor" value="${item ? item.valor : ""}" /></label>
              <label class="field"><span>Nº de parcelas</span><input type="number" min="1" name="numero_parcelas" value="${item ? item.numero_parcelas : 1}" /></label>
              <label class="field"><span>Forma de pagamento</span><input name="forma_pagamento" value="${UI.esc(item ? item.forma_pagamento || "" : "")}" /></label>
            </div>
            <label class="field"><span>Status</span><select name="status">${STATUS_CONTRATO.map(([v, l]) => `<option value="${v}" ${(!item && v === "EM_ANALISE") || (item && item.status === v) ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="field"><span>Observações</span><textarea name="observacoes" rows="2">${UI.esc(item ? item.observacoes || "" : "")}</textarea></label>
            ${item ? "" : `<p class="muted" style="font-size:12px">Ao criar, as parcelas serão geradas automaticamente conforme o número informado (vencimentos a cada 30 dias).</p>`}
          </form>`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">${item ? "Salvar" : "Criar"}</button>`;
        const m = UI.modal({ title: item ? "Editar contrato" : "Novo contrato", body, footer, wide: true });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
        footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
          const data = UI.formData(document.getElementById("form-cont"));
          data.valor = Number(data.valor || 0);
          data.numero_parcelas = Number(data.numero_parcelas || 1);
          if (!data.projeto_id) data.projeto_id = null;
          try {
            if (item) await API.put(`/contracts/${item.id}`, data);
            else await API.post("/contracts", data);
            UI.toast(item ? "Contrato atualizado." : "Contrato criado com parcelas.", "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        });
      })();
    }

    function openDetail(contractId, onDone) {
      (async () => {
        const c = await API.get(`/contracts/${contractId}`);
        const body = `
          <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
            ${UI.kpi({ label: "Valor", value: UI.money(c.valor), iconName: "receive" })}
            ${UI.kpi({ label: "Parcelas", value: `${c.installments.filter((i) => i.status === "RECEBIDO").length}/${c.numero_parcelas}`, iconName: "doc" })}
            ${UI.kpi({ label: "Status", value: UI.badge(c.status), iconName: "check" })}
          </div>
          <div class="section-title">Parcelas</div>
          ${UI.table({
            columns: [
              { label: "#", key: "numero" },
              { label: "Vencimento", render: (r) => UI.date(r.vencimento) },
              { label: "Recebimento", render: (r) => UI.date(r.recebimento) },
              { label: "Valor", align: "right", render: (r) => UI.money(r.valor) },
              { label: "Juros/Multa", align: "right", render: (r) => `${UI.money(r.juros)} / ${UI.money(r.multa)}` },
              { label: "Status", render: (r) => UI.badge(r.status) },
              { label: "", align: "right", render: (r) => r.status !== "RECEBIDO" ? `<button class="btn btn-success btn-sm" data-rec="${r.id}">Receber</button>` : "" },
            ],
            rows: c.installments,
          })}`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Fechar</button>`;
        const m = UI.modal({ title: `Contrato ${c.numero}`, body, footer, wide: true });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
        m.backdrop.querySelectorAll("[data-rec]").forEach((b) => b.addEventListener("click", async () => {
          try {
            await API.post(`/contracts/${contractId}/installments/${b.dataset.rec}/receive`, {});
            UI.toast("Parcela recebida.", "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        }));
      })();
    }
    await render();
  }

  window.Pages.contracts = { list };
})();
