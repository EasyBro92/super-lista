// Entiende frases como «apunta 2 kilos de naranjas, leche y quita los huevos»
// y busca cada producto en los catálogos de los supermercados. Todo funciona en el móvil, sin IA de pago.

export const norm = (s) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[-_/.,()'"]/g, " ").replace(/\s+/g, " ").trim();

// «limones» → «limon», «tomates» → «tomate», «naranjas» → «naranja»
export function stem(w) {
  if (w.length <= 3 || !w.endsWith("s")) return w;
  let s = w.slice(0, -1);
  if (s.endsWith("e") && /[lnrdzj]e$/.test(s) && s.length > 3) s = s.slice(0, -1);
  return s;
}

const STOP = new Set(["de", "del", "la", "las", "el", "los", "un", "una", "unos", "unas", "al", "y", "e", "para", "por", "favor", "mas", "algo", "poco", "pocos", "unas"]);
const SYN = { banana: "platano", cocacola: "coca cola", yogurt: "yogur", yoghourt: "yogur", jabon: "jabon", papel: "papel", huevo: "huevo", birra: "cerveza", pasta_dientes: "dentifrico" };

const PHRASES = [[/pasta de dientes|crema dental/g, "dentifrico"], [/espagueti/g, "spaghetti"], [/coca cola/g, "coca cola"]];

export function tokens(s) {
  let t = norm(s);
  for (const [re, r] of PHRASES) t = t.replace(re, r);
  return t.split(" ").filter((w) => w && !STOP.has(w)).map((w) => stem(SYN[w] ?? w));
}

const NUMW = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, media: 0.5, medio: 0.5 };
const UNITS = "kilos?|kg|gramos?|g|litros?|l|paquetes?|botes?|bolsas?|latas?|botellas?|cajas?|docenas?|bandejas?|briks?|bricks?|packs?|tarros?|barras?|mallas?|rollos?|unidades?|piezas?";
const QTY_RE = new RegExp(`^(\\d+(?:[.,]\\d+)?|${Object.keys(NUMW).join("|")})\\s+(?:(${UNITS})\\s+)?(?:de\\s+)?(.+)$`, "i");

const ADD = /^(por favor\s+)?(ap[uú]ntame|apunta|a[ñn]ade|a[ñn]ádeme|pon(me)?|compra|agrega|mete|necesito|hay que comprar|falta|faltan|quiero|y)\b[:,]?\s*/i;
const REMOVE = /^(quita|qu[ií]tame|borra|elimina|saca|tacha)\b\s*/i;
const CHECK = /^(ya\s+(he\s+)?(comprado|tengo|cogido|cog[ií])|marca(\s+como\s+comprado)?|tengo)\b\s*/i;
const VERB_SPLIT = /\s*(?:,|;|\by\b)?\s*(?=\b(?:quita|qu[ií]tame|borra|elimina|saca|tacha|ya tengo|ya he comprado|ya he cogido|apunta|ap[uú]ntame|a[ñn]ade|pon|ponme|necesito)\b)/i;

export function parseQty(text) {
  const m = text.trim().match(QTY_RE);
  if (!m) return { query: text.trim(), qty: "", count: 1 };
  const n = NUMW[m[1].toLowerCase()] ?? parseFloat(m[1].replace(",", "."));
  const unit = m[2] ? m[2].toLowerCase() : "";
  const count = !unit || /paquete|bote|bolsa|lata|botella|caja|bandeja|brik|brick|pack|tarro|barra|malla|rollo|unidad|pieza/.test(unit) ? n : 1;
  return { query: m[3].trim(), qty: unit ? `${String(n).replace(".", ",")} ${unit}` : `${n}`, count };
}

// Devuelve una lista de acciones: { op: "add" | "remove" | "check", query, qty, count }
export function parseCommand(text) {
  const acts = [];
  const clean = String(text).replace(/[.!¡¿?]+/g, " ").trim();
  for (let clause of clean.split(VERB_SPLIT).filter((c) => c && c.trim())) {
    clause = clause.trim();
    let op = "add";
    if (REMOVE.test(clause)) { op = "remove"; clause = clause.replace(REMOVE, ""); }
    else if (CHECK.test(clause)) { op = "check"; clause = clause.replace(CHECK, ""); }
    else clause = clause.replace(ADD, "");
    const parts = clause.split(/\s*(?:,|;|\by\b|\be\b|\bmas\b|\bmás\b|\btambien\b|\btambién\b)\s*/i)
      .map((p) => p.replace(/^(de|del|la|las|el|los|unos|unas)\s+/i, "").trim())
      .filter(Boolean);
    for (const p of parts) acts.push({ op, ...parseQty(p) });
  }
  return acts;
}

