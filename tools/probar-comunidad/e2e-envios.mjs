// Prueba en el navegador de los envíos: pasar todo a otro móvil con un código o enlace, una lista con código,
// y una lista a una persona con cuenta (buzón). Necesita server.mjs con una base que tenga envios.sql (README).
import { chromium } from "playwright";
import fs from "node:fs";
const S = new URL(".", import.meta.url).pathname.replace(/\/$/, ""), BASE = "http://localhost:8790/", SHOTS = process.env.SHOTS ?? "/tmp/capturas-envios";
fs.mkdirSync(SHOTS, { recursive: true });
const SDK = fs.readFileSync(`${S}/fake-sdk.js`, "utf8");
const b = await chromium.launch();
const errs = [];
let ok = 0, bad = 0;
const check = (name, cond) => { if (cond) { ok++; console.log("✓", name); } else { bad++; console.log("✗", name); } };
const KEY = "superlista.v2";
const STATE = { lists: [{ id: "l1", name: "Casa", store: "mercadona", items: [
  { id: "a", label: "Leche", qty: "", count: 2, done: false, cat: "Lácteos", emoji: "🥛" },
  { id: "b", label: "Pan", qty: "", count: 1, done: false, cat: "Panadería", emoji: "🥖" },
  { id: "c", label: "Tomates", qty: "1 kg", count: 1, done: false, cat: "Fruta y verdura", emoji: "🍅" }] },
  { id: "l2", name: "Cumpleaños", store: "lidl", items: [{ id: "d", label: "Velas", qty: "", count: 1, done: false, cat: "Otros", emoji: "🕯️" }] }],
  current: "l1", history: [{ date: Date.now() - 864e5, list: "Casa", store: "mercadona", total: 23.4, items: [{ label: "Leche", qty: "", count: 2, price: 1.8 }] }], freq: {}, memory: {}, shop: false };
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
  return p;
}
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png` });
const lists = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null")?.lists?.map((l) => `${l.name}:${l.items.length}`) ?? [], KEY);
const openBackupSheet = async (p) => { await p.click('.hcard[data-go="history"]'); await p.waitForTimeout(400); await p.click("#hBackup"); await p.waitForTimeout(300); };

// --- 1. Todo a otro móvil con un código ---
const a = await ctx("movil-a", STATE);
await a.goto(BASE); await a.waitForTimeout(800);
await openBackupSheet(a);
check("la hoja de copia ofrece el código y el archivo", (await a.locator("#envMake").count()) === 1 && (await a.locator("#bkSave").count()) === 1);
await shot(a, "01-pasar-datos");
await a.click("#envMake"); await a.waitForTimeout(900);
const code = (await a.textContent(".env-code")).replace(/\s/g, "");
check("sale un código de 6 letras", /^[A-Z0-9]{6}$/.test(code));
check("sale el QR", (await a.locator("#envQr svg").count()) === 1);
await a.evaluate(() => document.querySelector("#envQr").scrollIntoView({ block: "center" }));
await shot(a, "02-codigo-y-qr");

const bp = await ctx("movil-b");
await bp.goto(BASE); await bp.waitForTimeout(800);
await openBackupSheet(bp);
await bp.fill("#envCode", `${code.slice(0, 3).toLowerCase()} ${code.slice(3)}`);
await bp.click("#envGet button"); await bp.waitForTimeout(700);
check("pregunta antes de sustituir", (await bp.textContent("#sheetBody")).includes("2 listas"));
await shot(bp, "03-recoger-codigo");
await Promise.all([bp.waitForEvent("load"), bp.click("#envYes")]); await bp.waitForTimeout(800);
check("el otro móvil tiene las mismas listas", JSON.stringify(await lists(bp)) === JSON.stringify(["Casa:3", "Cumpleaños:1"]));

// --- 2. Con el enlace (lo que se manda por WhatsApp) ---
const c2 = await ctx("movil-c");
await c2.goto(`${BASE}#recoger=${code}`); await c2.waitForTimeout(1000);
check("el enlace abre directamente la pregunta", await c2.locator("#envYes").isVisible());
await Promise.all([c2.waitForEvent("load"), c2.click("#envYes")]); await c2.waitForTimeout(800);
check("con el enlace también llegan", (await lists(c2)).length === 2);
check("el enlace se quita de la barra", !c2.url().includes("recoger"));

