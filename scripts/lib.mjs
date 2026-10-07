// Utilidades compartidas por los scripts que descargan catálogos.
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const UA = "SuperLista/1.0 (lista de la compra personal; https://github.com/EasyBro92/super-lista)";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getJSON(url, { tries = 4, headers = {} } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", ...headers } });
      if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`HTTP ${res.status}`), { slow: res.status === 429 });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} en ${url}`), { fatal: true });
      return await res.json();
    } catch (e) {
      last = e;
      if (e.fatal) break;
      await sleep((e.slow ? 20000 : 2000) * 2 ** i);
    }
  }
  throw last;
}

export const norm = (s) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Secciones de la lista, en el orden en que suelen recorrerse en la tienda.
export const CATS = [
  "Frutas y verduras", "Carne", "Pescado", "Charcutería y quesos", "Lácteos y huevos", "Panadería",
  "Despensa", "Dulces y desayuno", "Bebidas", "Congelados", "Limpieza", "Higiene", "Bebé y mascotas", "Otros",
];

const RULES = [
  [/fruta|verdura|hortaliz|fresh-vegetables|fruits|vegetables|legumes-and-their-products(?!.*canned)|ensalada/, "Frutas y verduras"],
  [/marisco|pescado|fish|seafood|atun fresco/, "Pescado"],
  [/charcuteria|queso|cheese|embutido|jamon|sausage|ham|cured/, "Charcutería y quesos"],
  [/carne|meat|pollo|poultr|cerdo|ternera/, "Carne"],
  [/huevo|leche|mantequilla|yogur|postre|dairies|dairy|milk|egg|yogurt|butter|cream/, "Lácteos y huevos"],
  [/panaderia|pasteleria|bread|pan |bollo|viennoiser/, "Panadería"],
  [/congelado|frozen|helado|ice-cream|pizza/, "Congelados"],
  [/agua|refresco|zumo|bodega|vino|cerveza|beverage|drink|water|juice|soda|wine|beer/, "Bebidas"],
  [/cacao|cafe|infusion|cereal|galleta|azucar|caramelo|chocolate|snack-sweet|biscuit|breakfast|sweet|confectioner|cocoa|coffee|tea/, "Dulces y desayuno"],
  [/limpieza|hogar|detergent|cleaning|household/, "Limpieza"],
  [/cabello|facial|corporal|maquillaje|parafarmacia|fitoterapia|higiene|hygiene|cosmetic|shampoo|toothpaste/, "Higiene"],
  [/bebe|baby|mascota|pet-food|pet/, "Bebé y mascotas"],
  [/aceite|especia|salsa|arroz|legumbre|pasta|conserva|caldo|crema|aperitivo|plato|oil|sauce|rice|canned|spice|snack|condiment|cereal|flour|harina|meal/, "Despensa"],
];

// Prueba primero el texto más específico (la última categoría) y va subiendo.
export function catFor(...texts) {
  const parts = texts.flat().filter(Boolean).map((t) => norm(t).replace(/plant-based-foods-and-beverages|en:/g, " "));
  for (const t of parts.reverse()) for (const [re, c] of RULES) if (re.test(t)) return c;
  return "Otros";
}

export async function writeJSON(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data));
}

// Formato compacto de cada producto en data/stores/<tienda>.json
// { n: nombre, b: marca, f: formato, p: precio €, u: precio por unidad, img: foto, c: sección, e: código de barras, r: posición }
export function product({ name, brand = "", format = "", price = null, unit = "", img = "", cat = "Otros", ean = "", rank = 0 }) {
  const o = { n: name.trim(), c: cat, r: rank };
  if (brand) o.b = brand.trim();
  if (format) o.f = String(format).trim();
  if (price != null && !Number.isNaN(+price)) o.p = Math.round(+price * 100) / 100;
  if (unit) o.u = unit;
  if (img) o.img = img;
  if (ean) o.e = String(ean);
  return o;
}
