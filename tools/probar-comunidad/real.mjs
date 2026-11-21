// Comprueba el Supabase de verdad (el de js/config.js): que el SQL está instalado, que las tablas están cerradas,
// los ajustes de cuentas y un recorrido completo con una cuenta de prueba que se borra al final.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE } from "../../js/config.js";
const { url, key } = SUPABASE;
let ok = 0, bad = 0, warn = 0;
const t = (n, c, extra = "") => { if (c) { ok++; console.log("✓", n); } else { bad++; console.log("✗", n, extra); } };
const w = (n, c, extra = "") => { if (c) { ok++; console.log("✓", n); } else { warn++; console.log("⚠", n, extra); } };
const sb = createClient(url, key, { auth: { persistSession: false } });

const r1 = await sb.rpc("leer_lista", { p_id: "00000000-0000-4000-8000-000000000000" });
t("listas.sql instalado (leer_lista)", !r1.error, JSON.stringify(r1.error));
// Listas en directo: lo que manda un móvil le llega al otro al momento (Realtime, Broadcast).
{
  const name = `lista-prueba-${Math.random().toString(36).slice(2)}`;
  const c1 = createClient(url, key, { auth: { persistSession: false } }), c2 = createClient(url, key, { auth: { persistSession: false } });
  const sub = (c) => new Promise((ok) => { const ch = c.channel(name, { config: { broadcast: { self: false } } }); ch.subscribe((s) => ok([ch, s])); setTimeout(() => ok([ch, "TIMEOUT"]), 10000); });
  let got = null; const [ch1, s1] = await sub(c1);
  const [ch2, s2] = await new Promise((ok) => {
    const ch = c2.channel(name, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "cambio" }, (m) => { got = { at: Date.now(), m }; });
    ch.subscribe((s) => ok([ch, s])); setTimeout(() => ok([ch, "TIMEOUT"]), 10000);
  });
  t("tiempo real conectado en los dos móviles", s1 === "SUBSCRIBED" && s2 === "SUBSCRIBED", `${s1} / ${s2}`);
  const t0 = Date.now();
  await ch1.send({ type: "broadcast", event: "cambio", payload: { rev: 1, datos: { name: "Prueba", items: [{ id: "a", label: "Leche" }] } } });
  for (let k = 0; k < 100 && !got; k++) await new Promise((r) => setTimeout(r, 50));
  t(`un cambio llega al otro móvil al momento${got ? ` (${got.at - t0} ms)` : ""}`, got?.m?.payload?.datos?.items?.[0]?.label === "Leche", "no ha llegado en 5 s");
  await c1.removeChannel(ch1); await c2.removeChannel(ch2);
}
const r2 = await sb.rpc("com_recetas", {});
t("comunidad.sql instalado (com_recetas)", !r2.error && Array.isArray(r2.data), JSON.stringify(r2.error));
const r5 = await sb.rpc("env_recoger", { p_codigo: "ZZZZZZ" });
w("envios.sql instalado (pasar datos con un código)", !r5.error, "(falta ejecutar supabase/envios.sql en el SQL Editor)");
if (!r5.error) {
  const cc = await sb.rpc("env_crear", { p_tipo: "lista", p_datos: { name: "Prueba", items: [{ id: "a", label: "Leche" }] } });
  t("crear un código para pasar una lista", !cc.error && /^[A-Z0-9]{6}$/.test(cc.data ?? ""), JSON.stringify(cc.error));
  const rc = await sb.rpc("env_recoger", { p_codigo: cc.data });
  t("recoger la lista con ese código", rc.data?.datos?.name === "Prueba", JSON.stringify(rc.error));
  const bz = await sb.rpc("env_buzon");
  t("sin cuenta no se ve ningún buzón", !!bz.error || (Array.isArray(bz.data) && !bz.data.length));
  t("la tabla de envíos no se puede leer directamente", !!(await sb.from("envios").select("*").limit(1)).error);
}
const r3 = await sb.from("comentarios").select("*").limit(1);
t("las tablas no se pueden leer directamente", !!r3.error, JSON.stringify(r3));
const r4 = await sb.rpc("com_comentar", { p_hilo: "charla", p_texto: "hola" });
t("sin cuenta no se puede escribir", !!r4.error);
const set = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).then((r) => r.json());
w("«Confirm email» apagado", set.mailer_autoconfirm === true, `(mailer_autoconfirm = ${set.mailer_autoconfirm})`);
t("se pueden crear cuentas con correo", set.external?.email === true && !set.disable_signup);

if (set.mailer_autoconfirm === true) {
  const email = `prueba.superlista.${Date.now()}@gmail.com`;
  const up = await sb.auth.signUp({ email, password: `Prueba-${Math.random().toString(36).slice(2)}` });
  t("crear cuenta de prueba", !up.error && !!up.data.session, JSON.stringify(up.error));
  if (up.data.session) {
    const uid = up.data.user.id;
    const p = await sb.rpc("com_perfil", { p_nombre: `Prueba ${Date.now() % 100000}` });
    t("elegir nombre", !p.error, JSON.stringify(p.error));
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const path = `${uid}/prueba.png`;
    const upl = await sb.storage.from("fotos").upload(path, png, { contentType: "image/png" });
    t("subir una foto a tu carpeta", !upl.error, JSON.stringify(upl.error));
    const pub = await fetch(`${url}/storage/v1/object/public/fotos/${path}`);
    t("la foto se ve con su enlace público", pub.status === 200, `HTTP ${pub.status}`);
    const other = await sb.storage.from("fotos").upload(`00000000-0000-4000-8000-000000000000/x.png`, png, { contentType: "image/png" });
    t("no se puede subir a la carpeta de otro", !!other.error);
    const rid = await sb.rpc("com_publicar", { p_datos: { n: "Receta de prueba", i: [["Agua", "1 vaso"]], p: ["Bebe."] }, p_foto: path, p_id: null });
    t("compartir una receta", !rid.error, JSON.stringify(rid.error));
    const v = await sb.rpc("com_valorar", { p_receta: "r:Tortilla de patatas", p_estrellas: 5 });
    t("valorar una receta de la app", !v.error, JSON.stringify(v.error));
    const c = await sb.rpc("com_comentar", { p_hilo: `c:${rid.data}`, p_texto: "Comentario de prueba", p_foto: null });
    t("comentar", !c.error, JSON.stringify(c.error));
    // Límite de 15 fotos por hora (supabase/comunidad.sql, com_puede_subir): la 16.ª no debe entrar.
    const extra = [];
    for (let k = 2; k <= 16; k++) {
      const pk = `${uid}/limite${k}.png`;
      const r = await sb.storage.from("fotos").upload(pk, png, { contentType: "image/png" });
      if (r.error) break;
      extra.push(pk);
    }
    w("límite de 15 fotos por hora activo", extra.length === 14, `(entraron ${extra.length + 1} fotos; ¿falta volver a ejecutar comunidad.sql?)`);
    if (extra.length) await sb.storage.from("fotos").remove(extra);
    await sb.storage.from("fotos").remove([path]);
    const del = await sb.rpc("com_borrar_cuenta");
    t("borrar la cuenta de prueba (y todo lo suyo)", del.data === true, JSON.stringify(del.error));
    const after = await createClient(url, key, { auth: { persistSession: false } }).rpc("com_receta", { p_id: rid.data });
    t("su receta ya no está", !after.error && after.data === null);
  }
}
console.log(`\n${ok} bien, ${bad} mal, ${warn} avisos`);
process.exit(bad ? 1 : 0);
