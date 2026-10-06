// Descarga el catálogo público de la tienda online de Mercadona (productos, fotos y precios).
import { getJSON, sleep, catFor, product, writeJSON } from "./lib.mjs";

const BASE = "https://tienda.mercadona.es/api";
const WH = process.env.MERCADONA_WH || "mad1"; // almacén: cambia precios y surtido según la zona

export async function fetchMercadona() {
  const top = await getJSON(`${BASE}/categories/?lang=es&wh=${WH}`);
  const out = [];
  const seen = new Set();
  for (const group of top.results ?? []) {
    for (const sub of group.categories ?? []) {
      let detail;
      try {
        detail = await getJSON(`${BASE}/categories/${sub.id}/?lang=es&wh=${WH}`);
      } catch (e) {
        console.warn(`Mercadona: salto la categoría ${sub.name}: ${e.message}`);
        continue;
      }
      const sections = detail.categories?.length ? detail.categories : [detail];
      for (const sec of sections) {
        for (const p of sec.products ?? []) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          const pi = p.price_instructions ?? {};
          const fmt = [p.packaging, pi.unit_size && pi.size_format ? `${pi.unit_size} ${pi.size_format}` : ""]
            .filter(Boolean).join(" ");
          out.push(product({
            name: p.display_name,
            format: fmt,
            price: pi.unit_price ?? pi.bulk_price,
            unit: pi.bulk_price && pi.reference_format ? `${String(pi.bulk_price).replace(".", ",")} €/${pi.reference_format}` : "",
            img: p.thumbnail,
            cat: catFor(group.name, sub.name, sec.name),
            rank: out.length,
          }));
        }
      }
      await sleep(300);
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = await fetchMercadona();
  console.log(`Mercadona: ${items.length} productos`);
  await writeJSON("data/stores/mercadona.json", items);
}
