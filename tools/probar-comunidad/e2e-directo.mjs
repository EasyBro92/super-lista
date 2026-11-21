// Prueba en el navegador de las listas en directo: dos móviles con la misma lista, cada uno añade, marca y quita,
// y el otro lo ve al momento. Se entra por el enlace de WhatsApp y con un código. Necesita server.mjs con la base t5 (README).
import { chromium } from "playwright";
import fs from "node:fs";
const S = new URL(".", import.meta.url).pathname.replace(/\/$/, ""), BASE = "http://localhost:8790/", SHOTS = process.env.SHOTS ?? "/tmp/capturas-directo";
fs.mkdirSync(SHOTS, { recursive: true });
const SDK = fs.readFileSync(`${S}/fake-sdk.js`, "utf8");
const b = await chromium.launch();
const errs = [];
let ok = 0, bad = 0;
const check = (name, cond) => { if (cond) { ok++; console.log("✓", name); } else { bad++; console.log("✗", name); } };
const KEY = "superlista.v2";
const item = (id, label, emoji, cat) => ({ id, label, qty: "", count: 1, done: false, cat, emoji, added: Date.now() });
const ANA = { lists: [{ id: "l1", name: "Casa", store: "mercadona", items: [item("a", "Leche", "🥛", "Lácteos"), item("b", "Pan", "🥖", "Panadería"), item("c", "Tomates", "🍅", "Fruta y verdura")] }],
  current: "l1", history: [], freq: {}, memory: {}, shop: false, gestured: true };
const LUIS = { lists: [{ id: "m1", name: "Mía", store: "dia", items: [item("z", "Café", "☕", "Despensa")] }], current: "m1", history: [], freq: {}, memory: {}, shop: false, gestured: true };
async function ctx(name, state) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block", locale: "es-ES" });
  await c.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ body: SDK, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" } }));
  await c.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await c.route(/\/js\/config\.js$/, (r) => r.fulfill({ body: 'export const SUPABASE = { url: "", key: "" };', contentType: "text/javascript" }));
  await c.addInitScript(([k, s]) => {
    sessionStorage.setItem("superlista.intro", "1");
    localStorage.setItem("superlista.supabase", JSON.stringify({ url: "http://localhost:8790", key: "sb_publishable_prueba" }));
    if (s && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem("seeded", "1"); }
  }, [KEY, state ?? null]);
  const p = await c.newPage();
  p.on("pageerror", (e) => errs.push(`${name}: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts|Failed to load resource/.test(m.text())) errs.push(`${name}: ${m.text()}`); });
  await c.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  return p;
}
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png` });
const shown = (p) => p.$$eval("#list li.item", (ls) => ls.map((l) => (l.classList.contains("done") ? "✓" : "") + l.dataset.id));
const cur = (p) => p.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); return s.lists.find((l) => l.id === s.current); }, KEY);
const toList = (p) => p.evaluate(() => document.querySelector('.hcard[data-go="list"]').click());
// Espera hasta que se cumpla (como mucho ms) y devuelve cuánto ha tardado.
async function until(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return Date.now() - t0; await new Promise((r) => setTimeout(r, 25)); } return -1; }
const has = (p, label) => p.evaluate((l) => [...document.querySelectorAll("#list li.item")].some((x) => x.textContent.includes(l)), label);

// --- 1. Ana comparte en directo por WhatsApp (enlace) ---
const a = await ctx("ana", ANA);
await a.goto(BASE); await a.waitForTimeout(800); await toList(a); await a.waitForTimeout(400);
check("en la lista sale «Compartir»", await a.isVisible("#summary [data-share]"));
await shot(a, "01-lista-boton-compartir");
await a.click("#summary [data-share]"); await a.waitForTimeout(300);
check("la hoja trae marcado «Que también pueda cambiarla»", await a.isChecked("#envLive"));
await shot(a, "02-hoja-compartir");
await a.uncheck("#envLive");
check("sin la marca, el enlace de WhatsApp se esconde", !(await a.isVisible("#shareWa")));
await a.check("#envLive");
await a.click("#shareWa"); await a.waitForTimeout(900);
const ca = await cur(a);
check("la lista de Ana pasa a estar en directo", /^[0-9a-f-]{36}$/.test(ca.sid ?? ""));
const link = await a.evaluate(() => navigator.clipboard.readText());
check("el enlace es para unirse", link.includes(`#unirse=${ca.sid}`));
await shot(a, "03-ya-en-directo");
await a.keyboard.press("Escape"); await a.waitForTimeout(300);
check("«En directo» se pone verde con el punto encendido", await a.evaluate(() => document.querySelector("#summary [data-share]").classList.contains("live")));

const l = await ctx("luis", LUIS);
await l.goto(`${BASE}${link.slice(link.indexOf("#"))}`); await l.waitForTimeout(1200);
const cl = await cur(l);
check("Luis entra en la misma lista", cl.sid === ca.sid && cl.items.length === 3);
check("y su lista de siempre sigue ahí", (await l.evaluate((k) => JSON.parse(localStorage.getItem(k)).lists.map((x) => x.name), KEY)).join() === "Mía,Casa");
await l.waitForTimeout(500);

