// Pruebas del SQL de las listas compartidas contra Postgres (base t4, limpia, con stub.sql y supabase/listas.sql).
import pg from "pg";
import { randomUUID } from "node:crypto";
const pool = new pg.Pool({ host: "/tmp", port: 5433, user: "postgres", database: process.env.DB ?? "t4" });
async function anon(sql, params = []) {
  const c = await pool.connect();
  try {
    await c.query("begin"); await c.query("set local role anon");
    const r = await c.query(sql, params); await c.query("commit"); return r.rows[0] ? Object.values(r.rows[0])[0] : null;
  } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
}
let ok = 0, bad = 0;
const t = async (name, fn) => { try { await fn(); ok++; console.log("✓", name); } catch (e) { bad++; console.log("✗", name, "→", e.message); } };
const fails = async (p, re) => { try { await p; } catch (e) { if (re && !re.test(e.message)) throw new Error(`error inesperado: ${e.message}`); return; } throw new Error("debería fallar"); };
const eq = (a, b, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
const save = (id, datos, rev) => anon("select public.guardar_lista($1, $2::jsonb, $3)", [id, JSON.stringify(datos), rev]);
const L = { name: "Casa", store: "mercadona", items: [{ id: "a", label: "Leche" }], gone: {} };

const id = randomUUID();
await t("sin cuenta no se puede leer la tabla", () => fails(anon("select count(*) from public.listas"), /permission denied/));
await t("guardar y leer", async () => {
  eq(await save(id, L, 0), { ok: true, rev: 1 });
  eq((await anon("select public.leer_lista($1)", [id])).datos.name, "Casa");
});
await t("si otro guardó antes, devuelve lo suyo", async () => {
  eq((await save(id, { ...L, name: "B" }, 1)).ok, true);
  const r = await save(id, { ...L, name: "C" }, 1);
  eq([r.ok, r.rev, r.datos.name], [false, 2, "B"]);
});
await t("lista de más de 500 KB no", () => fails(save(randomUUID(), { ...L, x: "a".repeat(500001) }, 0), /demasiado grande/));
await t("una lista de 400 productos sí cabe", async () => {
  const items = Array.from({ length: 400 }, (_, k) => ({ id: `i${k}`, label: "Aceite de oliva", qty: "1", count: 1, done: false, cat: "Despensa", emoji: "🫒", added: Date.now(), t: Date.now(),
    prod: { n: "Aceite de oliva 0,4º Hacendado", c: "Despensa", r: 0, f: "Garrafa 5 l", p: 17.25, u: "3,45 €/L", img: "https://prod-mercadona.imgix.net/images/3b8cde7b3cb069ee0316029012cf8562.jpg?fit=crop&h=300&w=300", id: "4241", s: "mercadona" } }));
  eq((await save(randomUUID(), { ...L, items }, 0)).ok, true);
});
await t("lo que no es una lista no vale", () => fails(save(randomUUID(), [1, 2], 0), /no válida/));
await t("como mucho 300 listas nuevas por hora entre todos", async () => {
  await pool.query("insert into public.listas (id, datos) select gen_random_uuid(), '{}'::jsonb from generate_series(1, 300)");
  await fails(save(randomUUID(), L, 0), /dentro de un rato/);
  eq((await save(id, { ...L, name: "D" }, 2)).ok, true, "las que ya existen se siguen guardando");
});
await t("las creadas hace más de una hora no cuentan", async () => {
  await pool.query("update public.listas set creado = now() - interval '2 hours'");
  eq((await save(randomUUID(), L, 0)).ok, true);
});
console.log(`\n${ok} bien, ${bad} mal`);
await pool.end();
process.exit(bad ? 1 : 0);
