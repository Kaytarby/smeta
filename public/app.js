const WEEK_COUNT = 10;

const state = {
  user: null,
  items: [],
  refs: { articles: [], counterparties: [], paymentTypes: [], allowOtherCounterparties: true },
  users: [],
  limits: [],
  budgetUsage: [],
  reportUsage: [],
  reportMonth: "",
  importErrors: [],
  meta: { lastMondayRun: null },
  search: "",
  editing: null,
  selectedIds: new Set(),
  import: { data: null, rows: [], fileName: "" },
  collapsed: new Set(),
  runtime: null
};

const el = (id) => document.getElementById(id);

const loginView = el("login");
const appView = el("app");
const tableEl = el("table");

const loginForm = el("loginForm");
const loginError = el("loginError");

const userEmail = el("userEmail");
const userRole = el("userRole");
const weekSubtitle = el("weekSubtitle");
const lastRun = el("lastRun");

const logoutBtn = el("logoutBtn");
const newRowBtn = el("newRowBtn");
const exportBtn = el("exportBtn");
const mondayBtn = el("mondayBtn");
const searchInput = el("searchInput");
const selectedCount = el("selectedCount");
const bulkStatus = el("bulkStatus");
const bulkSetStatus = el("bulkSetStatus");
const bulkManager = el("bulkManager");
const bulkSetManager = el("bulkSetManager");
const bulkDelete = el("bulkDelete");
const bulkClear = el("bulkClear");
const importBtn = el("importBtn");

const drawer = el("drawer");
const drawerTitle = el("drawerTitle");
const drawerClose = el("drawerClose");
const drawerCancel = el("drawerCancel");
const editorForm = el("editorForm");
const editorStatus = el("editorStatus");

const editArticle = el("editArticle");
const editPaymentType = el("editPaymentType");
const editCounterpartyName = el("editCounterpartyName");
const editCounterpartyInn = el("editCounterpartyInn");
const editKz = el("editKz");
const editKzCrit = el("editKzCrit");
const editStatus = el("editStatus");
const editManager = el("editManager");
const editWeeks = el("editWeeks");
const counterpartySuggest = el("counterpartySuggest");
const saveCounterpartyBtn = el("saveCounterpartyBtn");
const budgetCard = el("budgetCard");
const budgetTitle = el("budgetTitle");
const budgetPercent = el("budgetPercent");
const budgetFill = el("budgetFill");
const budgetUsed = el("budgetUsed");
const budgetRemaining = el("budgetRemaining");

const articleList = el("articleList");
const paymentTypeList = el("paymentTypeList");
const counterpartyList = el("counterpartyList");

const addUserForm = el("addUserForm");
const addArticleForm = el("addArticleForm");
const addCounterpartyForm = el("addCounterpartyForm");
const limitForm = el("limitForm");
const userCreateStatus = el("userCreateStatus");
const articleStatus = el("articleStatus");
const counterpartyStatus = el("counterpartyStatus");
const limitStatus = el("limitStatus");

const newUserEmail = el("newUserEmail");
const newUserPassword = el("newUserPassword");
const newUserRole = el("newUserRole");
const newArticle = el("newArticle");
const newCounterparty = el("newCounterparty");
const newCounterpartyInn = el("newCounterpartyInn");
const newCounterpartyList = el("newCounterpartyList");
const limitArticle = el("limitArticle");
const limitMonth = el("limitMonth");
const limitAmount = el("limitAmount");
const limitList = el("limitList");

const articleAdminList = el("articleAdminList");
const counterpartyAdminList = el("counterpartyAdminList");
const userAdminList = el("userAdminList");
const limitAdminList = el("limitAdminList");

const importModal = el("importModal");
const importClose = el("importClose");
const importCancel = el("importCancel");
const importBrowse = el("importBrowse");
const importFile = el("importFile");
const dropZone = el("dropZone");
const importCommit = el("importCommit");
const importStatus = el("importStatus");
const importPreview = el("importPreview");
const reportMonth = el("reportMonth");
const reportRefresh = el("reportRefresh");
const reportSummary = el("reportSummary");
const reportTable = el("reportTable");
const importErrorList = el("importErrorList");
const clearImportErrors = el("clearImportErrors");
const hostBanner = el("hostBanner");
const lastBackup = el("lastBackup");
const backupBtn = el("backupBtn");
const collapseAllBtn = el("collapseAllBtn");
const expandAllBtn = el("expandAllBtn");

/* ---------- Новые узлы оформления (сводка, навигация, тосты) ---------- */

const saveStatus = el("saveStatus");
const saveStatusText = el("saveStatusText");
const userAvatar = el("userAvatar");
const rowCount = el("rowCount");
const navRowCount = el("navRowCount");
const sidebarMeta = el("sidebarMeta");
const dbName = el("dbName");
const toastEl = el("toast");
const helpModal = el("helpModal");
const helpOpen = el("helpOpen");
const helpClose = el("helpClose");
const helpOk = el("helpOk");
const tipImport = el("tipImport");
const footerHelp = el("footerHelp");

const kpiTotalValue = el("kpiTotalValue");
const kpiTotalTrend = el("kpiTotalTrend");
const kpiTotalNote = el("kpiTotalNote");
const kpiTotalSpark = el("kpiTotalSpark");
const kpiWeekLabel = el("kpiWeekLabel");
const kpiWeekValue = el("kpiWeekValue");
const kpiWeekTrend = el("kpiWeekTrend");
const kpiWeekNote = el("kpiWeekNote");
const kpiWeekSpark = el("kpiWeekSpark");
const kpiRowsValue = el("kpiRowsValue");
const kpiRowsTrend = el("kpiRowsTrend");
const kpiRowsNote = el("kpiRowsNote");
const kpiRowsChip = el("kpiRowsChip");
const kpiLimitValue = el("kpiLimitValue");
const kpiLimitTrend = el("kpiLimitTrend");
const kpiLimitNote = el("kpiLimitNote");
const kpiLimitSpark = el("kpiLimitSpark");

const ICONS = {
  ok: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.4" stroke="currentColor" stroke-width="1.6"/><path d="M6.8 10.3l2.1 2.1 4.3-4.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  error: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 6.2v4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="10" cy="13.6" r=".9" fill="currentColor"/><path d="M8.6 3.2 2.9 13.2a1.6 1.6 0 0 0 1.4 2.4h11.4a1.6 1.6 0 0 0 1.4-2.4L11.4 3.2a1.6 1.6 0 0 0-2.8 0Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  save: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.6v9.2M6.6 8.4 10 11.8l3.4-3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.6 15.6h12.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  host: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3.2" y="4.2" width="13.6" height="8.6" rx="2.2" stroke="currentColor" stroke-width="1.5"/><path d="M7.4 16.2h5.2M10 12.8v3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6.4 8.5h3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  copy: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5.6" y="5.6" width="7.4" height="7.4" rx="1.8" stroke="currentColor" stroke-width="1.4"/><path d="M10.6 5.6V4.4c0-1-.8-1.8-1.8-1.8H4.4c-1 0-1.8.8-1.8 1.8v4.4c0 1 .8 1.8 1.8 1.8h1.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.4 8.4l3 3 6.2-6.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const TREND_PATHS = {
  up: "M2.5 8.5 9 4M9 4H5.4M9 4v3.6",
  down: "M2.5 4 9 8.5M9 8.5H5.4M9 8.5V4.9",
  flat: "M2.5 6.4h7"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

let toastTimer = null;

function toast(message, kind = "ok") {
  if (!toastEl) return;
  toastEl.className = kind === "error" ? "toast error" : "toast";
  toastEl.innerHTML = `${kind === "error" ? ICONS.error : ICONS.ok}<span>${escapeHtml(message)}</span>`;
  requestAnimationFrame(() => toastEl.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), kind === "error" ? 5200 : 3400);
}

