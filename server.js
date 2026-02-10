import express from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const STORE_PATH = path.join(__dirname, "data", "store.json");
const EXPORT_DIR = path.join(__dirname, "exports");

const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-secret";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const ALLOW_OTHER_COUNTERPARTIES = (process.env.ALLOW_OTHER_COUNTERPARTIES || "true") === "true";
const ALLOWED_STATUSES = ["Черновик", "Отправлено", "Утверждено"];

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

let storeCache = null;

function normalizeInn(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeCounterpartyName(value) {
  return String(value || "").trim();
}

function sanitizeMonth(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : "";
}

function counterpartyMatches(a, name, inn) {
  return a.name.toLowerCase() === name.toLowerCase() && a.inn === inn;
}

function counterpartyExists(store, name, inn) {
  const lowered = name.toLowerCase();
  return store.counterparties.some(
    (cp) => cp.name.toLowerCase() === lowered && (cp.inn === inn || !cp.inn)
  );
}

function updateCounterpartyInn(store, name, inn) {
  const lowered = name.toLowerCase();
  const target = store.counterparties.find((cp) => cp.name.toLowerCase() === lowered && !cp.inn);
  if (target) {
    target.inn = inn;
    return true;
  }
  return false;
}

function ensureCounterpartyShape(entry) {
  if (!entry) return { name: "", inn: "" };
  if (typeof entry === "string") return { name: normalizeCounterpartyName(entry), inn: "" };
  return {
    name: normalizeCounterpartyName(entry.name),
    inn: normalizeInn(entry.inn)
  };
}

function migrateStore(store) {
  if (!store) return store;
  if (!Array.isArray(store.counterparties)) store.counterparties = [];
  store.counterparties = store.counterparties.map(ensureCounterpartyShape);

  if (!Array.isArray(store.items)) store.items = [];
  store.items.forEach((item) => {
    if (!("counterpartyName" in item) && "counterparty" in item) {
      item.counterpartyName = normalizeCounterpartyName(item.counterparty);
    }
    if (!("counterpartyInn" in item)) {
      const name = normalizeCounterpartyName(item.counterpartyName || "");
      const found = store.counterparties.find((cp) => cp.name === name && cp.inn);
      item.counterpartyInn = found ? found.inn : "";
    } else {
      item.counterpartyInn = normalizeInn(item.counterpartyInn);
    }
    delete item.counterparty;
  });

  if (!Array.isArray(store.archive)) store.archive = [];
  store.archive.forEach((entry) => {
    if (!("counterpartyName" in entry) && "counterparty" in entry) {
      entry.counterpartyName = normalizeCounterpartyName(entry.counterparty);
    }
    if (!("counterpartyInn" in entry)) {
      const name = normalizeCounterpartyName(entry.counterpartyName || "");
      const found = store.counterparties.find((cp) => cp.name === name && cp.inn);
      entry.counterpartyInn = found ? found.inn : "";
    } else {
      entry.counterpartyInn = normalizeInn(entry.counterpartyInn);
    }
    delete entry.counterparty;
  });

  if (!Array.isArray(store.limits)) store.limits = [];
  if (!Array.isArray(store.importErrors)) store.importErrors = [];
  return store;
}

async function loadStore() {
  if (storeCache) return storeCache;
  const raw = await fs.readFile(STORE_PATH, "utf8");
  storeCache = migrateStore(JSON.parse(raw));
  return storeCache;
}

async function saveStore() {
  if (!storeCache) return;
  const tmpPath = STORE_PATH + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(storeCache, null, 2), "utf8");
  await fs.rename(tmpPath, STORE_PATH);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const hashed = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(hashed, "hex"));
}

function signSession(email) {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 8;
  const payload = `${email}|${expiresAt}`;
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64");
}

function verifySession(token) {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [email, exp, sig] = decoded.split("|");
    if (!email || !exp || !sig) return null;
    const payload = `${email}|${exp}`;
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
      return null;
    }
    if (Date.now() > Number(exp)) return null;
    return email;
  } catch (err) {
    return null;
  }
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

function buildWeekHeaders() {
  return Array.from({ length: 10 }, (_, i) => weekLabel(i));
}

function sanitizeNumber(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return 0;
  return Math.round(num);
}

function ensureArrayLength(arr, len) {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < len) out.push(0);
  return out.slice(0, len).map((v) => sanitizeNumber(v));
}

