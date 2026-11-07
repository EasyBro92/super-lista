// Ofertas de la semana de Aldi con su precio (Aldi no vende comida online, pero publica sus folletos).
import { catFor, product, writeJSON, getText, titleCase } from "./lib.mjs";
import { guess } from "../js/parser.js";

const HEADERS = { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Accept-Language": "es-ES,es;q=0.9", Accept: "text/html" };
const eur = (n) => String(Math.round(+n * 100) / 100).replace(".", ",");
const day = (s) => (s ? new Date(s * 1000 + 2 * 36e5).toISOString().slice(0, 10) : "");

export function parseOffers(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return [];
  const api = JSON.parse(JSON.parse(m[1]).props?.pageProps?.apiData ?? "[]");
  const map = api.find((x) => x[0] === "OFFER_GET")?.[1]?.res?.algoliaDataMap ?? {};
  return Object.values(map);
}

export async function fetchAldiOfertas() {
  const out = [];
  const seen = new Set();
  for (const u of ["https://www.aldi.es/ofertas.html", "https://www.aldi.es/ofertas.html?week=next"]) {
    const html = await getText(u, { headers: HEADERS });
    if (!html) continue;
    for (const p of parseOffers(html)) {
      const cp = p.currentPrice ?? {};
      if (!p.name || !(cp.priceValue > 0) || seen.has(p.objectID)) continue;
      seen.add(p.objectID);
      const brand = titleCase((p.brandName ?? "").replace(/®/g, "").trim());
      const name = (brand && !p.name.toLowerCase().includes(brand.toLowerCase()) ? `${p.name} ${brand}` : p.name).replace(/®/g, "");
      const cats = [...(p.hierarchicalCategories?.lvl1 ?? []), ...(p.hierarchicalCategories?.lvl0 ?? [])].join(" ");
      let cat = catFor(name, cats);
      if (cat === "Otros") cat = guess(name).cat;
      const bp = cp.basePrice?.[0];
      const img = (p.assets ?? []).find((a) => a.type === "primary")?.url ?? p.assets?.[0]?.url ?? "";
      out.push(product({
        name, brand, format: p.salesUnit ?? "", price: cp.priceValue,
        unit: bp ? `${eur(bp.basePriceValue)} €/${bp.basePriceScale}` : "",
        img: img ? `${img}?wid=300&hei=300` : "", cat, rank: out.length, id: p.objectID, web: `/producto/${p.productSlug}.html`,
        was: cp.strikePrice?.strikePriceValue ?? null,
        offer: `Folleto${cp.priceTagLabels?.promoText1 ? ` ${cp.priceTagLabels.promoText1}` : ""}`,
        offerTo: day(cp.validUntil),
      }));
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = await fetchAldiOfertas();
  console.log(`Aldi: ${items.length} ofertas`);
  await writeJSON("data/stores/aldi-ofertas.json", items);
}
