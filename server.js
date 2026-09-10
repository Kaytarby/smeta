import express from "express";
import cookieParser from "cookie-parser";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import nodemailer from "nodemailer";
import { Store, migrateJsonStore, ensureDefaultAdmin, rotateBackups } from "./lib/db.js";
import {
  ALLOWED_STATUSES,
  alreadyRanThisWeek,
  extractSessionToken,
  isSecureRequest,
  sessionCookieOptions,
  buildExportRows,
  buildWeekHeaders,
  calculateBudgetUsage,
  canEditFields,
  counterpartyExists,
  createId,
  hashPassword,
  isWithinMondayWindow,
  lanUrls,
  normalizeInn,
  normalizeCounterpartyName,
  normalizeItemPayload,
  parseImportRows,
  sanitizeMonth,
  sanitizeNumber,
  shiftItemsForMonday,
  signSession,
  verifyPassword,
  verifySession,
  WEEK_COUNT
} from "./lib/logic.js";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const STORE_JSON_PATH = path.join(DATA_DIR, "store.json");
const DB_PATH = path.join(DATA_DIR, "operplan.sqlite");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const EXPORT_DIR = path.join(__dirname, "exports");
const SECRET_PATH = path.join(DATA_DIR, "session.secret");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const ALLOW_OTHER_COUNTERPARTIES = (process.env.ALLOW_OTHER_COUNTERPARTIES || "true") === "true";

fsSync.mkdirSync(DATA_DIR, { recursive: true });
fsSync.mkdirSync(EXPORT_DIR, { recursive: true });
fsSync.mkdirSync(BACKUP_DIR, { recursive: true });

function loadSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (fsSync.existsSync(SECRET_PATH)) return fsSync.readFileSync(SECRET_PATH, "utf8").trim();
  const generated = crypto.randomBytes(32).toString("hex");
  fsSync.writeFileSync(SECRET_PATH, generated, { encoding: "utf8", mode: 0o600 });
  return generated;
}

const SESSION_SECRET = loadSessionSecret();

const store = new Store(DB_PATH);

if (fsSync.existsSync(STORE_JSON_PATH)) {
  try {
    const json = JSON.parse(fsSync.readFileSync(STORE_JSON_PATH, "utf8"));
    const result = migrateJsonStore(store, json);
    if (result.migrated) {
      console.log("Данные перенесены из data/store.json в SQLite.");
    }
  } catch (err) {
    console.error("Не удалось прочитать store.json:", err.message);
  }
}

ensureDefaultAdmin(store, ADMIN_EMAIL, ADMIN_PASSWORD);

function backupNow() {
  try {
    store.checkpoint();
    const dest = rotateBackups(DB_PATH, BACKUP_DIR, 14);
    store.setMeta("lastBackup", new Date().toISOString());
    store.setMeta("lastBackupPath", dest);
    return dest;
  } catch (err) {
    console.error("Backup failed:", err);
    return null;
  }
}

backupNow();

const app = express();
// Работаем и напрямую (http://IP:3000 в локальной сети), и за HTTPS‑прокси/превью:
// важно для определения схемы запроса (Secure/SameSite cookie).
app.set("trust proxy", true);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

/** Короткий журнал запросов: видно, доходит ли браузер до сервера и каким путём авторизуется. */
app.use((req, res, next) => {
  if (/\.(css|js|svg|png|ico|map)$/.test(req.path)) return next();
  const started = Date.now();
  res.on("finish", () => {
    const auth = req.headers.authorization ? "bearer" : req.cookies?.session ? "cookie" : "нет";
    const who = req.user?.email ? ` ${req.user.email}` : "";
    const url = req.originalUrl.replace(/([?&]token=)[^&]*/i, "$1…");
    console.log(
      `[${new Date().toLocaleTimeString("ru-RU")}] ${req.method} ${url} → ${res.statusCode} (${Date.now() - started} мс, вход: ${auth}${who})`
    );
  });
  next();
});

app.use(express.static(path.join(__dirname, "public")));

function getUserByEmail(email) {
  return store.getUserByEmail(email);
}