function createId(prefix = "item") {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function ensureDefaultAdmin() {
  const store = await loadStore();
  if (store.users.length > 0) return;
  const { salt, hash } = hashPassword(ADMIN_PASSWORD);
  store.users.push({
    id: createId("user"),
    email: ADMIN_EMAIL,
    salt,
    hash,
    role: "admin",
    createdAt: new Date().toISOString()
  });
  await saveStore();
}

function getUserByEmail(store, email) {
  return store.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

function requireAuth(handler) {
  return async (req, res, next) => {
    const token = req.cookies.session;
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });
    const email = verifySession(token);
    if (!email) return res.status(401).json({ error: "UNAUTHORIZED" });
    const store = await loadStore();
    const user = getUserByEmail(store, email);
    if (!user) return res.status(401).json({ error: "UNAUTHORIZED" });
    req.user = user;
    next();
  };
}

function requireAdmin(handler) {
  return async (req, res, next) => {
    if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "FORBIDDEN" });
    next();
  };
}

function canEditFields(user, item, payload) {
  if (user.role === "admin") return { allowed: true };
  if (item.manager !== user.email) return { allowed: false, reason: "ONLY_OWNER" };

  if ("status" in payload || "manager" in payload) {
    return { allowed: false, reason: "FORBIDDEN_FIELDS" };
  }

  const lockedFields = ["counterpartyName", "counterpartyInn", "counterparty", "kz", "kzCrit", "weeks"];
  if (item.status !== "Черновик") {
    const touchesLocked = lockedFields.some((field) => field in payload);
    if (touchesLocked) return { allowed: false, reason: "LOCKED_BY_STATUS" };
  }
  return { allowed: true };
}

function normalizeItemPayload(payload, userEmail) {
  const weeks = ensureArrayLength(payload.weeks, 10);
  return {
    article: String(payload.article || "").trim(),
    paymentType: String(payload.paymentType || "").trim(),
    counterpartyName: normalizeCounterpartyName(payload.counterpartyName || payload.counterparty || ""),
    counterpartyInn: normalizeInn(payload.counterpartyInn || ""),
    kz: sanitizeNumber(payload.kz),
    kzCrit: sanitizeNumber(payload.kzCrit),
    weeks,
    status: payload.status || "Черновик",
    manager: payload.manager || userEmail
  };
}

function buildExportRows(items) {
  const headers = [
    "ID",
    "Статья",
    "Тип платежа",
    "Контрагент",
    "КЗ",
    "КЗ_Крит",
    "Week_0",
    "Week_1",
    "Week_2",
    "Week_3",
    "Week_4",
    "Week_5",
    "Week_6",
    "Week_7",
    "Week_8",
    "Week_9",
    "Статус",
    "Менеджер"
  ];

  const rows = items.map((item) => [
    item.id,
    item.article,
    item.paymentType,
    item.counterpartyName,
    item.kz,
    item.kzCrit,
    ...ensureArrayLength(item.weeks, 10),
    item.status,
    item.manager
  ]);

  return { headers, rows };
}

