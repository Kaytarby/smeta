/**
 * Смоук-тест интерфейса в jsdom: проверяет вход, отрисовку таблицы и сводки
 * в двух режимах — обычный браузер (cookie) и браузер, где cookie заблокированы
 * (именно так ведёт себя превью: приложение открыто во встроенном фрейме
 * на другом сайте, где SameSite-cookie не отправляются). Во втором режиме
 * вход должен работать по токену из /api/login.
 *
 * Запуск (нужен работающий сервер на порту 3000):
 *   npm install --no-save jsdom     # интернет нужен только для установки jsdom
 *   npm run test:ui
 *
 * В обычный `npm test` не входит: на ноутбуке-хосте интернета может не быть.
 */
import fs from "fs";
import { JSDOM, VirtualConsole } from "jsdom";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const html = await (await fetch(BASE + "/")).text();
const source = fs.readFileSync("public/app.js", "utf8");
const problems = [];
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "\u2713" : "\u2717"} ${label}${extra ? " \u2014 " + extra : ""}`);
  if (!ok) problems.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Прогон сценария входа. cookies: true — как обычный браузер; false — как сторонний фрейм, где cookie заблокированы. */
async function run({ label, cookies }) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => problems.push(`${label}: jsdomError ${e.message}`));
  vc.on("error", (...a) => problems.push(`${label}: console.error ${a.join(" ")}`));
  const dom = new JSDOM(html, { url: BASE + "/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom;
  const doc = window.document;
  window.Element.prototype.scrollIntoView = () => {};
  window.confirm = () => true;
  let cookie = "";
  window.fetch = async (input, init = {}) => {
    const url = String(input).startsWith("http") ? String(input) : BASE + String(input);
    const headers = { ...(init.headers || {}) };
    if (cookies && cookie) headers.cookie = cookie;
    const res = await fetch(url, { ...init, headers });
    if (cookies) {
      const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
    }
    return res;
  };
  window.eval(source);

  doc.getElementById("loginEmail").value = "admin@example.com";
  doc.getElementById("loginPassword").value = "admin";
  doc.getElementById("loginForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

  const waitFor = async (fn, what, timeout = 6000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (fn()) return true;
      await sleep(70);
    }
    problems.push(`${label}: таймаут ${what}`);
    return false;
  };

  const entered = await waitFor(() => !doc.getElementById("app").classList.contains("hidden"), "вход выполнен");
  check(`${label}: вход выполнен`, entered,
    doc.getElementById("loginError").textContent.trim() || "без ошибок");
  if (entered) {
    await waitFor(() => doc.querySelectorAll("#table tbody tr").length > 0, "таблица отрисована");
    check(`${label}: таблица строк отрисована`, doc.querySelectorAll("#table tbody tr").length > 0, `${doc.querySelectorAll("#table tbody tr:not(.group)").length} строк`);
    check(`${label}: KPI посчитаны`, /₽/.test(doc.getElementById("kpiTotalValue").textContent), doc.getElementById("kpiTotalValue").textContent.trim());
    check(`${label}: пользователь в топбаре`, doc.getElementById("userEmail").textContent === "admin@example.com");
    if (!cookies) {
      check(`${label}: токен сохранён в хранилище`, Boolean(window.localStorage.getItem("operplan.token")));
    }
    // выход и повторный вход
    doc.getElementById("logoutBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await waitFor(() => !doc.getElementById("login").classList.contains("hidden"), "показан экран входа после выхода");
    check(`${label}: выход возвращает на экран входа`, !doc.getElementById("login").classList.contains("hidden"));
    if (!cookies) check(`${label}: токен очищен при выходе`, !window.localStorage.getItem("operplan.token"));
  }
  dom.window.close();
}

await run({ label: "обычный браузер (cookie)", cookies: true });
await run({ label: "cookie заблокированы (превью)", cookies: false });

console.log("\nПроблемы:", problems.length ? problems.join(" | ") : "нет");
process.exit(problems.length ? 1 : 0);