function requireAuth() {
  return async (req, res, next) => {
    const token = extractSessionToken(req);
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });
    const email = verifySession(token, SESSION_SECRET);
    if (!email) return res.status(401).json({ error: "UNAUTHORIZED" });
    const user = getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "UNAUTHORIZED" });
    req.user = user;
    next();
  };
}

function requireAdmin() {
  return async (req, res, next) => {
    if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "FORBIDDEN" });
    next();
  };
}

function assertCounterparty(name, inn) {
  if (!name || !inn) return { error: "COUNTERPARTY_NAME_INN_REQUIRED" };
  if (![10, 12].includes(inn.length)) return { error: "INN_INVALID" };
  const exists = counterpartyExists(store.listCounterparties(), name, inn);
  if (!exists) return { error: "COUNTERPARTY_NOT_ALLOWED" };
  store.fillEmptyCounterpartyInn(name, inn);
  return { ok: true };
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
    ...Array.from({ length: WEEK_COUNT }, (_, i) => `Week_${i}`)
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Импорт");
  return workbook;
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
    attachments: [{ filename, content: buffer }]
  });

  return true;
}

async function runMondayProcessing() {
  const now = new Date();
  const current = store.listItems();
  const { items, archiveEntries } = shiftItemsForMonday(current, now);

  store.transaction(() => {
    items.forEach((item) => store.updateItem(item));
    if (archiveEntries.length > 0) store.insertArchiveEntries(archiveEntries);
    store.setMeta("lastMondayRun", now.toISOString());
  });

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

  backupNow();
  return { archivedCount: archiveEntries.length, filePath, emailed };
}

function scheduleMondayProcessing() {
  setInterval(async () => {
    const now = new Date();
    if (!isWithinMondayWindow(now)) return;
    if (alreadyRanThisWeek(store.getMeta("lastMondayRun"), now)) return;
    try {
      await runMondayProcessing();
      console.log("Monday processing completed.");
    } catch (err) {
      console.error("Monday processing failed:", err);
    }
  }, 5 * 60 * 1000);
}

function scheduleBackups() {
  setInterval(() => backupNow(), 6 * 60 * 60 * 1000);
}

function runtimeInfo() {
  return {
    hostName: os.hostname(),
    port: PORT,
    urls: lanUrls(PORT),
    laptopHost: true,
    warning:
      "База живёт только пока включён этот компьютер. Коллеги открывают адрес в браузере в локальной сети — интернет не нужен.",
    lastMondayRun: store.getMeta("lastMondayRun"),
    lastBackup: store.getMeta("lastBackup"),
    dbFile: path.basename(DB_PATH)
  };
}

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "EMAIL_AND_PASSWORD_REQUIRED" });
  const user = getUserByEmail(email);
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  if (!verifyPassword(password, user.salt, user.hash)) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
  const token = signSession(user.email, SESSION_SECRET);
  res.cookie("session", token, sessionCookieOptions(req));
  // Токен отдаём и в теле ответа: если браузер блокирует cookie в стороннем фрейме,
  // клиент сохранит его и будет присылать заголовком Authorization.
  res.json({ email: user.email, role: user.role, token });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("session", { path: "/" });
  res.clearCookie("session", { path: "/", sameSite: "none", secure: true });
  res.json({ ok: true });
});

app.get("/api/me", requireAuth(), async (req, res) => {
  res.json({ email: req.user.email, role: req.user.role });
});

app.get("/api/runtime", requireAuth(), async (_req, res) => {
  res.json(runtimeInfo());
});

app.get("/api/reference", requireAuth(), async (_req, res) => {
  const refs = store.reference();
  res.json({ ...refs, allowOtherCounterparties: ALLOW_OTHER_COUNTERPARTIES });
});

app.post("/api/reference/articles", requireAuth(), requireAdmin(), async (req, res) => {
  const { value } = req.body || {};
  if (!value) return res.status(400).json({ error: "VALUE_REQUIRED" });
  store.addArticle(String(value).trim());
  res.json({ articles: store.listArticles() });
});

app.post("/api/reference/articles/delete", requireAuth(), requireAdmin(), async (req, res) => {
  const { value } = req.body || {};
  if (!value) return res.status(400).json({ error: "VALUE_REQUIRED" });
  store.deleteArticle(value);
  res.json({ articles: store.listArticles() });
});