function buildWorkbook(items) {
  const { headers, rows } = buildExportRows(items);
  const weekHeaders = buildWeekHeaders();
  const headerRow = [...headers];
  headerRow.splice(6, 10, ...weekHeaders);
  const data = [headerRow, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Смета");
  return workbook;
}

function buildImportTemplateWorkbook() {
  const headers = [
    "Статья",
    "Тип платежа",
    "Контрагент",
    "ИНН",
    "КЗ",
    "КЗ_Крит",
    "Week_0",
    "Week_1",
    "Week_2",
    "Week_3",
    "Week_4",
    "Week_5",
    "Week_6",
    "Week_7",
    "Week_8",
    "Week_9"
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Импорт");
  return workbook;
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getWeekDate(index) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + index * 7);
  return base;
}

function calculateBudgetUsage(store, monthKey) {
  const usage = {};
  store.items.forEach((item) => {
    const weeks = ensureArrayLength(item.weeks, 10);
    weeks.forEach((value, idx) => {
      const date = getWeekDate(idx);
      if (getMonthKey(date) !== monthKey) return;
      const key = item.article;
      usage[key] = (usage[key] || 0) + sanitizeNumber(value);
    });
  });
  const result = store.limits
    .filter((limit) => limit.month === monthKey)
    .map((limit) => {
      const used = usage[limit.article] || 0;
      const limitAmount = sanitizeNumber(limit.amount);
      const remaining = limitAmount - used;
      const percent = limitAmount > 0 ? Math.min(1, used / limitAmount) : 0;
      return {
        article: limit.article,
        month: limit.month,
        limit: limitAmount,
        used,
        remaining,
        percent
      };
    });
  return result;
}

function parseImportRows(buffer, store) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  if (rows.length === 0) return [];
  const headerRow = rows[0].map((cell) => String(cell || "").trim());
  const headerIndex = {};
  headerRow.forEach((label, idx) => {
    if (label) headerIndex[label] = idx;
  });

  const requiredHeaders = ["Статья", "Тип платежа", "Контрагент", "ИНН"];
  const weekHeaders = Array.from({ length: 10 }, (_, i) => `Week_${i}`);
  const headersToFind = [...requiredHeaders, "КЗ", "КЗ_Крит", ...weekHeaders];
  const missingHeaders = headersToFind.filter((label) => !(label in headerIndex));
  if (missingHeaders.length > 0) {
    return [
      {
        rowIndex: 1,
        data: {},
        errors: { __header__: `Не найдены колонки: ${missingHeaders.join(", ")}` }
      }
    ];
  }

  const parsed = [];
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row || row.every((cell) => cell === null || cell === undefined || cell === "")) continue;
    const article = String(row[headerIndex["Статья"]] || "").trim();
    const paymentType = String(row[headerIndex["Тип платежа"]] || "").trim();
    const counterpartyName = normalizeCounterpartyName(row[headerIndex["Контрагент"]] || "");
    const counterpartyInn = normalizeInn(row[headerIndex["ИНН"]] || "");
    const kz = row[headerIndex["КЗ"]];
    const kzCrit = row[headerIndex["КЗ_Крит"]];
    const weeks = weekHeaders.map((label) => row[headerIndex[label]]);

    const errors = {};
    if (!article || !store.articles.includes(article)) errors.article = "Статья не найдена";
    if (!paymentType || !store.paymentTypes.includes(paymentType)) errors.paymentType = "Тип платежа не найден";
    if (!counterpartyName) errors.counterpartyName = "Контрагент обязателен";
    if (!counterpartyInn) errors.counterpartyInn = "ИНН обязателен";
    if (counterpartyInn && ![10, 12].includes(counterpartyInn.length)) {
      errors.counterpartyInn = "ИНН должен быть 10 или 12 цифр";
    }
    if (counterpartyName && counterpartyInn) {
      const exists = counterpartyExists(store, counterpartyName, counterpartyInn);
      if (!exists) errors.counterpartyName = "Контрагент не найден в базе";
    }

    const kzValue = sanitizeNumber(kz);
    const kzCritValue = sanitizeNumber(kzCrit);
    if (kz !== null && kz !== undefined && kz !== "" && Number.isNaN(Number(kz))) {
      errors.kz = "КЗ должно быть числом";
    }
    if (kzCrit !== null && kzCrit !== undefined && kzCrit !== "" && Number.isNaN(Number(kzCrit))) {
      errors.kzCrit = "КЗ_Крит должно быть числом";
    }

    const normalizedWeeks = weeks.map((value, idx) => {
      if (value === null || value === undefined || value === "") return 0;
      const num = Number(value);
      if (Number.isNaN(num)) {
        errors[`week_${idx}`] = "Неделя должна быть числом";
        return 0;
      }
      return Math.round(num);
    });

    parsed.push({
      rowIndex: r + 1,
      data: {
        article,
        paymentType,
        counterpartyName,
        counterpartyInn,
        kz: kzValue,
        kzCrit: kzCritValue,
        weeks: normalizedWeeks
      },
      errors
    });
  }
  return parsed;
}

function logImportError(store, entry) {
  if (!Array.isArray(store.importErrors)) store.importErrors = [];
  store.importErrors.unshift(entry);
  if (store.importErrors.length > 200) {
    store.importErrors = store.importErrors.slice(0, 200);
  }
}

async function sendExportEmail(buffer, filename) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || user,
    to: ADMIN_EMAIL,
    subject: "Смета (Понедельник)",
    text: "Файл во вложении.",
    attachments: [
      {
        filename,
        content: buffer
      }
    ]
  });

  return true;
}

