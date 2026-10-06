// Actualiza todos los catálogos y escribe data/meta.json con el resumen.
// Si una tienda falla, se conserva su catálogo anterior.
import { readFile } from "node:fs/promises";
import { fetchMercadona } from "./fetch-mercadona.mjs";
import { fetchOffStore, OFF_STORES } from "./fetch-off.mjs";
import { writeJSON } from "./lib.mjs";

const STORES = {
  mercadona: { name: "Mercadona", source: "Tienda online de Mercadona", prices: true, fetch: fetchMercadona },
  carrefour: { name: "Carrefour" }, lidl: { name: "Lidl" }, dia: { name: "Dia" }, alcampo: { name: "Alcampo" },
  eroski: { name: "Eroski" }, aldi: { name: "Aldi" }, consum: { name: "Consum" }, elcorteingles: { name: "El Corte Inglés" },
};
for (const s of Object.keys(OFF_STORES)) Object.assign(STORES[s], { source: "Open Food Facts", prices: false, fetch: () => fetchOffStore(s) });

const only = process.argv.slice(2);
let meta = { stores: {} };
try { meta = JSON.parse(await readFile("data/meta.json", "utf8")); } catch {}

for (const [slug, s] of Object.entries(STORES)) {
  const prev = meta.stores[slug] ?? {};
  meta.stores[slug] = { name: s.name, source: s.source, prices: s.prices, count: prev.count ?? 0, updated: prev.updated ?? null };
  if (only.length && !only.includes(slug)) continue;
  try {
    const items = await s.fetch();
    if (items.length < 20) throw new Error(`solo ${items.length} productos`);
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
meta.generated = new Date().toISOString();
await writeJSON("data/meta.json", meta);