app.post("/api/reference/counterparties", requireAuth(), async (req, res) => {
  const { name, inn } = req.body || {};
  const normalizedName = normalizeCounterpartyName(name);
  const normalizedInn = normalizeInn(inn);
  if (!normalizedName || !normalizedInn) return res.status(400).json({ error: "NAME_INN_REQUIRED" });
  if (![10, 12].includes(normalizedInn.length)) return res.status(400).json({ error: "INN_INVALID" });
  const exists = counterpartyExists(store.listCounterparties(), normalizedName, normalizedInn);
  if (!exists) store.addCounterparty(normalizedName, normalizedInn);
  else store.fillEmptyCounterpartyInn(normalizedName, normalizedInn);
  res.json({ counterparties: store.listCounterparties() });
});

app.post("/api/reference/counterparties/bulk", requireAuth(), requireAdmin(), async (req, res) => {
  const { values } = req.body || {};
  if (!values) return res.status(400).json({ error: "VALUE_REQUIRED" });
  const list = Array.isArray(values) ? values : String(values).split(/\n+/);
  store.transaction(() => {
    list.forEach((line) => {
      const parts = String(line)
        .split(/[,;\t]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (parts.length < 2) return;
      const name = normalizeCounterpartyName(parts[0]);
      const inn = normalizeInn(parts[1]);
      if (!name || !inn || ![10, 12].includes(inn.length)) return;
      const exists = counterpartyExists(store.listCounterparties(), name, inn);
      if (!exists) store.addCounterparty(name, inn);
      else store.fillEmptyCounterpartyInn(name, inn);
    });
  });
  res.json({ counterparties: store.listCounterparties() });
});

app.post("/api/reference/counterparties/delete", requireAuth(), requireAdmin(), async (req, res) => {
  const { name, inn } = req.body || {};
  const normalizedName = normalizeCounterpartyName(name);
  const normalizedInn = normalizeInn(inn);
  if (!normalizedName || !normalizedInn) return res.status(400).json({ error: "NAME_INN_REQUIRED" });
  store.deleteCounterparty(normalizedName, normalizedInn);
  res.json({ counterparties: store.listCounterparties() });
});

app.get("/api/items", requireAuth(), async (req, res) => {
  const isAdmin = req.user.role === "admin";
  const items = isAdmin ? store.listItems() : store.listItems(req.user.email);
  res.json({ items });
});

app.post("/api/items", requireAuth(), async (req, res) => {
  const payload = normalizeItemPayload(req.body, req.user.email);
  if (req.user.role !== "admin") {
    payload.status = "Черновик";
    payload.manager = req.user.email;
  }
  if (!payload.article || !payload.paymentType) {
    return res.status(400).json({ error: "ARTICLE_AND_PAYMENT_REQUIRED" });
  }
  const check = assertCounterparty(payload.counterpartyName, payload.counterpartyInn);
  if (check.error) return res.status(400).json({ error: check.error });

  const now = new Date().toISOString();
  const item = { id: createId(), ...payload, createdAt: now, updatedAt: now };
  store.insertItem(item);
  res.json({ item });
});

app.put("/api/items/:id", requireAuth(), async (req, res) => {
  const item = store.getItem(req.params.id);
  if (!item) return res.status(404).json({ error: "NOT_FOUND" });

  const permission = canEditFields(req.user, item, req.body || {});
  if (!permission.allowed) return res.status(403).json({ error: permission.reason });

  const body = req.body || {};
  const payload = normalizeItemPayload({ ...item, ...body }, req.user.email);
  if (req.user.role !== "admin") {
    payload.status = item.status;
    payload.manager = item.manager;
  }
  const counterpartyTouched =
    "counterpartyName" in body || "counterpartyInn" in body || "counterparty" in body;
  if (counterpartyTouched) {
    const check = assertCounterparty(payload.counterpartyName, payload.counterpartyInn);
    if (check.error) return res.status(400).json({ error: check.error });
  }

  const updated = {
    ...item,
    ...payload,
    updatedAt: new Date().toISOString()
  };
  store.updateItem(updated);
  res.json({ item: store.getItem(item.id) });
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

  const now = new Date().toISOString();
  const updated = [];
  store.transaction(() => {
    ids.forEach((id) => {
      const item = store.getItem(id);
      if (!item) return;
      if (status) item.status = status;
      if ("manager" in changes) item.manager = manager;
      item.updatedAt = now;
      store.updateItem(item);
      updated.push(item);
    });
  });
  res.json({ items: updated });
});

app.post("/api/items/bulk-delete", requireAuth(), requireAdmin(), async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "IDS_REQUIRED" });
  const deletedIds = store.transaction(() => store.deleteItems(ids));
  res.json({ deletedIds });
});