// --- 3. Una lista suelta con código ---
await a.keyboard.press("Escape"); await a.waitForTimeout(300);
await a.evaluate(() => document.querySelector('.hcard[data-go="list"]').click()); await a.waitForTimeout(400);
await a.click("#listBtn"); await a.waitForTimeout(300);
await a.click("#sendCopy"); await a.waitForTimeout(300);
await shot(a, "04-enviar-lista");
await a.click("#envMake"); await a.waitForTimeout(800);
const lcode = (await a.textContent(".env-code")).replace(/\s/g, "");
const d2 = await ctx("movil-d", { ...STATE, lists: [{ id: "x", name: "Mía", store: "dia", items: [] }], current: "x" });
await d2.goto(BASE); await d2.waitForTimeout(800);
await d2.evaluate(() => document.querySelector('.hcard[data-go="list"]').click()); await d2.waitForTimeout(400);
await d2.click("#listBtn"); await d2.waitForTimeout(300); await d2.click("#sendCopy"); await d2.waitForTimeout(300);
await d2.fill("#envCode", lcode); await d2.click("#envGet button"); await d2.waitForTimeout(700);
await shot(d2, "05-anadir-lista");
await d2.click("#envYes"); await d2.waitForTimeout(500);
check("la lista se añade sin tocar las suyas", JSON.stringify(await lists(d2)) === JSON.stringify(["Mía:0", "Casa:3"]));
check("código mal escrito avisa", await (async () => {
  await d2.click("#listBtn"); await d2.waitForTimeout(300); await d2.click("#sendCopy"); await d2.waitForTimeout(300);
  await d2.fill("#envCode", "ZZZ999"); await d2.click("#envGet button"); await d2.waitForTimeout(600);
  return (await d2.textContent("#envGetMsg")).includes("No encuentro");
})());

// --- 4. A una persona con cuenta ---
async function signUp(p, nombre, email) {
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await p.evaluate(() => { history.replaceState(null, "", "/"); }); await p.goto(BASE); await p.waitForTimeout(700);
  await p.click("#homeMe"); await p.waitForTimeout(400);
  await p.click('#amode [data-m="crear"]');
  await p.fill("#aname", nombre); await p.fill("#amail", email); await p.fill("#apass", "secreto123");
  await p.click("#ago"); await p.waitForTimeout(900);
}
await signUp(a, "Ana", `ana.${Date.now()}@envios.es`);
await signUp(d2, "Luis", `luis.${Date.now()}@envios.es`);
await a.keyboard.press("Escape");
await a.evaluate(() => document.querySelector('.hcard[data-go="list"]').click()); await a.waitForTimeout(400);
await a.click("#listBtn"); await a.waitForTimeout(300); await a.click("#sendCopy"); await a.waitForTimeout(300);
await a.fill("#envName", "Nadie"); await a.click("#envTo button"); await a.waitForTimeout(600);
check("nombre que no existe avisa", (await a.textContent("#envToMsg")).includes("No hay nadie"));
await a.fill("#envName", "luis"); await a.click("#envTo button"); await a.waitForTimeout(700);
check("enviado a Luis", (await a.textContent("#envToMsg")).includes("Enviado a Luis"));
await shot(a, "06-enviar-a-persona");
await d2.keyboard.press("Escape"); await d2.goto(BASE); await d2.waitForTimeout(1200);
check("a Luis le sale el aviso en el inicio", (await d2.isVisible("#homeBox")) && (await d2.textContent("#homeBox")).includes("Ana"));
await shot(d2, "07-aviso-inicio");
await d2.click("#homeBox"); await d2.waitForTimeout(400);
await shot(d2, "08-buzon");
await d2.click("[data-open]"); await d2.waitForTimeout(600);
await d2.click("#envYes"); await d2.waitForTimeout(800);
check("Luis tiene la lista de Ana", (await lists(d2)).filter((x) => x === "Casa:3").length === 2);
await d2.goto(BASE); await d2.waitForTimeout(1200);
check("y el buzón queda vacío", !(await d2.isVisible("#homeBox")));

console.log(errs.length ? `\nErrores en la página:\n${errs.join("\n")}` : "\nSin errores en la página.");
console.log(`${ok} bien, ${bad} mal · capturas en ${SHOTS}`);
await b.close();
process.exit(bad || errs.length ? 1 : 0);
