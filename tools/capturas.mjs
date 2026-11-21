// Capturas de la app en tamaño móvil, con las fotos reales de los súpers (se lanza desde el workflow «Capturas»).
// Uso: node tools/capturas.mjs http://localhost:8000/ carpeta
import { chromium } from "playwright";
const [URL, OUT = "capturas"] = process.argv.slice(2);
// Con CHROME, el Chrome del sistema (más reciente, como el de los móviles).
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
const p = await ctx.newPage();
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.jpg`, quality: 82, type: "jpeg" });
await p.goto(URL, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(4000);
await shot("1-inicio");
await p.click('#tabbar [data-tab="list"]'); await p.waitForTimeout(600);
await p.fill("#q", "apunta leche, huevos, 2 kilos de naranjas, pan, plátanos, tomates, papel higiénico y macarrones");
await p.click("#bar button[type=submit]"); await p.waitForTimeout(8000);
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(1500);
await shot("2-lista");
await p.click('[data-view="grid"]').catch(() => {}); await p.waitForTimeout(2500);
await shot("3-lista-cuadros");
await p.click('[data-view="list"]').catch(() => {});
await p.click('#tabbar [data-tab="recipes"]'); await p.waitForTimeout(4000);
await shot("4-recetas");
// «Con lo que tengo»: el asistente paso a paso.
await p.click('#sheetTabs [data-tab="pantry"]'); await p.waitForTimeout(3000);
const tap = async (v) => { await p.click(`#aqgrid [data-v="${v}"]`); await p.waitForTimeout(450); };
for (let i = 0; i < 3; i++) {
  const t = (await p.locator(".aq-q").textContent().catch(() => "")) ?? "";
  if (/tu cocina/.test(t)) { await p.click("#aqnext"); await p.waitForTimeout(500); } else if (/alergias/.test(t)) await tap("no"); else break;
}
await tap("pollo"); await tap("pasta"); await p.waitForTimeout(2500);
await shot("5-tengo-1-con-que");
await p.click("#aqnext"); await p.waitForTimeout(600);
await tap("casera"); await tap("italiana"); await p.waitForTimeout(2000);
await shot("6-tengo-2-cocina");
await p.click("#aqnext"); await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(4000);
for (const i of [0, 1, 2, 4, 5]) { await p.locator("#tggrid .tg-it").nth(i).click(); await p.waitForTimeout(200); }
await p.locator("#aq").evaluate((e) => e.scrollTo(0, 0)); await p.waitForTimeout(2500);
await shot("7-tengo-3-en-casa");
await p.click("#aqnext"); await p.waitForTimeout(600);
await shot("8-tengo-4-personas");
await tap("2"); await p.waitForTimeout(500);
await shot("9-tengo-5-tiempo");
await tap("30"); await p.waitForTimeout(500);
await tap("2"); await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(4000);
await shot("10-tengo-6-resultado");
await b.close();
