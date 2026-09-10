import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import {
  createId,
  ensureArrayLength,
  ensureCounterpartyShape,
  hashPassword,
  normalizeInn,
  normalizeCounterpartyName,
  WEEK_COUNT
} from "./logic.js";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS payment_types (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS counterparties (
  name TEXT NOT NULL,
  inn TEXT NOT NULL,
  PRIMARY KEY (name, inn)
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  article TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  counterparty_name TEXT NOT NULL DEFAULT '',
  counterparty_inn TEXT NOT NULL DEFAULT '',
  kz INTEGER NOT NULL DEFAULT 0,
  kz_crit INTEGER NOT NULL DEFAULT 0,
  weeks TEXT NOT NULL,
  status TEXT NOT NULL,
  manager TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archive (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  archived_at TEXT NOT NULL,
  article TEXT,
  payment_type TEXT,
  counterparty_name TEXT,
  counterparty_inn TEXT,
  manager TEXT,
  amount INTEGER
);

CREATE TABLE IF NOT EXISTS limits (
  article TEXT NOT NULL,
  month TEXT NOT NULL,
  amount INTEGER NOT NULL,
  PRIMARY KEY (article, month)
);

CREATE TABLE IF NOT EXISTS import_errors (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  user_email TEXT,
  file_name TEXT,
  invalid_count INTEGER,
  total_rows INTEGER,
  rows_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_manager ON items(manager);
CREATE INDEX IF NOT EXISTS idx_items_article ON items(article);
`;

function parseWeeks(raw) {
  try {
    const parsed = JSON.parse(raw);
    return ensureArrayLength(parsed, WEEK_COUNT);
  } catch {
    return ensureArrayLength([], WEEK_COUNT);
  }
}

function rowToItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    article: row.article,
    paymentType: row.payment_type,
    counterpartyName: row.counterparty_name,
    counterpartyInn: row.counterparty_inn,
    kz: row.kz,
    kzCrit: row.kz_crit,
    weeks: parseWeeks(row.weeks),
    status: row.status,
    manager: row.manager,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    salt: row.salt,
    hash: row.hash,
    role: row.role,
    createdAt: row.created_at
  };
}

export class Store {
  constructor(dbPath) {
    this.dbPath = dbPath;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(SCHEMA);
    this.#prepare();
  }

  #prepare() {
    this.stmts = {
      metaGet: this.db.prepare("SELECT value FROM meta WHERE key = ?"),
      metaSet: this.db.prepare(
        "INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ),
      userByEmail: this.db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)"),
      users: this.db.prepare("SELECT * FROM users ORDER BY email"),
      insertUser: this.db.prepare(
        "INSERT INTO users(id, email, salt, hash, role, created_at) VALUES(?, ?, ?, ?, ?, ?)"
      ),
      deleteUser: this.db.prepare("DELETE FROM users WHERE email = ?"),
      articles: this.db.prepare("SELECT name FROM articles ORDER BY name"),
      insertArticle: this.db.prepare("INSERT OR IGNORE INTO articles(name) VALUES(?)"),
      deleteArticle: this.db.prepare("DELETE FROM articles WHERE name = ?"),
      paymentTypes: this.db.prepare("SELECT name FROM payment_types ORDER BY name"),
      insertPaymentType: this.db.prepare("INSERT OR IGNORE INTO payment_types(name) VALUES(?)"),
      counterparties: this.db.prepare("SELECT name, inn FROM counterparties ORDER BY name, inn"),
      insertCounterparty: this.db.prepare("INSERT OR IGNORE INTO counterparties(name, inn) VALUES(?, ?)"),
      updateCounterpartyInn: this.db.prepare(
        "UPDATE counterparties SET inn = ? WHERE lower(name) = lower(?) AND inn = ''"
      ),
      deleteCounterparty: this.db.prepare("DELETE FROM counterparties WHERE name = ? AND inn = ?"),
      itemsAll: this.db.prepare("SELECT * FROM items ORDER BY article, payment_type, counterparty_name"),
      itemsByManager: this.db.prepare(
        "SELECT * FROM items WHERE manager = ? ORDER BY article, payment_type, counterparty_name"
      ),
      itemById: this.db.prepare("SELECT * FROM items WHERE id = ?"),
      insertItem: this.db.prepare(
        `INSERT INTO items(id, article, payment_type, counterparty_name, counterparty_inn, kz, kz_crit, weeks, status, manager, created_at, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      updateItem: this.db.prepare(
        `UPDATE items SET article=?, payment_type=?, counterparty_name=?, counterparty_inn=?, kz=?, kz_crit=?, weeks=?, status=?, manager=?, updated_at=?
         WHERE id=?`
      ),
      deleteItem: this.db.prepare("DELETE FROM items WHERE id = ?"),
      archive: this.db.prepare("SELECT * FROM archive ORDER BY archived_at, id"),
      insertArchive: this.db.prepare(
        `INSERT INTO archive(archived_at, article, payment_type, counterparty_name, counterparty_inn, manager, amount)
         VALUES(?, ?, ?, ?, ?, ?, ?)`
      ),
      limits: this.db.prepare("SELECT article, month, amount FROM limits ORDER BY month, article"),
      upsertLimit: this.db.prepare(
        `INSERT INTO limits(article, month, amount) VALUES(?, ?, ?)
         ON CONFLICT(article, month) DO UPDATE SET amount = excluded.amount`
      ),
      deleteLimit: this.db.prepare("DELETE FROM limits WHERE article = ? AND month = ?"),
      importErrors: this.db.prepare("SELECT * FROM import_errors ORDER BY created_at DESC"),
      importErrorsUser: this.db.prepare(
        "SELECT * FROM import_errors WHERE user_email = ? ORDER BY created_at DESC"
      ),
      insertImportError: this.db.prepare(
        `INSERT INTO import_errors(id, created_at, user_email, file_name, invalid_count, total_rows, rows_json)
         VALUES(?, ?, ?, ?, ?, ?, ?)`
      ),
      deleteImportError: this.db.prepare("DELETE FROM import_errors WHERE id = ?"),
      clearImportErrors: this.db.prepare("DELETE FROM import_errors"),
      clearImportErrorsUser: this.db.prepare("DELETE FROM import_errors WHERE user_email = ?")
    };
  }

  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // ignore
      }
      throw err;
    }
  }

  getMeta(key) {
    const row = this.stmts.metaGet.get(key);
    return row ? row.value : null;
  }

  setMeta(key, value) {
    this.stmts.metaSet.run(key, value == null ? "" : String(value));
  }

  getUserByEmail(email) {
    return rowToUser(this.stmts.userByEmail.get(email));
  }

  listUsers() {
    return this.stmts.users.all().map(rowToUser);
  }

  createUser({ id, email, salt, hash, role, createdAt }) {
    this.stmts.insertUser.run(id, email, salt, hash, role, createdAt);
  }

  deleteUser(email) {
    this.stmts.deleteUser.run(email);
  }

  listArticles() {
    return this.stmts.articles.all().map((row) => row.name);
  }

  addArticle(name) {
    this.stmts.insertArticle.run(name);
  }

  deleteArticle(name) {
    this.stmts.deleteArticle.run(name);
  }

  listPaymentTypes() {
    return this.stmts.paymentTypes.all().map((row) => row.name);
  }

  addPaymentType(name) {
    this.stmts.insertPaymentType.run(name);
  }

  listCounterparties() {
    return this.stmts.counterparties.all().map((row) => ({ name: row.name, inn: row.inn }));
  }

  addCounterparty(name, inn) {
    this.stmts.insertCounterparty.run(name, inn);
  }

  fillEmptyCounterpartyInn(name, inn) {
    this.stmts.updateCounterpartyInn.run(inn, name);
  }

  deleteCounterparty(name, inn) {
    this.stmts.deleteCounterparty.run(name, inn);
  }

  listItems(managerEmail) {
    const rows = managerEmail ? this.stmts.itemsByManager.all(managerEmail) : this.stmts.itemsAll.all();
    return rows.map(rowToItem);
  }

  getItem(id) {
    return rowToItem(this.stmts.itemById.get(id));
  }

  insertItem(item) {
    this.stmts.insertItem.run(
      item.id,
      item.article,
      item.paymentType,
      item.counterpartyName || "",
      item.counterpartyInn || "",
      item.kz || 0,
      item.kzCrit || 0,
      JSON.stringify(ensureArrayLength(item.weeks, WEEK_COUNT)),
      item.status,
      item.manager,
      item.createdAt,
      item.updatedAt
    );
  }

  updateItem(item) {
    this.stmts.updateItem.run(
      item.article,
      item.paymentType,
      item.counterpartyName || "",
      item.counterpartyInn || "",
      item.kz || 0,
      item.kzCrit || 0,
      JSON.stringify(ensureArrayLength(item.weeks, WEEK_COUNT)),
      item.status,
      item.manager,
      item.updatedAt,
      item.id
    );
  }

  deleteItems(ids) {
    const deleted = [];
    ids.forEach((id) => {
      const existing = this.getItem(id);
      if (existing) {
        this.stmts.deleteItem.run(id);
        deleted.push(id);
      }
    });
    return deleted;
  }

  listArchive() {
    return this.stmts.archive.all().map((row) => ({
      archivedAt: row.archived_at,
      article: row.article,
      paymentType: row.payment_type,
      counterpartyName: row.counterparty_name,
      counterpartyInn: row.counterparty_inn,
      manager: row.manager,
      amount: row.amount
    }));
  }

  insertArchiveEntries(entries) {
    entries.forEach((entry) => {
      this.stmts.insertArchive.run(
        entry.archivedAt,
        entry.article,
        entry.paymentType,
        entry.counterpartyName || "",
        entry.counterpartyInn || "",
        entry.manager,
        entry.amount || 0
      );
    });
  }

  listLimits() {
    return this.stmts.limits.all().map((row) => ({
      article: row.article,
      month: row.month,
      amount: row.amount
    }));
  }

  upsertLimit(article, month, amount) {
    this.stmts.upsertLimit.run(article, month, amount);
  }

  deleteLimit(article, month) {
    this.stmts.deleteLimit.run(article, month);
  }

  listImportErrors(userEmail, isAdmin) {
    const rows = isAdmin ? this.stmts.importErrors.all() : this.stmts.importErrorsUser.all(userEmail);
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      userEmail: row.user_email,
      fileName: row.file_name,
      invalidCount: row.invalid_count,
      totalRows: row.total_rows,
      rows: JSON.parse(row.rows_json || "[]")
    }));
  }

  addImportError(entry) {
    this.stmts.insertImportError.run(
      entry.id,
      entry.createdAt,
      entry.userEmail,
      entry.fileName,
      entry.invalidCount,
      entry.totalRows,
      JSON.stringify(entry.rows || [])
    );
    const all = this.stmts.importErrors.all();
    if (all.length > 200) {
      all.slice(200).forEach((row) => this.stmts.deleteImportError.run(row.id));
    }
  }

  clearImportErrors({ id, all, userEmail, isAdmin }) {
    if (all) {
      if (isAdmin) this.stmts.clearImportErrors.run();
      else this.stmts.clearImportErrorsUser.run(userEmail);
    } else if (id) {
      this.stmts.deleteImportError.run(id);
    }
  }

  reference() {
    return {
      articles: this.listArticles(),
      counterparties: this.listCounterparties(),
      paymentTypes: this.listPaymentTypes()
    };
  }

  userCount() {
    return this.listUsers().length;
  }

  itemCount() {
    return this.db.prepare("SELECT COUNT(*) AS c FROM items").get().c;
  }

  checkpoint() {
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  }

  close() {
    this.db.close();
  }
}

