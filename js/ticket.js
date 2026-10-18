// Leer el ticket de la compra con una foto, en el propio móvil: la foto no sale del teléfono y no cuesta nada.
// El lector (Tesseract) se descarga la primera vez que se usa, unos pocos MB.
const CDN = "https://cdn.jsdelivr.net/npm/";
const PATHS = {
  workerPath: `${CDN}tesseract.js@6.0.1/dist/worker.min.js`,
  corePath: `${CDN}tesseract.js-core@6.0.0`,
  langPath: `${CDN}@tesseract.js-data/spa@1.0.0/4.0.0_best_int`,
};
let lib = null;
function loadLib() {
  lib ??= new Promise((ok, ko) => {
    if (window.Tesseract) return ok(window.Tesseract);
    const s = document.createElement("script");
    s.src = `${CDN}tesseract.js@6.0.1/dist/tesseract.min.js`;
    s.onload = () => ok(window.Tesseract);
    s.onerror = () => { lib = null; s.remove(); ko(new Error("sin red")); };
    document.head.append(s);
  });
  return lib;
}

// Foto en gris, con más contraste y de un tamaño que el lector maneja bien.
async function prepare(file) {
  const img = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
  const f = Math.min(1, 2200 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, hist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 4) { const g = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000 | 0; p[i] = g; hist[g]++; }
  // Estira los grises entre el 2 % más oscuro y el 2 % más claro.
  const n = p.length / 4; let lo = 0, hi = 255;
  for (let a = 0, s = 0; a < 256; a++) { s += hist[a]; if (s > n * 0.02) { lo = a; break; } }
  for (let a = 255, s = 0; a >= 0; a--) { s += hist[a]; if (s > n * 0.02) { hi = a; break; } }
  const k = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < p.length; i += 4) { const g = Math.max(0, Math.min(255, (p[i] - lo) * k)); p[i] = p[i + 1] = p[i + 2] = g; }
  x.putImageData(d, 0, 0);
  return c;
}

// onProgress(fase, 0..1): fase «descarga» la primera vez, luego «lectura».
export async function readTicket(file, onProgress = () => {}) {
  const T = await loadLib();
  let w = null, timer;
  const late = new Promise((_, ko) => { timer = setTimeout(() => ko(new Error("tarda")), 90000); });
  try {
    w = await Promise.race([late, T.createWorker("spa", 1, { ...PATHS, errorHandler: () => {}, logger: (m) => {
      if (m.status === "recognizing text") onProgress("lectura", m.progress);
      else if (/loading|initializ/.test(m.status)) onProgress("descarga", m.progress);
    } })]);
    clearTimeout(timer);
    const { data } = await w.recognize(await prepare(file));
    return data.text;
  } finally { clearTimeout(timer); w?.terminate(); }
}

// ---------- Del texto del ticket a una compra ----------
const STORE_RE = [
  ["mercadona", /mercadona/], ["lidl", /\blidl\b/], ["carrefour", /carrefour/], ["alcampo", /alcampo|auchan/],
  ["eroski", /eroski/], ["aldi", /\baldi\b/], ["consum", /consum/], ["elcorteingles", /corte ingl|hipercor|supercor/],
  ["dia", /\bdia\b.{0,12}(retail|s\.?a)|supermercados dia|distribuidora internacional/],
];
// Líneas que llevan importe pero no son productos.
const SKIP = /total|i\.?v\.?a|tarjeta|cambio|entregad|efectivo|base imp|cuota|importe|visa|master|devoluc|factura|n\.?i\.?f|c\.?i\.?f|tel[eé]f|cajer|operac|autoriz|pago|saldo|ahorr|puntos|club|cup[oó]n|redondeo|art[ií]culos|descuento|dto\b|promoci|contactless|comercio|terminal|sesi[oó]n|a devolver/;
const PRICE = /(-?\d{1,4}[.,]\d{2})\s*(?:€|eur|e)?\s*[a-d*]?\s*$/i;
const num = (s) => parseFloat(s.replace(",", "."));
const letters = (s) => (s.match(/\p{L}/gu) ?? []).length;
const tidy = (s) => {
  const t = s.replace(/[^\p{L}\d %.,/'&-]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function parseTicket(text) {
  const lines = String(text).split(/\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const low = text.toLowerCase();
  const store = STORE_RE.find(([, re]) => re.test(low))?.[0] ?? "any";
  let total = null, date = null, pending = null;
  const items = [];
  const dm = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (dm) {
    const y = dm[3].length === 2 ? 2000 + +dm[3] : +dm[3], dt = new Date(y, +dm[2] - 1, +dm[1], 12);
    if (dt.getMonth() === +dm[2] - 1 && dt <= Date.now() && Date.now() - dt < 400 * 864e5) date = dt.getTime();
  }
  for (const l of lines) {
    const lo = l.toLowerCase();
    if (/total/.test(lo) && !/subtotal|total art|total uds|total ahorro/.test(lo)) {
      const m = lo.match(/\d{1,4}[.,]\d{2}/g);
      if (m) { const v = num(m.at(-1)); if (v > 0 && v > (total ?? 0)) total = v; }
      pending = null; continue;
    }
    if (SKIP.test(lo)) { pending = null; continue; }
    const m = l.match(PRICE);
    if (!m) { pending = letters(l) >= 3 && !/\d{5,}/.test(l) ? l : null; continue; }
    let name = l.slice(0, m.index);
    // «1,250 kg x 1,95 €/kg 2,44»: la línea del peso va debajo del nombre del producto.
    name = name.replace(/\s*\d+[.,]\d{1,3}\s*(kg|g|ud|uds)?\s*x?\s*(\d+[.,]\d{2}\s*(€|eur)?\s*(\/\s*kg)?)?\s*$/i, "");
    if (letters(name.replace(/\b(kg|ud|uds|eur|x)\b/gi, "")) < 3) { if (!pending) continue; name = pending; }
    pending = null;
    const price = num(m[1]);
    if (!(price > 0 && price < 300)) continue;
    let count = 1;
    const q = name.match(/^\s*(\d{1,2})\s*(?:x\s*)?(?=\p{L})/u);
    if (q) { count = Math.max(1, +q[1]); name = name.slice(q[0].length); }
    name = tidy(name);
    if (letters(name) < 3) continue;
    items.push({ label: name, count, price });
  }
  const sum = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100;
  return { store, date, total: total ?? (sum || null), items, sum };
}
