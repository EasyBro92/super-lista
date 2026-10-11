// Catálogo completo de la tienda online de Consum, con precios (su web lo sirve en páginas de 100).
import { getJSON, sleep, catFor, product, writeJSON, titleCase, norm } from "./lib.mjs";
import { guess } from "../js/parser.js";

const BASE = "https://tienda.consum.es/api/rest/V1.0/catalog/product";
const eur = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

export async function fetchConsum() {
  const out = [];
  const seen = new Set();
  for (let offset = 0; ; offset += 100) {
    const d = await getJSON(`${BASE}?limit=100&offset=${offset}&orderById=5&showRecommendations=false`);
    for (const p of d.products ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const pd = p.productData ?? {};
      const prices = (p.priceData?.prices ?? []).map((x) => x.value).filter(Boolean);
      const best = prices.sort((a, b) => a.centAmount - b.centAmount)[0];
      const per = (p.priceData?.unitPriceUnitType ?? "").replace(/^1\s*/, "");
      const brand = titleCase(pd.brand?.name ?? "");
      // Consum no pone la marca en el nombre: se añade al final, como en Mercadona («Leche semidesnatada Pascual»).
      const name = brand && !norm(pd.name).includes(norm(brand)) ? `${pd.name} ${brand}` : pd.name ?? "";
      let cat = catFor(name, (p.categories ?? []).map((c) => c.name));
      if (cat === "Otros") cat = guess(name).cat;
      out.push(product({
        name,
        brand,
        format: (pd.description ?? "").replace(pd.name ?? "", "").trim(),
        price: best?.centAmount,
        unit: best?.centUnitAmount && per ? `${eur(best.centUnitAmount)} €/${per}` : "",
        img: pd.imageURL ?? "",
        cat,
        ean: p.ean ?? "",
        rank: out.length,
      }));
    }
    if (!d.hasMore || !d.products?.length) break;
    await sleep(350);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = await fetchConsum();
  console.log(`Consum: ${items.length} productos`);
  await writeJSON("data/stores/consum.json", items);
}
