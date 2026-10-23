// Pruebas del SQL de la comunidad contra Postgres (base t3, limpia).
import pg from "pg";
const pool = new pg.Pool({ host: "/tmp", port: 5433, user: "postgres", database: "t3" });
async function as(uid, sql, params = []) {
  const c = await pool.connect();
  try {
    await c.query("begin"); await c.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    const r = await c.query(sql, params); await c.query("commit"); return r.rows[0] ? Object.values(r.rows[0])[0] : null;
  } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
}
let ok = 0, bad = 0;
const t = async (name, fn) => { try { await fn(); ok++; console.log("✓", name); } catch (e) { bad++; console.log("✗", name, "→", e.message); } };
const fails = async (p, re) => { try { await p; } catch (e) { if (re && !re.test(e.message)) throw new Error(`error inesperado: ${e.message}`); return; } throw new Error("debería fallar"); };
const eq = (a, b, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
const user = async (email) => (await pool.query("insert into auth.users (email) values ($1) returning id", [email])).rows[0].id;
const ana = await user("ana@x.es"), luis = await user("luis@x.es"), marta = await user("marta@x.es"), pepe = await user("pepe@x.es"), mod = await user("mod@x.es");
const R = { n: "Lentejas de la abuela", e: "🍲", t: 40, r: 4, d: "Fácil", m: { Comida: [] }, i: [["Lentejas", "300 g"], ["Chorizo", "1"]], p: ["Cuece todo 40 minutos."], tags: ["Legumbres"], basura: "x" };

await t("sin cuenta no se puede leer las tablas directamente", () => fails(as(null, "select count(*) from public.comentarios"), /permission denied/));
await t("con cuenta tampoco", () => fails(as(ana, "select count(*) from public.perfiles"), /permission denied/));
await t("sin cuenta: com_yo es null", async () => eq(await as(null, "select public.com_yo()"), null));
await t("sin cuenta no se puede comentar", () => fails(as(null, "select public.com_comentar('charla','hola')"), /permission denied/));
await t("con cuenta pero sin nombre no se publica", () => fails(as(ana, "select public.com_comentar('charla','hola')"), /Elige primero tu nombre/));
await t("nombre muy corto", () => fails(as(ana, "select public.com_perfil('A')"), /entre 2 y 30/));
await t("crear perfiles", async () => {
  for (const [u, n] of [[ana, "Ana"], [luis, "Luis"], [marta, "Marta"], [pepe, "Pepe"], [mod, "Moderador"]]) await as(u, "select public.com_perfil($1)", [n]);
  eq((await as(ana, "select public.com_yo()")).nombre, "Ana");
});
await t("nombre repetido (sin mayúsculas)", () => fails(as(luis, "select public.com_perfil('  ana ')"), /ya lo usa otra persona/));
await t("cambiar tu propio nombre", async () => { await as(ana, "select public.com_perfil('Ana  García')"); eq((await as(ana, "select public.com_yo()")).nombre, "Ana García"); });

let rid;
await t("publicar receta (limpia campos que no usa)", async () => {
  rid = await as(ana, "select public.com_publicar($1::jsonb, null, null)", [JSON.stringify(R)]);
  const x = await as(null, "select public.com_receta($1)", [rid]);
  eq(x.datos.basura, undefined); eq(x.autor, "Ana García"); eq(x.mia, false);
});
await t("foto en carpeta ajena no vale", () => fails(as(ana, "select public.com_publicar($1::jsonb, $2, null)", [JSON.stringify(R), `${luis}/a.jpg`]), /Foto no válida/));
await t("foto en tu carpeta vale", async () => { await as(ana, "select public.com_publicar($1::jsonb, $2, $3)", [JSON.stringify(R), `${ana}/abc123.jpg`, rid]); });
await t("otro no puede cambiar tu receta", () => fails(as(luis, "select public.com_publicar($1::jsonb, null, $2)", [JSON.stringify(R), rid]), /No puedes cambiar/));
await t("receta sin pasos no vale", () => fails(as(ana, "select public.com_publicar($1::jsonb)", [JSON.stringify({ ...R, p: [] })]), /pasos/));
await t("no puedes valorar tu receta", () => fails(as(ana, "select public.com_valorar($1, 5)", [`c:${rid}`]), /propia/));
await t("valorar y media", async () => {
  await as(luis, "select public.com_valorar($1, 5)", [`c:${rid}`]);
  const n = await as(marta, "select public.com_valorar($1, 4)", [`c:${rid}`]);
  eq([+n.m, n.v, n.mia], [4.5, 2, 4]);
  await as(marta, "select public.com_valorar($1, 2)", [`c:${rid}`]); // cambiar
  eq(+(await as(null, "select public.com_notas($1)", [[`c:${rid}`]]))[`c:${rid}`].m, 3.5);
  await as(marta, "select public.com_valorar($1, 0)", [`c:${rid}`]); // quitar
  eq((await as(null, "select public.com_notas($1)", [[`c:${rid}`]]))[`c:${rid}`].v, 1);
});
await t("6 estrellas no", () => fails(as(luis, "select public.com_valorar('r:Tortilla de patatas', 6)"), /1 a 5/));
await t("valorar receta de la app", async () => { await as(luis, "select public.com_valorar('r:Tortilla de patatas', 4)"); });
await t("hilo inventado no", () => fails(as(luis, "select public.com_comentar('hackeo','x')"), /no válida/));
await t("comentario en receta que no existe no", () => fails(as(luis, "select public.com_comentar($1,'x')", ["c:00000000-0000-4000-8000-000000000000"]), /ya no existe/));
let cid;
await t("comentar y leer", async () => {
  cid = (await as(luis, "select public.com_comentar($1, '¡Buenísima! <script>x</script>')", [`c:${rid}`])).id;
  const l = await as(null, "select public.com_comentarios($1)", [`c:${rid}`]);
  eq([l.length, l[0].autor, l[0].mio], [1, "Luis", false]);
  eq((await as(luis, "select public.com_comentarios($1)", [`c:${rid}`]))[0].mio, true);
  eq((await as(null, "select public.com_receta($1)", [rid])).comentarios, 1);
});
await t("comentario de más de 1000 letras no", () => fails(as(luis, "select public.com_comentar('charla', $1)", ["a".repeat(1001)]), /1000/));
await t("comentario vacío no", () => fails(as(luis, "select public.com_comentar('charla', '   ')"), /Escribe algo/));
await t("no puedes borrar lo de otro", () => fails(as(ana, "select public.com_borrar('comentario', $1)", [cid]), /No puedes borrar/));
await t("no puedes denunciarte", () => fails(as(luis, "select public.com_denunciar('comentario', $1)", [cid]), /algo tuyo/));
await t("3 denuncias lo ocultan", async () => {
  await as(ana, "select public.com_denunciar('comentario', $1, 'insulto')", [cid]);
  await as(ana, "select public.com_denunciar('comentario', $1, 'otra vez')", [cid]); // repetida: no cuenta
  await as(marta, "select public.com_denunciar('comentario', $1)", [cid]);
  eq((await as(null, "select public.com_comentarios($1)", [`c:${rid}`])).length, 1, "aún visible con 2");
  await as(pepe, "select public.com_denunciar('comentario', $1)", [cid]);
  eq((await as(null, "select public.com_comentarios($1)", [`c:${rid}`])).length, 0, "oculto para todos");
  eq((await as(luis, "select public.com_comentarios($1)", [`c:${rid}`])).length, 1, "su autor lo sigue viendo");
});
await t("revisar solo para moderadores", () => fails(as(ana, "select public.com_pendientes()"), /moderadores/));
await pool.query("insert into public.moderadores values ($1)", [mod]);
await t("moderador ve lo pendiente y lo aprueba", async () => {
  const p = await as(mod, "select public.com_pendientes()");
  eq([p.length, p[0].denuncias, p[0].cosa.oculto], [1, 3, true]);
  await as(mod, "select public.com_moderar('comentario', $1, 'mostrar')", [cid]);
  eq((await as(null, "select public.com_comentarios($1)", [`c:${rid}`])).length, 1);
  eq((await as(mod, "select public.com_pendientes()")).length, 0);
});
await t("bloquear: se oculta todo y no puede publicar", async () => {
  await as(luis, "select public.com_comentar('charla', 'spam spam')");
  const sc = (await as(null, "select public.com_comentarios('charla')"))[0].id;
  await as(mod, "select public.com_moderar('comentario', $1, 'bloquear')", [sc]);
  eq((await as(null, "select public.com_comentarios('charla')")).length, 0);
  await fails(as(luis, "select public.com_comentar('charla', 'hola')"), /bloqueada/);
  await fails(as(luis, "select public.com_valorar('r:Tortilla de patatas', 1)"), /bloqueada/);
});
await t("no se puede bloquear a un moderador", async () => {
  await as(mod, "select public.com_comentar('charla', 'Bienvenidos')");
  const id = (await as(mod, "select public.com_comentarios('charla')"))[0].id;
  await fails(as(mod, "select public.com_moderar('comentario', $1, 'bloquear')", [id]), /moderador/);
});
await t("límite: 40 comentarios por hora", async () => {
  for (let k = 0; k < 40; k++) await as(pepe, "select public.com_comentar('charla', $1)", [`m${k}`]);
  await fails(as(pepe, "select public.com_comentar('charla', 'uno más')"), /Espera un rato/);
});
await t("charla: 40 por página y paginar hacia atrás", async () => {
  const a = await as(null, "select public.com_comentarios('charla')");
  eq(a.length, 40);
  const b = await as(null, "select public.com_comentarios('charla', $1)", [a.at(-1).creado]);
  eq(b.length >= 1, true);
});
await t("listar recetas: nuevas, mejores y buscar", async () => {
  const r2 = await as(marta, "select public.com_publicar($1::jsonb)", [JSON.stringify({ ...R, n: "Pisto manchego", i: [["Calabacín", "1"]] })]);
  await as(pepe, "select public.com_valorar($1, 1)", [`c:${r2}`]);
  eq((await as(null, "select public.com_recetas('nuevas')"))[0].datos.n, "Pisto manchego");
  eq((await as(null, "select public.com_recetas('mejores')"))[0].datos.n, "Lentejas de la abuela");
  eq((await as(null, "select public.com_recetas('nuevas', 0, 'calabac')")).map((x) => x.datos.n), ["Pisto manchego"]);
  eq((await as(null, "select public.com_recetas('nuevas', 0, '%')")).length, 2);
});
await t("borrar tu receta borra sus comentarios y votos", async () => {
  const res = await as(ana, "select public.com_borrar('receta', $1)", [rid]);
  eq(res.foto, `${ana}/abc123.jpg`);
  eq(await as(null, "select public.com_receta($1)", [rid]), null);
  eq((await pool.query("select count(*)::int n from public.comentarios where hilo = $1", [`c:${rid}`])).rows[0].n, 0);
  eq((await pool.query("select count(*)::int n from public.valoraciones where receta = $1", [`c:${rid}`])).rows[0].n, 0);
});
await t("borrar la cuenta lo borra todo", async () => {
  await as(marta, "select public.com_comentar('charla', 'adiós')");
  eq(await as(marta, "select public.com_borrar_cuenta()"), true);
  eq((await pool.query("select count(*)::int n from auth.users where id = $1", [marta])).rows[0].n, 0);
  eq((await pool.query("select count(*)::int n from public.recetas_com where autor = $1", [marta])).rows[0].n, 0);
  eq((await pool.query("select count(*)::int n from public.comentarios where autor = $1", [marta])).rows[0].n, 0);
});
await t("fotos: solo subir en tu carpeta", async () => {
  await as(ana, "insert into storage.objects (bucket_id, name) values ('fotos', $1)", [`${ana}/x.jpg`]);
  await fails(as(ana, "insert into storage.objects (bucket_id, name) values ('fotos', $1)", [`${pepe}/x.jpg`]), /row-level security/);
});
await t("fotos: un bloqueado no sube", () => fails(as(luis, "insert into storage.objects (bucket_id, name) values ('fotos', $1)", [`${luis}/x.jpg`]), /row-level security/));
await t("el cajón de fotos existe, es público y limita a 2 MB", async () => {
  const b = (await pool.query("select * from storage.buckets where id = 'fotos'")).rows[0];
  eq([b.public, +b.file_size_limit], [true, 2097152]);
});
console.log(`\n${ok} bien, ${bad} mal`);
await pool.end();
process.exit(bad ? 1 : 0);
