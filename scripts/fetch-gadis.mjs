// Productos y precios de Gadis (Galicia y Castilla y León) desde las secciones de su tienda online.
// Cada sección trae en __NEXT_DATA__ sus primeros 50 productos: se recorren las secciones pequeñas para tener casi todo.
import { sleep, catFor, product, writeJSON, titleCase, getText } from "./lib.mjs";
import { guess } from "../js/parser.js";

const BASE = "https://www.gadisline.com";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Accept-Language": "es-ES,es;q=0.9", Accept: "text/html" };
const TOP = ["frescos", "alimentacion", "lacteos", "bodega-y-bebidas", "congelado", "limpieza", "higiene-y-belleza", "bebes-y-ninos", "mascotas", "hogar"];
const es = (a) => (a ?? []).find((x) => x.language === "ES")?.value ?? a?.[0]?.value ?? "";
const fmtOf = (s) => s.match(/(\d+\s*x\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|gr|l|ml|cl|ud|uds|unidades)\b/i)?.[0] ?? "";
const eur = (n) => String(Math.round(+n * 100) / 100).replace(".", ",");

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
}
// Busca dentro del JSON las listas de productos (las que tienen «elements» con «price»).
function lists(o, acc = []) {
  if (Array.isArray(o)) o.forEach((x) => lists(x, acc));
  else if (o && typeof o === "object") {
    if (Array.isArray(o.elements) && o.elements[0]?.price != null && o.elements[0]?.commercial_description) acc.push(...o.elements);
    for (const v of Object.values(o)) lists(v, acc);
  }
  return acc;
}

export function parsePage(html) {
  const d = nextData(html);
  return d ? lists(d) : [];
}
export const sectionsOf = (html) => [...new Set([...html.matchAll(/"(\/[a-z0-9-]+(?:\/[a-z0-9-]+)+)"/g)].map((m) => m[1]))]
  .filter((p) => TOP.includes(p.split("/")[1]));

export async function fetchGadis() {
  const out = [];
  const seen = new Set();
  const home = await getText(`${BASE}/lacteos`, { headers: HEADERS });
  if (!home) throw new Error("no responde");
  const secs = sectionsOf(home);
  let fails = 0;
  const all = [...TOP.map((t) => `/${t}`), ...secs].slice(0, Number(process.env.GADIS_MAX) || undefined);
  console.log(`Gadis: ${all.length} secciones`);
  for (const s of all) {
    const html = await getText(BASE + s, { headers: HEADERS });
    if (html == null) { if (++fails > 8) break; continue; }
    fails = 0;
    for (const p of parsePage(html)) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      let name = es(p.commercial_description).replace(/\s+/g, " ").trim();
      const brand = titleCase(p.brand_description ?? "");
      if (p.brand_description) name = name.replace(p.brand_description, brand);
      const cats = (p.categories ?? []).map((c) => es(c.descriptions_translate));
      let cat = catFor(name, cats);
      if (cat === "Otros") cat = guess(name).cat;
      const suf = es(p.price_kilo_litre_suffix).replace(/^el\s+/, "");
      const per = { litro: "L", kilo: "kg", unidad: "ud", docena: "docena" }[suf] ?? suf;
      const of = (p.offers ?? [])[0];
      const was = of ? +(of.previous_price ?? of.original_price ?? of.price_before ?? NaN) : NaN;
      out.push(product({
        name, brand, format: fmtOf(name), price: p.price,
        unit: p.price_kilo_litre && per ? `${eur(p.price_kilo_litre)} €/${per}` : "",
        img: p.image?.image_thumbnails ?? p.image?.image ?? "", cat, rank: out.length, id: p.product_code, web: p.slug ?? "",
        was: was > p.price ? was : null,
        offer: of ? String(es(of.description) || of.title || "Oferta").slice(0, 40) : "",
        offerTo: of?.end_date ?? "",
      }));
    }
    await sleep(600);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = await fetchGadis();
  console.log(`Gadis: ${items.length} productos`);
  await writeJSON("data/stores/gadis.json", items);
}