async function runMondayProcessing(store) {
  const now = new Date();
  const items = store.items;
  const archiveEntries = [];

  for (const item of items) {
    const weeks = ensureArrayLength(item.weeks, 10);
    const week0 = weeks[0];
    if (week0 && week0 !== 0) {
      archiveEntries.push({
        archivedAt: now.toISOString(),
        article: item.article,
        paymentType: item.paymentType,
        counterpartyName: item.counterpartyName || "",
        counterpartyInn: item.counterpartyInn || "",
        manager: item.manager,
        amount: week0
      });
    }

    const shifted = weeks.slice(1).concat(0);
    item.weeks = shifted;
    item.updatedAt = now.toISOString();
  }

  if (archiveEntries.length > 0) {
    store.archive.push(...archiveEntries);
  }

  const workbook = buildWorkbook(items);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileName = `Смета_${now.toISOString().slice(0, 10)}.xlsx`;
  const filePath = path.join(EXPORT_DIR, fileName);
  await fs.writeFile(filePath, buffer);

  let emailed = false;
  try {
    emailed = await sendExportEmail(buffer, fileName);
  } catch (err) {
    console.error("Email send failed:", err);
  }

  store.meta.lastMondayRun = now.toISOString();
  await saveStore();

  return { archivedCount: archiveEntries.length, filePath, emailed };
}

function isWithinMondayWindow(now) {
  const day = now.getDay();
  const hour = now.getHours();
  return day === 1 && hour === 0;
}

function alreadyRanThisWeek(lastRunIso, now) {
  if (!lastRunIso) return false;
  const last = new Date(lastRunIso);
  const weekNow = getISOWeek(now);
  const weekLast = getISOWeek(last);
  return weekNow === weekLast && now.getFullYear() === last.getFullYear();
}

async function scheduleMondayProcessing() {
  setInterval(async () => {
    const now = new Date();
    if (!isWithinMondayWindow(now)) return;
    const store = await loadStore();
    if (alreadyRanThisWeek(store.meta.lastMondayRun, now)) return;
    try {
      await runMondayProcessing(store);
      console.log("Monday processing completed.");
    } catch (err) {
      console.error("Monday processing failed:", err);
    }
  }, 5 * 60 * 1000);
}

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "EMAIL_AND_PASSWORD_REQUIRED" });
  const store = await loadStore();
  const user = getUserByEmail(store, email);
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  if (!verifyPassword(password, user.salt, user.hash)) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }

  const token = signSession(user.email);
  res.cookie("session", token, { httpOnly: true, sameSite: "lax" });
  res.json({ email: user.email, role: user.role });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ ok: true });
});

app.get("/api/me", requireAuth(), async (req, res) => {
  res.json({ email: req.user.email, role: req.user.role });
});

app.get("/api/reference", requireAuth(), async (req, res) => {
  const store = await loadStore();
  res.json({
    articles: store.articles,
    counterparties: store.counterparties,
    paymentTypes: store.paymentTypes,
    allowOtherCounterparties: ALLOW_OTHER_COUNTERPARTIES
  });
});

app.post("/api/reference/articles", requireAuth(), requireAdmin(), async (req, res) => {
  const { value } = req.body || {};
  if (!value) return res.status(400).json({ error: "VALUE_REQUIRED" });
  const store = await loadStore();
  if (!store.articles.includes(value)) store.articles.push(value);
  await saveStore();
  res.json({ articles: store.articles });
});

app.post("/api/reference/articles/delete", requireAuth(), requireAdmin(), async (req, res) => {
  const { value } = req.body || {};
  if (!value) return res.status(400).json({ error: "VALUE_REQUIRED" });
  const store = await loadStore();
  store.articles = store.articles.filter((item) => item !== value);
  await saveStore();
  res.json({ articles: store.articles });
});

app.post("/api/reference/counterparties", requireAuth(), async (req, res) => {
  const { name, inn } = req.body || {};
  const normalizedName = normalizeCounterpartyName(name);
  const normalizedInn = normalizeInn(inn);
  if (!normalizedName || !normalizedInn) return res.status(400).json({ error: "NAME_INN_REQUIRED" });
  if (![10, 12].includes(normalizedInn.length)) return res.status(400).json({ error: "INN_INVALID" });
  const store = await loadStore();
  const exists = counterpartyExists(store, normalizedName, normalizedInn);
  if (!exists) {
    store.counterparties.push({ name: normalizedName, inn: normalizedInn });
  } else {
    updateCounterpartyInn(store, normalizedName, normalizedInn);
  }
  await saveStore();
  res.json({ counterparties: store.counterparties });
});

