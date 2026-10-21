// Ficha de cada producto, como en la tienda online de cada súper: fotos, oferta, ingredientes, alérgenos,
// información nutricional, Nutri-Score, gráfico del precio y enlace a la web del súper.
// Los datos salen de la ficha de Mercadona (descargada cada noche), de la web de Dia y de Open Food Facts.
import { norm, tokens } from "./parser.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = (n) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const num = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("es-ES");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fecha = (d) => { const [, m, dd] = d.split("-"); return `${+dd} ${MESES[+m - 1]}`; };

// ---------- Enlace a la web del súper ----------
const SEARCH = {
  mercadona: "https://tienda.mercadona.es/search-results?query=", dia: "https://www.dia.es/search?q=",
  alcampo: "https://www.compraonline.alcampo.es/search?q=", consum: "https://tienda.consum.es/es/s/",
  carrefour: "https://www.carrefour.es/?q=", eroski: "https://supermercado.eroski.es/es/search/results/?q=",
  elcorteingles: "https://www.elcorteingles.es/supermercado/buscar/?term=", lidl: "https://www.lidl.es/q/search?q=",
  aldi: "https://www.aldi.es/busqueda.html?query=",
};
// Lidl y Aldi no venden comida por internet: su web solo informa.
export const SELLS_ONLINE = new Set(["mercadona", "dia", "alcampo", "consum", "carrefour", "eroski", "elcorteingles"]);
export function webUrl(p) {
  if (!p?.s) return "";
  if (p.s === "mercadona" && p.id) return `https://tienda.mercadona.es/product/${encodeURIComponent(p.id)}`;
  if (p.s === "dia" && p.w) return `https://www.dia.es${p.w}`;
  if (p.s === "alcampo" && p.id) return `https://www.compraonline.alcampo.es/products/${encodeURIComponent(p.id)}`;
  if (p.s === "consum" && p.id) return `https://tienda.consum.es/es/p/x/${encodeURIComponent(p.id)}`;
  const base = SEARCH[p.s];
  if (!base) return "";
  // Para buscar vale el nombre sin el formato ni símbolos raros.
  const q = String(p.n).replace(/[^\p{L}\p{N}\s%-]/gu, " ").replace(/\s+/g, " ").trim();
  return base + encodeURIComponent(q);
}

// ---------- Ofertas ----------
// Etiqueta corta para la esquina de la foto: «2ª -50%», «3x2», «-6%», «Nuevo».
export function offerTag(p) {
  if (!p) return "";
  const o = p.o ?? "";
  if (o && o !== "Ha bajado") {
    const m = o.match(/(\d+)\s*[ªa]\s*(?:unidad|ud\.?)?\s*(?:al\s*)?-?\s*(\d+)\s*%/i);
    if (m) return `${m[1]}ª -${m[2]}%`;
    const x = o.match(/\b(\d+)\s*x\s*(\d+)\b/i);
    if (x) return `${x[1]}x${x[2]}`;
    const pc = o.match(/-\s*(\d+)\s*%/);
    if (pc) return `-${pc[1]}%`;
  }
  if (p.pt != null && p.p != null && p.pt > p.p) return `-${Math.round((1 - p.p / p.pt) * 100)}%`;
  if (o && o !== "Ha bajado") return "Oferta";
  return "";
}
export function offerHTML(p) {
  const t = offerTag(p);
  if (t) return `<span class="offer" title="${esc(p.o || "Oferta")}">${esc(t)}</span>`;
  if (p?.nw) return `<span class="offer new">Nuevo</span>`;
  return "";
}
const hasta = (p) => (p.ot ? ` · hasta el ${fecha(p.ot)}` : "");

