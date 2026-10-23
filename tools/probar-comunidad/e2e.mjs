import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const S = new URL(".", import.meta.url).pathname.replace(/\/$/, ""), ROOT = new URL("../..", import.meta.url).pathname, BASE = "http://localhost:8790/", SHOTS = process.env.SHOTS ?? "/tmp/capturas-comunidad";
fs.mkdirSync(SHOTS, { recursive: true });
const SDK = fs.readFileSync(`${S}/fake-sdk.js`, "utf8");
const FOTO = `${ROOT}img/recetas/albondigas-en-salsa.jpg`, FOTO2 = `${ROOT}img/recetas/arroz-a-la-cubana.jpg`;
const b = await chromium.launch();
const errs = [];
let ok = 0, bad = 0;
const check = (name, cond) => { if (cond) { ok++; console.log("✓", name); } else { bad++; console.log("✗", name); } };
async function ctx(name, withCfg = true) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block", locale: "es-ES" });
  await c.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ body: SDK, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" } }));
  await c.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  // La app ya trae los datos del Supabase de verdad: en la prueba se usa el falso o ninguno.
  await c.route(/\/js\/config\.js$/, (r) => r.fulfill({ body: 'export const SUPABASE = { url: "", key: "" };', contentType: "text/javascript" }));
  await c.addInitScript((cfg) => { sessionStorage.setItem("superlista.intro", "1"); if (cfg) localStorage.setItem("superlista.supabase", JSON.stringify(cfg)); },
    withCfg ? { url: "http://localhost:8790", key: "sb_publishable_prueba" } : null);
  const p = await c.newPage();
  p.on("pageerror", (e) => errs.push(`${name}: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts|Failed to load resource/.test(m.text())) errs.push(`${name}: ${m.text()}`); });
  await p.goto(BASE); await p.waitForTimeout(800);
  return p;
}
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png` });
const openCom = async (p) => { await p.evaluate(() => document.querySelector('.hcard[data-go="com"]').click()); await p.waitForTimeout(600); };
async function signUp(p, nombre, email) {
  if (await p.locator('#amode [data-m="crear"][aria-pressed="false"]').count()) await p.click('#amode [data-m="crear"]');
  await p.fill("#aname", nombre); await p.fill("#amail", email); await p.fill("#apass", "secreto123");
  await p.click("#ago"); await p.waitForTimeout(900);
}

// --- Sin configurar: no aparece nada de la comunidad ---
const off = await ctx("sin-config", false);
check("sin Supabase: 5 tarjetas en inicio", (await off.locator(".hcard").count()) === 5);
await off.close();

// --- Ana: crea cuenta, escribe y comparte una receta ---
const ana = await ctx("ana");
check("con Supabase: tarjeta Comunidad en inicio", (await ana.locator('.hcard[data-go="com"]').count()) === 1);
await shot(ana, "00-inicio");
await openCom(ana);
check("comunidad vacía", await ana.locator("#crows .empty").isVisible());
await shot(ana, "01-comunidad-vacia");
await ana.click("#cme"); await ana.waitForTimeout(300);
await ana.click('#amode [data-m="crear"]');
await shot(ana, "02-crear-cuenta");
await signUp(ana, "Ana", "ana@prueba.es");
check("Ana ha entrado y vuelve a la comunidad", (await ana.textContent("#cme")).includes("Ana"));
await ana.click("#cshare"); await ana.waitForTimeout(300);
await ana.click("#snew"); await ana.waitForTimeout(300);
await ana.fill("#ename", "Albóndigas de mi madre");
await ana.fill("#eings", "500 g de carne picada\n1 huevo\n2 dientes de ajo\n400 g de tomate triturado");
await ana.fill("#esteps", "Mezcla la carne con el huevo y el ajo.\nHaz bolas y dóralas.\nCuécelas 20 minutos en el tomate.");
await ana.setInputFiles("#efile", FOTO); await ana.waitForTimeout(500);
await ana.click("#esave"); await ana.waitForTimeout(500);
check("tu receta ofrece compartirla", await ana.locator("#xpub").isVisible());
await ana.locator("#csocial").scrollIntoViewIfNeeded(); await shot(ana, "03-mi-receta-compartir");
await ana.click("#xpub"); await ana.waitForTimeout(1500);
check("receta compartida y abierta desde la comunidad", (await ana.textContent(".com-by")).includes("Ana"));
const files = await (await fetch(`${BASE}fake/files`)).json();
check("la foto se ha subido a Storage", files.length === 1 && files[0].startsWith("fotos/"));