app.post("/api/reference/counterparties/bulk", requireAuth(), requireAdmin(), async (req, res) => {
  const { values } = req.body || {};
  if (!values) return res.status(400).json({ error: "VALUE_REQUIRED" });
  const list = Array.isArray(values) ? values : String(values).split(/\n+/);
  const store = await loadStore();
  list.forEach((line) => {
    const parts = String(line).split(/[,;\t]+/).map((item) => item.trim()).filter(Boolean);
    if (parts.length < 2) return;
    const name = normalizeCounterpartyName(parts[0]);
    const inn = normalizeInn(parts[1]);
    if (!name || !inn || ![10, 12].includes(inn.length)) return;
    const exists = counterpartyExists(store, name, inn);
    if (!exists) {
      store.counterparties.push({ name, inn });
    } else {
      updateCounterpartyInn(store, name, inn);
    }
  });
  await saveStore();
  res.json({ counterparties: store.counterparties });
});

app.post("/api/reference/counterparties/delete", requireAuth(), requireAdmin(), async (req, res) => {
  const { name, inn } = req.body || {};
  const normalizedName = normalizeCounterpartyName(name);
  const normalizedInn = normalizeInn(inn);
  if (!normalizedName || !normalizedInn) return res.status(400).json({ error: "NAME_INN_REQUIRED" });
  const store = await loadStore();
  store.counterparties = store.counterparties.filter(
    (item) => !counterpartyMatches(item, normalizedName, normalizedInn)
  );
  await saveStore();
  res.json({ counterparties: store.counterparties });
});

app.get("/api/items", requireAuth(), async (req, res) => {
  const store = await loadStore();
  const isAdmin = req.user.role === "admin";
  const items = isAdmin ? store.items : store.items.filter((item) => item.manager === req.user.email);
  res.json({ items });
});

app.post("/api/items", requireAuth(), async (req, res) => {
  const store = await loadStore();
  const payload = normalizeItemPayload(req.body, req.user.email);

  if (req.user.role !== "admin") {
    payload.status = "Черновик";
    payload.manager = req.user.email;
  }

  if (!payload.article || !payload.paymentType) {
    return res.status(400).json({ error: "ARTICLE_AND_PAYMENT_REQUIRED" });
  }

  if (!payload.counterpartyName || !payload.counterpartyInn) {
    return res.status(400).json({ error: "COUNTERPARTY_NAME_INN_REQUIRED" });
  }

  const counterpartyTouched =
    "counterpartyName" in req.body || "counterpartyInn" in req.body || "counterparty" in req.body;
  if (counterpartyTouched) {
    if (!payload.counterpartyName || !payload.counterpartyInn) {
      return res.status(400).json({ error: "COUNTERPARTY_NAME_INN_REQUIRED" });
    }
    if (![10, 12].includes(payload.counterpartyInn.length)) {
      return res.status(400).json({ error: "INN_INVALID" });
    }
    const exists = counterpartyExists(store, payload.counterpartyName, payload.counterpartyInn);
    if (!exists) return res.status(400).json({ error: "COUNTERPARTY_NOT_ALLOWED" });
    updateCounterpartyInn(store, payload.counterpartyName, payload.counterpartyInn);
  }

  const now = new Date().toISOString();
  const item = {
    id: createId(),
    ...payload,
    createdAt: now,
    updatedAt: now
  };

  store.items.push(item);
  await saveStore();
  res.json({ item });
});

