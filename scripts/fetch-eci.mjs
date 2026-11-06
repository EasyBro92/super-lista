// Productos y precios del supermercado de El Corte Inglés, recorriendo las páginas de cada sección
// (cada página trae 24 productos en un JSON dentro del HTML, de más a menos vendidos).
import { sleep, catFor, product, writeJSON, titleCase, jsonObjects, getText, rotate, deadline, keepPrevious } from "./lib.mjs";
import { guess } from "../js/parser.js";

const BASE = "https://www.elcorteingles.es/supermercado/";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Accept-Language": "es-ES,es;q=0.9", Accept: "text/html" };
const SECCIONES = ["frescos", "alimentacion-general", "lacteos", "desayunos-dulces-y-pan", "bebidas", "congelados", "drogueria-y-limpieza",
  "cuidado-personal-y-belleza", "bebes", "mascotas", "nutricion-y-bienestar"];
const MAX_PAGES = Number(process.env.ECI_MAX_PAGES || 45);
const UNITS = { litro: "L", kilo: "kg", kilogramo: "kg", unidad: "ud", docena: "docena", metro: "m" };
const num = (s) => +String(s ?? "").replace(/\./g, "").replace(",", ".");

// «leche entera brik 1 l - El Corte Ingles» → «Leche entera brik 1 l El Corte Inglés»
function fixName(d, brand) {
  let [n, b] = String(d).split(/\s+-\s+(?=[^-]+$)/);
  n = n.charAt(0).toUpperCase() + n.slice(1);
  b = b ?? brand;
  if (b && !n.toLowerCase().includes(b.toLowerCase())) n = `${n} ${b}`;
  return n.replace(/\bEl Corte Ingles\b/g, "El Corte Inglés");
}

export function parsePage(html) {
  return jsonObjects(html, /\{"id":"[A-Z]?\d{6,}","id_atg"/).filter((p) => p.priceSpecification && p.description);
}

export async function fetchEci() {
  const out = [];
  const seen = new Set();
  let fails = 0;
  const late = deadline(16);
  // Cada noche se empieza por otra sección y se acaba cuando se agota el tiempo.
  for (const s of rotate(SECCIONES, 3)) {
    for (let page = 1; page <= MAX_PAGES && !late(); page++) {
      const html = await getText(`${BASE}${s}/${page > 1 ? `${page}/` : ""}`, { headers: HEADERS });
      if (html == null) { if (++fails > 6) return keepPrevious("elcorteingles", out); break; }
      fails = 0;
      const items = parsePage(html);
      if (!items.length) break;
      for (const p of items) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const ps = p.priceSpecification;
        const brand = titleCase(p.brand?.name ?? "").replace(/^El Corte Ingles$/, "El Corte Inglés");
        const name = fixName(p.description, brand);
        const cats = [];
        for (let c = p.categories?.at(-1); c; c = c.parent_category) cats.unshift(c.name);
        let cat = catFor(name, cats);
        if (cat === "Otros") cat = guess(name).cat;
        const per = UNITS[(ps.pum_description ?? p.pum ?? "").toLowerCase()] ?? (ps.pum_description ?? "").toLowerCase();
        const promo = (p.promotional_actions ?? [])[0];
        out.push(product({
          name, brand, format: p.presentation_detail_quantity ?? "", price: num(ps.salePrice ?? ps.price),
          unit: ps.measurementUnitPrice && per ? `${ps.measurementUnitPrice} €/${per}` : "",
          img: p.image ?? "", cat, rank: out.length, id: p.id, web: p.url ?? "",
          was: num(ps.price) > num(ps.salePrice) ? num(ps.price) : null,
          offer: promo ? String(promo.name ?? promo.description ?? promo.title ?? "Oferta").slice(0, 40) : "",
        }));
      }
      if (!/"path_next":"/.test(html)) break;
      await sleep(500);
    }
  }
  return keepPrevious("elcorteingles", out);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = await fetchEci();
  console.log(`El Corte Inglés: ${items.length} productos`);
  await writeJSON("data/stores/elcorteingles.json", items);
}
