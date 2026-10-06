// Descarga de Open Food Facts los productos que se venden en cada supermercado español.
// Open Food Facts es una base de datos abierta y colaborativa: tiene fotos y códigos de barras, pero no precios.
import { getJSON, sleep, catFor, product, writeJSON, norm } from "./lib.mjs";

export const OFF_STORES = {
  carrefour: ["carrefour"],
  lidl: ["lidl"],
  dia: ["dia"],
  alcampo: ["alcampo", "auchan"],
  eroski: ["eroski"],
  aldi: ["aldi"],
  consum: ["consum"],
  elcorteingles: ["el-corte-ingles", "hipercor"],
};

const FIELDS = "code,product_name_es,product_name,generic_name_es,brands,quantity,image_front_small_url,categories_tags,unique_scans_n";
const PAGE_SIZE = 250;
const MAX_PAGES = Number(process.env.OFF_MAX_PAGES || 16);
// Open Food Facts permite unas 10 búsquedas por minuto.
const WAIT = 6500;

export async function fetchOffStore(slug) {
  const out = [];
  const seen = new Set();
  for (const tag of OFF_STORES[slug]) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://world.openfoodfacts.org/api/v2/search?countries_tags_en=spain&stores_tags=${tag}` +
        `&fields=${FIELDS}&page_size=${PAGE_SIZE}&page=${page}&sort_by=unique_scans_n`;
      let data;
      try {
        data = await getJSON(url);
      } catch (e) {
        console.warn(`OFF ${tag} página ${page}: ${e.message}`);
        break;
      }
      const prods = data.products ?? [];
      for (const p of prods) {
        const name = (p.product_name_es || p.product_name || p.generic_name_es || "").trim();
        if (!name || !p.image_front_small_url || seen.has(p.code)) continue;
        seen.add(p.code);
        const brand = (p.brands || "").split(",")[0].trim();
        out.push(product({
          name: brand && !norm(name).includes(norm(brand)) ? `${name} ${brand}` : name,
          brand,
          format: p.quantity || "",
          img: p.image_front_small_url,
          cat: catFor(p.categories_tags || []),
          ean: p.code,
          rank: out.length,
        }));
      }
      await sleep(WAIT);
      if (prods.length < PAGE_SIZE) break;
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const slugs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(OFF_STORES);
  for (const s of slugs) {
    const items = await fetchOffStore(s);
    console.log(`${s}: ${items.length} productos`);
    await writeJSON(`data/stores/${s}.json`, items);
  }
}
