/* ============================================================================
   Build Flow BPO — Coleta Semanal
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

  const TIPOS_ITEM = [
    ["CONTRATO", "Novo contrato"], ["GASTO_EXTRA", "Gasto extra"], ["ENTRADA", "Entrada"],
    ["SAIDA", "Saída"], ["PAGAMENTO", "Pagamento"], ["RECEBIMENTO", "Recebimento"],
    ["DIVERGENCIA", "Divergência"], ["DOCUMENTO", "Documento"],
  ];

  function monday() {
    const d = new Date();
    const dia = (d.getDay() + 6) % 7; // segunda = 0
    d.setDate(d.getDate() - dia);
    return d.toISOString().slice(0, 10);
  }

  async function list(container) {
    UI.pageLoader(container);
    const clients = await clientsSelect();
    let state = { page: 1, client_id: "", status: "" };

    async function render() {
      const [data, pendentes] = await Promise.all([
        API.get("/collections", {
          page: state.page, page_size: 15, client_id: state.client_id || undefined,
          status: state.status || undefined,
        }),
        API.get("/collections/pending"),
      ]);
      container.innerHTML = `
        <div class="page-head">
          <div><div class="page-title">Coleta Semanal</div><div class="page-sub">Registro semanal de novos contratos, gastos, entradas, saídas e documentação.</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btn-nova">${UI.icon("plus")} Nova coleta</button></div>
        </div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-header"><div><div class="card-title">Pendências da semana</div><div class="card-sub">Clientes ativos sem coleta registrada</div></div></div>
          <div id="box-pendentes"></div>
        </div>
        <div class="filter-bar">
          <label class="field"><span>Cliente</span><select id="f-cliente"><option value="">Todos</option>${clients.map(([v, l]) => `<option value="${v}" ${state.client_id === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
          <label class="field"><span>Status</span><select id="f-status"><option value="">Todos</option>${["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA"].map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${UI.esc(s.replace("_", " "))}</option>`).join("")}</select></label>
        </div>
        <div id="tbl"></div><div id="pag"></div>`;

      document.getElementById("f-cliente").addEventListener("change", (e) => { state.client_id = e.target.value; state.page = 1; render(); });
      document.getElementById("f-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(); });
      document.getElementById("btn-nova").addEventListener("click", () => openNova(render));

      const boxP = document.getElementById("box-pendentes");
      if (!pendentes.length) boxP.innerHTML = `<p class="muted" style="font-size:13px">${UI.icon("check")} Todos os clientes ativos com coleta registrada nesta semana.</p>`;
      else {
        boxP.innerHTML = pendentes.map((p) => `
          <button class="btn btn-ghost btn-sm" style="margin:4px" data-criar="${p.client_id}" data-nome="${UI.esc(p.client_name)}">
            ${UI.icon("calendar")} ${UI.esc(p.client_name)}
          </button>`).join("");
        boxP.querySelectorAll("[data-criar]").forEach((b) => b.addEventListener("click", () => openNova(render, b.dataset.criar, b.dataset.nome)));
      }

      const box = document.getElementById("tbl");
      if (!data.items.length) box.innerHTML = UI.emptyState("Nenhuma coleta registrada.", "calendar");
      else {
        box.innerHTML = UI.table({
          columns: [
            { label: "Cliente", render: (r) => `<strong>${UI.esc(r.client_name)}</strong>` },
            { label: "Semana", render: (r) => UI.date(r.semana) },
            { label: "Coletado por", render: (r) => UI.esc(r.user_name || "—") },
            { label: "Itens", render: (r) => `<span class="badge blue">${r.items.length}</span>` },
            { label: "Status", render: (r) => UI.badge(r.status) },
            { label: "", align: "right", render: (r) => `
              <button class="btn btn-ghost btn-sm" data-open="${r.id}">Abrir</button>
              <button class="btn btn-ghost btn-sm" data-del="${r.id}">${UI.icon("trash")}</button>` },
          ],
          rows: data.items,
        });
        box.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openDetalhe(b.dataset.open, render)));
        box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
          UI.confirm({ title: "Excluir coleta", message: "Deseja excluir esta coleta semanal?", onConfirm: async () => {
            try { await API.del(`/collections/${b.dataset.del}`); UI.toast("Coleta excluída.", "success"); render(); }
            catch (e) { UI.toast(e.message, "error"); }
          } });
        }));
      }
      const pag = document.getElementById("pag");
      pag.innerHTML = UI.pagination({ page: state.page, pageSize: 15, total: data.total, onChange: () => {} });
      UI.bindPagination(pag, (p) => { state.page = p; render(); });
    }

    function openNova(onDone, presetClient = "", presetName = "") {
      (async () => {
        const clienteSel = await clientsSelect();
        const body = `
          <form id="form-coleta">
            <div class="field-row">
              <label class="field"><span>Cliente *</span><select name="client_id" required><option value="">Selecione…</option>${clienteSel.map(([v, l]) => `<option value="${v}" ${presetClient === v ? "selected" : ""}>${UI.esc(l)}</option>`).join("")}</select></label>
              <label class="field"><span>Semana (segunda-feira) *</span><input type="date" name="semana" required value="${monday()}" /></label>
            </div>
            <label class="field"><span>Observações</span><textarea name="observacoes" rows="2"></textarea></label>
            <p class="muted" style="font-size:12px">A coleta pode ser criada vazia e preenchida depois (itens).</p>
          </form>`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Cancelar</button><button class="btn btn-primary btn-sm" data-act="s">Criar</button>`;
        const m = UI.modal({ title: "Nova coleta semanal", body, footer });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);
        footer.querySelector('[data-act="s"]').addEventListener("click", async () => {
          const data = UI.formData(document.getElementById("form-coleta"));
          data.items = [];
          try {
            const c = await API.post("/collections", data);
            UI.toast("Coleta criada.", "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        });
      })();
    }

    function openDetalhe(colId, onDone) {
      (async () => {
        const c = await API.get(`/collections/${colId}`);
        const rows = c.items.length
          ? c.items.map((i) => `
            <tr>
              <td>${UI.badge(i.tipo)}</td>
              <td>${UI.esc(i.descricao || "—")}</td>
              <td class="num">${i.valor ? UI.money(i.valor) : "—"}</td>
              <td>${UI.date(i.data_item)}</td>
              <td>${UI.esc(i.status || "—")}</td>
            </tr>`).join("")
          : `<tr><td colspan="5" class="muted">Nenhum item registrado.</td></tr>`;
        const body = `
          <div class="muted" style="margin-bottom:10px">${UI.esc(c.client_name)} · semana ${UI.date(c.semana)} · ${UI.badge(c.status)}</div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Data</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" id="btn-item">${UI.icon("plus")} Adicionar item</button>
            <button class="btn btn-ghost btn-sm" id="btn-concluir">Concluir coleta</button>
          </div>
          <div id="item-form" class="hidden" style="margin-top:12px"></div>`;
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
        footer.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="c">Fechar</button>`;
        const m = UI.modal({ title: "Coleta semanal — detalhes", body, footer, wide: true });
        footer.querySelector('[data-act="c"]').addEventListener("click", m.close);

        m.backdrop.querySelector("#btn-item").addEventListener("click", () => {
          const box = m.backdrop.querySelector("#item-form");
          box.classList.remove("hidden");
          box.innerHTML = `
            <div class="field-row">
              <label class="field"><span>Tipo</span><select id="it-tipo">${TIPOS_ITEM.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
              <label class="field"><span>Valor</span><input type="number" step="0.01" id="it-valor" /></label>
              <label class="field"><span>Data</span><input type="date" id="it-data" value="${new Date().toISOString().slice(0, 10)}" /></label>
            </div>
            <label class="field"><span>Descrição</span><input id="it-desc" placeholder="O que foi coletado?" /></label>
            <button class="btn btn-primary btn-sm" id="it-salvar">Salvar item</button>`;
          box.querySelector("#it-salvar").addEventListener("click", async () => {
            const payload = {
              tipo: box.querySelector("#it-tipo").value,
              descricao: box.querySelector("#it-desc").value,
              valor: Number(box.querySelector("#it-valor").value || 0),
              data_item: box.querySelector("#it-data").value || null,
              status: "REGISTRADO",
            };
            try {
              await API.post(`/collections/${colId}/items`, payload);
              UI.toast("Item registrado.", "success");
              m.close();
              onDone();
            } catch (e) { UI.toast(e.message, "error"); }
          });
        });
        m.backdrop.querySelector("#btn-concluir").addEventListener("click", async () => {
          try {
            await API.put(`/collections/${colId}`, { status: "CONCLUIDA" });
            UI.toast("Coleta concluída.", "success");
            m.close();
            onDone();
          } catch (e) { UI.toast(e.message, "error"); }
        });
      })();
    }
    await render();
  }

  window.Pages.collections = { list };
})();