// --- Luis: ve la receta, entra, vota, comenta con foto y la guarda ---
const luis = await ctx("luis");
await openCom(luis);
await luis.waitForSelector("#crows .rc");
check("Luis ve la receta de Ana en la comunidad", (await luis.textContent("#crows")).includes("Albóndigas de mi madre"));
await shot(luis, "04-comunidad-recetas");
await luis.click("#crows .rc"); await luis.waitForTimeout(800);
check("sin cuenta: botón para entrar a valorar", await luis.locator("#xlogin").isVisible());
await luis.click("#xlogin"); await luis.waitForTimeout(300);
await signUp(luis, "Luis", "luis@prueba.es");
check("tras crear la cuenta vuelve a la receta", await luis.locator("#xstars").isVisible());
await luis.click('#xstars [data-s="5"]'); await luis.waitForTimeout(800);
check("nota guardada: media 5", (await luis.textContent(".rate-avg")).includes("5"));
await luis.fill("#xft", "¡Me han salido buenísimas! Les puse un poco de comino.");
await luis.setInputFiles("#xff", FOTO2); await luis.waitForTimeout(500);
await luis.click("#xfs"); await luis.waitForTimeout(1200);
check("comentario con foto publicado", (await luis.locator("#xcmts .cmt").count()) === 1 && (await luis.locator("#xcmts .cmt img").count()) === 1);
await luis.locator(".rate").scrollIntoViewIfNeeded(); await shot(luis, "05-opiniones");
await luis.click("#xsave"); await luis.waitForTimeout(300);
check("guardada en mis recetas", (await luis.evaluate(() => JSON.parse(localStorage.getItem("superlista.v1") || localStorage.getItem(Object.keys(localStorage).find((k) => k.includes("superlista") && localStorage.getItem(k).includes("myR"))) || "{}").myR?.length)) === 1);
// Receta de la app: también tiene opiniones
await luis.click("#sheetClose"); await luis.waitForTimeout(300); // atrás → comunidad
check("atrás desde la receta vuelve a la comunidad", await luis.locator("#ctabs").isVisible());
// Charla
await luis.click('#ctabs [data-t="charla"]'); await luis.waitForTimeout(800);
await luis.fill("#chft", "¿Alguien sabe dónde hay buen aceite de oliva de oferta esta semana?"); await luis.click("#chfs"); await luis.waitForTimeout(800);
check("mensaje en la charla", (await luis.locator("#chat .cmt").count()) === 1);

// --- Ana responde en la charla y denuncia (para probar la revisión) ---
await ana.click("#sheetClose"); await ana.waitForTimeout(300);
await openCom(ana);
await ana.click('#ctabs [data-t="charla"]'); await ana.waitForTimeout(800);
check("Ana ve el mensaje de Luis", (await ana.textContent("#chat")).includes("aceite de oliva"));
await ana.fill("#chft", "En el Mercadona de mi barrio lo tienen a 6,95 € el litro 👌"); await ana.click("#chfs"); await ana.waitForTimeout(800);
await shot(ana, "06-charla");
await ana.click('#chat .cmt:not(.mine) [data-act="rep"]'); await ana.click('#chat .cmt:not(.mine) [data-act="rep"]'); await ana.waitForTimeout(500);
check("denuncia enviada", (await ana.textContent("#chat")).includes("Denunciado"));
// Luis recibe la respuesta (cada 15 s o al volver a abrir)
await luis.click('#ctabs [data-t="recetas"]'); await luis.waitForTimeout(300); await luis.click('#ctabs [data-t="charla"]'); await luis.waitForTimeout(800);
check("Luis ve la respuesta de Ana", (await luis.textContent("#chat")).includes("6,95"));
await shot(luis, "07-charla-luis");