let saveStatusTimer = null;

function setSaveStatus(kind, text) {
  if (!saveStatus) return;
  saveStatus.classList.toggle("busy", kind === "busy");
  saveStatus.classList.toggle("error", kind === "error");
  if (saveStatusText) saveStatusText.textContent = text || "Данные в базе";
  clearTimeout(saveStatusTimer);
  if (kind === "ok") {
    saveStatusTimer = setTimeout(() => {
      saveStatus.classList.remove("busy", "error");
      if (saveStatusText) saveStatusText.textContent = "Данные в базе";
    }, 2600);
  }
}

function setButtonLabel(button, text) {
  if (!button) return;
  const label = button.querySelector(".btn-label");
  if (label) label.textContent = text;
  else button.textContent = text;
}

function initialsOf(email) {
  const name = String(email || "").split("@")[0];
  const parts = name.split(/[._\-+]+/).filter(Boolean);
  const initials = `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
  return initials || "—";
}

function weeklyTotals(items) {
  const totals = Array(WEEK_COUNT).fill(0);
  items.forEach((item) => {
    normalizeWeeks(item.weeks).forEach((value, idx) => {
      totals[idx] += parseNumber(value);
    });
  });
  return totals;
}

function sparkline(values) {
  const width = 51;
  const height = 26;
  const pad = 3;
  const data = values.length > 1 ? values : [0, 0];
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const step = (width - pad * 2) / Math.max(data.length - 1, 1);
  const points = data.map((value, idx) => [
    pad + idx * step,
    height - pad - ((value - min) / span) * (height - pad * 2)
  ]);
  const line = points
    .map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${height} L${points[0][0].toFixed(1)} ${height} Z`;
  return `<path d="${area}" fill="currentColor" fill-opacity="0.12"/><path d="${line}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function setTrend(node, text, direction = "flat") {
  if (!node) return;
  const svg = node.querySelector("svg");
  if (svg) {
    const path = svg.querySelector("path");
    if (path) path.setAttribute("d", TREND_PATHS[direction] || TREND_PATHS.flat);
  }
  const label = node.querySelector(".trend-text");
  if (label) label.textContent = text;
  node.classList.toggle("negative", direction === "down");
  node.classList.toggle("neutral", direction === "flat");
}

function percentDelta(current, base) {
  if (!base) return null;
  return Math.round(((current - base) / base) * 100);
}

function renderMetrics() {
  const items = state.items || [];
  const totals = weeklyTotals(items);
  const totalPlan = totals.reduce((sum, value) => sum + value, 0);
  const labels = weekLabels();

  if (kpiTotalValue) {
    kpiTotalValue.innerHTML = `${formatNumber(totalPlan) || "0"} <span class="currency">₽</span>`;
  }
  const approved = items.filter((item) => item.status === "Утверждено").length;
  const approvedShare = items.length ? Math.round((approved / items.length) * 100) : 0;
  setTrend(
    kpiTotalTrend,
    `утверждено ${approved} из ${items.length || 0}`,
    items.length === 0 ? "flat" : approved === items.length ? "up" : approved === 0 ? "down" : "flat"
  );
  if (kpiTotalNote) kpiTotalNote.textContent = `${WEEK_COUNT} недель · ${items.length} строк`;
  if (kpiTotalSpark) {
    kpiTotalSpark.innerHTML = sparkline(totals);
    kpiTotalSpark.setAttribute("aria-label", `Суммы по неделям, всего ${formatNumber(totalPlan) || 0} рублей`);
  }

  const weekValue = totals[0] || 0;
  const average = totalPlan / WEEK_COUNT;
  const weekDelta = percentDelta(weekValue, Math.round(average));
  if (kpiWeekLabel) kpiWeekLabel.textContent = `Неделя ${labels[0]}`;
  if (kpiWeekValue) {
    kpiWeekValue.innerHTML = `${formatNumber(weekValue) || "0"} <span class="currency">₽</span>`;
  }
  setTrend(
    kpiWeekTrend,
    weekDelta === null ? "нет данных" : `${weekDelta > 0 ? "+" : ""}${weekDelta}% к средней`,
    weekDelta === null || weekDelta === 0 ? "flat" : weekDelta > 0 ? "up" : "down"
  );
  if (kpiWeekNote) kpiWeekNote.textContent = `средняя ${formatNumber(Math.round(average)) || 0} ₽`;
  if (kpiWeekSpark) kpiWeekSpark.innerHTML = sparkline(totals.slice(0, 6));

  const counterparties = new Set(items.map((item) => item.counterpartyName).filter(Boolean)).size;
  const articles = new Set(items.map((item) => item.article).filter(Boolean)).size;
  const drafts = items.filter((item) => item.status === "Черновик").length;
  if (kpiRowsValue) kpiRowsValue.innerHTML = `${items.length}`;
  setTrend(kpiRowsTrend, `${counterparties} контрагентов`, counterparties ? "up" : "flat");
  if (kpiRowsNote) kpiRowsNote.textContent = drafts ? `${drafts} черновиков` : `статей: ${articles}`;
  if (kpiRowsChip) kpiRowsChip.textContent = `статей: ${articles} · менеджеров: ${new Set(items.map((item) => item.manager).filter(Boolean)).size}`;

  const usage = state.reportUsage && state.reportUsage.length ? state.reportUsage : state.budgetUsage || [];
  const limitTotal = usage.reduce((sum, item) => sum + (item.limit || 0), 0);
  const usedTotal = usage.reduce((sum, item) => sum + (item.used || 0), 0);
  if (!usage.length || !limitTotal) {
    if (kpiLimitValue) kpiLimitValue.textContent = "—";
    setTrend(kpiLimitTrend, "лимиты не заданы", "flat");
    if (kpiLimitNote) kpiLimitNote.textContent = "раздел «Администрирование»";
    if (kpiLimitSpark) kpiLimitSpark.innerHTML = "";
  } else {
    const percent = Math.round((usedTotal / limitTotal) * 100);
    const remaining = limitTotal - usedTotal;
    if (kpiLimitValue) {
      kpiLimitValue.innerHTML = `${percent} <span class="currency">%</span>`;
    }
    setTrend(
      kpiLimitTrend,
      `${remaining < 0 ? "перерасход " : "осталось "}${formatNumber(Math.abs(remaining)) || 0} ₽`,
      remaining < 0 ? "down" : "up"
    );
    if (kpiLimitNote) {
      const month = monthLabel(state.reportMonth || getCurrentMonth());
      kpiLimitNote.textContent = `${month} · ${formatNumber(usedTotal) || 0} из ${formatNumber(limitTotal) || 0} ₽`;
    }
    if (kpiLimitSpark) {
      kpiLimitSpark.innerHTML = sparkline(usage.map((item) => Math.round((item.percent || 0) * 100)));
    }
  }

  if (sidebarMeta) {
    sidebarMeta.textContent = `${items.length} строк · ${articles} статьи · ${counterparties} контрагентов`;
  }
  if (navRowCount) navRowCount.textContent = String(items.length);
  if (rowCount) rowCount.textContent = `${visibleItems().length} строк`;
}

function showLogin() {
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
}

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function formatNumber(value) {
  const num = Number(value || 0);
  if (!num) return "";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(num);
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const num = Number(String(value).replace(/\s/g, ""));
  return Number.isNaN(num) ? 0 : Math.round(num);
}

function getISOWeek(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}

function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

function weekLabel(offsetWeeks = 0) {
  const base = new Date();
  base.setDate(base.getDate() + offsetWeeks * 7);
  return `Н${getISOWeek(base)} (${formatDate(base)})`;
}

function weekLabels() {
  return Array.from({ length: WEEK_COUNT }, (_, i) => weekLabel(i));
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (res.status === 401) {
    showLogin();
    throw new Error("UNAUTHORIZED");
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = payload.error || "REQUEST_FAILED";
    throw new Error(message);
  }
  return res.json();
}

function setAdminVisibility() {
  document.querySelectorAll(".admin-only").forEach((node) => {
    if (state.user?.role === "admin") {
      node.classList.remove("hidden");
    } else {
      node.classList.add("hidden");
    }
  });
}

function renderDatalists() {
  articleList.innerHTML = state.refs.articles.map((item) => `<option value="${item}"></option>`).join("");
  paymentTypeList.innerHTML = state.refs.paymentTypes.map((item) => `<option value="${item}"></option>`).join("");
  counterpartyList.innerHTML = state.refs.counterparties
    .map((item) => `<option value="${item.name}"></option>`)
    .join("");
}

function renderAdminLists() {
  if (!articleAdminList || !counterpartyAdminList || !userAdminList || !limitAdminList) return;
  if (state.user?.role !== "admin") return;

  articleAdminList.innerHTML = "";
  state.refs.articles.forEach((value) => {
    const row = document.createElement("div");
    row.className = "list-item";
    const name = document.createElement("span");
    name.textContent = value;
    const btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = "Удалить";
    btn.addEventListener("click", async () => {
      await api("/api/reference/articles/delete", {
        method: "POST",
        body: JSON.stringify({ value })
      });
      state.refs.articles = state.refs.articles.filter((item) => item !== value);
      renderDatalists();
      renderAdminLists();
    });
    row.appendChild(name);
    row.appendChild(btn);
    articleAdminList.appendChild(row);
  });

  counterpartyAdminList.innerHTML = "";
  state.refs.counterparties.forEach((value) => {
    const row = document.createElement("div");
    row.className = "list-item";
    const name = document.createElement("span");
    name.textContent = `${value.name} (${value.inn})`;
    const btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = "Удалить";
    btn.addEventListener("click", async () => {
      const response = await api("/api/reference/counterparties/delete", {
        method: "POST",
        body: JSON.stringify({ name: value.name, inn: value.inn })
      });
      state.refs.counterparties = response.counterparties;
      renderDatalists();
      renderAdminLists();
    });
    row.appendChild(name);
    row.appendChild(btn);
    counterpartyAdminList.appendChild(row);
  });

  userAdminList.innerHTML = "";
  state.users.forEach((user) => {
    const row = document.createElement("div");
    row.className = "list-item";
    const name = document.createElement("span");
    name.textContent = user.email;
    const role = document.createElement("small");
    role.textContent = user.role;
    const left = document.createElement("div");
    left.appendChild(name);
    left.appendChild(document.createElement("br"));
    left.appendChild(role);
    const btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = "Удалить";
    btn.disabled = user.email === state.user?.email;
    btn.addEventListener("click", async () => {
      const response = await api("/api/users/delete", {
        method: "POST",
        body: JSON.stringify({ email: user.email })
      });
      state.users = response.users;
      renderAdminLists();
    });
    row.appendChild(left);
    row.appendChild(btn);
    userAdminList.appendChild(row);
  });

  limitAdminList.innerHTML = "";
  state.limits.forEach((limit) => {
    const row = document.createElement("div");
    row.className = "list-item";
    const name = document.createElement("span");
    name.textContent = `${limit.article} · ${limit.month} · ${formatNumber(limit.amount) || "0"}`;
    const btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = "Удалить";
    btn.addEventListener("click", async () => {
      const response = await api("/api/limits/delete", {
        method: "POST",
        body: JSON.stringify({ article: limit.article, month: limit.month })
      });
      state.limits = response.limits;
      renderAdminLists();
      await refreshBudgetUsage();
    });
    row.appendChild(name);
    row.appendChild(btn);
    limitAdminList.appendChild(row);
  });
}

function updateCounterpartySuggestions() {
  if (!counterpartySuggest) return;
  const nameValue = editCounterpartyName.value.trim().toLowerCase();
  const innValue = editCounterpartyInn.value.trim();
  const query = nameValue || innValue;
  const matches = state.refs.counterparties
    .filter((cp) => {
      if (!query) return true;
      return (
        cp.name.toLowerCase().includes(nameValue || query) ||
        cp.inn.includes(innValue || query)
      );
    })
    .slice(0, 8);
  if (matches.length === 0) {
    counterpartySuggest.classList.add("hidden");
    counterpartySuggest.innerHTML = "";
    return;
  }
  counterpartySuggest.classList.remove("hidden");
  counterpartySuggest.innerHTML = "";
  matches.forEach((cp) => {
    const item = document.createElement("div");
    item.className = "suggest-item";
    item.textContent = `${cp.name} (${cp.inn})`;
    item.addEventListener("click", () => {
      editCounterpartyName.value = cp.name;
      editCounterpartyInn.value = cp.inn;
      counterpartySuggest.classList.add("hidden");
      updateBudgetCard(editArticle.value.trim());
    });
    counterpartySuggest.appendChild(item);
  });
}

function updateBudgetCard(article) {
  if (!budgetCard) return;
  const value = article || "";
  const usage = state.budgetUsage.find((item) => item.article === value);
  if (!usage) {
    budgetTitle.textContent = "Лимит не задан";
    budgetPercent.textContent = "—";
    budgetFill.style.width = "0%";
    budgetUsed.textContent = "0";
    budgetRemaining.textContent = "0";
    return;
  }
  budgetTitle.textContent = `${usage.article} · ${usage.month}`;
  const percent = Math.round((usage.percent || 0) * 100);
  budgetPercent.textContent = `${percent}%`;
  budgetFill.style.width = `${Math.min(100, percent)}%`;
  budgetUsed.textContent = formatNumber(usage.used) || "0";
  budgetRemaining.textContent = formatNumber(usage.remaining) || "0";
  budgetFill.style.background = usage.remaining < 0 ? "var(--danger)" : "var(--accent)";
}

function monthLabel(month) {
  if (!month) return "";
  const [year, mon] = String(month).split("-").map(Number);
  if (!year || !mon) return String(month);
  const name = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(new Date(year, mon - 1, 1));
  return `${name} ${year}`;
}

/** Месяц для отчёта: выбранный, иначе текущий, иначе самый свежий месяц с лимитами. */
function defaultReportMonth() {
  const months = [...new Set((state.limits || []).map((limit) => limit.month))].filter(Boolean).sort();
  const current = getCurrentMonth();
  if (!months.length) return current;
  if (months.includes(current)) return current;
  if (state.reportMonth && months.includes(state.reportMonth)) return state.reportMonth;
  return months[months.length - 1];
}

async function refreshBudgetUsage() {
  try {
    const response = await api("/api/budget-usage");
    state.budgetUsage = response.usage || [];
    updateBudgetCard(editArticle?.value?.trim() || "");
    await fetchReport(state.reportMonth || defaultReportMonth());
  } catch (err) {
    // ignore
  }
}

function renderReport() {
  if (!reportTable) return;
  const usage = state.reportUsage || [];
  if (usage.length === 0) {
    reportTable.innerHTML =
      '<div class="table-empty">На выбранный месяц лимиты не заданы.<br />Задайте их в разделе «Администрирование» — тогда здесь появится сравнение факта с лимитом.</div>';
    reportSummary.textContent = "";
    return;
  }

  const totalLimit = usage.reduce((sum, item) => sum + (item.limit || 0), 0);
  const totalUsed = usage.reduce((sum, item) => sum + (item.used || 0), 0);
  const totalRemaining = totalLimit - totalUsed;
  const totalPercent = totalLimit ? Math.round((totalUsed / totalLimit) * 100) : 0;
  reportSummary.innerHTML = `
    <span class="source-chip">лимит ${formatNumber(totalLimit) || "0"} ₽</span>
    <span class="source-chip">факт ${formatNumber(totalUsed) || "0"} ₽</span>
    <span class="trend${totalRemaining < 0 ? " negative" : ""}">
      <span class="trend-text">${totalRemaining < 0 ? "перерасход" : "осталось"} ${formatNumber(Math.abs(totalRemaining)) || "0"} ₽</span>
    </span>
    <span class="trend neutral"><span class="trend-text">${totalPercent}% лимита</span></span>`;

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Статья", "Лимит", "Использовано", "Осталось", "Процент"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  usage.forEach((item) => {
    const tr = document.createElement("tr");
    const percent = Math.round((item.percent || 0) * 100);
    const cells = [
      item.article,
      formatNumber(item.limit) || "0",
      formatNumber(item.used) || "0",
      formatNumber(item.remaining) || "0"
    ];
    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    const tdPercent = document.createElement("td");
    const bar = document.createElement("div");
    bar.className = "report-bar";
    const fill = document.createElement("div");
    fill.className = "report-bar-fill";
    fill.style.width = `${Math.min(100, percent)}%`;
    fill.style.background = item.remaining < 0 ? "var(--danger)" : "var(--accent)";
    bar.appendChild(fill);
    const percentLabel = document.createElement("div");
    percentLabel.textContent = `${percent}%`;
    percentLabel.style.marginTop = "4px";
    percentLabel.style.fontSize = "12px";
    tdPercent.appendChild(bar);
    tdPercent.appendChild(percentLabel);
    tr.appendChild(tdPercent);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  reportTable.innerHTML = "";
  reportTable.appendChild(table);
}

async function fetchReport(month) {
  const value = month || getCurrentMonth();
  try {
    const response = await api(`/api/budget-usage?month=${encodeURIComponent(value)}`);
    state.reportUsage = response.usage || [];
    state.reportMonth = response.month || value;
    if (reportMonth) reportMonth.value = state.reportMonth;
    renderReport();
    renderMetrics();
  } catch (err) {
    reportTable.innerHTML = "<div class=\"status\">Не удалось загрузить отчёт</div>";
  }
}

function renderImportErrors() {
  if (!importErrorList) return;
  const list = state.importErrors || [];
  if (list.length === 0) {
    importErrorList.innerHTML = "<div class=\"status\">Ошибок нет.</div>";
    return;
  }
  importErrorList.innerHTML = "";
  list.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "list-item error-card";
    const header = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.fileName || "Импорт";
    const meta = document.createElement("div");
    meta.className = "error-details";
    meta.textContent = `${new Date(entry.createdAt).toLocaleString("ru-RU")} · Ошибок: ${
      entry.invalidCount
    } / ${entry.totalRows} · ${entry.userEmail}`;
    header.appendChild(title);
    header.appendChild(meta);
    const details = document.createElement("div");
    details.className = "error-details";
    const rows = entry.rows || [];
    rows.slice(0, 5).forEach((row) => {
      const line = document.createElement("div");
      const messages = Object.values(row.errors || {}).join("; ");
      line.textContent = `Строка ${row.rowIndex}: ${messages}`;
      details.appendChild(line);
    });
    if (rows.length > 5) {
      const more = document.createElement("div");
      more.textContent = `… и ещё ${rows.length - 5} ошибок`;
      details.appendChild(more);
    }
    const clearBtn = document.createElement("button");
    clearBtn.className = "ghost";
    clearBtn.textContent = "Удалить";
    clearBtn.addEventListener("click", async () => {
      const response = await api("/api/import/errors/clear", {
        method: "POST",
        body: JSON.stringify({ id: entry.id })
      });
      state.importErrors = response.errors;
      renderImportErrors();
    });
    card.appendChild(header);
    card.appendChild(details);
    card.appendChild(clearBtn);
    importErrorList.appendChild(card);
  });
}

function updateSelectionUI() {
  if (!selectedCount) return;
  const count = state.selectedIds.size;
  selectedCount.textContent = count;
  const disabled = count === 0;
  [bulkSetStatus, bulkSetManager, bulkDelete, bulkClear, bulkStatus, bulkManager].forEach((node) => {
    if (!node) return;
    node.disabled = disabled;
  });
}

function openImportModal() {
  if (!importModal) return;
  importModal.classList.remove("hidden");
  importStatus.textContent = "";
  importPreview.innerHTML = "";
  importCommit.disabled = true;
}

function closeImportModal() {
  if (!importModal) return;
  importModal.classList.add("hidden");
  importStatus.textContent = "";
  importPreview.innerHTML = "";
  importCommit.disabled = true;
  state.import = { data: null, rows: [], fileName: "" };
}

function renderImportPreview(rows) {
  if (!importPreview) return;
  if (!rows || rows.length === 0) {
    importPreview.innerHTML = "<div class=\"status\">Нет строк для импорта</div>";
    return;
  }
  const table = document.createElement("table");
  table.className = "preview-table";
  const headers = [
    "#",
    "Статья",
    "Тип платежа",
    "Контрагент",
    "ИНН",
    "КЗ",
    "КЗ_Крит",
    ...Array.from({ length: WEEK_COUNT }, (_, i) => `Week_${i}`)
  ];
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const data = row.data || {};
    const weeks = Array.isArray(data.weeks) ? data.weeks : Array(WEEK_COUNT).fill("");
    const cells = [
      row.rowIndex,
      data.article,
      data.paymentType,
      data.counterpartyName,
      data.counterpartyInn,
      formatNumber(data.kz),
      formatNumber(data.kzCrit),
      ...weeks.map((value) => formatNumber(value))
    ];
    cells.forEach((value, idx) => {
      const td = document.createElement("td");
      td.textContent = value || "";
      const errorMap = row.errors || {};
      if (
        (idx === 1 && errorMap.article) ||
        (idx === 2 && errorMap.paymentType) ||
        (idx === 3 && errorMap.counterpartyName) ||
        (idx === 4 && errorMap.counterpartyInn) ||
        (idx === 5 && errorMap.kz) ||
        (idx === 6 && errorMap.kzCrit) ||
        (idx >= 7 && errorMap[`week_${idx - 7}`])
      ) {
        td.classList.add("invalid");
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  importPreview.innerHTML = "";
  importPreview.appendChild(table);
}

async function handleImportFile(file) {
  if (!file) return;
  importStatus.textContent = "Проверяем файл...";
  state.import.fileName = file.name;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const base64 = String(dataUrl).split(",")[1];
  try {
    const response = await api("/api/import/preview", {
      method: "POST",
      body: JSON.stringify({ data: base64, fileName: file.name, logErrors: true })
    });
    state.import = { data: base64, rows: response.rows };
    renderImportPreview(response.rows);
    const headerError = response.rows?.[0]?.errors?.__header__;
    if (headerError) {
      importStatus.textContent = headerError;
      importCommit.disabled = true;
      const errorsResponse = await api("/api/import/errors");
      state.importErrors = errorsResponse.errors || [];
      renderImportErrors();
      return;
    }
    if (response.invalid > 0) {
      importStatus.textContent = `Ошибок: ${response.invalid}. Исправьте данные.`;
      importCommit.disabled = true;
      const errorsResponse = await api("/api/import/errors");
      state.importErrors = errorsResponse.errors || [];
      renderImportErrors();
    } else {
      importStatus.textContent = `Готово. Строк: ${response.rows.length}`;
      importCommit.disabled = response.rows.length === 0;
    }
  } catch (err) {
    importStatus.textContent = "Ошибка чтения файла";
    importCommit.disabled = true;
  } finally {
    if (importFile) importFile.value = "";
  }
}

function normalizeWeeks(weeks) {
  const out = Array.isArray(weeks) ? [...weeks] : [];
  while (out.length < WEEK_COUNT) out.push(0);
  return out.slice(0, WEEK_COUNT).map((v) => parseNumber(v));
}

function updateLocalItem(updated) {
  const idx = state.items.findIndex((item) => item.id === updated.id);
  if (idx === -1) state.items.push(updated);
  else state.items[idx] = updated;
}

function canEditField(item, field) {
  if (state.user?.role === "admin") return true;
  if (item.manager !== state.user?.email) return false;
  if (field === "status" || field === "manager") return false;
  const lockedFields = ["counterpartyName", "counterpartyInn", "kz", "kzCrit", "weeks"];
  if (item.status !== "Черновик" && lockedFields.includes(field)) return false;
  return true;
}

function groupKeyOf(item) {
  return `${item.article}|||${item.paymentType}`;
}

function visibleItems() {
  const search = state.search.trim().toLowerCase();
  return state.items
    .map((item) => ({ ...item, weeks: normalizeWeeks(item.weeks) }))
    .filter((item) => {
      if (!search) return true;
      return [item.article, item.paymentType, item.counterpartyName, item.counterpartyInn, item.manager]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(search));
    })
    .sort((a, b) => {
      if (a.article === b.article) return a.paymentType.localeCompare(b.paymentType);
      return a.article.localeCompare(b.article);
    });
}

function setWeekCellText(td, value) {
  td.textContent = formatNumber(value);
}

function updateGroupTotalCell(key, idx, delta) {
  const cell = tableEl.querySelector(`[data-group-total="${CSS.escape(key)}:${idx}"]`);
  if (!cell) return;
  const current = parseNumber(cell.dataset.raw || "0") + delta;
  cell.dataset.raw = String(current);
  cell.textContent = formatNumber(current);
}

async function saveWeekValue(item, idx, value) {
  const weeks = normalizeWeeks(item.weeks);
  const prev = weeks[idx];
  if (prev === value) return;
  weeks[idx] = value;
  setSaveStatus("busy", "Сохранение…");
  try {
    const response = await api(`/api/items/${item.id}`, {
      method: "PUT",
      body: JSON.stringify({ weeks })
    });
    const old = item.weeks[idx] || 0;
    updateLocalItem(response.item);
    const local = state.items.find((row) => row.id === item.id);
    if (local) local.weeks = normalizeWeeks(response.item.weeks);
    updateGroupTotalCell(groupKeyOf(item), idx, value - old);
    setSaveStatus("ok", "Неделя сохранена");
    renderMetrics();
    refreshBudgetUsage();
  } catch (err) {
    console.error(err);
    setSaveStatus("error", "Не сохранено");
    toast(`Не удалось сохранить неделю: ${err.message || "ошибка сервера"}`, "error");
  }
}

function focusWeekCell(itemId, idx) {
  const td = Array.from(tableEl.querySelectorAll("td.week")).find(
    (node) => node.dataset.id === itemId && node.dataset.idx === String(idx)
  );
  if (td) startWeekEdit(td);
}

function startWeekEdit(td) {
  if (!td || td.dataset.locked === "1" || td.querySelector("input")) return;
  const item = state.items.find((row) => row.id === td.dataset.id);
  if (!item) return;
  const idx = Number(td.dataset.idx);
  const current = normalizeWeeks(item.weeks)[idx] || 0;
  td.classList.add("editing");
  const input = document.createElement("input");
  input.type = "number";
  input.value = current ? String(current) : "";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
      focusWeekCell(item.id, Math.min(WEEK_COUNT - 1, idx + 1));
    } else if (event.key === "Escape") {
      event.preventDefault();
      td.dataset.cancel = "1";
      input.blur();
    } else if (event.key === "ArrowRight" && input.selectionEnd === input.value.length) {
      event.preventDefault();
      input.blur();
      focusWeekCell(item.id, Math.min(WEEK_COUNT - 1, idx + 1));
    } else if (event.key === "ArrowLeft" && input.selectionStart === 0) {
      event.preventDefault();
      input.blur();
      focusWeekCell(item.id, Math.max(0, idx - 1));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = td.parentElement?.nextElementSibling?.querySelector(`td.week[data-idx="${idx}"]`);
      input.blur();
      if (next) startWeekEdit(next);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevRow = td.parentElement?.previousElementSibling?.querySelector(`td.week[data-idx="${idx}"]`);
      input.blur();
      if (prevRow) startWeekEdit(prevRow);
    }
  });
  input.addEventListener("blur", async () => {
    const cancel = td.dataset.cancel === "1";
    delete td.dataset.cancel;
    td.classList.remove("editing");
    const value = cancel ? current : parseNumber(input.value);
    td.innerHTML = "";
    setWeekCellText(td, value);
    if (!cancel) await saveWeekValue(item, idx, value);
  });
  td.innerHTML = "";
  td.appendChild(input);
  input.focus();
  input.select();
}

function renderHostBanner() {
  if (!hostBanner) return;
  const info = state.runtime;
  const hidden = sessionStorage.getItem("operplan.hideHostBanner") === "1";
  if (!info || hidden) {
    hostBanner.classList.add("hidden");
    return;
  }
  hostBanner.classList.remove("hidden");
  const urls = (info.urls || []).filter((url) => !url.includes("127.0.0.1") && !url.includes("169.254."));
  const share = urls[0] || (info.urls || [])[0] || "";
  hostBanner.innerHTML = "";

  const icon = document.createElement("div");
  icon.className = "host-icon";
  icon.innerHTML = ICONS.host;

  const text = document.createElement("div");
  text.className = "host-text";
  text.innerHTML = `<strong>Общая база на этом компьютере (${escapeHtml(info.hostName || "хост")}).</strong>
    Пока он выключен, коллеги не зайдут. Этот же адрес открывают в браузере в той же сети: ${
      share ? `<code>${escapeHtml(share)}</code>` : `<code>порт ${escapeHtml(info.port || 3000)}</code>`
    }`;

  const actions = document.createElement("div");
  actions.className = "host-urls";
  if (share) {
    const copy = document.createElement("button");
    copy.className = "ghost-button";
    copy.type = "button";
    copy.innerHTML = `${ICONS.copy}<span class="btn-label">Копировать адрес</span>`;
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(share);
        setButtonLabel(copy, "Скопировано");
        setTimeout(() => setButtonLabel(copy, "Копировать адрес"), 1600);
      } catch {
        setButtonLabel(copy, share);
      }
    });
    actions.appendChild(copy);
  }
  const hide = document.createElement("button");
  hide.className = "ghost-button";
  hide.type = "button";
  hide.textContent = "Скрыть";
  hide.addEventListener("click", () => {
    sessionStorage.setItem("operplan.hideHostBanner", "1");
    hostBanner.classList.add("hidden");
  });
  actions.appendChild(hide);

  hostBanner.appendChild(icon);
  hostBanner.appendChild(text);
  hostBanner.appendChild(actions);
}

function renderTable() {
  const isAdmin = state.user?.role === "admin";
  tableEl.className = isAdmin ? "plan-table with-check" : "plan-table";
  tableEl.innerHTML = "";

  const labels = weekLabels();
  const items = visibleItems();
  const visibleIds = items.map((item) => item.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedIds.has(id));

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const headers = [];
  if (isAdmin) headers.push({ label: "", cls: "sticky-check" });
  headers.push({ label: "Контрагент", cls: "sticky-cp" });
  headers.push({ label: "КЗ" }, { label: "КЗ_Крит" });
  labels.forEach((label) => headers.push({ label }));
  headers.push({ label: "Статус" }, { label: "Менеджер" }, { label: "Действия" });
  headers.forEach((h, idx) => {
    const th = document.createElement("th");
    if (h.cls) th.className = h.cls;
    if (isAdmin && idx === 0) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = allSelected;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) visibleIds.forEach((id) => state.selectedIds.add(id));
        else visibleIds.forEach((id) => state.selectedIds.delete(id));
        renderTable();
      });
      th.appendChild(checkbox);
    } else {
      th.textContent = h.label;
    }
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  tableEl.appendChild(thead);

  const groups = [];
  for (const item of items) {
    const key = groupKeyOf(item);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        article: item.article,
        paymentType: item.paymentType,
        totals: Array(WEEK_COUNT).fill(0),
        rows: []
      };
      groups.push(group);
    }
    group.rows.push(item);
    item.weeks.forEach((value, idx) => {
      group.totals[idx] += parseNumber(value);
    });
  }

  const tbody = document.createElement("tbody");
  const colCount = headers.length;

  if (groups.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.className = "table-empty";
    emptyCell.colSpan = colCount;
    emptyCell.innerHTML = state.search.trim()
      ? `По запросу «${escapeHtml(state.search.trim())}» ничего не найдено. Очистите поиск, чтобы вернуть все строки.`
      : "Строк пока нет. Нажмите «Новая строка» или загрузите файл Excel — данные появятся здесь.";
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  }

  groups.forEach((group) => {
    const collapsed = state.collapsed.has(group.key);
    const groupRow = document.createElement("tr");
    groupRow.className = "group";
    groupRow.addEventListener("click", () => {
      if (state.collapsed.has(group.key)) state.collapsed.delete(group.key);
      else state.collapsed.add(group.key);
      renderTable();
    });
    const mark = collapsed ? "▸" : "▾";
    for (let i = 0; i < colCount; i += 1) {
      const td = document.createElement("td");
      if (isAdmin && i === 0) td.className = "sticky-check";
      const cpIndex = isAdmin ? 1 : 0;
      const weekStart = cpIndex + 3;
      if (i === cpIndex) {
        td.classList.add("sticky-cp");
        td.textContent = `${mark} ${group.article} / ${group.paymentType}`;
      }
      if (i >= weekStart && i < weekStart + WEEK_COUNT) {
        const idx = i - weekStart;
        td.dataset.groupTotal = `${group.key}:${idx}`;
        td.dataset.raw = String(group.totals[idx]);
        td.textContent = formatNumber(group.totals[idx]);
      }
      groupRow.appendChild(td);
    }
    tbody.appendChild(groupRow);
    if (collapsed) return;

    group.rows.forEach((item) => {
      const isDebt = item.paymentType === "Погашение кредиторской задолженности";
      const tr = document.createElement("tr");
      tr.dataset.id = item.id;
      if (state.selectedIds.has(item.id)) tr.classList.add("selected");

      if (isAdmin) {
        const selectCell = document.createElement("td");
        selectCell.className = "sticky-check";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.selectedIds.has(item.id);
        checkbox.addEventListener("click", (event) => event.stopPropagation());
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) state.selectedIds.add(item.id);
          else state.selectedIds.delete(item.id);
          tr.classList.toggle("selected", checkbox.checked);
          updateSelectionUI();
        });
        selectCell.appendChild(checkbox);
        tr.appendChild(selectCell);
      }

      const counterpartyCell = document.createElement("td");
      counterpartyCell.className = "sticky-cp";
      if (item.status === "Черновик") counterpartyCell.classList.add("status-draft");
      const name = document.createElement("div");
      name.textContent = item.counterpartyName || "—";
      counterpartyCell.appendChild(name);
      if (item.counterpartyInn) {
        const inn = document.createElement("span");
        inn.className = "cp-inn";
        inn.textContent = `ИНН ${item.counterpartyInn}`;
        counterpartyCell.appendChild(inn);
      }
      counterpartyCell.addEventListener("click", () => openDrawer(item));
      tr.appendChild(counterpartyCell);

      const kzCell = document.createElement("td");
      if (isDebt) kzCell.classList.add("debt");
      kzCell.textContent = formatNumber(item.kz);
      tr.appendChild(kzCell);

      const kzCritCell = document.createElement("td");
      if (isDebt) kzCritCell.classList.add("debt");
      kzCritCell.textContent = formatNumber(item.kzCrit);
      tr.appendChild(kzCritCell);

      const locked = !canEditField(item, "weeks");
      item.weeks.forEach((value, idx) => {
        const td = document.createElement("td");
        td.className = "week";
        if (isDebt) td.classList.add("debt");
        td.dataset.id = item.id;
        td.dataset.idx = String(idx);
        td.tabIndex = locked ? -1 : 0;
        if (locked) td.dataset.locked = "1";
        setWeekCellText(td, value);
        if (!locked) {
          td.addEventListener("click", () => startWeekEdit(td));
          td.addEventListener("focus", () => startWeekEdit(td));
        }
        tr.appendChild(td);
      });

      const statusCell = document.createElement("td");
      if (item.status === "Черновик") statusCell.classList.add("status-draft");
      statusCell.textContent = item.status;
      tr.appendChild(statusCell);

      const managerCell = document.createElement("td");
      managerCell.textContent = item.manager;
      tr.appendChild(managerCell);

      const actionsCell = document.createElement("td");
      actionsCell.className = "actions";
      const editBtn = document.createElement("button");
      editBtn.className = "ghost";
      editBtn.textContent = "Правка";
      editBtn.addEventListener("click", () => openDrawer(item));
      const copyBtn = document.createElement("button");
      copyBtn.className = "ghost";
      copyBtn.textContent = "Копировать";
      copyBtn.addEventListener("click", async () => {
        try {
          const response = await api(`/api/items/${item.id}/copy`, { method: "POST" });
          updateLocalItem(response.item);
          await refreshBudgetUsage();
          renderTable();
        } catch (err) {
          console.error(err);
        }
      });
      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(copyBtn);
      tr.appendChild(actionsCell);
      tbody.appendChild(tr);
    });
  });

  tableEl.appendChild(tbody);
  updateSelectionUI();
  renderMetrics();
}

function openDrawer(item) {
  state.editing = item || {
    article: "",
    paymentType: "",
    counterpartyName: "",
    counterpartyInn: "",
    kz: 0,
    kzCrit: 0,
    weeks: Array(WEEK_COUNT).fill(0),
    status: "Черновик",
    manager: state.user?.email || ""
  };

  const editing = state.editing;
  drawerTitle.textContent = editing.id ? "Редактирование" : "Новая строка";
  editArticle.value = editing.article || "";
  editPaymentType.value = editing.paymentType || "";
  editCounterpartyName.value = editing.counterpartyName || "";
  editCounterpartyInn.value = editing.counterpartyInn || "";
  editKz.value = editing.kz || 0;
  editKzCrit.value = editing.kzCrit || 0;
  editStatus.value = editing.status || "Черновик";
  editManager.value = editing.manager || state.user?.email || "";

  const weeks = normalizeWeeks(editing.weeks);
  editWeeks.innerHTML = "";
  weekLabels().forEach((label, idx) => {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.value = weeks[idx] ? weeks[idx] : "";
    input.dataset.index = idx;
    wrapper.appendChild(input);
    editWeeks.appendChild(wrapper);
  });

  const isAdmin = state.user?.role === "admin";
  editManager.disabled = !isAdmin;
  editStatus.disabled = !isAdmin;

  updateBudgetCard(editing.article || "");
  updateCounterpartySuggestions();

  drawer.classList.remove("hidden");
  editorStatus.textContent = "";
}

function closeDrawer() {
  drawer.classList.add("hidden");
  state.editing = null;
  counterpartySuggest?.classList.add("hidden");
}

async function handleLogin(event) {
  event.preventDefault();
  loginError.textContent = "";
  try {
    const email = el("loginEmail").value.trim();
    const password = el("loginPassword").value;
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    await bootstrap();
  } catch (err) {
    loginError.textContent = "Неверные данные входа";
  }
}

async function fetchAll() {
  const me = await api("/api/me");
  const [refs, items, meta, limits, usage, importErrors] = await Promise.all([
    api("/api/reference"),
    api("/api/items"),
    api("/api/meta"),
    api("/api/limits"),
    api("/api/budget-usage"),
    api("/api/import/errors")
  ]);
  state.user = me;
  state.refs = refs;
  state.items = items.items;
  state.meta = meta;
  state.limits = limits.limits;
  state.budgetUsage = usage.usage || [];
  state.importErrors = importErrors.errors || [];
  state.selectedIds = new Set();
  if (me.role === "admin") {
    const usersResponse = await api("/api/users");
    state.users = usersResponse.users;
  } else {
    state.users = [];
  }
}

async function bootstrap() {
  try {
    await fetchAll();
    showApp();
    userEmail.textContent = state.user.email;
    userRole.textContent = state.user.role;
    if (userAvatar) userAvatar.textContent = initialsOf(state.user.email);
    setSaveStatus("ok", "Данные в базе");
    state.reportMonth = state.reportMonth || defaultReportMonth();
    if (reportMonth) reportMonth.value = state.reportMonth;
    const labels = weekLabels();
    if (weekSubtitle) weekSubtitle.textContent = `${labels[0]} — ${labels[labels.length - 1]}`;
    lastRun.textContent = state.meta.lastMondayRun ? new Date(state.meta.lastMondayRun).toLocaleString("ru-RU") : "—";
    if (lastBackup) {
      lastBackup.textContent = state.meta.lastBackup ? new Date(state.meta.lastBackup).toLocaleString("ru-RU") : "—";
    }
    try {
      state.runtime = await api("/api/runtime");
      if (dbName && state.runtime?.dbFile) dbName.textContent = state.runtime.dbFile;
    } catch {
      state.runtime = null;
    }
    renderHostBanner();
    setAdminVisibility();
    renderDatalists();
    renderAdminLists();
    renderImportErrors();
    renderTable();
    await fetchReport(state.reportMonth || defaultReportMonth());
  } catch (err) {
    showLogin();
  }
}

loginForm.addEventListener("submit", handleLogin);
logoutBtn.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  showLogin();
});

newRowBtn.addEventListener("click", () => openDrawer(null));

exportBtn.addEventListener("click", () => {
  window.location.href = "/api/export";
});

mondayBtn.addEventListener("click", async () => {
  const ok = confirm("Сдвинуть недели: крайняя неделя уйдёт в архив. Продолжить?");
  if (!ok) return;
  mondayBtn.disabled = true;
  setButtonLabel(mondayBtn, "Запуск…");
  try {
    const result = await api("/api/process/monday", { method: "POST" });
    lastRun.textContent = new Date().toLocaleString("ru-RU");
    toast(`Сдвиг недель выполнен. В архив ушло строк: ${result.archivedCount}. Файл: ${result.filePath}`);
    await fetchAll();
    renderTable();
  } catch (err) {
    toast("Не удалось выполнить сдвиг недель", "error");
  } finally {
    mondayBtn.disabled = false;
    setButtonLabel(mondayBtn, "Понедельник: запустить");
  }
});

backupBtn?.addEventListener("click", async () => {
  try {
    const result = await api("/api/backup", { method: "POST" });
    if (lastBackup && result.lastBackup) {
      lastBackup.textContent = new Date(result.lastBackup).toLocaleString("ru-RU");
    }
    toast("Бэкап сохранён в папку data/backups");
  } catch (err) {
    toast("Не удалось сделать бэкап", "error");
  }
});

collapseAllBtn?.addEventListener("click", () => {
  visibleItems().forEach((item) => state.collapsed.add(groupKeyOf(item)));
  renderTable();
});

expandAllBtn?.addEventListener("click", () => {
  state.collapsed = new Set();
  renderTable();
});

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderTable();
});

newCounterpartyInn?.addEventListener("input", () => {
  newCounterpartyInn.value = newCounterpartyInn.value.replace(/\D/g, "");
});

reportRefresh?.addEventListener("click", () => {
  const value = reportMonth?.value || getCurrentMonth();
  fetchReport(value);
});

reportMonth?.addEventListener("change", () => {
  fetchReport(reportMonth.value);
});

clearImportErrors?.addEventListener("click", async () => {
  const response = await api("/api/import/errors/clear", { method: "POST", body: JSON.stringify({ all: true }) });
  state.importErrors = response.errors;
  renderImportErrors();
});

importBtn?.addEventListener("click", openImportModal);
importClose?.addEventListener("click", closeImportModal);
importCancel?.addEventListener("click", closeImportModal);
importBrowse?.addEventListener("click", () => importFile?.click());
importFile?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  handleImportFile(file);
});
dropZone?.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag");
});
dropZone?.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag");
});
dropZone?.addEventListener("click", () => importFile?.click());
dropZone?.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag");
  const file = event.dataTransfer.files?.[0];
  handleImportFile(file);
});

importCommit?.addEventListener("click", async () => {
  if (!state.import.data) return;
  importCommit.disabled = true;
  importStatus.textContent = "Импортируем...";
  try {
    const response = await api("/api/import/commit", {
      method: "POST",
      body: JSON.stringify({ data: state.import.data, fileName: state.import.fileName || "" })
    });
    state.items = [...state.items, ...response.items];
    importStatus.textContent = `Импортировано: ${response.created}`;
    await fetchAll();
    renderTable();
    closeImportModal();
  } catch (err) {
    importStatus.textContent = "Ошибка импорта";
    await fetchAll();
    renderImportErrors();
    importCommit.disabled = false;
  }
});

bulkSetStatus?.addEventListener("click", async () => {
  const status = bulkStatus?.value;
  if (!status) {
    toast("Сначала выберите статус", "error");
    return;
  }
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;
  try {
    const response = await api("/api/items/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, changes: { status } })
    });
    response.items.forEach(updateLocalItem);
    state.selectedIds = new Set();
    bulkStatus.value = "";
    renderTable();
  } catch (err) {
    toast("Не удалось применить изменения к выбранным строкам", "error");
  }
});

bulkSetManager?.addEventListener("click", async () => {
  const manager = bulkManager?.value.trim();
  if (!manager) {
    toast("Введите email менеджера", "error");
    return;
  }
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;
  try {
    const response = await api("/api/items/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, changes: { manager } })
    });
    response.items.forEach(updateLocalItem);
    state.selectedIds = new Set();
    bulkManager.value = "";
    renderTable();
  } catch (err) {
    toast("Не удалось применить изменения к выбранным строкам", "error");
  }
});

bulkDelete?.addEventListener("click", async () => {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;
  const ok = confirm(`Удалить выбранные строки (${ids.length})?`);
  if (!ok) return;
  try {
    const response = await api("/api/items/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids })
    });
    const deleted = new Set(response.deletedIds || []);
    state.items = state.items.filter((item) => !deleted.has(item.id));
    state.selectedIds = new Set();
    await refreshBudgetUsage();
    renderTable();
  } catch (err) {
    toast("Не удалось удалить выбранные строки", "error");
  }
});

bulkClear?.addEventListener("click", () => {
  state.selectedIds = new Set();
  renderTable();
});

editorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const weeks = Array.from(editWeeks.querySelectorAll("input")).map((input) => parseNumber(input.value));
  const payload = {
    article: editArticle.value.trim(),
    paymentType: editPaymentType.value.trim(),
    counterpartyName: editCounterpartyName.value.trim(),
    counterpartyInn: editCounterpartyInn.value.trim(),
    kz: parseNumber(editKz.value),
    kzCrit: parseNumber(editKzCrit.value),
    weeks,
    status: editStatus.value,
    manager: editManager.value.trim()
  };
  if (state.user?.role !== "admin") {
    payload.status = "Черновик";
    payload.manager = state.user?.email || "";
  }

  setSaveStatus("busy", "Сохранение…");
  try {
    let response;
    if (state.editing?.id) {
      response = await api(`/api/items/${state.editing.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      updateLocalItem(response.item);
      editorStatus.textContent = "Сохранено";
    } else {
      response = await api("/api/items", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      updateLocalItem(response.item);
      editorStatus.textContent = "Создано";
    }
    await refreshBudgetUsage();
    renderTable();
    closeDrawer();
    setSaveStatus("ok", "Строка сохранена");
    toast(state.editing?.id ? "Строка обновлена" : "Строка добавлена");
  } catch (err) {
    editorStatus.textContent = "Ошибка сохранения";
    setSaveStatus("error", "Не сохранено");
    toast(`Строку не удалось сохранить: ${err.message || "ошибка сервера"}`, "error");
  }
});

