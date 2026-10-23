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
const r2 = await sb.rpc("com_recetas", {});
t("comunidad.sql instalado (com_recetas)", !r2.error && Array.isArray(r2.data), JSON.stringify(r2.error));
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
    await sb.storage.from("fotos").remove([path]);
    const del = await sb.rpc("com_borrar_cuenta");
    t("borrar la cuenta de prueba (y todo lo suyo)", del.data === true, JSON.stringify(del.error));
    const after = await createClient(url, key, { auth: { persistSession: false } }).rpc("com_receta", { p_id: rid.data });
    t("su receta ya no está", !after.error && after.data === null);
  }
}
console.log(`\n${ok} bien, ${bad} mal, ${warn} avisos`);
process.exit(bad ? 1 : 0);
