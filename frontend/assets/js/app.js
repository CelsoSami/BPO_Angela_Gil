/* ============================================================================
   Build Flow BPO — Bootstrap, roteador, menu, tema e autenticação
   ============================================================================ */
(() => {
  "use strict";

  const Pages = (window.Pages = window.Pages || {});

  /* ------------------------------- tema ----------------------------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bf_theme", theme);
    const icon = document.getElementById("icon-theme");
    if (icon) icon.innerHTML = UI.icon(theme === "dark" ? "sun" : "moon");
  }
  function initTheme() {
    applyTheme(localStorage.getItem("bf_theme") || "dark");
    const btn = document.getElementById("btn-theme");
    if (btn) btn.addEventListener("click", () => {
      const atual = document.documentElement.getAttribute("data-theme");
      applyTheme(atual === "dark" ? "light" : "dark");
      // regrava gráficos da página atual
      const evt = new CustomEvent("bf:theme-change");
      document.dispatchEvent(evt);
    });
  }

  /* ---------------------------- autenticação ------------------------------ */
  function currentUser() {
    try { return JSON.parse(localStorage.getItem("bf_user") || "null"); }
    catch { return null; }
  }
  function setSession(data) {
    localStorage.setItem("bf_token", data.token);
    localStorage.setItem("bf_user", JSON.stringify(data.user));
  }
  function logout() {
    API.post("/auth/logout").catch(() => {});
    localStorage.removeItem("bf_token");
    localStorage.removeItem("bf_user");
    showLogin();
  }

  /* ------------------------------- layout --------------------------------- */
  function showLogin() {
    document.getElementById("view-app").classList.add("hidden");
    document.getElementById("view-login").classList.remove("hidden");
    document.querySelector(".login-foot [data-year]").textContent = new Date().getFullYear();
  }
  function showApp() {
    document.getElementById("view-login").classList.add("hidden");
    document.getElementById("view-app").classList.remove("hidden");
    renderSidebar();
    renderUserChip();
  }
  function renderUserChip() {
    const u = currentUser();
    if (!u) return;
    document.getElementById("user-name").textContent = u.nome;
    document.getElementById("user-role").textContent = u.role;
    document.getElementById("user-avatar").textContent = (u.nome || "?").trim().charAt(0).toUpperCase();
  }

  /* -------------------------------- menu ---------------------------------- */
  function menuFor(role) {
    const menu = [
      {
        group: "Operação",
        items: [
          ["#/dashboard", "Visão Geral", "grid"],
          ["#/clients", "Clientes", "building"],
          ["#/clients/new", "Novo cliente", "plus"],
          ["#/plans", "Planos", "tag"],
          ["#/contracts", "Contratos", "doc"],
          ["#/documents", "Documentos", "doc"],
          ["#/collections", "Coleta Semanal", "calendar"],
        ],
      },
      {
        group: "Financeiro",
        items: [
          ["#/financial/cashflow", "Fluxo de Caixa", "flow"],
          ["#/financial/payables", "Contas a Pagar", "pay"],
          ["#/financial/receivables", "Contas a Receber", "receive"],
          ["#/financial/bank", "Conciliação", "bank"],
          ["#/financial/dre", "DRE", "chart"],
          ["#/financial/inadimplencia", "Inadimplência", "alert"],
        ],
      },
      {
        group: "Projetos",
        items: [
          ["#/projects", "Projetos", "box"],
          ["#/projects/profitability", "Rentabilidade", "trendUp"],
          ["#/pricing", "Precificação", "tag"],
        ],
      },
      {
        group: "Inteligência",
        items: [
          ["#/indicators", "Indicadores", "gauge"],
          ["#/reports", "Relatórios", "report"],
          ["#/admin/health", "Saúde Financeira", "target"],
        ],
      },
    ];
    const adminItems = [
      ["#/admin/actions", "Plano de Acompanhamento", "check"],
      ["#/admin/assets", "Ativos", "box"],
      ["#/admin/processes", "Processos", "flow"],
    ];
    if (role === "ADMIN") adminItems.push(["#/admin/users", "Usuários", "users"]);
    if (role === "ADMIN" || role === "GERENTE") adminItems.push(["#/admin/audit", "Auditoria", "search"]);
    menu.push({ group: "Administração", items: adminItems });
    menu.push({ group: "Sistema", items: [["#/settings", "Configurações", "gear"]] });
    return menu;
  }

  function renderSidebar() {
    const nav = document.getElementById("sidebar-nav");
    const u = currentUser();
    const html = menuFor(u ? u.role : "AUXILIAR")
      .map(
        (g) => `
        <div class="nav-group">
          <div class="nav-group-title">${UI.esc(g.group)}</div>
          ${g.items
            .map(
              ([hash, label, ic]) =>
                `<button class="nav-item" data-hash="${hash}" data-tooltip="${UI.esc(label)}">
                   ${UI.icon(ic)}<span class="nav-label">${UI.esc(label)}</span>
                 </button>`
            )
            .join("")}
        </div>`
      )
      .join("");
    nav.innerHTML = html;
    nav.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        location.hash = btn.dataset.hash;
        if (window.innerWidth <= 900) {
          document.getElementById("view-app").classList.remove("sidebar-open");
        }
      });
    });
    highlightMenu();
  }
  function highlightMenu() {
    const hash = location.hash;
    document.querySelectorAll(".nav-item").forEach((btn) => {
      const b = btn.dataset.hash;
      btn.classList.toggle("active", hash === b || (b !== "#/dashboard" && hash.startsWith(b + "/")));
    });
  }

  /* ------------------------------- roteador -------------------------------- */
  const ROUTES = [
    { pattern: "#/login", page: "login", action: "login" },
    { pattern: "#/dashboard", page: "dashboard", action: "overview" },
    { pattern: "#/clients", page: "clients", action: "list" },
    { pattern: "#/clients/new", page: "clients", action: "new" },
    { pattern: "#/clients/:id", page: "clients", action: "detail" },
    { pattern: "#/plans", page: "clients", action: "plans" },
    { pattern: "#/financial/cashflow", page: "financial", action: "cashflow" },
    { pattern: "#/financial/payables", page: "financial", action: "payables" },
    { pattern: "#/financial/receivables", page: "financial", action: "receivables" },
    { pattern: "#/financial/bank", page: "financial", action: "bank" },
    { pattern: "#/financial/dre", page: "financial", action: "dre" },
    { pattern: "#/financial/inadimplencia", page: "financial", action: "inadimplencia" },
    { pattern: "#/projects", page: "projects", action: "list" },
    { pattern: "#/projects/profitability", page: "projects", action: "profitability" },
    { pattern: "#/pricing", page: "projects", action: "pricing" },
    { pattern: "#/contracts", page: "contracts", action: "list" },
    { pattern: "#/documents", page: "documents", action: "list" },
    { pattern: "#/collections", page: "collections", action: "list" },
    { pattern: "#/indicators", page: "indicators", action: "list" },
    { pattern: "#/reports", page: "reports", action: "list" },
    { pattern: "#/admin/users", page: "admin", action: "users" },
    { pattern: "#/admin/processes", page: "admin", action: "processes" },
    { pattern: "#/admin/assets", page: "admin", action: "assets" },
    { pattern: "#/admin/audit", page: "admin", action: "audit" },
    { pattern: "#/admin/actions", page: "admin", action: "actions" },
    { pattern: "#/admin/health", page: "admin", action: "health" },
    { pattern: "#/settings", page: "settings", action: "main" },
  ];

  function matchRoute(hash) {
    const parts = hash.split("/");
    for (const r of ROUTES) {
      const rp = r.pattern.split("/");
      if (rp.length !== parts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < rp.length; i++) {
        if (rp[i].startsWith(":")) params[rp[i].slice(1)] = decodeURIComponent(parts[i]);
        else if (rp[i] !== parts[i]) { ok = false; break; }
      }
      if (ok) return { ...r, params };
    }
    return null;
  }

  async function loadPageModule(name) {
    if (Pages[name]) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `/assets/js/pages/${name}.js`;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Falha ao carregar módulo ${name}`));
      document.head.appendChild(s);
    });
  }

  async function router() {
    if (!currentUser()) {
      showLogin();
      return;
    }
    showApp();
    let hash = location.hash || "#/dashboard";
    if (hash === "#/" || hash === "#") hash = "#/dashboard";
    const route = matchRoute(hash);
    if (!route) { location.hash = "#/dashboard"; return; }

    highlightMenu();
    const main = document.getElementById("page");
    main.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';
    try {
      await loadPageModule(route.page);
      const mod = Pages[route.page];
      if (!mod || typeof mod[route.action] !== "function") throw new Error("Página não implementada");
      await mod[route.action](main, route.params || {});
      main.classList.remove("page-enter");
      void main.offsetWidth;
      main.classList.add("page-enter");
    } catch (err) {
      console.error(err);
      main.innerHTML = `<div class="card"><h3>Não foi possível carregar esta página.</h3><p class="muted">${UI.esc(err.message)}</p></div>`;
    }
  }

  /* ------------------------------- login ---------------------------------- */
  async function doLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("login-btn");
    const errEl = document.getElementById("login-error");
    errEl.classList.add("hidden");
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    if (!username || !password) {
      errEl.textContent = "Informe usuário e senha.";
      errEl.classList.remove("hidden");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Entrando…";
    try {
      const data = await API.post("/auth/login", { username, password });
      setSession(data);
      UI.toast(`Bem-vindo(a), ${data.user.nome.split(" ")[0]}.`, "success");
      location.hash = "#/dashboard";
      router();
    } catch (err) {
      errEl.textContent = err.message || "Falha no login.";
      errEl.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  }

  /* ------------------------------- bootstrap ------------------------------- */
  function init() {
    initTheme();
    document.querySelector(".login-foot [data-year]").textContent = new Date().getFullYear();
    document.getElementById("login-form").addEventListener("submit", doLogin);
    document.getElementById("btn-logout").addEventListener("click", logout);
    document.getElementById("btn-sidebar-toggle").addEventListener("click", () => {
      document.getElementById("view-app").classList.toggle("sidebar-collapsed");
    });
    document.getElementById("btn-alerts").addEventListener("click", () => {
      location.hash = "#/admin/actions";
    });
    window.addEventListener("hashchange", router);

    const greetings = ["Bom dia", "Boa tarde", "Boa noite"];
    const h = new Date().getHours();
    const greet = h < 12 ? greetings[0] : h < 18 ? greetings[1] : greetings[2];

    // banner de boas-vindas na home
    Pages._greeting = greet;

    // valida sessão e navega
    (async () => {
      const u = currentUser();
      if (!u || !API.token()) { showLogin(); return; }
      try {
        const me = await API.get("/auth/me");
        localStorage.setItem("bf_user", JSON.stringify(me));
      } catch {
        showLogin();
        return;
      }
      router();
    })();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