drawerClose.addEventListener("click", closeDrawer);
drawerCancel.addEventListener("click", closeDrawer);
editCounterpartyName?.addEventListener("input", updateCounterpartySuggestions);
editCounterpartyName?.addEventListener("focus", updateCounterpartySuggestions);
editCounterpartyInn?.addEventListener("focus", updateCounterpartySuggestions);
editCounterpartyInn?.addEventListener("input", () => {
  editCounterpartyInn.value = editCounterpartyInn.value.replace(/\D/g, "");
  updateCounterpartySuggestions();
});
editArticle?.addEventListener("input", () => updateBudgetCard(editArticle.value.trim()));

saveCounterpartyBtn?.addEventListener("click", async () => {
  const name = editCounterpartyName.value.trim();
  const inn = editCounterpartyInn.value.trim().replace(/\D/g, "");
  if (!name || !inn) {
    editorStatus.textContent = "Контрагент и ИНН обязательны";
    return;
  }
  try {
    const response = await api("/api/reference/counterparties", {
      method: "POST",
      body: JSON.stringify({ name, inn })
    });
    state.refs.counterparties = response.counterparties;
    renderDatalists();
    renderAdminLists();
    editorStatus.textContent = "Контрагент добавлен";
  } catch (err) {
    editorStatus.textContent = "Ошибка добавления контрагента";
  }
});

addUserForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  userCreateStatus.textContent = "";
  try {
    const response = await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: newUserEmail.value.trim(),
        password: newUserPassword.value.trim(),
        role: newUserRole.value
      })
    });
    state.users = [...state.users, response.user];
    renderAdminLists();
    userCreateStatus.textContent = "Создано";
    newUserEmail.value = "";
    newUserPassword.value = "";
  } catch (err) {
    userCreateStatus.textContent = "Ошибка";
  }
});

addArticleForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  articleStatus.textContent = "";
  try {
    const response = await api("/api/reference/articles", {
      method: "POST",
      body: JSON.stringify({ value: newArticle.value.trim() })
    });
    state.refs.articles = response.articles;
    renderDatalists();
    renderAdminLists();
    newArticle.value = "";
    articleStatus.textContent = "Добавлено";
  } catch (err) {
    articleStatus.textContent = "Ошибка";
  }
});

limitForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  limitStatus.textContent = "";
  try {
    const listValue = limitList?.value.trim();
    let response;
    if (listValue) {
      response = await api("/api/limits/bulk", {
        method: "POST",
        body: JSON.stringify({ values: listValue })
      });
      if (limitList) limitList.value = "";
    } else {
      const article = limitArticle.value.trim();
      const month = limitMonth.value.trim();
      const amount = parseNumber(limitAmount.value);
      if (!article || !month) {
        limitStatus.textContent = "Укажите статью и месяц";
        return;
      }
      response = await api("/api/limits", {
        method: "POST",
        body: JSON.stringify({ article, month, amount })
      });
      limitArticle.value = "";
      limitMonth.value = "";
      limitAmount.value = "";
    }
    state.limits = response.limits;
    renderAdminLists();
    await refreshBudgetUsage();
    limitStatus.textContent = "Сохранено";
  } catch (err) {
    limitStatus.textContent = "Ошибка";
  }
});

addCounterpartyForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  counterpartyStatus.textContent = "";
  try {
    const listValue = newCounterpartyList?.value.trim();
    const singleValue = newCounterparty.value.trim();
    const singleInn = newCounterpartyInn?.value.trim().replace(/\D/g, "");
    if (listValue) {
      const response = await api("/api/reference/counterparties/bulk", {
        method: "POST",
        body: JSON.stringify({ values: listValue })
      });
      state.refs.counterparties = response.counterparties;
    } else {
      if (!singleValue || !singleInn) {
        counterpartyStatus.textContent = "Введите контрагента и ИНН";
        return;
      }
      const response = await api("/api/reference/counterparties", {
        method: "POST",
        body: JSON.stringify({ name: singleValue, inn: singleInn })
      });
      state.refs.counterparties = response.counterparties;
    }
    renderDatalists();
    renderAdminLists();
    newCounterparty.value = "";
    if (newCounterpartyInn) newCounterpartyInn.value = "";
    if (newCounterpartyList) newCounterpartyList.value = "";
    counterpartyStatus.textContent = "Добавлено";
  } catch (err) {
    counterpartyStatus.textContent = "Ошибка";
  }
});

/* ---------- Разделы в сайдбаре, помощь, клавиатура ---------- */

const navButtons = Array.from(document.querySelectorAll(".nav-item[data-target]"));

