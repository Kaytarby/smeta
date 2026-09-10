import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { Store, migrateJsonStore } from "../lib/db.js";
import {
  alreadyRanThisWeek,
  calculateBudgetUsage,
  canEditFields,
  counterpartyExists,
  ensureArrayLength,
  extractSessionToken,
  getMonthKey,
  isSecureRequest,
  normalizeInn,
  sessionCookieOptions,
  shiftItemsForMonday,
  signSession,
  verifySession
} from "../lib/logic.js";

test("ИНН нормализуется до цифр", () => {
  assert.equal(normalizeInn("77 01-000000"), "7701000000");
});

test("недели дополняются до 10", () => {
  assert.deepEqual(ensureArrayLength([1, 2], 10).length, 10);
});

test("понедельник сдвигает недели и архивирует week0", () => {
  const now = new Date("2026-02-09T00:00:00");
  const { items, archiveEntries } = shiftItemsForMonday(
    [
      {
        id: "1",
        article: "Семена",
        paymentType: "Аванс",
        counterpartyName: "АВС",
        counterpartyInn: "1111111100",
        manager: "a@b.c",
        weeks: [100, 200, 300, 0, 0, 0, 0, 0, 0, 0]
      }
    ],
    now
  );
  assert.equal(items[0].weeks[0], 200);
  assert.equal(items[0].weeks[9], 0);
  assert.equal(archiveEntries.length, 1);
  assert.equal(archiveEntries[0].amount, 100);
});

test("лимиты считаются по месяцу текущих недель", () => {
  const now = new Date("2026-02-15T12:00:00");
  const month = getMonthKey(now);
  const usage = calculateBudgetUsage(
    [{ article: "Семена", weeks: [1000, 0, 0, 0, 0, 0, 0, 0, 0, 0] }],
    [{ article: "Семена", month, amount: 5000 }],
    month,
    now
  );
  assert.equal(usage.length, 1);
  assert.equal(usage[0].used, 1000);
  assert.equal(usage[0].remaining, 4000);
});

test("менеджер не меняет чужие строки и статус", () => {
  const user = { role: "manager", email: "m@x.y" };
  const item = { manager: "m@x.y", status: "Утверждено" };
  assert.equal(canEditFields(user, item, { weeks: [1] }).allowed, false);
  assert.equal(canEditFields(user, { ...item, status: "Черновик" }, { weeks: [1] }).allowed, true);
  assert.equal(canEditFields(user, item, { status: "Черновик" }).allowed, false);
});

test("контрагент с пустым ИНН считается найденным по имени", () => {
  assert.equal(counterpartyExists([{ name: "Ромашка", inn: "" }], "ромашка", "1234567890"), true);
  assert.equal(counterpartyExists([{ name: "Ромашка", inn: "1" }], "Ромашка", "2"), false);
});

test("сессия подписывается и проверяется", () => {
  const token = signSession("a@b.c", "secret", 10000);
  assert.equal(verifySession(token, "secret"), "a@b.c");
  assert.equal(verifySession(token, "other"), null);
});

test("alreadyRanThisWeek смотрит ISO-неделю", () => {
  const now = new Date("2026-02-10T12:00:00");
  assert.equal(alreadyRanThisWeek("2026-02-09T01:00:00", now), true);
  assert.equal(alreadyRanThisWeek("2026-02-01T01:00:00", now), false);
});

test("миграция JSON в SQLite и чтение строки", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smeta-"));
  const dbPath = path.join(dir, "t.sqlite");
  const store = new Store(dbPath);
  const result = migrateJsonStore(store, {
    users: [
      {
        id: "user_1",
        email: "admin@example.com",
        salt: "abc",
        hash: "def",
        role: "admin",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    articles: ["Семена"],
    paymentTypes: ["Аванс"],
    counterparties: [{ name: "АВС", inn: "1111111100" }],
    items: [
      {
        id: "item_1",
        article: "Семена",
        paymentType: "Аванс",
        counterpartyName: "АВС",
        counterpartyInn: "1111111100",
        kz: 0,
        kzCrit: 0,
        weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        status: "Черновик",
        manager: "admin@example.com",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    archive: [],
    limits: [{ article: "Семена", month: "2026-02", amount: 100 }],
    meta: { lastMondayRun: "2026-02-08T00:00:00.000Z" }
  });
  assert.equal(result.migrated, true);
  const item = store.getItem("item_1");
  assert.equal(item.article, "Семена");
  assert.deepEqual(item.weeks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(store.getUserByEmail("admin@example.com").role, "admin");
  const again = migrateJsonStore(store, { users: [], items: [] });
  assert.equal(again.migrated, false);
  store.close();
});

test("в локальной сети cookie сессии — SameSite=Lax без Secure", () => {
  const options = sessionCookieOptions({ headers: {}, secure: false });
  assert.equal(options.sameSite, "lax");
  assert.equal(options.secure, undefined);
  assert.equal(options.httpOnly, true);
});

test("за HTTPS-прокси cookie сессии — SameSite=None и Secure (иначе вход не проходит во фрейме)", () => {
  const options = sessionCookieOptions({ headers: { "x-forwarded-proto": "https" }, secure: false });
  assert.equal(options.sameSite, "none");
  assert.equal(options.secure, true);
});

test("x-forwarded-proto распознаётся даже со списком протоколов", () => {
  assert.equal(isSecureRequest({ headers: { "x-forwarded-proto": "https, http" }, secure: false }), true);
  assert.equal(isSecureRequest({ headers: { "x-forwarded-proto": "http" }, secure: false }), false);
  assert.equal(isSecureRequest({ headers: {}, secure: true }), true);
});

test("токен сессии берётся из cookie или из заголовка Bearer", () => {
  assert.equal(extractSessionToken({ headers: {}, cookies: { session: "abc" } }), "abc");
  assert.equal(extractSessionToken({ headers: { authorization: "Bearer xyz" }, cookies: {} }), "xyz");
  assert.equal(extractSessionToken({ headers: { authorization: "bearer  xyz " }, cookies: {} }), "xyz");
  assert.equal(extractSessionToken({ headers: { authorization: "Basic xyz" }, cookies: { session: "abc" } }), "abc");
  assert.equal(extractSessionToken({ headers: {}, cookies: {} }), "");
  assert.equal(extractSessionToken(null), "");
});

test("токен из заголовка работает так же, как из cookie", () => {
  const secret = "test-secret";
  const token = signSession("manager@example.com", secret);
  const fromBearer = extractSessionToken({ headers: { authorization: `Bearer ${token}` }, cookies: {} });
  const fromCookie = extractSessionToken({ headers: {}, cookies: { session: token } });
  assert.equal(verifySession(fromBearer, secret), "manager@example.com");
  assert.equal(verifySession(fromCookie, secret), "manager@example.com");
});
