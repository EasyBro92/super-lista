// Productos y precios de Dia usando el buscador de su tienda online (no publica el catálogo entero).
import { getJSON, sleep, catFor, product, writeJSON } from "./lib.mjs";
import { guess } from "../js/parser.js";
import { terminos } from "./terminos.mjs";

const BASE = "https://www.dia.es/api/v1/search-back/search/reduced";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" };
const UNITS = { LITRO: "L", KILO: "kg", KILOGRAMO: "kg", UNIDAD: "ud", DOCENA: "docena", METRO: "m" };
const eur = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
const fmtOf = (s) => s.match(/(\d+\s*x\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|gr|l|ml|cl|ud|uds|unidades)\b.*$/i)?.[0] ?? "";

export async function fetchDia() {
  const out = [];
  const seen = new Set();
  for (const t of await terminos()) {
    for (let page = 1; page <= 2; page++) {
      let d;
      try { d = await getJSON(`${BASE}?q=${encodeURIComponent(t)}&page=${page}`, { headers: HEADERS, tries: 3 }); }
      catch (e) { console.warn(`Dia: «${t}» falló: ${e.message}`); break; }
      for (const p of d.search_items ?? []) {
        if (seen.has(p.object_id)) continue;
        seen.add(p.object_id);
        const name = p.display_name ?? "";
        const pr = p.prices ?? {};
        let cat = catFor(name, p.l1_category_description, p.l2_category_description);
        if (cat === "Otros") cat = guess(name).cat;
        out.push(product({
          name,
          brand: p.brand ?? "",
          format: fmtOf(name),
          price: pr.price,
          unit: pr.price_per_unit && pr.measure_unit ? `${eur(pr.price_per_unit)} €/${UNITS[pr.measure_unit] ?? pr.measure_unit.toLowerCase()}` : "",
          img: p.image ? `https://www.dia.es${p.image}` : "",
          cat,
          rank: out.length,
          id: p.object_id,
          web: p.url ?? "",
          was: pr.is_promo_price ? pr.strikethrough_price : null,
          offer: pr.is_promo_price ? `${pr.is_club_price ? "Precio Club Dia" : "Oferta"}${pr.discount_percentage ? ` -${pr.discount_percentage}%` : ""}` : "",
        }));
      }
      if (page >= (d.pagination?.total_pages ?? 1)) break;
      await sleep(300);
    }
    await sleep(300);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = await fetchDia();
  console.log(`Dia: ${items.length} productos`);
  await writeJSON("data/stores/dia.json", items);
}
