// Comprueba en la web publicada que Chrome la considera instalable y que la búsqueda funciona.
import { chromium } from "playwright";

const URL = process.env.SITE_URL;
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
const res = await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
const c = await p.context().newCDPSession(p);
const { installabilityErrors } = await c.send("Page.getInstallabilityErrors");
const man = await c.send("Page.getAppManifest");
const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r?.active ? "activo" : "no activo"; });
await p.fill("#q", "apunta leche, huevos y oreos");
await p.click("button[type=submit]");
await p.waitForTimeout(4000);
const status = await p.textContent("#status");
const imgs = await p.locator("li.item img").count();
const out = { http: res.status(), installabilityErrors, manifestErrors: man.errors, manifestUrl: man.url, sw, status, imgs, errs };
console.log(JSON.stringify(out, null, 2));
const bad = installabilityErrors.length || man.errors.length || !imgs;
console.log(`::${bad ? "error" : "notice"} title=Resultado::${JSON.stringify(out).replace(/\n/g, " ")}`);
await b.close();
process.exit(bad ? 1 : 0);