app.put("/api/items/:id", requireAuth(), async (req, res) => {
  const store = await loadStore();
  const item = store.items.find((row) => row.id === req.params.id);
  if (!item) return res.status(404).json({ error: "NOT_FOUND" });

  const permission = canEditFields(req.user, item, req.body || {});
  if (!permission.allowed) return res.status(403).json({ error: permission.reason });

  const payload = normalizeItemPayload({ ...item, ...req.body }, req.user.email);
  if (req.user.role !== "admin") {
    payload.status = item.status;
    payload.manager = item.manager;
  }
  if (payload.counterpartyName || payload.counterpartyInn) {
    if (!payload.counterpartyName || !payload.counterpartyInn) {
      return res.status(400).json({ error: "COUNTERPARTY_NAME_INN_REQUIRED" });
    }
    if (![10, 12].includes(payload.counterpartyInn.length)) {
      return res.status(400).json({ error: "INN_INVALID" });
    }
    const exists = counterpartyExists(store, payload.counterpartyName, payload.counterpartyInn);
    if (!exists) return res.status(400).json({ error: "COUNTERPARTY_NOT_ALLOWED" });
    updateCounterpartyInn(store, payload.counterpartyName, payload.counterpartyInn);
  }
  item.article = payload.article;
  item.paymentType = payload.paymentType;
  item.counterpartyName = payload.counterpartyName;
  item.counterpartyInn = payload.counterpartyInn;
  item.kz = payload.kz;
  item.kzCrit = payload.kzCrit;
  item.weeks = payload.weeks;
  item.status = payload.status;
  item.manager = payload.manager;
  item.updatedAt = new Date().toISOString();

  await saveStore();
  res.json({ item });
});

app.post("/api/items/bulk", requireAuth(), requireAdmin(), async (req, res) => {
  const { ids, changes } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "IDS_REQUIRED" });
  if (!changes || typeof changes !== "object") return res.status(400).json({ error: "CHANGES_REQUIRED" });

  const status = changes.status;
  const manager = "manager" in changes ? String(changes.manager || "").trim() : "";
  if (!status && !manager) return res.status(400).json({ error: "NO_CHANGES" });
  if (status && !ALLOWED_STATUSES.includes(status)) return res.status(400).json({ error: "INVALID_STATUS" });
  if ("manager" in changes && !manager) return res.status(400).json({ error: "INVALID_MANAGER" });

  const store = await loadStore();
  const now = new Date().toISOString();
  const updated = [];
  const idSet = new Set(ids);
  store.items.forEach((item) => {
    if (!idSet.has(item.id)) return;
    if (status) item.status = status;
    if ("manager" in changes) item.manager = manager;
    item.updatedAt = now;
    updated.push(item);
  });
  await saveStore();
  res.json({ items: updated });
});

app.post("/api/items/bulk-delete", requireAuth(), requireAdmin(), async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "IDS_REQUIRED" });
  const store = await loadStore();
  const idSet = new Set(ids);
  const existing = new Set(store.items.map((item) => item.id));
  const deletedIds = ids.filter((id) => existing.has(id));
  store.items = store.items.filter((item) => !idSet.has(item.id));
  await saveStore();
  res.json({ deletedIds });
});

app.post("/api/items/:id/copy", requireAuth(), async (req, res) => {
  const store = await loadStore();
  const item = store.items.find((row) => row.id === req.params.id);
  if (!item) return res.status(404).json({ error: "NOT_FOUND" });
  if (req.user.role !== "admin" && item.manager !== req.user.email) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const now = new Date().toISOString();
  const copied = {
    ...item,
    id: createId(),
    counterpartyName: "",
    counterpartyInn: "",
    status: "Черновик",
    manager: req.user.email,
    createdAt: now,
    updatedAt: now
  };
  store.items.push(copied);
  await saveStore();
  res.json({ item: copied });
});

app.get("/api/archive", requireAuth(), requireAdmin(), async (req, res) => {
  const store = await loadStore();
  res.json({ archive: store.archive });
});