// ---------- Búsqueda en catálogo ----------

export function indexCatalog(items, store) {
  for (const it of items) {
    it.s = store;
    it._t = tokens(it.n);
    it._first = it._t[0] || "";
  }
  return items;
}

export function score(it, qt, prefCat) {
  let s = 0;
  let miss = 0;
  for (const q of qt) {
    if (it._t.includes(q)) s += 3;
    else if (q.length >= 3 && it._t.some((t) => t.startsWith(q))) s += 2;
    else miss++;
  }
  if (miss && (qt.length < 2 || miss > qt.length / 3)) return -1;
  s -= miss * 2;
  if (it._first === qt[0]) s += 3;
  if (!miss && it._t.length === qt.length) s += 2;
  if (prefCat && it.c === prefCat) s += 2.5;
  s -= it._t.length * 0.25;
  s -= it.r * 0.0004;
  if (it.img) s += 0.5;
  return s;
}

export function search(catalog, query, limit = 12) {
  const qt = tokens(query);
  const g = guess(query).cat;
  const prefCat = g === "Otros" ? null : g;
  if (!qt.length) return [];
  const res = [];
  for (const it of catalog) {
    const s = score(it, qt, prefCat);
    if (s > 0) res.push([s, it]);
  }
  res.sort((a, b) => b[0] - a[0]);
  return res.slice(0, limit).map((r) => r[1]);
}

// ---------- Respaldo cuando un producto no está en el catálogo ----------

