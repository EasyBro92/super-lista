// Fichas de los productos de Mercadona (ingredientes, alérgenos, origen, conservación, fotos y código de barras).
// Su web no deja leerlas desde otra página, así que se descargan aquí poco a poco y se guardan en
// data/fichas/mercadona/<0-15>.json, repartidas por el número de producto para que el móvil baje solo un trozo.
import { readFile } from "node:fs/promises";
import { getJSON, sleep, writeJSON } from "./lib.mjs";

const BASE = "https://tienda.mercadona.es/api/products";
const WH = process.env.MERCADONA_WH || "mad1";
export const SHARDS = 16;
export const shardOf = (id) => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7) % SHARDS;
const NUEVAS = Number(process.env.FICHAS_NUEVAS || 1500); // fichas nuevas por noche
const REPASO = Number(process.env.FICHAS_REPASO || 200); // fichas viejas que se vuelven a mirar

const text = (h) => String(h ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
// Los alérgenos van en negrita dentro de los ingredientes («<strong>Leche</strong> semidesnatada»).
function allergens(ni) {
  const set = new Set();
  for (const m of String(ni?.ingredients ?? "").matchAll(/<(?:strong|b)>([^<]+)<\/(?:strong|b)>/gi)) {
    const t = text(m[1]).replace(/[.,:;()]+/g, "").trim().toLowerCase();
    if (t.length > 2 && t.length < 40 && !/^ingredientes?$/.test(t)) set.add(t);
  }
  return [...set];
}
// Texto aparte de alérgenos y trazas («Puede contener trazas de frutos de cáscara»), sin códigos internos («x99»).
const allergenText = (ni) => text(ni?.allergens).replace(/\bx\d+\b/gi, "").replace(/^[\s.,:;-]+|[\s.,:;-]+$/g, "");

export function compact(d) {
  const det = d.details ?? {};
  const o = { t: new Date().toISOString().slice(0, 10) };
  if (d.ean) o.e = d.ean;
  const ing = text(d.nutrition_information?.ingredients).replace(/^ingredientes:?\s*/i, "");
  if (ing) o.i = ing;
  const al = allergens(d.nutrition_information);
  if (al.length) o.a = al;
  const at = allergenText(d.nutrition_information);
  if (at.length > 3) o.at = at;
  if (d.origin || det.origin) o.o = d.origin || det.origin;
  if (text(det.storage_instructions)) o.k = text(det.storage_instructions);
  if (text(det.usage_instructions)) o.m = text(det.usage_instructions);
  if (text(det.mandatory_mentions)) o.x = text(det.mandatory_mentions);
  const ph = (d.photos ?? []).map((p) => String(p.regular ?? "").match(/images\/([0-9a-f]+)\.jpg/)?.[1]).filter(Boolean);
  if (ph.length) o.ph = ph;
  return o;
}

export async function fetchFichas() {
  const items = JSON.parse(await readFile("data/stores/mercadona.json", "utf8"));
  const ids = [...new Set(items.map((p) => p.id).filter(Boolean))];
  const shards = await Promise.all(Array.from({ length: SHARDS }, (_, k) => readFile(`data/fichas/mercadona/${k}.json`, "utf8").then(JSON.parse).catch(() => ({}))));
  const all = Object.assign({}, ...shards);
  const live = new Set(ids);
  const nuevas = ids.filter((id) => !all[id]).slice(0, NUEVAS);
  const viejas = Object.keys(all).filter((id) => live.has(id)).sort((a, b) => all[a].t.localeCompare(all[b].t)).slice(0, REPASO);
  let ok = 0, fallos = 0;
  for (const id of [...nuevas, ...viejas]) {
    try { all[id] = compact(await getJSON(`${BASE}/${id}/?lang=es&wh=${WH}`, { tries: 2 })); ok++; fallos = 0; }
    catch (e) { if (++fallos > 20) { console.warn(`Fichas: demasiados fallos seguidos (${e.message}), paro aquí`); break; } }
    await sleep(250);
  }
  const out = Array.from({ length: SHARDS }, () => ({}));
  for (const [id, f] of Object.entries(all)) if (live.has(id)) out[shardOf(id)][id] = f;
  for (let k = 0; k < SHARDS; k++) await writeJSON(`data/fichas/mercadona/${k}.json`, out[k]);
  const total = out.reduce((n, s) => n + Object.keys(s).length, 0);
  console.log(`::notice title=Fichas Mercadona::${ok} descargadas, ${total} de ${ids.length} productos con ficha`);
}

if (import.meta.url === `file://${process.argv[1]}`) await fetchFichas();