app.get("/api/export", requireAuth(), async (req, res) => {
  const store = await loadStore();
  const isAdmin = req.user.role === "admin";
  const items = isAdmin ? store.items : store.items.filter((item) => item.manager === req.user.email);
  const workbook = buildWorkbook(items);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `Смета_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(buffer);
});

app.get("/api/template", requireAuth(), async (req, res) => {
  const workbook = buildImportTemplateWorkbook();
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = "Шаблон_импорт.xlsx";
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(buffer);
});

app.post("/api/import/preview", requireAuth(), async (req, res) => {
  const { data, fileName, logErrors } = req.body || {};
  if (!data) return res.status(400).json({ error: "DATA_REQUIRED" });
  const buffer = Buffer.from(String(data), "base64");
  const store = await loadStore();
  const rows = parseImportRows(buffer, store);
  const invalid = rows.filter((row) => row.errors && Object.keys(row.errors).length > 0).length;
  if (logErrors && invalid > 0) {
    const invalidRows = rows.filter((row) => row.errors && Object.keys(row.errors).length > 0);
    logImportError(store, {
      id: createId("import"),
      createdAt: new Date().toISOString(),
      userEmail: req.user.email,
      fileName: String(fileName || "Импорт"),
      invalidCount: invalidRows.length,
      totalRows: rows.length,
      rows: invalidRows.slice(0, 50).map((row) => ({
        rowIndex: row.rowIndex,
        errors: row.errors,
        data: {
          article: row.data.article,
          paymentType: row.data.paymentType,
          counterpartyName: row.data.counterpartyName,
          counterpartyInn: row.data.counterpartyInn
        }
      }))
    });
    await saveStore();
  }
  res.json({ rows, invalid, valid: rows.length - invalid });
});

app.post("/api/import/commit", requireAuth(), async (req, res) => {
  const { data, fileName } = req.body || {};
  if (!data) return res.status(400).json({ error: "DATA_REQUIRED" });
  const buffer = Buffer.from(String(data), "base64");
  const store = await loadStore();
  const rows = parseImportRows(buffer, store);
  const invalidRows = rows.filter((row) => row.errors && Object.keys(row.errors).length > 0);
  if (invalidRows.length > 0) {
    logImportError(store, {
      id: createId("import"),
      createdAt: new Date().toISOString(),
      userEmail: req.user.email,
      fileName: String(fileName || "Импорт"),
      invalidCount: invalidRows.length,
      totalRows: rows.length,
      rows: invalidRows.slice(0, 50).map((row) => ({
        rowIndex: row.rowIndex,
        errors: row.errors,
        data: {
          article: row.data.article,
          paymentType: row.data.paymentType,
          counterpartyName: row.data.counterpartyName,
          counterpartyInn: row.data.counterpartyInn
        }
      }))
    });
    await saveStore();
    return res.status(400).json({ error: "INVALID_ROWS", rows, invalid: invalidRows.length });
  }
  const now = new Date().toISOString();
  const created = rows.map((row) => ({
    id: createId(),
    article: row.data.article,
    paymentType: row.data.paymentType,
    counterpartyName: row.data.counterpartyName,
    counterpartyInn: row.data.counterpartyInn,
    kz: sanitizeNumber(row.data.kz),
    kzCrit: sanitizeNumber(row.data.kzCrit),
    weeks: ensureArrayLength(row.data.weeks, 10),
    status: req.user.role === "admin" ? "Черновик" : "Черновик",
    manager: req.user.email,
    createdAt: now,
    updatedAt: now
  }));
  created.forEach((item) => {
    updateCounterpartyInn(store, item.counterpartyName, item.counterpartyInn);
  });
  store.items.push(...created);
  await saveStore();
  res.json({ created: created.length, items: created });
});

app.get("/api/import/errors", requireAuth(), async (req, res) => {
  const store = await loadStore();
  const errors = store.importErrors || [];
  const filtered =
    req.user.role === "admin" ? errors : errors.filter((entry) => entry.userEmail === req.user.email);
  res.json({ errors: filtered });
});

app.post("/api/import/errors/clear", requireAuth(), async (req, res) => {
  const { id, all } = req.body || {};
  const store = await loadStore();
  if (all) {
    if (req.user.role === "admin") {
      store.importErrors = [];
    } else {
      store.importErrors = (store.importErrors || []).filter((entry) => entry.userEmail !== req.user.email);
    }
    await saveStore();
  } else if (id) {
    store.importErrors = (store.importErrors || []).filter((entry) => entry.id !== id);
    await saveStore();
  }
  const filtered =
    req.user.role === "admin"
      ? store.importErrors
      : (store.importErrors || []).filter((entry) => entry.userEmail === req.user.email);
  res.json({ errors: filtered });
});

app.get("/api/limits", requireAuth(), async (req, res) => {
  const store = await loadStore();
  res.json({ limits: store.limits || [] });
});

app.post("/api/limits", requireAuth(), requireAdmin(), async (req, res) => {
  const { article, month, amount } = req.body || {};
  const normalizedArticle = String(article || "").trim();
  const normalizedMonth = sanitizeMonth(month);
  const numericAmount = sanitizeNumber(amount);
  if (!normalizedArticle || !normalizedMonth) return res.status(400).json({ error: "REQUIRED" });
  const store = await loadStore();
  if (!store.articles.includes(normalizedArticle)) {
    return res.status(400).json({ error: "ARTICLE_NOT_FOUND" });
  }
  const existing = store.limits.find((limit) => limit.article === normalizedArticle && limit.month === normalizedMonth);
  if (existing) {
    existing.amount = numericAmount;
  } else {
    store.limits.push({ article: normalizedArticle, month: normalizedMonth, amount: numericAmount });
  }
  await saveStore();
  res.json({ limits: store.limits });
});

app.post("/api/limits/bulk", requireAuth(), requireAdmin(), async (req, res) => {
  const { values } = req.body || {};
  if (!values) return res.status(400).json({ error: "VALUE_REQUIRED" });
  const list = Array.isArray(values) ? values : String(values).split(/\n+/);
  const store = await loadStore();
  list.forEach((line) => {
    const parts = String(line).split(/[,;\t]+/).map((item) => item.trim()).filter(Boolean);
    if (parts.length < 3) return;
    const [article, month, amount] = parts;
    const normalizedMonth = sanitizeMonth(month);
    if (!article || !normalizedMonth) return;
    if (!store.articles.includes(article)) return;
    const numericAmount = sanitizeNumber(amount);
    const existing = store.limits.find((limit) => limit.article === article && limit.month === normalizedMonth);
    if (existing) {
      existing.amount = numericAmount;
    } else {
      store.limits.push({ article, month: normalizedMonth, amount: numericAmount });
    }
  });
  await saveStore();
  res.json({ limits: store.limits });
});

app.post("/api/limits/delete", requireAuth(), requireAdmin(), async (req, res) => {
  const { article, month } = req.body || {};
  const normalizedArticle = String(article || "").trim();
  const normalizedMonth = sanitizeMonth(month);
  if (!normalizedArticle || !normalizedMonth) return res.status(400).json({ error: "REQUIRED" });
  const store = await loadStore();
  store.limits = store.limits.filter((limit) => !(limit.article === normalizedArticle && limit.month === normalizedMonth));
  await saveStore();
  res.json({ limits: store.limits });
});

app.get("/api/budget-usage", requireAuth(), async (req, res) => {
  const month = sanitizeMonth(req.query.month) || getMonthKey(new Date());
  const store = await loadStore();
  const usage = calculateBudgetUsage(store, month);
  res.json({ month, usage });
});

app.post("/api/process/monday", requireAuth(), requireAdmin(), async (req, res) => {
  const store = await loadStore();
  const result = await runMondayProcessing(store);
  res.json(result);
});

app.get("/api/meta", requireAuth(), async (req, res) => {
  const store = await loadStore();
  res.json({ lastMondayRun: store.meta.lastMondayRun });
});

app.post("/api/users", requireAuth(), requireAdmin(), async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password || !role) return res.status(400).json({ error: "REQUIRED" });
  const store = await loadStore();
  if (getUserByEmail(store, email)) return res.status(409).json({ error: "ALREADY_EXISTS" });
  const { salt, hash } = hashPassword(password);
  const user = { id: createId("user"), email, salt, hash, role, createdAt: new Date().toISOString() };
  store.users.push(user);
  await saveStore();
  res.json({ user: { email: user.email, role: user.role } });
});

app.get("/api/users", requireAuth(), requireAdmin(), async (req, res) => {
  const store = await loadStore();
  res.json({ users: store.users.map((user) => ({ email: user.email, role: user.role })) });
});

app.post("/api/users/delete", requireAuth(), requireAdmin(), async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "EMAIL_REQUIRED" });
  if (email === req.user.email) return res.status(400).json({ error: "CANNOT_DELETE_SELF" });
  const store = await loadStore();
  const target = store.users.find((user) => user.email === email);
  if (!target) return res.status(404).json({ error: "NOT_FOUND" });
  if (target.role === "admin") {
    const adminCount = store.users.filter((user) => user.role === "admin").length;
    if (adminCount <= 1) return res.status(400).json({ error: "LAST_ADMIN" });
  }
  store.users = store.users.filter((user) => user.email !== email);
  await saveStore();
  res.json({ users: store.users.map((user) => ({ email: user.email, role: user.role })) });
});

app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND" });
});

await ensureDefaultAdmin();
await scheduleMondayProcessing();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
