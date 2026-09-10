import crypto from "crypto";
import os from "os";

export const WEEK_COUNT = 10;
export const ALLOWED_STATUSES = ["Черновик", "Отправлено", "Утверждено"];

export function normalizeInn(value) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeCounterpartyName(value) {
  return String(value || "").trim();
}

export function sanitizeMonth(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : "";
}

export function sanitizeNumber(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return 0;
  return Math.round(num);
}

export function ensureArrayLength(arr, len) {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < len) out.push(0);
  return out.slice(0, len).map((v) => sanitizeNumber(v));
}

export function createId(prefix = "item") {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function getISOWeek(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
}

export function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

export function weekLabel(offsetWeeks = 0, now = new Date()) {
  const base = new Date(now);
  base.setDate(base.getDate() + offsetWeeks * 7);
  return `Н${getISOWeek(base)} (${formatDate(base)})`;
}

export function buildWeekHeaders(now = new Date()) {
  return Array.from({ length: WEEK_COUNT }, (_, i) => weekLabel(i, now));
}

export function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getWeekDate(index, now = new Date()) {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + index * 7);
  return base;
}

export function counterpartyMatches(a, name, inn) {
  return a.name.toLowerCase() === name.toLowerCase() && a.inn === inn;
}

export function counterpartyExists(counterparties, name, inn) {
  const lowered = name.toLowerCase();
  return counterparties.some((cp) => cp.name.toLowerCase() === lowered && (cp.inn === inn || !cp.inn));
}

export function ensureCounterpartyShape(entry) {
  if (!entry) return { name: "", inn: "" };
  if (typeof entry === "string") return { name: normalizeCounterpartyName(entry), inn: "" };
  return {
    name: normalizeCounterpartyName(entry.name),
    inn: normalizeInn(entry.inn)
  };
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  const hashed = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(hashed, "hex"));
}

/**
 * Запрос пришёл по HTTPS (напрямую или через прокси/туннель)?
 * Нужно, чтобы правильно выбрать режим cookie: в локальной сети это http,
 * а в превью браузер открывает приложение во встроенном фрейме по https.
 */
export function isSecureRequest(req) {
  if (!req) return false;
  if (req.secure) return true;
  const proto = req.headers ? req.headers["x-forwarded-proto"] : "";
  if (typeof proto === "string" && proto.split(",")[0].trim() === "https") return true;
  return false;
}

/**
 * Настройки cookie сессии.
 * http (локальная сеть) → SameSite=Lax: обычный браузер коллег.
 * https (превью во фрейме) → SameSite=None; Secure: без этого браузер
 * считает cookie сторонней и не отправляет её, из-за чего вход «не проходит».
 */
export function sessionCookieOptions(req, ttlMs = 1000 * 60 * 60 * 8) {
  const base = { httpOnly: true, path: "/", maxAge: ttlMs };
  if (isSecureRequest(req)) return { ...base, sameSite: "none", secure: true };
  return { ...base, sameSite: "lax" };
}

/** Токен сессии из cookie или из заголовка Authorization: Bearer (если cookie недоступны). */
export function extractSessionToken(req) {
  if (!req) return "";
  const header = (req.headers && req.headers.authorization) || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match) return match[1].trim();
  return (req.cookies && req.cookies.session) || "";
}

export function signSession(email, secret, ttlMs = 1000 * 60 * 60 * 8) {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${email}|${expiresAt}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64");
}

export function verifySession(token, secret) {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [email, exp, sig] = decoded.split("|");
    if (!email || !exp || !sig) return null;
    const payload = `${email}|${exp}`;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
      return null;
    }
    if (Date.now() > Number(exp)) return null;
    return email;
  } catch {
    return null;
  }
}

export function canEditFields(user, item, payload) {
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

export function normalizeItemPayload(payload, userEmail) {
  const weeks = ensureArrayLength(payload.weeks, WEEK_COUNT);
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

export function calculateBudgetUsage(items, limits, monthKey, now = new Date()) {
  const usage = {};
  items.forEach((item) => {
    const weeks = ensureArrayLength(item.weeks, WEEK_COUNT);
    weeks.forEach((value, idx) => {
      const date = getWeekDate(idx, now);
      if (getMonthKey(date) !== monthKey) return;
      const key = item.article;
      usage[key] = (usage[key] || 0) + sanitizeNumber(value);
    });
  });
  return (limits || [])
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
}

export function shiftItemsForMonday(items, now = new Date()) {
  const archiveEntries = [];
  const shifted = items.map((item) => {
    const weeks = ensureArrayLength(item.weeks, WEEK_COUNT);
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
    return {
      ...item,
      weeks: weeks.slice(1).concat(0),
      updatedAt: now.toISOString()
    };
  });
  return { items: shifted, archiveEntries };
}

export function alreadyRanThisWeek(lastRunIso, now = new Date()) {
  if (!lastRunIso) return false;
  const last = new Date(lastRunIso);
  const weekNow = getISOWeek(now);
  const weekLast = getISOWeek(last);
  return weekNow === weekLast && now.getFullYear() === last.getFullYear();
}

export function isWithinMondayWindow(now = new Date()) {
  return now.getDay() === 1 && now.getHours() === 0;
}

export function buildExportRows(items) {
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
    ...ensureArrayLength(item.weeks, WEEK_COUNT),
    item.status,
    item.manager
  ]);

  return { headers, rows };
}

export function parseImportRows(buffer, store, XLSX) {
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
  const weekHeaders = Array.from({ length: WEEK_COUNT }, (_, i) => `Week_${i}`);
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
      const exists = counterpartyExists(store.counterparties, counterpartyName, counterpartyInn);
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

export function lanUrls(port) {
  const urls = [`http://127.0.0.1:${port}`];
  const seen = new Set(urls);
  for (const list of Object.values(os.networkInterfaces() || {})) {
    for (const n of list || []) {
      const v4 = n.family === "IPv4" || n.family === 4;
      if (!v4 || n.internal) continue;
      const url = `http://${n.address}:${port}`;
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
  }
  return urls;
}