function setActiveNav(active) {
  navButtons.forEach((btn) => btn.classList.toggle("active", btn === active));
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    setActiveNav(btn);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const navSections = navButtons
  .map((btn) => ({ btn, section: document.getElementById(btn.dataset.target) }))
  .filter((entry) => entry.section);

if ("IntersectionObserver" in window && navSections.length > 1) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const hit = navSections.find((item) => item.section === entry.target);
        if (hit) setActiveNav(hit.btn);
      });
    },
    { rootMargin: "-96px 0px -65% 0px", threshold: 0 }
  );
  navSections.forEach((entry) => observer.observe(entry.section));
}

function openHelp() {
  helpModal?.classList.remove("hidden");
}

function closeHelp() {
  helpModal?.classList.add("hidden");
}

helpOpen?.addEventListener("click", openHelp);
footerHelp?.addEventListener("click", openHelp);
helpClose?.addEventListener("click", closeHelp);
helpOk?.addEventListener("click", closeHelp);
helpModal?.addEventListener("click", (event) => {
  if (event.target === helpModal) closeHelp();
});

tipImport?.addEventListener("click", openImportModal);

drawer.addEventListener("click", (event) => {
  if (event.target === drawer) closeDrawer();
});

importModal?.addEventListener("click", (event) => {
  if (event.target === importModal) closeImportModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!drawer.classList.contains("hidden")) {
    closeDrawer();
    return;
  }
  if (importModal && !importModal.classList.contains("hidden")) {
    closeImportModal();
    return;
  }
  if (helpModal && !helpModal.classList.contains("hidden")) closeHelp();
});

bootstrap();