const GUESS = [
  // Primero lo concreto, para que «salchichas» no caiga en «sal» ni «panceta» en «pan».
  [/\bmasa de pizza/, "🍕", "Panadería"], [/\bpan de hamburguesa/, "🍔", "Panadería"], [/\btortillas? de trigo|\bwrap|\bpan de pita|\bfajita/, "🫓", "Panadería"],
  [/\bhojaldre|\bmasa\b|\bempanadilla|\bbizcocho|\bsoletilla/, "🥐", "Panadería"],
  [/\bbebida de (avena|soja|almendra|arroz)/, "🥛", "Lácteos y huevos"], [/\bleche de coco|\bcoco\b/, "🥥", "Despensa"],
  [/\bsalchicha/, "🌭", "Carne"], [/\bbacon|\bpanceta|\btocino/, "🥓", "Carne"], [/\bcostilla|\bcordero|\bchuleta/, "🍖", "Carne"],
  [/\bmorcilla/, "🌭", "Charcutería y quesos"], [/\bmozzarella|\bburrata/, "🧀", "Charcutería y quesos"],
  [/\bcalamar|\bsepia|\bpulpo/, "🦑", "Pescado"], [/\bmejillon|\balmeja|\bberberecho/, "🦪", "Pescado"], [/\bgamba|\blangostino/, "🦐", "Pescado"],
  [/\blubina|\bdorada|\bsardina|\bboquer|\bsurimi|\bpescado/, "🐟", "Pescado"],
  [/\bcaldo/, "🍲", "Despensa"], [/\bgelatina|\bflan\b/, "🍮", "Dulces y desayuno"],
  [/\bpimienta|\bpimenton|\bcomino|\bcanela|\bcurry|\bazafran|\bcolorante|\bguindilla|\bnuez moscada|\bsesamo|\bespecia/, "🧂", "Despensa"],
  [/\boregano|\blaurel|\btomillo|\bromero/, "🌿", "Despensa"], [/\bperejil|\bcilantro|\balbahaca|\bhierbabuena|\bmenta\b/, "🌿", "Frutas y verduras"],
  [/\bberenjena/, "🍆", "Frutas y verduras"], [/\bpuerro|\brucula|\bcanonigo|\brepollo|\bcol\b/, "🥬", "Frutas y verduras"], [/\bcalabaza\b/, "🎃", "Frutas y verduras"],
  [/\bcoliflor/, "🥦", "Frutas y verduras"], [/\bjudias? verde|\bguisante|\bedamame/, "🫛", "Frutas y verduras"], [/\bjengibre/, "🫚", "Frutas y verduras"],
  [/\bmaiz/, "🌽", "Despensa"], [/\blima\b|\blimas\b/, "🍋", "Frutas y verduras"], [/\bmango/, "🥭", "Frutas y verduras"], [/\bpina\b|\bpinas\b/, "🍍", "Frutas y verduras"],
  [/\barandano/, "🫐", "Frutas y verduras"], [/\bmenestra|\bverduras para wok/, "🥦", "Congelados"], [/\bgyoza/, "🥟", "Congelados"], [/\bcroqueta/, "🧆", "Congelados"],
  [/\bfideo|\blasana|\btallarin|\bgnocchi|\btortellini|\bpasta\b|\bmacarron|\bespagueti|\bspaghetti/, "🍝", "Despensa"],
  [/\bcuscus|\bquinoa/, "🌾", "Despensa"], [/\bgarbanzo|\blenteja|\balubia|\bjudion|\blegumbre/, "🫘", "Despensa"],
  [/\baceituna|\balcaparra/, "🫒", "Despensa"], [/\bnuez|\bnueces|\balmendra|\bfrutos secos|\bpasas\b|\bavellana|\bpistacho|\bcacahuete/, "🥜", "Despensa"],
  [/\bmiel\b/, "🍯", "Dulces y desayuno"], [/\bmermelada/, "🫙", "Dulces y desayuno"], [/\bavena|\bcopos/, "🥣", "Dulces y desayuno"],
  [/\bguacamole/, "🥑", "Despensa"], [/\bsalsa|\bmayonesa|\bketchup|\bmostaza|\bpesto|\btahini|\bhummus|\bvinagre/, "🫙", "Despensa"],
  [/\blevadura|\bmaicena|\bvainilla/, "🧂", "Despensa"],
  [/platano|banana/, "🍌", "Frutas y verduras"], [/manzana/, "🍎", "Frutas y verduras"], [/naranja|mandarina/, "🍊", "Frutas y verduras"],
  [/limon/, "🍋", "Frutas y verduras"], [/tomate/, "🍅", "Frutas y verduras"], [/patata/, "🥔", "Frutas y verduras"],
  [/cebolla/, "🧅", "Frutas y verduras"], [/ajo/, "🧄", "Frutas y verduras"], [/lechuga|ensalada/, "🥬", "Frutas y verduras"],
  [/zanahoria/, "🥕", "Frutas y verduras"], [/aguacate/, "🥑", "Frutas y verduras"], [/pimiento/, "🫑", "Frutas y verduras"],
  [/fresa/, "🍓", "Frutas y verduras"], [/sandia/, "🍉", "Frutas y verduras"], [/melon/, "🍈", "Frutas y verduras"],
  [/pepino|calabacin/, "🥒", "Frutas y verduras"], [/brocoli|espinaca|champi/, "🥦", "Frutas y verduras"], [/uva/, "🍇", "Frutas y verduras"], [/pera/, "🍐", "Frutas y verduras"],
  [/pollo|pavo/, "🍗", "Carne"], [/carne|ternera|cerdo|filete|hamburguesa/, "🥩", "Carne"],
  [/pescado|salmon|merluza|bacalao|gamba|langostino/, "🐟", "Pescado"],
  [/jamon|chorizo|salchichon|fuet|embutido/, "🥓", "Charcutería y quesos"], [/queso/, "🧀", "Charcutería y quesos"],
  [/leche|yogur|mantequilla|nata/, "🥛", "Lácteos y huevos"], [/huevo/, "🥚", "Lácteos y huevos"],
  [/\bpan\b|baguette|\bbarra/, "🥖", "Panadería"], [/croissant|bollo|magdalena/, "🥐", "Panadería"],
  [/arroz/, "🍚", "Despensa"], [/pasta|macarron|espagueti/, "🍝", "Despensa"], [/aceite/, "🫒", "Despensa"],
  [/atun|conserva|lata/, "🥫", "Despensa"], [/\bsal\b|azucar|harina/, "🧂", "Despensa"],
  [/galleta|oreo/, "🍪", "Dulces y desayuno"], [/chocolate|cacao|nutella/, "🍫", "Dulces y desayuno"], [/cafe/, "☕", "Dulces y desayuno"],
  [/cereal/, "🥣", "Dulces y desayuno"], [/agua/, "💧", "Bebidas"], [/cerveza/, "🍺", "Bebidas"], [/vino/, "🍷", "Bebidas"],
  [/zumo|refresco|cola/, "🧃", "Bebidas"], [/helado/, "🍨", "Congelados"], [/pizza/, "🍕", "Congelados"],
  [/detergente|lejia|friegasuelos|lavavajillas|limpia|estropajo|basura/, "🧽", "Limpieza"],
  [/papel higienico|champu|gel|jabon|dentifrico|pasta de dientes|desodorante|compresa/, "🧴", "Higiene"],
  [/panal|toallita|pienso|gato|perro/, "🍼", "Bebé y mascotas"],
];

export function guess(query) {
  const q = norm(query);
  for (const [re, emoji, cat] of GUESS) if (re.test(q)) return { emoji, cat };
  return { emoji: "🛒", cat: "Otros" };
}

export const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