// --- Ana pasa a moderadora ---
execSync(`psql -q -h /tmp -p 5433 -U postgres -d t2 -c "insert into public.moderadores select id from auth.users where email = 'ana@prueba.es'"`);
await ana.reload(); await ana.waitForTimeout(1200);
await openCom(ana); await ana.waitForTimeout(800);
check("moderadora: pestaña Revisar", await ana.locator('#ctabs [data-t="revisar"]').isVisible());
await ana.click('#ctabs [data-t="revisar"]'); await ana.waitForTimeout(800);
check("revisar muestra la denuncia", (await ana.locator(".rev-it").count()) === 1);
await shot(ana, "08-revisar");
await ana.click('.rev-it [data-m="mostrar"]'); await ana.waitForTimeout(600);
check("aprobada: ya no queda nada", await ana.locator("#rev .empty").isVisible());

// --- Cuenta: salir, contraseña mal, volver a entrar ---
await ana.click("#cme"); await ana.waitForTimeout(400);
await shot(ana, "09-tu-cuenta");
await ana.click("#aout"); await ana.waitForTimeout(400);
check("ha salido", await ana.locator("#amail").isVisible());
await ana.fill("#amail", "ana@prueba.es"); await ana.fill("#apass", "malmal"); await ana.click("#ago"); await ana.waitForTimeout(600);
check("contraseña mal: aviso claro", (await ana.textContent("#aerr")).includes("no son correctos"));
await shot(ana, "10-contrasena-mal");
await ana.fill("#apass", "secreto123"); await ana.click("#ago"); await ana.waitForTimeout(800);
check("vuelve a entrar y a la comunidad", (await ana.textContent("#cme")).includes("Ana"));

// --- Receta de la app con opiniones (Luis) ---
await luis.click("#sheetClose"); await luis.waitForTimeout(300);
await luis.evaluate(() => document.querySelector('.hcard[data-go="recipes"]').click()); await luis.waitForTimeout(1200);
check("en Recetas aparece el acceso a la Comunidad", await luis.locator("#ccom").isVisible());
await shot(luis, "11-recetas-acceso");
await luis.fill("#cq", "tortilla de patatas"); await luis.waitForTimeout(500);
await luis.click('#cmode [data-mode="todas"]'); await luis.waitForTimeout(300);
await luis.click("#clist .rc"); await luis.waitForTimeout(1000);
await luis.click('#xstars [data-s="4"]'); await luis.waitForTimeout(800);
check("receta de la app: nota guardada", (await luis.textContent(".rate-avg")).includes("4"));
await luis.locator(".rate").scrollIntoViewIfNeeded(); await shot(luis, "12-receta-app-opiniones");

// --- Borrar la cuenta de Luis ---
await luis.click("#sheetClose"); await luis.waitForTimeout(200); await luis.click("#sheetClose").catch(() => {}); await luis.waitForTimeout(300);
await luis.evaluate(() => document.querySelector('.hcard[data-go="com"]').click()); await luis.waitForTimeout(600);
await luis.click("#cme"); await luis.waitForTimeout(400);
await luis.click("#adel"); await luis.click("#adel"); await luis.waitForTimeout(1200);
check("cuenta borrada", (await luis.textContent("#sheetBody")).includes("se han borrado"));
const files2 = await (await fetch(`${BASE}fake/files`)).json();
check("sus fotos también se borran", files2.length === 1);

// --- Entrar con Google (Marta) ---
const marta = await ctx("marta");
await openCom(marta);
await marta.click("#cme"); await marta.waitForTimeout(800);
check("botón de Google visible (y el de Apple no, porque está apagado)", (await marta.locator('[data-prov="google"]').count()) === 1 && (await marta.locator('[data-prov="apple"]').count()) === 0);
await shot(marta, "13-entrar-google");
await marta.click('[data-prov="google"]'); await marta.waitForTimeout(2000);
check("al volver de Google pide el nombre, ya relleno", (await marta.inputValue("#aname").catch(() => "")) === "Marta López");
await shot(marta, "14-google-nombre");
await marta.click('#nform button[type="submit"]'); await marta.waitForTimeout(1000);
check("con Google ya está dentro de la comunidad", (await marta.textContent("#cme").catch(() => "")).includes("Marta"));

console.log(`\n${ok} bien, ${bad} mal`);
console.log(errs.length ? `Errores en la consola:\n${errs.join("\n")}` : "Sin errores en la consola");
await b.close();
process.exit(bad || errs.length ? 1 : 0);