app.post("/api/items/:id/copy", requireAuth(), async (req, res) => {
  const item = store.getItem(req.params.id);
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
  store.insertItem(copied);
  res.json({ item: copied });
});

app.get("/api/archive", requireAuth(), requireAdmin(), async (_req, res) => {
  res.json({ archive: store.listArchive() });
});

app.get("/api/export", requireAuth(), async (req, res) => {
  const isAdmin = req.user.role === "admin";
  const items = isAdmin ? store.listItems() : store.listItems(req.user.email);
  const workbook = buildWorkbook(items);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `Смета_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(buffer);
});

app.get("/api/template", requireAuth(), async (_req, res) => {
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
  const refs = store.reference();
  const rows = parseImportRows(buffer, refs, XLSX);
  const invalid = rows.filter((row) => row.errors && Object.keys(row.errors).length > 0).length;
  if (logErrors && invalid > 0) {
    const invalidRows = rows.filter((row) => row.errors && Object.keys(row.errors).length > 0);
    store.addImportError({
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
  }
  res.json({ rows, invalid, valid: rows.length - invalid });
});

app.post("/api/import/commit", requireAuth(), async (req, res) => {
  const { data, fileName } = req.body || {};
  if (!data) return res.status(400).json({ error: "DATA_REQUIRED" });
  const buffer = Buffer.from(String(data), "base64");
  const refs = store.reference();
  const rows = parseImportRows(buffer, refs, XLSX);
  const invalidRows = rows.filter((row) => row.errors && Object.keys(row.errors).length > 0);
  if (invalidRows.length > 0) {
    store.addImportError({
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
    return res.status(400).json({ error: "INVALID_ROWS", rows, invalid: invalidRows.length });
  }
  const now = new Date().toISOString();
  const created = [];
  store.transaction(() => {
    rows.forEach((row) => {
      const item = {
        id: createId(),
        article: row.data.article,
        paymentType: row.data.paymentType,
        counterpartyName: row.data.counterpartyName,
        counterpartyInn: row.data.counterpartyInn,
        kz: sanitizeNumber(row.data.kz),
        kzCrit: sanitizeNumber(row.data.kzCrit),
        weeks: row.data.weeks,
        status: "Черновик",
        manager: req.user.email,
        createdAt: now,
        updatedAt: now
      };
      store.fillEmptyCounterpartyInn(item.counterpartyName, item.counterpartyInn);
      store.insertItem(item);
      created.push(item);
    });
  });
  res.json({ created: created.length, items: created });
});

app.get("/api/import/errors", requireAuth(), async (req, res) => {
  const errors = store.listImportErrors(req.user.email, req.user.role === "admin");
  res.json({ errors });
});

app.post("/api/import/errors/clear", requireAuth(), async (req, res) => {
  const { id, all } = req.body || {};
  store.clearImportErrors({
    id,
    all,
    userEmail: req.user.email,
    isAdmin: req.user.role === "admin"
  });
  const errors = store.listImportErrors(req.user.email, req.user.role === "admin");
  res.json({ errors });
});

app.get("/api/limits", requireAuth(), async (_req, res) => {
  res.json({ limits: store.listLimits() });
});

app.post("/api/limits", requireAuth(), requireAdmin(), async (req, res) => {
  const { article, month, amount } = req.body || {};
  const normalizedArticle = String(article || "").trim();
  const normalizedMonth = sanitizeMonth(month);
  const numericAmount = sanitizeNumber(amount);
  if (!normalizedArticle || !normalizedMonth) return res.status(400).json({ error: "REQUIRED" });
  if (!store.listArticles().includes(normalizedArticle)) {
    return res.status(400).json({ error: "ARTICLE_NOT_FOUND" });
  }
  store.upsertLimit(normalizedArticle, normalizedMonth, numericAmount);
  res.json({ limits: store.listLimits() });
});

app.post("/api/limits/bulk", requireAuth(), requireAdmin(), async (req, res) => {
  const { values } = req.body || {};
  if (!values) return res.status(400).json({ error: "VALUE_REQUIRED" });
  const list = Array.isArray(values) ? values : String(values).split(/\n+/);
  const articles = store.listArticles();
  store.transaction(() => {
    list.forEach((line) => {
      const parts = String(line)
        .split(/[,;\t]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (parts.length < 3) return;
      const [article, month, amount] = parts;
      const normalizedMonth = sanitizeMonth(month);
      if (!article || !normalizedMonth) return;
      if (!articles.includes(article)) return;
      store.upsertLimit(article, normalizedMonth, sanitizeNumber(amount));
    });
  });
  res.json({ limits: store.listLimits() });
});

app.post("/api/limits/delete", requireAuth(), requireAdmin(), async (req, res) => {
  const { article, month } = req.body || {};
  const normalizedArticle = String(article || "").trim();
  const normalizedMonth = sanitizeMonth(month);
  if (!normalizedArticle || !normalizedMonth) return res.status(400).json({ error: "REQUIRED" });
  store.deleteLimit(normalizedArticle, normalizedMonth);
  res.json({ limits: store.listLimits() });
});

app.get("/api/budget-usage", requireAuth(), async (req, res) => {
  const month = sanitizeMonth(req.query.month) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const usage = calculateBudgetUsage(store.listItems(), store.listLimits(), month);
  res.json({ month, usage });
});

app.post("/api/process/monday", requireAuth(), requireAdmin(), async (_req, res) => {
  const result = await runMondayProcessing();
  res.json(result);
});

app.get("/api/meta", requireAuth(), async (_req, res) => {
  res.json({ lastMondayRun: store.getMeta("lastMondayRun"), lastBackup: store.getMeta("lastBackup") });
});

app.post("/api/backup", requireAuth(), requireAdmin(), async (_req, res) => {
  const dest = backupNow();
  res.json({ ok: Boolean(dest), path: dest, lastBackup: store.getMeta("lastBackup") });
});

app.post("/api/users", requireAuth(), requireAdmin(), async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password || !role) return res.status(400).json({ error: "REQUIRED" });
  if (getUserByEmail(email)) return res.status(409).json({ error: "ALREADY_EXISTS" });
  const { salt, hash } = hashPassword(password);
  const user = {
    id: createId("user"),
    email,
    salt,
    hash,
    role,
    createdAt: new Date().toISOString()
  };
  store.createUser(user);
  res.json({ user: { email: user.email, role: user.role } });
});

app.get("/api/users", requireAuth(), requireAdmin(), async (_req, res) => {
  res.json({ users: store.listUsers().map((user) => ({ email: user.email, role: user.role })) });
});

app.post("/api/users/delete", requireAuth(), requireAdmin(), async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "EMAIL_REQUIRED" });
  if (email === req.user.email) return res.status(400).json({ error: "CANNOT_DELETE_SELF" });
  const target = store.listUsers().find((user) => user.email === email);
  if (!target) return res.status(404).json({ error: "NOT_FOUND" });
  if (target.role === "admin") {
    const adminCount = store.listUsers().filter((user) => user.role === "admin").length;
    if (adminCount <= 1) return res.status(400).json({ error: "LAST_ADMIN" });
  }
  store.deleteUser(email);
  res.json({ users: store.listUsers().map((user) => ({ email: user.email, role: user.role })) });
});

app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND" });
});

scheduleMondayProcessing();
scheduleBackups();

app.listen(PORT, "0.0.0.0", () => {
  const urls = lanUrls(PORT);
  console.log("Оперплан запущен. Интернет не нужен.");
  console.log(`Этот компьютер: ${os.hostname()}`);
  console.log("Откройте в браузере:");
  urls.forEach((url) => console.log(`  ${url}`));
  console.log("Пока этот ноутбук выключен, коллеги к базе не подключатся.");
});
