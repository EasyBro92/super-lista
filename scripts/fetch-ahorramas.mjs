// Productos y precios de Ahorramas desde el buscador de su tienda online
// (devuelve trozos de HTML con cada producto, su precio y su precio por kilo o litro).
import { sleep, catFor, product, writeJSON, titleCase } from "./lib.mjs";
import { guess } from "../js/parser.js";
import { terminos } from "./terminos.mjs";

const BASE = "https://www.ahorramas.com/on/demandware.store/Sites-Ahorramas-Site/es/Search-UpdateGrid";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" };
const UNITS = { LITRO: "L", KILO: "kg", KG: "kg", UNIDAD: "ud", UD: "ud", DOCENA: "docena", METRO: "m" };
const fmtOf = (s) => s.match(/(\d+\s*x\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|gr|l|ml|cl|ud|uds|unidades)\b/i)?.[0] ?? "";
const ENT = { "&aacute;": "á", "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú", "&ntilde;": "ñ", "&Aacute;": "Á", "&Eacute;": "É",
  "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú", "&Ntilde;": "Ñ", "&uuml;": "ü", "&amp;": "&", "&euro;": "€", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
const dec = (s) => String(s ?? "").replace(/&[a-zA-Z]+;|&#\d+;/g, (m) => ENT[m] ?? m).replace(/\s+/g, " ").trim();

// Cada producto va en un <div class="product" data-pid="…">.
export function parseGrid(html) {
  const out = [];
  for (const part of html.split(/<div class="product" data-pid="/).slice(1)) {
    const pid = part.match(/^([^"]+)"/)?.[1];
    let info = {};
    try { info = JSON.parse(decodeURIComponent(part.match(/data-gtm-layer="([^"]+)"/)?.[1] ?? "")); } catch {}
    const name = dec(part.match(/class="link product-name-gtm"[^>]*>([^<]+)</)?.[1] ?? info.name ?? "");
    const price = +(part.match(/class="sales">\s*<span class="value" content="([\d.]+)"/)?.[1] ?? info.price ?? NaN);
    if (!pid || !name || !(price > 0)) continue;
    const was = +(part.match(/strike-through[^>]*>\s*<span class="value" content="([\d.]+)"/)?.[1] ?? NaN);
    const unitTxt = dec(part.match(/class="unit-price-per-unit grey">([^<]+)</)?.[1] ?? "");
    const um = unitTxt.match(/([\d.,]+)\s*€\s*\/\s*(\w+)/);
    const img = dec(part.match(/class="tile-image"\s+src="([^"]+)"/)?.[1] ?? "").replace(/\?.*$/, "?sw=300&sh=300&sm=fit");
    const promo = dec((part.match(/class="tile-promo-callout">([\s\S]*?)<\/div>/)?.[1] ?? "").replace(/<[^>]+>/g, " "));
    const disc = part.match(/class="marker">([^<]+)</)?.[1]?.trim();
    const brand = titleCase(dec(info.brand ?? part.match(/data-brand="([^"]*)"/)?.[1] ?? ""));
    const web = part.match(/<a href="(\/[^"]+\.html)" class="product-pdp-link/)?.[1] ?? "";
    out.push({ pid, name, price, was, unit: um ? `${um[1]} €/${UNITS[um[2].toUpperCase()] ?? um[2].toLowerCase()}` : "", img, brand,
      cats: [dec(part.match(/data-category1="([^"]*)"/)?.[1]), dec(part.match(/data-category2="([^"]*)"/)?.[1])], web,
      offer: promo || (disc && was > price ? disc : "") });
  }
  return out;
}

async function grid(q, start) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${BASE}?q=${encodeURIComponent(q)}&start=${start}&sz=48`, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
      if (r.status === 404) return "";
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch { await sleep(5000 * (i + 1)); }
  }
  return null;
}

export async function fetchAhorramas() {
  const out = [];
  const seen = new Set();
  let fails = 0;
  for (const t of await terminos()) {
    for (let start = 0; start < 96; start += 48) {
      const html = await grid(t, start);
      if (html == null) { if (++fails > 15) return out; break; }
      fails = 0;
      const items = parseGrid(html);
      for (const p of items) {
        if (seen.has(p.pid)) continue;
        seen.add(p.pid);
        let cat = catFor(p.name, p.cats);
        if (cat === "Otros") cat = guess(p.name).cat;
        out.push(product({ name: p.name, brand: p.brand, format: fmtOf(p.name), price: p.price, unit: p.unit, img: p.img, cat,
          rank: out.length, id: p.pid, web: p.web, was: p.was > p.price ? p.was : null, offer: p.offer }));
      }
      if (items.length < 48) break;
      await sleep(400);
    }
    await sleep(400);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = await fetchAhorramas();
  console.log(`Ahorramas: ${items.length} productos`);
  await writeJSON("data/stores/ahorramas.json", items);
}
