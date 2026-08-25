/* ============================================================================
   Build Flow BPO — Componentes de UI reutilizáveis
   ============================================================================ */

const UI = (() => {
  /* ------------------------------- formatadores --------------------------- */
  function money(v) {
    const n = Number(v || 0);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  function pct(v) {
    const n = Number(v || 0);
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
  }
  function date(iso) {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("pt-BR");
  }
  function datetime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* --------------------------------- ícones ------------------------------- */
  const ICONS = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h2m-2 4h2m-2 4h2m2-12h2m-2 4h2m-2 4h2"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h16"/><circle cx="17" cy="13.5" r="1.2" fill="currentColor"/></svg>',
    pay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4zM4 10h16"/><path d="M8 14h4"/></svg>',
    receive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 18h16"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-6 9 6M5 9v9m4-9v9m6-9v9m4-9v9M3 21h18M3 21v-2m18 2v-2"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6Zm-2 15a2 2 0 0 0 4 0"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h8l4 4v16H6zM14 2v4h4M9 13h6m-6 4h6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4m8-4v4"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21a9 9 0 1 1 9-9M12 12l5-3"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
    report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3h8l4 4v14H8zM8 3v4h4M12 12v4m-3-2h6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 7M18.5 20a6 6 0 0 0-3-5.2"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 3 7v10l9 5 9-5V7zm0 0 9 5M12 2 3 7m9 15V12M3 7l9 5 9-5"/></svg>',
    flow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h10a3 3 0 0 1 3 3v9M4 6l3-3M4 6l3 3m10 9 3-3m-3 3-3-3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12.5 10 17.5 19 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4l10-10-4-4L4 16v4ZM13.5 6.5l4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>',
    trendUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 17 6-6 4 4 8-8M15 7h6v6"/></svg>',
    trendDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 7 6 6 4-4 8 8M15 17h6v-6"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  };
  function icon(name) {
    return ICONS[name] || ICONS.grid;
  }

  /* --------------------------------- toasts ------------------------------- */
  function toast(msg, type = "info", ms = 4200) {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icon(type === "success" ? "check" : type === "error" ? "x" : "alert")}</span><span>${esc(msg)}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 260);
    }, ms);
  }

  /* --------------------------------- loader ------------------------------- */
  function loader(on) {
    const root = document.getElementById("loader-root");
    if (on) {
      root.innerHTML = '<div class="spinner"></div>';
      root.classList.remove("hidden");
    } else {
      root.classList.add("hidden");
      root.innerHTML = "";
    }
  }

  function pageLoader(container) {
    container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';
  }

  /* --------------------------------- modal -------------------------------- */
  function modal({ title, body, footer, wide = false, onClose }) {
    const root = document.getElementById("modal-root");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal ${wide ? "wide" : ""}">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn modal-close" title="Fechar">${icon("x")}</button>
        </div>
        <div class="modal-body"></div>
        ${footer ? `<div class="modal-foot"></div>` : ""}
      </div>`;
    const bodyEl = backdrop.querySelector(".modal-body");
    if (typeof body === "string") bodyEl.innerHTML = body;
    else bodyEl.appendChild(body);

    if (footer) {
      const footEl = backdrop.querySelector(".modal-foot");
      footEl.appendChild(footer);
    }

    function close() {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      if (onClose) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelector(".modal-close").addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    root.appendChild(backdrop);
    return { close, bodyEl, backdrop };
  }

  function confirm({ title, message, onConfirm, danger = true }) {
    const footer = document.createElement("div");
    footer.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
    footer.innerHTML = `
      <button class="btn btn-ghost btn-sm" data-act="cancel">Cancelar</button>
      <button class="btn ${danger ? "btn-danger" : "btn-primary"} btn-sm" data-act="ok">Confirmar</button>`;
    const m = modal({ title, body: `<p>${esc(message)}</p>`, footer });
    footer.querySelector('[data-act="cancel"]').addEventListener("click", m.close);
    footer.querySelector('[data-act="ok"]').addEventListener("click", async () => {
      m.close();
      await onConfirm();
    });
  }

  /* ------------------------------- badges ---------------------------------- */
  const BADGES = {
    ATIVO: ["green", "Ativo"], SUSPENSO: ["amber", "Suspenso"], ENCERRADO: ["red", "Encerrado"],
    EM_IMPLANTACAO: ["blue", "Em implantação"],
    PENDENTE: ["amber", "Pendente"], PAGO: ["green", "Pago"], ATRASADO: ["red", "Atrasado"],
    CANCELADO: ["gray", "Cancelado"],
    A_RECEBER: ["blue", "A receber"], RECEBIDO: ["green", "Recebido"],
    EM_ANALISE: ["amber", "Em análise"], ATIVO: ["green", "Ativo"], CONCLUIDO: ["blue", "Concluído"],
    PLANEJAMENTO: ["gray", "Planejamento"], EM_ANDAMENTO: ["blue", "Em andamento"], PAUSADO: ["amber", "Pausado"],
    PROCESSADO: ["gray", "Processado"], AGUARDANDO_VALIDACAO: ["amber", "Aguardando validação"],
    VALIDADO: ["green", "Validado"], REJEITADO: ["red", "Rejeitado"],
    CONCLUIDA: ["green", "Concluída"],
    ABERTO: ["red", "Aberto"], RESOLVIDO: ["green", "Resolvido"],
    ALTA: ["red", "Alta"], MEDIA: ["amber", "Média"], BAIXA: ["gray", "Baixa"],
    CONCILIADO: ["green", "Conciliado"], DIVERGENTE: ["red", "Divergente"],
    SAUDAVEL: ["green", "Saudável"], ATENCAO: ["amber", "Atenção"], CRITICO: ["red", "Crítico"],
    NAO_INICIADO: ["gray", "Não iniciado"],
    RECEBIDO: ["green", "Recebido"],
    entrada: ["green", "Entrada"], saida: ["red", "Saída"],
  };
  function badge(value) {
    const key = String(value || "");
    const cfg = BADGES[key] || ["gray", key.replace(/_/g, " ")];
    return `<span class="badge ${cfg[0]}">${esc(cfg[1])}</span>`;
  }

  /* ------------------------------ kpi / cards ------------------------------ */
  function kpi({ label, value, sub, iconName = "grid", tone = "" }) {
    return `
      <div class="kpi ${tone}">
        <div class="kpi-icon">${icon(iconName)}</div>
        <div class="kpi-label">${esc(label)}</div>
        <div class="kpi-value">${value}</div>
        ${sub ? `<div class="kpi-sub">${sub}</div>` : ""}
      </div>`;
  }

  function emptyState(message, iconName = "doc") {
    return `<div class="empty-state">${icon(iconName)}<p>${esc(message)}</p></div>`;
  }

  /* --------------------------------- tables -------------------------------- */
  function table({ columns, rows, empty = "Nenhum registro encontrado.", rowClass } = {}) {
    if (!rows.length) return `<div class="table-wrap">${emptyState(empty)}</div>`;
    const head = `<tr>${columns.map((c) => `<th class="${c.align === "right" ? "num" : ""}">${esc(c.label)}</th>`).join("")}</tr>`;
    const body = rows
      .map((r, i) => {
        const cls = rowClass ? rowClass(r, i) : "";
        return `<tr class="${cls}">${columns
          .map((c) => {
            const v = c.render ? c.render(r) : esc(r[c.key] ?? "—");
            return `<td class="${c.align === "right" ? "num" : ""}">${v}</td>`;
          })
          .join("")}</tr>`;
      })
      .join("");
    return `<div class="table-wrap"><table class="tbl"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function pagination({ page, pageSize, total, onChange }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages <= 1) return "";
    const btn = (label, p, disabled = false) =>
      `<button class="btn btn-ghost btn-sm" ${disabled ? "disabled" : ""} data-page="${p}">${label}</button>`;
    return `
      <div class="pagination">
        <span>${total} registro(s)</span>
        ${btn("‹", page - 1, page <= 1)}
        <span class="muted">Página ${page} de ${pages}</span>
        ${btn("›", page + 1, page >= pages)}
      </div>`;
  }

  function bindPagination(container, onChange) {
    container.querySelectorAll("[data-page]").forEach((b) => {
      b.addEventListener("click", () => onChange(Number(b.dataset.page)));
    });
  }

  /* ------------------------------ form helpers ----------------------------- */
  function field({ label, name, type = "text", value = "", options = [], required = false, placeholder = "", rows } = {}) {
    const id = `f-${name}`;
    let control;
    if (type === "select") {
      control = `<select id="${id}" name="${name}" ${required ? "required" : ""}>
        ${options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(l)}</option>`;
        }).join("")}</select>`;
    } else if (type === "textarea") {
      control = `<textarea id="${id}" name="${name}" rows="${rows || 3}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
    } else {
      control = `<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? "required" : ""} />`;
    }
    return `<label class="field"><span>${esc(label)}${required ? " *" : ""}</span>${control}</label>`;
  }

  function formData(form) {
    const fd = new FormData(form);
    const obj = {};
    fd.forEach((v, k) => {
      if (v === "") obj[k] = null;
      else obj[k] = v;
    });
    return obj;
  }

  return {
    money, pct, date, datetime, esc, icon, toast, loader, pageLoader,
    modal, confirm, badge, kpi, emptyState, table, pagination, bindPagination,
    field, formData,
  };
})();