// --- 2. Cambios al momento en los dos sentidos ---
await a.fill("#q", "huevos"); await a.press("#q", "Enter");
let ms = await until(() => has(l, "Huevos"));
check(`lo que añade Ana le sale a Luis al momento (${ms} ms)`, ms >= 0 && ms < 1500);
await l.waitForTimeout(150);
check("en el móvil de Luis se ilumina lo nuevo", await l.evaluate(() => !!document.querySelector("#list li.item.fresh")));
await shot(l, "04-luis-ve-huevos");
const ln0 = (await cur(l)).items.length;
await l.fill("#q", "aceite"); await l.press("#q", "Enter");
ms = await until(() => has(a, "Aceite"));
check(`lo que añade Luis le sale a Ana al momento (${ms} ms)`, ms >= 0 && ms < 1500);
// Luis quita el pan (borrar desde la ficha del producto)
const pan = l.locator('#list li.item[data-id="b"]');
const box = await pan.boundingBox();
await l.mouse.move(box.x + box.width - 20, box.y + box.height / 2); await l.mouse.down();
await l.mouse.move(box.x + 30, box.y + box.height / 2, { steps: 8 }); await l.mouse.up(); await l.waitForTimeout(100);
ms = await until(async () => !(await has(a, "Pan")));
check(`lo que quita Luis desaparece en el de Ana (${ms} ms)`, ms >= 0 && ms < 2500);
// Ana marca la leche como comprada
await a.click('#list li.item[data-id="a"] .check').catch(async () => { await a.evaluate(() => document.querySelector('#list li.item[data-id="a"] [data-act="done"], #list li.item[data-id="a"] button')?.click()); });
ms = await until(async () => (await cur(l)).items.find((i) => i.id === "a")?.done === true);
check(`lo que marca Ana como comprado se marca en el de Luis (${ms} ms)`, ms >= 0 && ms < 2500);
await a.waitForTimeout(400);
await shot(a, "05-ana-ve-aceite");
await shot(l, "06-luis-lista");

// --- 3. Los dos a la vez: no se pierde nada ---
await Promise.all([
  a.evaluate(() => { const q = document.querySelector("#q"); q.value = "plátanos"; q.dispatchEvent(new Event("input")); q.form?.requestSubmit?.() ?? q.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })); }),
  l.evaluate(() => { const q = document.querySelector("#q"); q.value = "yogures"; q.dispatchEvent(new Event("input")); q.form?.requestSubmit?.() ?? q.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })); }),
]);
ms = await until(async () => (await has(a, "Yogur")) && (await has(l, "Plátano")), 5000);
check(`si los dos añaden a la vez, los dos ven las dos cosas (${ms} ms)`, ms >= 0);
await a.waitForTimeout(800);
const fa = (await cur(a)).items.map((i) => i.label).sort().join(), fl = (await cur(l)).items.map((i) => i.label).sort().join();
check("y las dos listas quedan iguales", fa === fl);
console.log("   ", fa);

// --- 4. Con un código: Ana invita a Marta y Marta se une en directo ---
await a.click("#summary [data-share]"); await a.waitForTimeout(300);
check("en una lista en directo la hoja lo dice", (await a.textContent("#sheetBody")).includes("Lista en directo"));
await a.click("#envMake"); await a.waitForTimeout(900);
const code = (await a.textContent(".env-code")).replace(/\s/g, "");
check("sale el código", /^[A-Z0-9]{6}$/.test(code));
await a.keyboard.press("Escape");
const m = await ctx("marta", { ...LUIS, lists: [{ id: "q1", name: "Lo mío", store: "lidl", items: [] }], current: "q1" });
await m.goto(BASE); await m.waitForTimeout(800); await toList(m); await m.waitForTimeout(300);
await m.click("#listBtn"); await m.waitForTimeout(300); await m.click("#shareOpen"); await m.waitForTimeout(300); // su lista está vacía: desde «Tus listas»
await m.fill("#envCode", code); await m.click("#envGet button"); await m.waitForTimeout(700);
check("a Marta le pregunta si quiere unirse", (await m.textContent("#sheetBody")).includes("lista en directo"));
await shot(m, "07-marta-invitacion");
await m.click("#envYes"); await m.waitForTimeout(900);
const cm = await cur(m);
check("Marta está en la misma lista", cm.sid === ca.sid && cm.items.length === (await cur(a)).items.length);
await m.fill("#q", "arroz"); await m.press("#q", "Enter");
ms = await until(async () => (await has(a, "Arroz")) && (await has(l, "Arroz")));
check(`lo de Marta les sale a Ana y a Luis (${ms} ms)`, ms >= 0 && ms < 2000);
await m.waitForTimeout(300);
await shot(m, "08-marta-en-la-lista");

// --- 5. Una copia sin directo sigue funcionando ---
await a.click("#summary [data-share]"); await a.waitForTimeout(300);
check("en una lista en directo no hay marca para copia (es la misma lista)", !(await a.locator("#envLive").count()));
await a.keyboard.press("Escape");

const log = await (await fetch(`${BASE}fake/bclog`)).json();
check("los avisos llevan la lista dentro (no hace falta volver a leerla)", log.length > 0 && log.every((x) => x.hasData));
console.log(errs.length ? `\nErrores en la página:\n${errs.join("\n")}` : "\nSin errores en la página.");
console.log(`${ok} bien, ${bad} mal · capturas en ${SHOTS}`);
await b.close();
process.exit(bad || errs.length ? 1 : 0);