export function migrateJsonStore(store, json) {
  if (!json || typeof json !== "object") return { migrated: false };

  const already = store.getMeta("migratedFromJson");
  if (already === "1" || store.itemCount() > 0 || store.userCount() > 0) {
    return { migrated: false };
  }

  store.transaction(() => {
    (json.articles || []).forEach((name) => store.addArticle(String(name)));
    (json.paymentTypes || []).forEach((name) => store.addPaymentType(String(name)));
    (json.counterparties || []).map(ensureCounterpartyShape).forEach((cp) => {
      if (cp.name) store.addCounterparty(cp.name, cp.inn || "");
    });
    (json.users || []).forEach((user) => {
      store.createUser({
        id: user.id || createId("user"),
        email: user.email,
        salt: user.salt,
        hash: user.hash,
        role: user.role,
        createdAt: user.createdAt || new Date().toISOString()
      });
    });
    (json.items || []).forEach((item) => {
      const name = normalizeCounterpartyName(item.counterpartyName || item.counterparty || "");
      const inn = normalizeInn(item.counterpartyInn || "");
      store.insertItem({
        id: item.id || createId(),
        article: item.article,
        paymentType: item.paymentType,
        counterpartyName: name,
        counterpartyInn: inn,
        kz: item.kz || 0,
        kzCrit: item.kzCrit || 0,
        weeks: item.weeks,
        status: item.status || "Черновик",
        manager: item.manager || "",
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString()
      });
    });
    (json.archive || []).forEach((entry) => {
      store.insertArchiveEntries([
        {
          archivedAt: entry.archivedAt || new Date().toISOString(),
          article: entry.article,
          paymentType: entry.paymentType,
          counterpartyName: normalizeCounterpartyName(entry.counterpartyName || entry.counterparty || ""),
          counterpartyInn: normalizeInn(entry.counterpartyInn || ""),
          manager: entry.manager,
          amount: entry.amount || 0
        }
      ]);
    });
    (json.limits || []).forEach((limit) => {
      store.upsertLimit(limit.article, limit.month, limit.amount || 0);
    });
    (json.importErrors || []).forEach((entry) => {
      store.addImportError({
        id: entry.id || createId("import"),
        createdAt: entry.createdAt || new Date().toISOString(),
        userEmail: entry.userEmail,
        fileName: entry.fileName,
        invalidCount: entry.invalidCount || 0,
        totalRows: entry.totalRows || 0,
        rows: entry.rows || []
      });
    });
    if (json.meta?.lastMondayRun) store.setMeta("lastMondayRun", json.meta.lastMondayRun);
    store.setMeta("schemaVersion", "2");
    store.setMeta("migratedFromJson", "1");
  });

  return { migrated: true };
}

export function ensureDefaultAdmin(store, email, password) {
  if (store.userCount() > 0) return false;
  const { salt, hash } = hashPassword(password);
  store.createUser({
    id: createId("user"),
    email,
    salt,
    hash,
    role: "admin",
    createdAt: new Date().toISOString()
  });
  return true;
}

export function rotateBackups(dbPath, backupDir, keep = 14) {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(backupDir, `оперплан_${stamp}.sqlite`);
  fs.copyFileSync(dbPath, dest);
  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith(".sqlite"))
    .map((name) => ({ name, full: path.join(backupDir, name), mtime: fs.statSync(path.join(backupDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  files.slice(keep).forEach((file) => {
    try {
      fs.unlinkSync(file.full);
    } catch {
      // ignore
    }
  });
  return dest;
}