// ---------- Filtros por dieta y orden ----------
// Se fían del nombre del producto (así lo ponen los súpers: «sin gluten», «0% lactosa», «ecológico»…).
export const DIETS = [
  ["Sin gluten", /\bsin gluten\b|\bgluten free\b/],
  ["Sin lactosa", /\bsin lactosa\b|\b0\s?% lactosa\b|\blactose free\b/],
  ["Vegano", /\bvegan[oa]?s?\b|\bbebida (vegetal|de (avena|soja|almendras?|arroz|coco))\b|\btofu\b|\bseitan\b|\bplant based\b/],
  ["Ecológico", /\becologic[oa]s?\b|\bbio\b|\borganic\b|\beco\b/],
  ["Sin azúcar", /\bsin azucar(es)?( anadidos?)?\b|\b0\s?% azucar(es)?\b|\bzero\b/],
];
export const dietOk = (p, d) => { const re = DIETS.find(([n]) => n === d)?.[1]; return !re || re.test(norm(`${p.n} ${p.b ?? ""}`)); };
// «16,23 €/kg» → { v: 16.23, u: "kg" }. Litros y kilos se comparan juntos.
export function unitPrice(p) {
  const m = String(p?.u ?? "").match(/([\d.,]+)\s*€\s*\/\s*(\d*\s*\w+)/);
  if (!m) return null;
  let v = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  let u = m[2].replace(/\s/g, "").toLowerCase();
  if (u === "100g" || u === "100ml") { v *= 10; u = u === "100g" ? "kg" : "l"; }
  if (u === "g") { v *= 1000; u = "kg"; } if (u === "ml") { v *= 1000; u = "l"; }
  return Number.isFinite(v) ? { v, u } : null;
}
export const SORTS = [["rel", "Más parecido"], ["price", "Más barato"], ["unit", "Mejor € por kg o L"]];
export function sortProducts(list, how) {
  if (how === "price") return [...list].sort((a, b) => (a.p ?? 1e9) - (b.p ?? 1e9));
  if (how === "unit") {
    const w = (p) => { const u = unitPrice(p); return u ? u.v + (/^(kg|l)$/.test(u.u) ? 0 : 1e6) : 1e9; };
    return [...list].sort((a, b) => w(a) - w(b));
  }
  return list;
}
export function filterBarHTML(state) {
  return `<div class="fbar" role="group" aria-label="Ordenar y filtrar">
    ${SORTS.map(([k, n]) => `<button type="button" class="chip sm" data-sort="${k}" aria-pressed="${state.sort === k}">${esc(n)}</button>`).join("")}
    <span class="fsep" aria-hidden="true"></span>
    ${DIETS.map(([n]) => `<button type="button" class="chip sm" data-diet="${esc(n)}" aria-pressed="${state.diets.has(n)}">${esc(n)}</button>`).join("")}
  </div>`;
}
// Aplica los botones de la barra: devuelve true si ha cambiado algo.
export function filterBarClick(e, state) {
  const s = e.target.closest("[data-sort]"), d = e.target.closest("[data-diet]");
  if (s) { state.sort = s.dataset.sort; return true; }
  if (d) { const n = d.dataset.diet; if (state.diets.has(n)) state.diets.delete(n); else state.diets.add(n); return true; }
  return false;
}
export const applyFilters = (list, state) => sortProducts(list.filter((p) => [...state.diets].every((d) => dietOk(p, d))), state.sort);

// ---------- Datos de la ficha ----------
const SHARDS = 16;
// Igual que en scripts/fetch-fichas.mjs.
export const shardOf = (id) => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7) % SHARDS;
const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const shards = new Map();
const mercShard = (k) => { if (!shards.has(k)) shards.set(k, getJSON(`data/fichas/mercadona/${k}.json`)); return shards.get(k); };
const hist = new Map();
const histFor = (s) => { if (!hist.has(s)) hist.set(s, getJSON(`data/precios/${s}.json`)); return hist.get(s); };

