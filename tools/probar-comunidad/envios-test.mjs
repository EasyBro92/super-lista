// Pruebas del SQL de los envíos (código corto y envío a una persona) contra Postgres.
// Base limpia con stub.sql, listas.sql, comunidad.sql y envios.sql (por defecto «t5»).
import pg from "pg";
const pool = new pg.Pool({ host: "/tmp", port: 5433, user: "postgres", database: process.env.DB ?? "t5" });
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
const user = async (nombre) => {
  const { rows } = await pool.query("insert into auth.users (email) values ($1) returning id", [`${nombre}.${Date.now()}@x.es`]);
  await as(rows[0].id, "select public.com_perfil($1)", [nombre]); return rows[0].id;
};
const L = { name: "Casa", store: "mercadona", items: [{ id: "a", label: "Leche" }, { id: "b", label: "Pan" }] };
const crear = (uid, tipo, d) => as(uid, "select public.env_crear($1, $2::jsonb)", [tipo, JSON.stringify(d)]);

await pool.query("delete from public.envios");
const ana = await user("Ana"), luis = await user("Luis"), eva = await user("Eva");

let code;
await t("sin cuenta no se puede leer la tabla", () => fails(as(null, "select count(*) from public.envios"), /permission denied/));
await t("sin cuenta se crea un código de 6 letras sin 0, O, 1, I ni L", async () => {
  code = await crear(null, "lista", L);
  if (!/^[A-HJKMNP-Z2-9]{6}$/.test(code)) throw new Error(code);
});
await t("recoger con el código (en minúsculas y con espacio)", async () => {
  const r = await as(null, "select public.env_recoger($1)", [`${code.slice(0, 3).toLowerCase()} ${code.slice(3)}`]);
  eq([r.tipo, r.datos.name, r.datos.items.length, r.de], ["lista", "Casa", 2, null]);
});
await t("un código que no existe no da nada", async () => eq(await as(null, "select public.env_recoger('ZZZZZZ')"), null));
await t("con cuenta, el código dice quién lo envía", async () => {
  const c = await crear(ana, "copia", { app: "superlista", state: { lists: [L] } });
  eq((await as(null, "select public.env_recoger($1)", [c])).de, "Ana");
});
await t("un código caducado ya no sirve", async () => {
  const c = await crear(null, "lista", L);
  await pool.query("update public.envios set caduca = now() - interval '1 minute' where codigo = $1", [c]);
  eq(await as(null, "select public.env_recoger($1)", [c]), null);
});
await t("tipo raro o datos que no son un objeto, no", async () => {
  await fails(crear(null, "virus", L), /no válido/);
  await fails(as(null, "select public.env_crear('lista', '[1,2]'::jsonb)"), /no válido/);
});
await t("más de 4 MB, no", () => fails(crear(null, "copia", { x: "a".repeat(4000001) }), /demasiado grande/));
await t("una copia de 3 MB sí", async () => { await crear(null, "copia", { x: "a".repeat(3000000) }); });
await t("las funciones internas no se pueden llamar", async () => {
  await fails(as(null, "select public.env_letras(6)"), /permission denied/);
  await fails(as(ana, "select public.env_comprobar('lista', '{}'::jsonb)"), /permission denied/);
});

let pc;
await t("sin cuenta no se puede enviar a una persona ni ver un buzón", async () => {
  await fails(as(null, "select public.env_enviar('Luis', 'lista', $1::jsonb)", [JSON.stringify(L)]), /permission denied/);
  await fails(as(null, "select public.env_buzon()"), /permission denied/);
});
await t("enviar a alguien que no existe avisa", () => fails(as(ana, "select public.env_enviar('Nadie', 'lista', $1::jsonb)", [JSON.stringify(L)]), /No hay nadie/));
await t("Ana envía a «luis» (da igual mayúsculas) y devuelve su nombre", async () => {
  eq(await as(ana, "select public.env_enviar(' luis ', 'lista', $1::jsonb)", [JSON.stringify(L)]), "Luis");
});
await t("Luis lo ve en su buzón con el nombre de la lista", async () => {
  const b = await as(luis, "select public.env_buzon()");
  eq([b.length, b[0].de, b[0].tipo, b[0].nombre, b[0].n, "datos" in b[0]], [1, "Ana", "lista", "Casa", 2, false]);
  pc = b[0].codigo;
  if (pc.length < 20) throw new Error("el código de un envío a una persona debe ser largo");
});
await t("Eva y alguien sin cuenta no pueden recogerlo; Luis sí", async () => {
  eq(await as(eva, "select public.env_recoger($1)", [pc]), null);
  eq(await as(null, "select public.env_recoger($1)", [pc]), null);
  eq((await as(luis, "select public.env_recoger($1)", [pc])).datos.name, "Casa");
});
await t("el buzón de Eva está vacío", async () => eq(await as(eva, "select public.env_buzon()"), []));
await t("Eva no puede borrarlo; Luis sí", async () => {
  eq(await as(eva, "select public.env_borrar($1)", [pc]), false);
  eq(await as(luis, "select public.env_borrar($1)", [pc]), true);
  eq(await as(luis, "select public.env_buzon()"), []);
});
await t("como mucho 30 envíos por hora cada persona", async () => {
  await pool.query("insert into public.envios (codigo, tipo, datos, de, caduca) select 'X' || g, 'lista', '{}', $1, now() + interval '1 day' from generate_series(1, 30) g", [eva]);
  await fails(as(eva, "select public.env_enviar('Ana', 'lista', $1::jsonb)", [JSON.stringify(L)]), /muchas cosas/);
  await fails(crear(eva, "lista", L), /muchas cosas/);
  await crear(ana, "lista", L); // los demás siguen pudiendo
});
await t("como mucho 300 envíos por hora entre todos", async () => {
  await pool.query("insert into public.envios (codigo, tipo, datos, caduca) select 'Y' || g, 'lista', '{}', now() + interval '1 day' from generate_series(1, 300) g");
  await fails(crear(null, "lista", L), /dentro de un rato/);
  await pool.query("delete from public.envios where codigo like 'Y%' or codigo like 'X%'");
});
await t("al borrar la cuenta se borra su buzón", async () => {
  await as(ana, "select public.env_enviar('Luis', 'lista', $1::jsonb)", [JSON.stringify(L)]);
  eq((await as(luis, "select public.env_buzon()")).length, 1);
  await as(luis, "select public.com_borrar_cuenta()");
  eq(Number((await pool.query("select count(*) from public.envios where para = $1", [luis])).rows[0].count), 0);
});
await t("los caducados se borran al crear uno nuevo", async () => {
  await pool.query("update public.envios set caduca = now() - interval '1 minute'");
  await crear(null, "lista", L);
  eq(Number((await pool.query("select count(*) from public.envios")).rows[0].count), 1);
});

console.log(`\n${ok} bien, ${bad} mal`);
await pool.end();
process.exit(bad ? 1 : 0);
