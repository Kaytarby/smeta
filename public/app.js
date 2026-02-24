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
  import: { data: null, rows: [], fileName: "" }
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
  if (!query) {
    counterpartySuggest.classList.add("hidden");
    counterpartySuggest.innerHTML = "";
    return;
  }
  const matches = state.refs.counterparties
    .filter((cp) => {
      return (
        cp.name.toLowerCase().includes(nameValue || "") ||
        cp.inn.includes(innValue || "")
      );
    })
    .slice(0, 5);
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

async function refreshBudgetUsage() {
  try {
    const response = await api("/api/budget-usage");
    state.budgetUsage = response.usage || [];
    updateBudgetCard(editArticle?.value?.trim() || "");
    await fetchReport(state.reportMonth || getCurrentMonth());
  } catch (err) {
    // ignore
  }
}

function renderReport() {
  if (!reportTable) return;
  const usage = state.reportUsage || [];
  if (usage.length === 0) {
    reportTable.innerHTML = "<div class=\"status\">Нет лимитов на выбранный месяц.</div>";
    reportSummary.textContent = "";
    return;
  }

  const totalLimit = usage.reduce((sum, item) => sum + (item.limit || 0), 0);
  const totalUsed = usage.reduce((sum, item) => sum + (item.used || 0), 0);
  const totalRemaining = totalLimit - totalUsed;
  reportSummary.textContent = `Лимит: ${formatNumber(totalLimit) || "0"} · Использовано: ${
    formatNumber(totalUsed) || "0"
  } · Осталось: ${formatNumber(totalRemaining) || "0"}`;

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

function renderTable() {
  tableEl.innerHTML = "";
  const isAdmin = state.user?.role === "admin";
  const baseHeaders = [
    "Контрагент",
    "КЗ",
    "КЗ_Крит",
    ...weekLabels(),
    "Статус",
    "Менеджер",
    "Действия"
  ];
  const headers = isAdmin ? ["", ...baseHeaders] : baseHeaders;
  if (isAdmin) {
    tableEl.style.gridTemplateColumns = `44px ${"minmax(120px, auto) ".repeat(headers.length - 1)}`.trim();
  } else {
    tableEl.style.gridTemplateColumns = `repeat(${headers.length}, minmax(120px, auto))`;
  }

  const search = state.search.trim().toLowerCase();
  const items = state.items
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

  const visibleIds = items.map((item) => item.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedIds.has(id));

  headers.forEach((label, idx) => {
    const cell = document.createElement("div");
    cell.className = "cell header";
    if (isAdmin && idx === 0) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = allSelected;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          visibleIds.forEach((id) => state.selectedIds.add(id));
        } else {
          visibleIds.forEach((id) => state.selectedIds.delete(id));
        }
        renderTable();
      });
      cell.classList.add("checkbox");
      cell.appendChild(checkbox);
    } else {
      cell.textContent = label;
    }
    tableEl.appendChild(cell);
  });

  // Add state to track expanded groups (initialize if not exists)
  if (!state.expandedGroups) {
    state.expandedGroups = new Set();
  }

  const groups = [];
  for (const item of items) {
    const key = `${item.article}|||${item.paymentType}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        article: item.article,
        paymentType: item.paymentType,
        totals: Array(WEEK_COUNT).fill(0),
        rows: [],
        isExpanded: state.expandedGroups.has(key)
      };
      groups.push(group);
    }
    group.rows.push(item);
    item.weeks.forEach((value, idx) => {
      group.totals[idx] += parseNumber(value);
    });
  }

  const groupLabelIndex = isAdmin ? 1 : 0;
  const weekStartIndex = (isAdmin ? 1 : 0) + 3;
  const weekEndIndex = weekStartIndex + WEEK_COUNT;

  groups.forEach((group) => {
    // Create group header row
    for (let i = 0; i < headers.length; i += 1) {
      const cell = document.createElement("div");
      cell.className = "cell group";
      
      if (i === groupLabelIndex) {
        // Add expand/collapse button for admin users
        if (isAdmin) {
          const expandBtn = document.createElement("button");
          expandBtn.className = "expand-btn";
          expandBtn.textContent = group.isExpanded ? "▼" : "►";
          expandBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const key = group.key;
            if (state.expandedGroups.has(key)) {
              state.expandedGroups.delete(key);
            } else {
              state.expandedGroups.add(key);
            }
            renderTable();
          });
          
          const labelSpan = document.createElement("span");
          labelSpan.textContent = `${group.article} / ${group.paymentType}`;
          
          cell.appendChild(expandBtn);
          cell.appendChild(labelSpan);
        } else {
          cell.textContent = `${group.article} / ${group.paymentType}`;
        }
      }
      
      if (i >= weekStartIndex && i < weekEndIndex) {
        const total = group.totals[i - weekStartIndex];
        cell.textContent = formatNumber(total);
      }
      tableEl.appendChild(cell);
    }

    // Show child rows only if group is expanded (or if not admin view)
    if (group.isExpanded || !isAdmin) {
      group.rows.forEach((item) => {
      const isDebt = item.paymentType === "Погашение кредиторской задолженности";

      if (isAdmin) {
        const selectCell = document.createElement("div");
        selectCell.className = "cell checkbox";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.selectedIds.has(item.id);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) state.selectedIds.add(item.id);
          else state.selectedIds.delete(item.id);
          renderTable();
        });
        selectCell.appendChild(checkbox);
        tableEl.appendChild(selectCell);
      }

      const counterpartyCell = document.createElement("div");
      counterpartyCell.className = "cell";
      if (item.status === "Черновик") counterpartyCell.classList.add("status-draft");
      counterpartyCell.textContent = item.counterpartyName || "";
      counterpartyCell.addEventListener("click", () => openDrawer(item));
      tableEl.appendChild(counterpartyCell);

      const kzCell = document.createElement("div");
      kzCell.className = "cell";
      if (isDebt) kzCell.classList.add("debt");
      kzCell.textContent = formatNumber(item.kz);
      tableEl.appendChild(kzCell);

      const kzCritCell = document.createElement("div");
      kzCritCell.className = "cell";
      if (isDebt) kzCritCell.classList.add("debt");
      kzCritCell.textContent = formatNumber(item.kzCrit);
      tableEl.appendChild(kzCritCell);

      item.weeks.forEach((value, idx) => {
        const cell = document.createElement("div");
        cell.className = "cell";
        if (isDebt) cell.classList.add("debt");
        const input = document.createElement("input");
        input.type = "number";
        input.value = value ? value : "";
        input.disabled = !canEditField(item, "weeks");
        input.addEventListener("blur", async () => {
          const weeks = normalizeWeeks(item.weeks);
          weeks[idx] = parseNumber(input.value);
          try {
            const response = await api(`/api/items/${item.id}`, {
              method: "PUT",
              body: JSON.stringify({ weeks })
            });
            updateLocalItem(response.item);
            await refreshBudgetUsage();
            renderTable();
          } catch (err) {
            console.error(err);
          }
        });
        cell.appendChild(input);
        tableEl.appendChild(cell);
      });

      const statusCell = document.createElement("div");
      statusCell.className = "cell";
      if (item.status === "Черновик") statusCell.classList.add("status-draft");
      statusCell.textContent = item.status;
      tableEl.appendChild(statusCell);

      const managerCell = document.createElement("div");
      managerCell.className = "cell";
      managerCell.textContent = item.manager;
      tableEl.appendChild(managerCell);

      const actionsCell = document.createElement("div");
      actionsCell.className = "cell actions";

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
      tableEl.appendChild(actionsCell);
    });
  });

  updateSelectionUI();
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
    state.reportMonth = state.reportMonth || getCurrentMonth();
    if (reportMonth) reportMonth.value = state.reportMonth;
    const labels = weekLabels();
    weekSubtitle.textContent = `Текущий диапазон: ${labels[0]} — ${labels[labels.length - 1]}`;
    lastRun.textContent = state.meta.lastMondayRun ? new Date(state.meta.lastMondayRun).toLocaleString("ru-RU") : "—";
    setAdminVisibility();
    renderDatalists();
    renderAdminLists();
    renderImportErrors();
    renderTable();
    await fetchReport(state.reportMonth || getCurrentMonth());
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
  mondayBtn.disabled = true;
  mondayBtn.textContent = "Запуск...";
  try {
    const result = await api("/api/process/monday", { method: "POST" });
    lastRun.textContent = new Date().toLocaleString("ru-RU");
    alert(`Готово. Архивировано строк: ${result.archivedCount}. Файл: ${result.filePath}`);
    await fetchAll();
    renderTable();
  } catch (err) {
    alert("Ошибка запуска");
  } finally {
    mondayBtn.disabled = false;
    mondayBtn.textContent = "Понедельник: запустить";
  }
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
    alert("Выберите статус");
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
    alert("Ошибка массового обновления");
  }
});

bulkSetManager?.addEventListener("click", async () => {
  const manager = bulkManager?.value.trim();
  if (!manager) {
    alert("Введите email менеджера");
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
    alert("Ошибка массового обновления");
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
    alert("Ошибка удаления");
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
  } catch (err) {
    editorStatus.textContent = "Ошибка сохранения";
  }
});

drawerClose.addEventListener("click", closeDrawer);
drawerCancel.addEventListener("click", closeDrawer);
editCounterpartyName?.addEventListener("input", updateCounterpartySuggestions);
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

bootstrap();