const ALLERGENS = {
  gluten: "gluten", milk: "leche", eggs: "huevo", nuts: "frutos de cáscara", peanuts: "cacahuetes", soybeans: "soja",
  fish: "pescado", crustaceans: "crustáceos", molluscs: "moluscos", celery: "apio", mustard: "mostaza",
  "sesame-seeds": "sésamo", "sulphur-dioxide-and-sulphites": "sulfitos", lupin: "altramuces",
};
const tagName = (t) => { const k = String(t).replace(/^\w\w:/, ""); return ALLERGENS[k] ?? k.replace(/-/g, " "); };
const LABELS = [
  [/gluten-free|sin-gluten/, "Sin gluten"], [/lactose-free|no-lactose|sin-lactosa/, "Sin lactosa"], [/^en:vegan$|vegano/, "Vegano"],
  [/^en:vegetarian$|vegetariano/, "Vegetariano"], [/organic|ecologico/, "Ecológico"], [/no-added-sugar|sin-azucar/, "Sin azúcar añadido"],
];
const clean = (h) => String(h ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function fromOff(ean) {
  const f = "product_name,ingredients_text_es,ingredients_text,allergens_tags,traces_tags,nutriments,nutriscore_grade,nova_group,labels_tags,image_front_url,image_ingredients_url,image_nutrition_url,origins,nutrition_data_per";
  const d = await getJSON(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=${f}`);
  const p = d?.status === 1 ? d.product : null;
  if (!p) return null;
  const n = p.nutriments ?? {};
  const v = (k) => n[`${k}_100g`] ?? n[`${k}_prepared_100g`];
  const nut = { kcal: v("energy-kcal"), fat: v("fat"), sat: v("saturated-fat"), carbs: v("carbohydrates"), sugar: v("sugars"), fiber: v("fiber"), prot: v("proteins"), salt: v("salt") };
  return {
    ing: p.ingredients_text_es || "",
    alg: (p.allergens_tags ?? []).map(tagName), traces: (p.traces_tags ?? []).map(tagName),
    nut: nut.kcal != null || nut.fat != null ? nut : null, per: n["energy-kcal_prepared_100g"] != null && n["energy-kcal_100g"] == null ? "100 ml" : "100 g",
    ns: /^[a-e]$/.test(p.nutriscore_grade ?? "") ? p.nutriscore_grade.toUpperCase() : "",
    nova: p.nova_group, labels: [...new Set((p.labels_tags ?? []).flatMap((t) => LABELS.filter(([re]) => re.test(t)).map(([, n]) => n)))],
    photos: [p.image_front_url, p.image_ingredients_url, p.image_nutrition_url].filter(Boolean),
    origin: p.origins || "",
  };
}
async function fromDia(id) {
  const d = await getJSON(`https://www.dia.es/api/v1/pdp-back/reduced/${encodeURIComponent(id)}`);
  const p = d?.product;
  if (!p) return null;
  const nv = p.nutritional_info?.nutritional_values;
  const find = (re, list = nv?.values ?? []) => list.find((x) => re.test(norm(x.title)));
  const sub = (re1, re2) => find(re2, find(re1)?.items ?? [])?.value_per_100_g;
  const nut = nv ? { kcal: nv.energy_value, fat: find(/grasa/)?.value_per_100_g, sat: sub(/grasa/, /saturad/), carbs: find(/hidrato/)?.value_per_100_g,
    sugar: sub(/hidrato/, /azucar/), fiber: find(/fibra/)?.value_per_100_g, prot: find(/proteina/)?.value_per_100_g, salt: find(/^sal/)?.value_per_100_g } : null;
  const ingHtml = p.ingredients?.text ?? "";
  return {
    ing: clean(ingHtml).replace(/^ingredientes:?\s*/i, ""),
    alg: [...new Set([...ingHtml.matchAll(/<strong>([^<]+)<\/strong>/gi)].map((m) => clean(m[1]).toLowerCase().replace(/[.,:;]+$/, "")).filter((t) => t.length > 2))],
    nut, per: `${p.nutritional_info?.nutri_size?.value ?? 100} ${p.nutritional_info?.nutri_measurement_unit?.value === "ml" ? "ml" : "g"}`,
    storage: clean(p.instructions?.storage_instructions?.text), usage: clean(p.instructions?.instructions_for_preparation?.text),
    maker: clean(p.manufacturer_contact?.manufacturer_contact_name), info: (p.info_labels ?? []).map(clean).filter(Boolean),
    photos: (p.images ?? []).map((u) => `https://www.dia.es${u}`),
  };
}
async function fromMercadona(id) {
  const s = await mercShard(shardOf(id));
  const f = s?.[id];
  if (!f) return null;
  return {
    ean: f.e, ing: f.i ?? "", alg: f.a ?? [], algText: f.at ?? "", origin: f.o ?? "", storage: f.k ?? "", usage: f.m ?? "", extra: f.x ?? "",
    photos: (f.ph ?? []).map((h) => `https://prod-mercadona.imgix.net/images/${h}.jpg?fit=crop&h=800&w=800`),
  };
}

// Junta lo que da la tienda con Open Food Facts (Nutri-Score y nutrición). Lo de la tienda manda.
const cache = new Map();
export function fichaData(p) {
  const key = `${p.s}|${p.id ?? ""}|${p.e ?? ""}|${p.n}`;
  if (!cache.has(key)) cache.set(key, (async () => {
    const shop = p.s === "mercadona" && p.id ? await fromMercadona(p.id) : p.s === "dia" && p.id ? await fromDia(p.id) : null;
    const ean = p.e || shop?.ean;
    const off = ean ? await fromOff(ean) : null;
    const d = { ...(off ?? {}) };
    for (const [k, v] of Object.entries(shop ?? {})) if (v && (!Array.isArray(v) || v.length)) d[k] = v;
    if (shop?.nut && off?.nut) d.nut = { ...off.nut, ...Object.fromEntries(Object.entries(shop.nut).filter(([, v]) => v != null)) };
    if (off?.ns) d.ns = off.ns;
    d.src = [shop ? `la web de ${p.s === "dia" ? "Dia" : "Mercadona"}` : "", off ? "Open Food Facts" : ""].filter(Boolean);
    return d;
  })());
  return cache.get(key);
}
export async function priceHistory(p) {
  const h = await histFor(p.s);
  if (!h?.desde) return null;
  return { desde: h.desde, pts: h.h?.[`${p.n}|${p.f ?? ""}`] ?? null };
}

// ---------- Trozos de la ficha ----------
export function nutriScoreHTML(g) {
  if (!g) return "";
  return `<span class="nscore" role="img" aria-label="Nutri-Score ${g}"><span class="ns-t">NUTRI-SCORE</span>${"ABCDE".split("").map((l) => `<span class="ns-${l.toLowerCase()}${l === g ? " on" : ""}">${l}</span>`).join("")}</span>`;
}
const NUT_ROWS = [["kcal", "Valor energético", "kcal"], ["fat", "Grasas", "g"], ["sat", "de las cuales saturadas", "g", 1], ["carbs", "Hidratos de carbono", "g"],
  ["sugar", "de los cuales azúcares", "g", 1], ["fiber", "Fibra", "g"], ["prot", "Proteínas", "g"], ["salt", "Sal", "g"]];
// Semáforo como en los envases (por 100 g, criterios de la FSA británica).
const LIGHTS = { fat: [3, 17.5], sat: [1.5, 5], sugar: [5, 22.5], salt: [0.3, 1.5] };
const light = (k, v) => { const l = LIGHTS[k]; return !l || v == null ? "" : v <= l[0] ? "lo" : v > l[1] ? "hi" : "mid"; };
export function nutritionHTML(nut, per) {
  if (!nut) return "";
  const rows = NUT_ROWS.filter(([k]) => nut[k] != null && Number.isFinite(+nut[k]));
  if (!rows.length) return "";
  return `<table class="ntab"><caption>Por ${esc(per || "100 g")}</caption>${rows.map(([k, n, u, sub]) =>
    `<tr class="${sub ? "sub" : ""}"><th scope="row">${esc(n)}</th><td><span class="nl ${light(k, +nut[k])}"></span>${num(+nut[k], k === "kcal" ? 0 : 1)} ${u}</td></tr>`).join("")}</table>`;
}
// Gráfico del precio: escalones (el precio se mantiene hasta que cambia) hasta hoy.
export function priceChartHTML(ph, p, today = new Date().toISOString().slice(0, 10)) {
  if (!ph || p.p == null) return "";
  const pts = ph.pts?.length ? ph.pts.map(([d, v]) => [d, v]) : [[ph.desde, p.p]];
  if (pts[pts.length - 1][0] < today) pts.push([today, pts[pts.length - 1][1]]);
  const vals = pts.map((x) => x[1]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  if (pts.length <= 2 && lo === hi) return `<p class="note">Cuesta ${eur(p.p)} desde el ${fecha(ph.desde)}, cuando empezamos a apuntar los precios.</p>`;
  const t0 = Date.parse(pts[0][0]), t1 = Math.max(Date.parse(today), t0 + 864e5);
  const W = 320, H = 120, L = 6, R = 52, T = 12, B = 22;
  const x = (d) => L + (Date.parse(d) - t0) / (t1 - t0) * (W - L - R);
  const pad = (hi - lo) * 0.25 || hi * 0.05;
  const y = (v) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  let d = `M${x(pts[0][0]).toFixed(1)},${y(pts[0][1]).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` H${x(pts[i][0]).toFixed(1)} V${y(pts[i][1]).toFixed(1)}`;
  const area = `${d} V${H - B} H${x(pts[0][0]).toFixed(1)} Z`;
  const last = pts[pts.length - 1];
  const first = pts[0][1];
  const diff = last[1] - first;
  const txt = Math.abs(diff) < 0.005 ? `Igual que el ${fecha(pts[0][0])}` : `${diff < 0 ? "⬇ " : "⬆ "}${eur(Math.abs(diff))} desde el ${fecha(pts[0][0])}`;
  return `<figure class="pchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Precio entre el ${fecha(pts[0][0])} y hoy: de ${eur(first)} a ${eur(last[1])}">
    <path d="${area}" class="pc-area"/><path d="${d}" class="pc-line"/>
    <line x1="${L}" x2="${W - R}" y1="${y(hi).toFixed(1)}" y2="${y(hi).toFixed(1)}" class="pc-grid"/><line x1="${L}" x2="${W - R}" y1="${y(lo).toFixed(1)}" y2="${y(lo).toFixed(1)}" class="pc-grid"/>
    <text x="${W - R + 6}" y="${(y(hi) + 4).toFixed(1)}" class="pc-t">${esc(eur(hi))}</text>${hi !== lo ? `<text x="${W - R + 6}" y="${(y(lo) + 4).toFixed(1)}" class="pc-t">${esc(eur(lo))}</text>` : ""}
    <circle cx="${x(last[0]).toFixed(1)}" cy="${y(last[1]).toFixed(1)}" r="4" class="pc-dot"/>
    <text x="${L}" y="${H - 6}" class="pc-t">${esc(fecha(pts[0][0]))}</text><text x="${W - R}" y="${H - 6}" class="pc-t" text-anchor="end">hoy</text>
  </svg><figcaption class="${diff < -0.004 ? "down" : diff > 0.004 ? "up" : ""}">${esc(txt)} · más barato: ${esc(eur(lo))}, más caro: ${esc(eur(hi))}</figcaption></figure>`;
}

// Secciones de la ficha (sin las fotos ni el menú, que pone app.js).
export function fichaSections(p, d, ph) {
  const sec = [];
  const tags = [...new Set([...(d.labels ?? []), ...DIETS.filter(([n]) => dietOk(p, n)).map(([n]) => n)])];
  const top = [nutriScoreHTML(d.ns), tags.map((t) => `<span class="ftag">${esc(t)}</span>`).join("")].join("");
  if (top.trim()) sec.push(["Resumen", `<div class="ftop">${top}</div>`]);
  if (d.ing || d.alg?.length || d.algText || d.traces?.length) {
    sec.push(["Ingredientes", `${d.ing ? `<p class="fing">${esc(d.ing)}</p>` : ""}
      ${d.alg?.length ? `<p class="falg"><b>Alérgenos:</b> ${d.alg.map((a) => `<span class="achip">${esc(a)}</span>`).join("")}</p>` : ""}
      ${d.algText ? `<p class="note">${esc(d.algText)}</p>` : ""}
      ${d.traces?.length ? `<p class="note">Puede contener trazas de: ${esc(d.traces.join(", "))}.</p>` : ""}`]);
  }
  const nt = nutritionHTML(d.nut, d.per);
  if (nt || d.nova) sec.push(["Nutrición", `${nt}${d.nova ? `<p class="note">Procesado: ${["", "sin procesar o poco", "ingrediente culinario", "procesado", "ultraprocesado"][d.nova] ?? ""} (NOVA ${d.nova}).</p>` : ""}`]);
  const chart = priceChartHTML(ph, p);
  if (chart) sec.push(["Precio", chart]);
  const more = [["Origen", d.origin], ["Conservación", d.storage], ["Modo de empleo", d.usage], ["Fabricante", d.maker], ["Más información", [...(d.info ?? []), d.extra].filter(Boolean).join(" · ")]].filter(([, v]) => v);
  if (more.length) sec.push(["Más datos", `<dl class="fdl">${more.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`]);
  return sec;
}
export function offerLineHTML(p) {
  const t = offerTag(p);
  if (!t && !p.nw && !(p.o === "Ha bajado")) return "";
  const parts = [];
  if (p.o && p.o !== "Ha bajado") parts.push(`<b>${esc(p.o)}</b>${esc(hasta(p))}`);
  else if (p.pt != null) parts.push(`<b>Rebajado</b>`);
  if (p.pt != null) parts.push(`antes <s>${esc(eur(p.pt))}</s>`);
  if (p.nw) parts.push("Novedad");
  return `<p class="foffer">${offerHTML(p)} ${parts.join(" · ")}</p>`;
}

// ---------- «Hay uno más barato» ----------
// Busca el mismo tipo de producto (sin la marca) en los catálogos con precio y se queda con los que salen
// más baratos por kilo o litro (o por unidad si no hay precio por kilo). Si el producto no tiene precio
// (p. ej. escaneado), enseña dónde se encuentra más barato.
export function cheaperAlts(p, catalog, searchFn, n = 3) {
  if (!p?.n) return [];
  // Sin marca conocida (Mercadona), la marca son las palabras en mayúscula del final: «Leche semidesnatada Asturiana».
  let bname = p.b ?? "";
  if (!bname) { const w = String(p.n).split(/\s+/); const tail = []; while (w.length > 2 && /^\p{Lu}/u.test(w[w.length - 1])) tail.unshift(w.pop()); bname = tail.join(" "); }
  const brand = new Set(tokens(bname));
  const PACK = /^(brik|brick|botella|lata|pack|paquete|bolsa|garrafa|tarro|bote|caja|bandeja|malla|unidad|ud|uds|formato|envase|tetrabrik)$/;
  const qt = tokens(p.n).filter((t) => !brand.has(t) && !/^\d/.test(t) && !PACK.test(t)).slice(0, 3);
  if (!qt.length) return [];
  const same = (x) => x.s === p.s && x.n === p.n && (x.f ?? "") === (p.f ?? "");
  // Tiene que llevar todas las palabras (para no cambiar semidesnatada por desnatada).
  const all = (x) => qt.every((q) => (x._t ?? tokens(x.n)).some((t) => t === q || (q.length >= 4 && t.startsWith(q))));
  const cands = searchFn(catalog, qt.join(" "), 80).filter((x) => x.p != null && !same(x) && all(x) && (!p.c || p.c === "Otros" || x.c === p.c)).slice(0, 30);
  const mine = unitPrice(p);
  const out = [];
  for (const x of cands) {
    const ux = unitPrice(x);
    let save = null, per = "";
    if (mine && ux && ux.u === mine.u) { save = 1 - ux.v / mine.v; per = ux.u === "kg" ? "kg" : ux.u === "l" ? "litro" : "unidad"; }
    else if (p.p != null && x.f && p.f && norm(x.f) === norm(p.f)) { save = 1 - x.p / p.p; per = "envase"; }
    else if (p.p == null) { save = 0; per = ""; }
    if (save == null || (p.p != null && save < 0.05)) continue;
    out.push({ x, save, per, uv: ux?.v ?? x.p });
  }
  if (p.p == null) out.sort((a, b) => a.uv - b.uv); else out.sort((a, b) => b.save - a.save);
  // Uno por súper como mucho dos, para que no salgan tres casi iguales del mismo sitio.
  const per = {}, res = [];
  for (const o of out) { per[o.x.s] = (per[o.x.s] ?? 0) + 1; if (per[o.x.s] <= 2) res.push(o); if (res.length >= n) break; }
  return res;
}
