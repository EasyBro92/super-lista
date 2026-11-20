// Capturas de la app en tamaño móvil, con las fotos reales de los súpers (se lanza desde el workflow «Capturas»).
// Uso: node tools/capturas.mjs http://localhost:8000/ carpeta
import { chromium } from "playwright";
const [URL, OUT = "capturas"] = process.argv.slice(2);
const b = await chromium.launch();
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
await p.click('#sheetTabs [data-tab="pantry"]'); await p.waitForTimeout(5000);
await shot("5-tengo-vacio");
for (const n of ["Huevos", "Patatas", "Tomates", "Cebollas", "Pechuga de pollo", "Arroz", "Leche"]) {
  const l = p.locator(`.tg-it[data-n="${n}"]`); if (await l.count()) { await l.first().scrollIntoViewIfNeeded(); await l.first().click(); } await p.waitForTimeout(200);
}
await p.locator("#tggrid").evaluate((e) => e.closest(".tg").scrollTo(0, 0)); await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(4000);
await shot("6-tengo");
await b.close();
