// Actualiza todos los catálogos y escribe data/meta.json con el resumen.
// Si una tienda falla, se conserva su catálogo anterior.
import { readFile } from "node:fs/promises";
import { fetchMercadona } from "./fetch-mercadona.mjs";
import { fetchOffStore, OFF_STORES } from "./fetch-off.mjs";
import { fetchConsum } from "./fetch-consum.mjs";
import { fetchDia } from "./fetch-dia.mjs";
import { fetchAlcampo } from "./fetch-alcampo.mjs";
import { writeJSON } from "./lib.mjs";
import { addHistory } from "./historial.mjs";
import { fetchFichas } from "./fetch-fichas.mjs";

const STORES = {
  mercadona: { name: "Mercadona", source: "Tienda online de Mercadona", prices: true, fetch: fetchMercadona },
  carrefour: { name: "Carrefour" }, lidl: { name: "Lidl" }, dia: { name: "Dia" }, alcampo: { name: "Alcampo" },
  eroski: { name: "Eroski" }, aldi: { name: "Aldi" }, consum: { name: "Consum" }, elcorteingles: { name: "El Corte Inglés" },
};
for (const s of Object.keys(OFF_STORES)) Object.assign(STORES[s], { source: "Open Food Facts", prices: false, fetch: () => fetchOffStore(s) });
// Súpers cuya tienda online deja consultar precios; si un día fallan, se usa Open Food Facts (sin precios).
// Si el buscador da pocos productos, se completa con los de Open Food Facts (sin precio), detrás de los que sí lo tienen.
const withOff = (s, fetch) => async () => { try {
  const items = await fetch();
  if (items.length >= 1500) return items;
  const have = new Set(items.map((p) => p.n.toLowerCase()));
  const off = (await fetchOffStore(s).catch(() => [])).filter((p) => !have.has(p.n.toLowerCase()));
  return [...items, ...off.map((p) => ({ ...p, r: p.r + items.length }))];
} catch (e) { console.error(`✗ ${STORES[s].name} (precios): ${e.message}`); STORES[s].source = "Open Food Facts"; STORES[s].prices = false; return fetchOffStore(s); } };
Object.assign(STORES.consum, { source: "Tienda online de Consum", prices: true, fetch: withOff("consum", fetchConsum) });
Object.assign(STORES.dia, { source: "Buscador de la tienda online de Dia", prices: true, fetch: withOff("dia", fetchDia) });
Object.assign(STORES.alcampo, { source: "Buscador de la tienda online de Alcampo", prices: true, fetch: withOff("alcampo", fetchAlcampo) });

// Bajadas de precio: si un producto cuesta menos que en el catálogo anterior, se guarda el precio de antes («pb»)
// y el día («pd»). Se mantiene 14 días mientras siga más barato.
export function applyDrops(items, prevItems, today = new Date().toISOString().slice(0, 10)) {
  const old = new Map(prevItems.map((p) => [`${p.n}|${p.f ?? ""}`, p]));
  const limit = new Date(Date.parse(today) - 14 * 864e5).toISOString().slice(0, 10);
  let n = 0;
  for (const p of items) {
    delete p.pb; delete p.pd;
    const o = old.get(`${p.n}|${p.f ?? ""}`);
    if (p.p == null || !o || o.p == null) continue;
    if (p.p < o.p - 0.005) { p.pb = o.p; p.pd = today; }
    else if (o.pb != null && o.pd >= limit && p.p < o.pb - 0.005) { p.pb = o.pb; p.pd = o.pd; }
    if (p.pb != null) n++;
  }
  return n;
}
async function markDrops(slug, items) {
  let prevItems = [];
  try { prevItems = JSON.parse(await readFile(`data/stores/${slug}.json`, "utf8")); } catch {}
  console.log(`  ${applyDrops(items, prevItems)} bajadas de precio`);
  // Historial para el gráfico de precio de cada ficha.
  let hist = {};
  try { hist = JSON.parse(await readFile(`data/precios/${slug}.json`, "utf8")); } catch {}
  console.log(`  ${addHistory(hist, prevItems, items, new Date().toISOString().slice(0, 10))} cambios de precio`);
  await writeJSON(`data/precios/${slug}.json`, hist);
}

const only = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) await main();
async function main() {
let meta = { stores: {} };
try { meta = JSON.parse(await readFile("data/meta.json", "utf8")); } catch {}

for (const [slug, s] of Object.entries(STORES)) {
  const prev = meta.stores[slug] ?? {};
  meta.stores[slug] = { name: s.name, source: prev.source ?? s.source, prices: prev.prices ?? s.prices, count: prev.count ?? 0, updated: prev.updated ?? null };
  if (only.length && !only.includes(slug)) continue;
  try {
    const items = await s.fetch();
    Object.assign(meta.stores[slug], { source: s.source, prices: s.prices });
    if (items.length < 20) throw new Error(`solo ${items.length} productos`);
    // Open Food Facts a veces responde a medias: si sale menos de la mitad que la última vez, se conserva lo anterior.
    if (prev.count && items.length < prev.count / 2) throw new Error(`solo ${items.length} productos (antes ${prev.count})`);
    if (s.prices) await markDrops(slug, items);
    await writeJSON(`data/stores/${slug}.json`, items);
    meta.stores[slug].count = items.length;
    meta.stores[slug].updated = new Date().toISOString();
    console.log(`✓ ${s.name}: ${items.length} productos`);
  } catch (e) {
    meta.stores[slug].error = e.message;
    console.error(`✗ ${s.name}: ${e.message}`);
    continue;
  }
  delete meta.stores[slug].error;
}
// Fichas de Mercadona (ingredientes, alérgenos…), poco a poco cada noche.
if (!only.length || only.includes("mercadona") || only.includes("fichas")) {
  try { await fetchFichas(); } catch (e) { console.error(`✗ Fichas de Mercadona: ${e.message}`); }
}
meta.generated = new Date().toISOString();
await writeJSON("data/meta.json", meta);
}
