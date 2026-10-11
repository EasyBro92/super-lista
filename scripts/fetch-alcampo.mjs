// Productos y precios de Alcampo desde las páginas de búsqueda de su tienda online
// (cada página trae los productos en un JSON dentro del HTML: window.__INITIAL_STATE__).
import { sleep, catFor, product, writeJSON } from "./lib.mjs";
import { guess } from "../js/parser.js";
import { terminos } from "./terminos.mjs";

const BASE = "https://www.compraonline.alcampo.es/search?q=";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" };
const UNITS = { litre: "L", kg: "kg", kilogram: "kg", each: "ud", unit: "ud", "100g": "100 g", "100ml": "100 ml", metre: "m" };
const eur = (n) => String(Math.round(+n * 100) / 100).replace(".", ",");
const fmtOf = (s) => s.match(/(\d+\s*x\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|gr|l|ml|cl|ud|uds|unidades)\b/i)?.[0] ?? "";

const seenStatus = {};
async function page(q) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(BASE + encodeURIComponent(q), { headers: HEADERS });
      seenStatus[r.status] = (seenStatus[r.status] ?? 0) + 1;
      // Si nos frena (403/429), esperamos un rato y volvemos a probar.
      if (r.status === 403 || r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) return null;
      const t = await r.text();
      const a = t.indexOf("__INITIAL_STATE__=");
      if (a < 0) return null;
      const b = t.indexOf("</script>", a);
      return JSON.parse(t.slice(a + 18, b).trim().replace(/;$/, ""));
    } catch (e) { await sleep(15000 * (i + 1)); }
  }
  return null;
}

export async function fetchAlcampo() {
  const out = [];
  const seen = new Set();
  let fails = 0;
  for (const t of await terminos()) {
    const d = await page(t);
    // Si deja de responder muchas veces seguidas, paramos con lo que haya.
    if (!d) { if (++fails > 8) break; continue; }
    fails = 0;
    for (const p of Object.values(d.data?.products?.productEntities ?? {})) {
      if (!p?.retailerProductId || seen.has(p.retailerProductId)) continue;
      seen.add(p.retailerProductId);
      const name = (p.name ?? "").replace(/\s*Producto Alcampo\.?$/i, "").replace(/\.$/, "").trim();
      const unitKey = (p.price?.unit?.label ?? "").replace(/^fop\.price\.per\./, "");
      let cat = catFor(p.categoryPath ?? [], name);
      if (cat === "Otros") cat = guess(name).cat;
      out.push(product({
        name,
        brand: /^producto alcampo$/i.test(p.brand ?? "") ? "Alcampo" : p.brand ?? "",
        format: fmtOf(name),
        price: p.price?.current?.amount,
        unit: p.price?.unit?.current?.amount ? `${eur(p.price.unit.current.amount)} €/${UNITS[unitKey] ?? unitKey}` : "",
        img: p.image?.src ?? "",
        cat,
        rank: out.length,
      }));
    }
    await sleep(2500);
  }
  console.log(`::notice title=Alcampo::${out.length} productos; respuestas ${JSON.stringify(seenStatus)}`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = await fetchAlcampo();
  console.log(`Alcampo: ${items.length} productos`);
  await writeJSON("data/stores/alcampo.json", items);
}
