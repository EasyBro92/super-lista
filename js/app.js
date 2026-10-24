import { parseCommand, search, indexCatalog, guess, norm, capital, tokens } from "./parser.js";
import { BASICS } from "./basics.js";
import { initCocina, openRecipes, learnPurchase, cookBack, renderIdeas, homeInfo } from "./cocina.js";
import { barcodeSVG, bestFormat } from "./barcode.js";
import { readTicket, parseTicket } from "./ticket.js";
import { webUrl, SELLS_ONLINE, offerTag, offerHTML, offerLineHTML, cheaperAlts, unitPrice, filterBarHTML, filterBarClick, applyFilters, fichaData, priceHistory, fichaSections } from "./ficha.js";
import { haptic, swipeRows, sheetGestures, pullToRefresh } from "./gestos.js";
import { avoidSet, conflicts, labelAllergens, ALLER } from "./alergias.js";
import { initSync, stamp, syncReady, syncCurrent, share, unshare, shareURL } from "./sync.js";
import { initComunidad, openComunidad, openCuenta, comReady, meNow } from "./comunidad.js";
import { initInstalar, showBanner, canInstall, install, later as installLater } from "./instalar.js";

const STORES = [
  ["any", "Cualquiera"], ["mercadona", "Mercadona"], ["carrefour", "Carrefour"], ["lidl", "Lidl"], ["dia", "Dia"],
  ["alcampo", "Alcampo"], ["eroski", "Eroski"], ["aldi", "Aldi"], ["consum", "Consum"], ["elcorteingles", "El Corte Inglés"],
];
const STORE_NAME = Object.fromEntries(STORES);
// Marcas propias: un producto de estas marcas solo se vende en su súper y lleva su logo en la esquina de la foto.
const OWN_BRANDS = [
  ["mercadona", /\b(hacendado|deliplus|bosque verde|compy)\b/], ["carrefour", /\bcarrefour\b/],
  ["dia", /^dia\b|\bdia (lactea|nature|delicious|al punto)\b|\bbonte\b/], ["alcampo", /\b(auchan|alcampo)\b/],
  ["eroski", /\b(eroski|seleqtia)\b/], ["consum", /^consum\b|\bconsum$/], ["elcorteingles", /\b(el corte ingles|aliada|hipercor)\b/],
  ["lidl", /\b(milbona|pikok|combino|freeway|vitasia|chef select|baresa|alesto|solevita|crownfield|snack day|lidl)\b/],
  ["aldi", /\b(milsani|golden seafood|cucina nobile|choceur|lyttos|moser roth|aldi)\b/],
];
function onlyAt(p) {
  if (!p?.n) return null;
  const b = norm(p.b ?? ""), n = norm(p.n);
  for (const [s, re] of OWN_BRANDS) if ((b && re.test(b)) || re.test(n)) return s;
  return null;
}
const logoHTML = (s) => s ? `<span class="slogo" style="background-image:url('img/logos/${s}.png')" role="img" aria-label="Solo en ${esc(STORE_NAME[s])}" title="Solo en ${esc(STORE_NAME[s])}"></span>` : "";
const CATS = [
  "Frutas y verduras", "Carne", "Pescado", "Charcutería y quesos", "Lácteos y huevos", "Panadería",
  "Despensa", "Dulces y desayuno", "Bebidas", "Congelados", "Limpieza", "Higiene", "Bebé y mascotas", "Otros",
];
// Icono y color de cada pasillo: las fichas se tiñen con el color de su sección.
const CAT_LOOK = {
  "Frutas y verduras": ["🥦", 110], "Carne": ["🥩", 0], "Pescado": ["🐟", 200], "Charcutería y quesos": ["🧀", 40],
  "Lácteos y huevos": ["🥛", 210], "Panadería": ["🥖", 30], "Despensa": ["🥫", 18], "Dulces y desayuno": ["🍪", 330],
  "Bebidas": ["🧃", 270], "Congelados": ["🧊", 190], "Limpieza": ["🧽", 170], "Higiene": ["🧴", 290], "Bebé y mascotas": ["🍼", 50], "Otros": ["🛍️", 90],
};
const KEY = "superlista.v2";
const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = (n) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';

// ---------- Estado ----------
let st = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && Array.isArray(s.lists) && s.lists.length) return { history: [], freq: {}, memory: {}, shop: false, ...s };
  } catch {}
  const id = uid();
  return { lists: [{ id, name: "Casa", store: "mercadona", items: [] }], current: id, history: [], freq: {}, memory: {}, shop: false };
}
// En las listas compartidas, guardar también marca qué ha cambiado y lo envía.
function save() { stamp(); persist(); }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }
const list = () => st.lists.find((l) => l.id === st.current) ?? st.lists[0];

// ---------- Catálogos ----------
const catalogs = new Map(); // slug -> productos indexados
const loading = new Map();
let meta = null;
fetch("data/meta.json").then((r) => (r.ok ? r.json() : null)).then((m) => { meta = m; renderSummary(); renderDeals().catch(() => {}); priceAlerts().catch(() => {}); }).catch(() => {});

function loadStore(slug) {
  if (catalogs.has(slug)) return Promise.resolve(catalogs.get(slug));
  if (!loading.has(slug)) {
    loading.set(slug, fetch(`data/stores/${slug}.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((items) => { const idx = indexCatalog(items, slug); catalogs.set(slug, idx); return idx; }));
  }
  return loading.get(slug);
}
async function catalogFor(store) {
  if (store !== "any") return loadStore(store);
  const all = await Promise.all(STORES.slice(1).map(([s]) => loadStore(s)));
  return all.flat();
}

// Para los básicos y los ingredientes de recetas («Sandía», «Ternera») mejor sin foto que con un producto
// que solo los menciona de pasada.
const BASIC_SET = new Set(Object.values(BASICS).flat().map(norm));
const markGeneric = (names) => { for (const n of names) BASIC_SET.add(norm(n)); };
// Cómo llaman los súpers a algunos genéricos («Ternera» es «vacuno añojo» en Mercadona).
const ALIAS = {
  "ternera": "tacos de vacuno añojo", "filetes de ternera": "filetes de vacuno añojo plancha", "queso parmesano": "queso grana padano",
  "cuscus": "cous cous", "fideos de arroz": "noodles de arroz", "nueces": "nuez natural pelada", "sesamo": "semillas sesamo",
  "mascarpone": "queso mascarpone", "atun fresco": "rodajas de atun", "hojaldre": "masa fresca hojaldre", "queso crema": "queso untar",
  "hamburguesas": "burger de vacuno", "merluza": "filetes de merluza", "salmon": "filete de salmon",
  "fideos ramen": "noodles ramen", "cacahuetes": "cacahuete tostado", "arroz para sushi": "arroz redondo", "batatas": "batata",
  // Sin equivalente en el súper: mejor sin foto que con otro producto.
  "carne picada de cordero": "", "lentejas rojas": "", "anis estrellado": "",
  "frutos rojos": "mix frutos rojos", "granola": "muesli crunchy sin azucares", "anis": "licor de anis", "esencia de vainilla": "aroma de vainilla",
  "pepitas de chocolate": "gotas de chocolate", "queso fresco": "queso fresco burgos",
  "leche de avena": "bebida de avena", "leche de soja": "bebida de soja", "leche de almendras": "bebida de almendras", "leche de arroz": "bebida de arroz",
};
markGeneric(Object.values(ALIAS).filter(Boolean));
function bestProd(cat, query) {
  const alias = ALIAS[norm(query)];
  if (alias === "") return null;
  if (alias) { const p = bestProd(cat, alias); if (p) return p; }
  const r = search(cat, query, 6);
  // Si la primera palabra aparece al final del nombre («leche» en unas galletas con leche), mejor uno que empiece por ella.
  if (!BASIC_SET.has(norm(query)) && !alias) { const q0 = tokens(query)[0]; return pick(r.find((p) => p._t.indexOf(q0) <= 1 && p._t.includes(q0)) ?? r[0]); }
  const q0 = tokens(query)[0], c = guess(query).cat;
  return pick(r.find((p) => p._t.indexOf(q0) === 0) ?? r.find((p) => p._t.indexOf(q0) === 1 && (c === "Otros" || p.c === c || tokens(query).length > 1)));
}
function pick(prod) {
  if (!prod) return null;
  const o = { n: prod.n, s: prod.s };
  for (const k of ["img", "p", "u", "f", "e", "b", "c", "pb", "pd", "id", "w", "o", "ot", "pt", "nw"]) if (prod[k] != null) o[k] = prod[k];
  return o;
}

// ---------- Acciones sobre la lista ----------
const fresh = new Set();
const memKey = (q, store) => `${store}|${tokens(q).join(" ")}`;

async function addItem({ query, qty = "", count = 1 }, forcedProd) {
  const l = list();
  const label = capital(query.trim());
  let prod = forcedProd ?? st.memory[memKey(query, l.store)] ?? null;
  if (!prod) {
    const cat = await catalogFor(l.store);
    prod = bestProd(cat, query);
  }
  const g = guess(query);
  const cat = prod?.c ?? g.cat;
  const existing = l.items.find((i) => !i.done && norm(i.label) === norm(label));
  if (existing) {
    if (qty) { existing.qty = qty; existing.count = count; }
    fresh.add(existing.id);
    return existing;
  }
  const it = { id: uid(), label, qty, count, done: false, prod, cat, emoji: g.emoji, added: Date.now() };
  l.items.push(it);
  fresh.add(it.id);
  const fk = norm(label);
  const f = st.freq[fk] ?? { label, count: 0 };
  st.freq[fk] = { ...f, label, count: f.count + 1, last: Date.now(), prod, emoji: g.emoji };
  return it;
}
function matchItems(query) {
  const q = tokens(query);
  return list().items.filter((i) => {
    const t = tokens(`${i.label} ${i.prod?.n ?? ""}`);
    return q.length && q.every((w) => t.some((x) => x === w || x.startsWith(w)));
  });
}

async function handle(text, { quiet = false } = {}) {
  text = text.trim();
  if (!text) return;
  const acts = parseCommand(text);
  if (!acts.length) return setStatus("No he entendido qué apuntar.", true);
  setStatus("Buscando productos…");
  const added = [], removed = [], checked = [], addedIds = [];
  for (const a of acts) {
    if (a.op === "remove") {
      const m = matchItems(a.query);
      list().items = list().items.filter((i) => !m.includes(i));
      if (m.length) removed.push(...m.map((i) => i.label));
    } else if (a.op === "check") {
      for (const i of matchItems(a.query)) { i.done = true; checked.push(i.label); }
    } else {
      const it = await addItem(a);
      added.push(it.label); addedIds.push(it.id);
    }
  }
  save(); render(); flyIn(addedIds);
  const bits = [];
  if (added.length) bits.push(`Apuntado: ${added.join(", ")}`);
  if (removed.length) bits.push(`Quitado: ${removed.join(", ")}`);
  if (checked.length) bits.push(`Comprado: ${checked.join(", ")}`);
  if (!quiet) setStatus(bits.join(" · ") || "No he encontrado eso en la lista.", !bits.length);
  return added;
}

// Tarjeta que aparece arriba con el producto y baja hasta su sitio en la lista.
let flyQueue = Promise.resolve();
const incoming = new Set(); // productos que aún están «volando» hacia la lista
function flyIn(ids) {
  if (!Element.prototype.animate) return;
  for (const id of ids) {
    incoming.add(id);
    document.querySelector(`li.item[data-id="${id}"]`)?.classList.add("incoming");
    flyQueue = flyQueue.then(() => flyOne(id)).catch(() => {}).finally(() => {
      incoming.delete(id); document.querySelector(`li.item[data-id="${id}"]`)?.classList.remove("incoming");
    });
  }
}
async function flyOne(id) {
  const it = list().items.find((i) => i.id === id);
  const li = () => document.querySelector(`li.item[data-id="${id}"]`);
  if (!it || !li()) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const card = document.createElement("div");
  card.className = "fly";
  card.setAttribute("aria-hidden", "true");
  card.innerHTML = `<span class="thumb">${thumbHTML(it.prod, it.emoji)}</span>
    <span class="info"><span class="name">${esc(it.label)}</span><span class="sub">${esc(it.prod?.n ?? "Añadido a la lista")}</span></span>
    <span class="fly-ok">${CHECK_SVG}</span>`;
  document.body.append(card);
  buzz(15);
  li()?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  await card.animate([{ transform: "translateY(-24px) scale(.9)", opacity: 0 }, { transform: "none", opacity: 1 }],
    { duration: reduce ? 1 : 260, easing: "cubic-bezier(.2,.9,.3,1.25)", fill: "forwards" }).finished;
  await new Promise((r) => setTimeout(r, reduce ? 500 : 650));
  const target = li();
  if (target) {
    const a = card.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left - a.left, dy = b.top - a.top, sx = b.width / a.width, sy = b.height / a.height;
    await card.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, opacity: .9 }],
      { duration: reduce ? 1 : 420, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" }).finished;
    incoming.delete(id);
    target.classList.remove("incoming");
    target.classList.add("landed");
    setTimeout(() => target.classList.remove("landed"), 700);
  }
  card.remove();
}

// ---------- Deshacer ----------
let undoSnap = null, toastTimer = null, undoAfter = null;
function snapshot() { return JSON.stringify({ lists: st.lists, history: st.history }); }
// Con una ventana abierta (p. ej. Compras) el aviso se pone dentro de ella; si no, quedaría tapado.
function placeToast() {
  const t = $("toast"), host = sheet.open ? sheet.querySelector(".sheet-in") : document.querySelector(".dock-in");
  if (t.parentElement !== host) { if (sheet.open) host.insertBefore(t, $("sheetTabs")); else host.prepend(t); }
}
function withUndo(msg, fn, after = null) {
  const snap = snapshot();
  fn();
  save(); render();
  undoSnap = snap; undoAfter = after;
  const t = $("toast");
  $("toastMsg").textContent = msg;
  placeToast();
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; undoSnap = null; undoAfter = null; }, 6000);
}
function undo() {
  if (!undoSnap) return;
  Object.assign(st, JSON.parse(undoSnap));
  if (!st.lists.some((l) => l.id === st.current)) st.current = st.lists[0].id;
  undoSnap = null; $("toast").hidden = true;
  save(); render(); buzz();
  const after = undoAfter; undoAfter = null;
  if (after && sheet.open) after();
  else if (sheet.open && sheet.dataset.sec === "history") openHistory();
}
const buzz = haptic;
const SWIPE_DEL = {};
function removeItem(id) {
  const it = list().items.find((i) => i.id === id); if (!it) return;
  withUndo(`Borrado: ${it.label}`, () => { list().items = list().items.filter((i) => i.id !== id); });
}
function toggleItem(id) {
  const it = list().items.find((i) => i.id === id); if (!it) return;
  it.done = !it.done; save(); render(); buzz();
}

function setStatus(t, err) { const s = $("status"); s.textContent = t; s.classList.toggle("err", !!err); }

// ---------- Pintar ----------
// Las fotos se pintan como fondo (no como <img>) para que Chrome no muestre su menú de «Descargar imagen»
// al mantener pulsado. Debajo queda el emoji, que se ve si la foto no carga.
const cssUrl = (u) => esc(String(u).replace(/'/g, "%27").replace(/"/g, "%22").replace(/\s/g, "%20"));
function photoHTML(url, emoji, label = "", only = null) {
  const emo = `<span class="emo" aria-hidden="true">${esc(emoji || "🛒")}</span>`;
  if (!url) return only ? `<span class="photo">${emo}${logoHTML(only)}</span>` : emo;
  return `<span class="photo" role="img" aria-label="${esc(label)}">${emo}<span class="photo-img" style="background-image:url('${cssUrl(url)}')"></span>${logoHTML(only)}</span>`;
}
function thumbHTML(prod, emoji) { return photoHTML(prod?.img, emoji, prod?.n, onlyAt(prod)); }
// Ha bajado de precio en el último catálogo (precio de antes en «pb»).
const dropPct = (p) => p?.pb != null && p.p != null && p.p < p.pb ? Math.round((1 - p.p / p.pb) * 100) : 0;
const dropHTML = (p) => { const d = dropPct(p); return d >= 3 ? `<span class="drop" title="Antes ${eur(p.pb)}">⬇ ${d}%</span>` : ""; };
// Esquina de la foto: la oferta del súper («2ª -50%», «Nuevo») y, si no hay, la bajada de precio.
const badgeHTML = (p) => (offerTag(p) || p?.nw ? offerHTML(p) : dropHTML(p));
const itemPrice = (i) => (i.prod?.p != null ? i.prod.p * (i.count || 1) : null);

function renderStores() {
  const cur = list().store;
  $("stores").innerHTML = STORES.map(([s, n]) => `<button class="chip store" type="button" data-s="${s}" aria-pressed="${cur === s}">${s === "any"
    ? `<span class="clogo any" aria-hidden="true">🛒</span>` : `<span class="clogo" style="background-image:url('img/logos/${s}.png')" aria-hidden="true"></span>`}${esc(n)}</button>`).join("");
}
// Tarjeta de resumen: cuánto llevas en el carro, el total aproximado y cómo ver la lista.
function renderSummary() {
  const l = list(), el = $("summary");
  const left = l.items.filter((i) => !i.done), inCart = l.items.length - left.length;
  el.hidden = !l.items.length;
  if (!l.items.length) { el.innerHTML = ""; return; }
  const priced = left.filter((i) => itemPrice(i) != null);
  const total = priced.reduce((s, i) => s + itemPrice(i), 0);
  const pct = Math.round((inCart / l.items.length) * 100);
  const view = st.view ?? "grid";
  el.innerHTML = `<div class="sum-top">
      <div class="sum-ring" style="--p:${pct}" role="img" aria-label="${inCart} de ${l.items.length} en el carro"><span>${inCart}/${l.items.length}</span></div>
      <div class="sum-txt"><b>${left.length ? `${left.length} por comprar` : "¡Todo en el carro!"}</b>
        <span>${priced.length ? `Total aprox. <b class="sum-eur">${eur(total)}</b>${left.length > priced.length ? ` · ${left.length - priced.length} sin precio` : ""}` : inCart ? `${inCart} en el carro` : "Sin precios en este súper"}</span></div>
    </div>
    <div class="seg views" role="group" aria-label="Cómo ver la lista">
      <button type="button" data-view="grid" aria-pressed="${view === "grid"}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>En cuadros</button>
      <button type="button" data-view="list" aria-pressed="${view === "list"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>Uno debajo de otro</button></div>
    ${(() => { const k = (st.cards ?? []).findIndex((c) => c.store === l.store); return k < 0 ? "" : `<button type="button" class="sum-cmp card" data-showcard="${k}"><span aria-hidden="true">💳</span> Tarjeta ${esc(st.cards[k].name)} <b>Enseñar en caja ›</b></button>`; })()}
    ${left.length && pricedStores().length > 1 ? `<button type="button" class="sum-cmp" data-compare><span aria-hidden="true">⚖️</span> ¿Dónde sale más barata? <b>Comparar súpers ›</b></button>` : ""}
    ${budgetLine(total)}
    ${new Set(left.map((i) => i.cat)).size > 1 ? `<button type="button" class="sum-cmp aisle" data-aisles><span aria-hidden="true">🧭</span> Pasillos en el orden de ${l.store === "any" ? "tu súper" : esc(STORE_NAME[l.store] ?? "tu súper")} <b>${st.aisles?.[l.store] ? "Cambiar ›" : "Ordenar ›"}</b></button>` : ""}`;
}
// Aviso del tope de gasto del mes (como el presupuesto de Listonic).
function budgetLine(total) {
  if (!st.budget) return "";
  const spent = monthSpent(), after = spent + total;
  if (after <= st.budget) return total ? `<p class="sum-budget">Este mes llevas ${eur(spent)} de ${eur(st.budget)}; con esta compra te quedarían ${eur(st.budget - after)}.</p>` : "";
  return `<p class="sum-budget over">⚠️ Con esta compra te pasarías del tope del mes en ${eur(after - st.budget)} (llevas ${eur(spent)} de ${eur(st.budget)}).</p>`;
}
// ---------- Pantalla de inicio: una tarjeta grande con foto por sección, para deslizar ----------
let home = !location.hash.includes("unirse=");
function showHome(on, push = true) {
  if (home === on) return;
  home = on;
  if (!on && push) history.pushState({ v: "lista" }, "");
  render();
  scrollTo({ top: 0 });
}
// Botón «atrás» del móvil desde la lista: vuelve al inicio.
addEventListener("popstate", () => { if (!home && !sheet.open) showHome(true, false); });
// Nombre de la foto de cada tarjeta en recetas-fotos.json (sin el prefijo «Inicio »)
const FOTO_NAME = { list: "Lista", recipes: "Recetas", plan: "Menú", tengo: "En casa", history: "Compras" };
// Encuadre de las fotos apaisadas en la tarjeta vertical (por defecto, el centro)
const FOTO_POS = { list: "24% 50%" };
const HOME_CARDS = [
  ["list", "Lista", "🛒", 150, "Apunta, dicta o escanea lo que necesitas y márcalo en el súper."],
  ["recipes", "Recetas", "🍳", 25, "Recetas con foto para cada momento del día, con raciones y paso a paso."],
  ["plan", "Menú", "📅", 270, "Planifica la semana y apunta de una vez todo lo que te falta."],
  ["tengo", "Con lo que tengo", "🏠", 200, "Qué puedes cocinar con lo que tienes en casa y qué caduca pronto."],
  ["history", "Compras", "🧾", 330, "Tus compras anteriores, lo que gastaste y tus tarjetas de cliente."],
];
// Solo si la comunidad está activada (js/config.js con los datos de Supabase).
if (comReady()) HOME_CARDS.push(["com", "Comunidad", "👥", 100, "Recetas de la gente, estrellas, comentarios con foto y una charla para todos."]);
let homeHTML = "";
// Saludo: con tu cuenta, «Hola, Nombre»; sin ella, una invitación a entrar y poner tu nombre.
function renderHello() {
  const me = comReady() ? meNow() : null, b = $("homeMe");
  $("homeName").textContent = me?.nombre ? `Hola, ${me.nombre}` : "Super Lista";
  b.hidden = !comReady() || !!me?.nombre;
  if (!b.hidden) b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>${me ? "Tu nombre" : "Entrar"}</span>`;
}
$("homeMe").onclick = () => { buzz(); openCuenta({ back: null }); };
$("insGo").onclick = () => { buzz(); install(openSheet); };
$("insLater").onclick = () => { installLater(); $("homeIns").hidden = true; };
initInstalar(() => { if (home) renderHome(); });
addEventListener("superlista:cuenta", () => { if (home) renderHome(); });
async function renderHome() {
  const h = new Date().getHours();
  $("homeHi").textContent = h >= 6 && h < 14 ? "¡Buenos días!" : h >= 14 && h < 21 ? "¡Buenas tardes!" : "¡Buenas noches!";
  renderHello();
  $("homeIns").hidden = !showBanner();
  const info = await homeInfo().catch(() => null);
  const l = list(), left = l.items.filter((i) => !i.done);
  const total = left.reduce((a, i) => a + (itemPrice(i) ?? 0), 0);
  const last = st.history.at(-1), nc = (st.cards ?? []).length;
  const ro = runningOut(), spent = monthSpent();
  const live = {
    list: left.length ? `${left.length} por comprar${total ? ` · ${eur(total)}` : ""}` : ro.length ? `⏰ Se te puede acabar: ${ro.slice(0, 2).map((r) => r.label.toLowerCase()).join(" y ")}` : "Tu lista está vacía",
    recipes: info ? `${info.momentEmo} ${info.para}: ${info.inMoment} recetas` : "",
    plan: info?.hoy.length ? `Hoy: ${info.hoy[0]}` : info?.planN ? `${info.planN} recetas esta semana` : "Aún sin planificar",
    tengo: info?.soon.length ? `⏰ ${info.soon[0].n} caduca pronto` : info?.ready ? `Puedes hacer ${info.ready} recetas ya` : "Marca lo que tienes en casa",
    com: meNow()?.nombre ? `Hola, ${meNow().nombre}` : "Entra o crea tu cuenta gratis",
    history: spent ? `Este mes: ${eur(spent)}${st.budget ? ` de ${eur(st.budget)}` : ""}` : last ? `Última: ${new Date(last.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}${last.total ? ` · ${eur(last.total)}` : ""}${nc ? ` · ${nc} tarjeta${nc === 1 ? "" : "s"}` : ""}` : nc ? `${nc} tarjeta${nc === 1 ? "" : "s"} de cliente` : "Aún no has terminado ninguna compra",
  };
  // Lista y Compras: si aún no hay foto propia, las fotos de tus productos.
  const prodImgs = (items) => items.map((i) => i.prod?.img).filter(Boolean).slice(0, 4);
  const mosaic = { list: prodImgs(left), history: prodImgs(last?.items ?? []) };
  const html = HOME_CARDS.map(([k, t, e, hue, d]) => {
    const img = info?.fotos?.[FOTO_NAME[k]]?.img ?? info?.alt?.[FOTO_NAME[k]];
    const mo = !img && mosaic[k]?.length ? `<span class="hc-mosaic">${mosaic[k].map((u) => `<span style="background-image:url('${cssUrl(u)}')"></span>`).join("")}</span>` : "";
    return `<button type="button" class="hcard" data-go="${k}" style="--h:${hue}">
      <span class="hc-bg"${img ? ` style="background-image:url('${cssUrl(img)}')${FOTO_POS[k] && info?.fotos?.[FOTO_NAME[k]] ? `;background-position:${FOTO_POS[k]}` : ""}"` : ""}>${mo}${img || mo ? "" : `<span class="hc-big" aria-hidden="true">${e}</span>`}</span>
      <span class="hc-body"><span class="hc-e" aria-hidden="true">${e}</span><b class="hc-t">${esc(t)}</b><span class="hc-d">${esc(d)}</span>
        ${live[k] ? `<span class="hc-live">${esc(live[k])}</span>` : ""}<span class="hc-go">Abrir ›</span></span></button>`;
  }).join("");
  if (html !== homeHTML) {
    $("hcards").innerHTML = html; homeHTML = html;
    $("hdots").innerHTML = HOME_CARDS.map((_, k) => `<span${k === 0 ? ' class="on"' : ""}></span>`).join("");
  }
}
// La barra de secciones también se ve dentro de las secciones que se abren como hoja (Recetas, Menú, En casa, Compras).
$("sheetTabs").innerHTML = $("tabbar").innerHTML;
function markSheetTab(k) {
  sheet.dataset.sec = k;
  const cur = k === "tengo" ? "pantry" : k;
  for (const b of $("sheetTabs").children) { if (b.dataset.tab === cur) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }
}
$("sheetTabs").addEventListener("click", (e) => { const t = e.target.closest("[data-tab]")?.dataset.tab; if (t) goSection(t); });
function goSection(k) {
  buzz();
  if (k !== "home" && k !== "list") markSheetTab(k);
  if (k === "home") { closeSheet(); return showHome(true); }
  if (k === "list") { closeSheet(); return showHome(false); }
  if (k === "recipes") openRecipes();
  else if (k === "plan" || k === "pantry" || k === "tengo") openRecipes(null, null, k);
  else if (k === "history") openHistory();
  else if (k === "com") openComunidad({ from: null });
}
$("hcards").addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) goSection(b.dataset.go); });
$("hcards").addEventListener("scroll", () => {
  const c = $("hcards"), w = c.firstElementChild?.offsetWidth || 1;
  const k = Math.round(c.scrollLeft / (w + 14));
  [...$("hdots").children].forEach((d, i) => d.classList.toggle("on", i === k));
}, { passive: true });

function render() {
  const l = list();
  document.body.classList.toggle("home", home);
  $("home").hidden = !home;
  for (const b of $("tabbar").children) b.toggleAttribute("aria-current", false);
  $("tabbar").querySelector(`[data-tab="${home ? "home" : "list"}"]`)?.setAttribute("aria-current", "page");
  if (home) renderHome();
  renderIdeas($("ideas")).catch(() => {});
  renderDeals().catch(() => {});
  $("listName").textContent = l.sid ? `${l.name} 👥` : l.name;
  syncCurrent();
  document.body.classList.toggle("shop", !!st.shop);
  $("shopBtn").setAttribute("aria-pressed", String(!!st.shop));
  renderStores();
  renderSummary();
  renderFavs();
  $("finishWrap").hidden = !l.items.some((i) => i.done);
  const el = $("list");
  if (!l.items.length) {
    el.classList.remove("grid");
    el.innerHTML = `<div class="empty"><span class="empty-art" aria-hidden="true">🧺</span><b>La lista está vacía</b><span>Escribe o dicta lo que necesitas, por ejemplo:</span>
      <button class="btn ghost" type="button" data-try="apunta leche, huevos y oreos">«apunta leche, huevos y oreos»</button>
      <span>o elige de la lista de productos:</span>
      <button class="btn" type="button" data-browse>Ver productos</button></div>`;
    return;
  }
  const grid = (st.view ?? "grid") === "grid";
  el.classList.toggle("grid", grid);
  const by = {};
  const left = l.items.filter((i) => !i.done), cart = l.items.filter((i) => i.done);
  for (const it of left) (by[CATS.includes(it.cat) ? it.cat : "Otros"] ??= []).push(it);
  const one = (it) => grid ? tileHTML(it, l) : rowHTML(it, l);
  const head = (c, n) => { const [e, h] = CAT_LOOK[c] ?? CAT_LOOK.Otros; return `<h2 style="--h:${h}"><span class="cat-ic" aria-hidden="true">${e}</span>${esc(c)}<span class="cat-n">${n}</span></h2>`; };
  // En cuadrícula todo va seguido por pasillos (el color de la ficha dice cuál); en lista, con un título por pasillo.
  const order = aisleOrder(l.store).filter((c) => by[c]);
  el.innerHTML = (grid ? `<section class="cat"><ul class="items">${order.map((c) => by[c].sort((a, b) => a.added - b.added)
      .map((it) => one(it).replace('class="item gt', `style="--h:${(CAT_LOOK[c] ?? CAT_LOOK.Otros)[1]}" class="item gt`)).join("")).join("")}</ul></section>`
    : order.map((c) => `<section class="cat" style="--h:${(CAT_LOOK[c] ?? CAT_LOOK.Otros)[1]}">${head(c, by[c].length)}
      <ul class="items">${by[c].sort((a, b) => a.added - b.added).map(one).join("")}</ul></section>`).join(""))
    + (cart.length ? `<section class="cat cart"><h2><span class="cat-ic" aria-hidden="true">✅</span>En el carro<span class="cat-n">${cart.length}</span></h2>
      <ul class="items">${cart.sort((a, b) => a.added - b.added).map(one).join("")}</ul></section>` : "")
    + (st.gestured ? "" : `<p class="hint">${grid ? "Consejo: toca un producto para meterlo en el carro, deslízalo a la izquierda para quitarlo o mantenlo pulsado para cambiarlo o editarlo."
      : "Consejo: desliza un producto a la izquierda para borrarlo, a la derecha para marcarlo como comprado, o mantenlo pulsado para ver más opciones."}</p>`);
  fresh.clear();
}
// Aviso en la lista si algo lleva lo que has marcado en 🛡️ Alergias (por el nombre del producto).
function algWarn(it) {
  const av = avoidSet(st.diet?.evita);
  if (!av.size) return "";
  const c = conflicts(`${it.label} ${it.prod?.n ?? ""}`, av).filter((k) => !(k === "lactosa" && av.has("leche")));
  return c.length ? `<span class="alg-w" title="Revisa la etiqueta">⚠️ ${esc(c.map((k) => ALLER.get(k)[2].replace(" (alergia)", "").toLowerCase()).join(", "))}</span>` : "";
}
function rowHTML(it, l) {
  const p = it.prod;
  const sub = p ? [it.note, p.n, p.f, l.store === "any" ? STORE_NAME[p.s] : ""].filter(Boolean).join(" · ") : it.note || "Toca la foto para elegir producto";
  const price = itemPrice(it);
  return `<li class="item${it.done ? " done" : ""}${fresh.has(it.id) ? " fresh" : ""}${incoming.has(it.id) ? " incoming" : ""}" data-id="${it.id}">
    <div class="swipe-bg" aria-hidden="true"><span class="bg-done">${CHECK_SVG}${it.done ? "Pendiente" : "Comprado"}</span><span class="bg-del">Borrar${TRASH_SVG}</span></div>
    <div class="row-in">
    <button class="thumb" type="button" data-pick="${it.id}" aria-label="Cambiar producto de ${esc(it.label)}">${thumbHTML(p, it.emoji)}</button>
    <span class="info"><span class="name">${esc(it.label)}${algWarn(it)}</span><span class="sub">${esc(sub)}</span></span>
    <span class="right">
      <button class="qty" type="button" data-qty="${it.id}">${esc(it.qty || "1")}</button>
      ${price != null ? `<span class="price">${dropHTML(p)}${eur(price)}</span>` : ""}
    </span>
    <span class="check" role="checkbox" aria-checked="${it.done}" aria-label="Comprado">${CHECK_SVG}</span>
    </div>
  </li>`;
}
// Ficha grande tipo Bring!: foto, nombre, cantidad y precio. Tocar = al carro; mantener = opciones.
function tileHTML(it, l) {
  const p = it.prod, price = itemPrice(it);
  const q = it.qty && it.qty !== "1" ? it.qty : it.count > 1 ? `×${it.count}` : "";
  return `<li class="item gt${it.done ? " done" : ""}${fresh.has(it.id) ? " fresh" : ""}${incoming.has(it.id) ? " incoming" : ""}" data-id="${it.id}"
      role="checkbox" aria-checked="${it.done}" aria-label="${esc(it.label)}${q ? `, ${esc(q)}` : ""}" tabindex="0">
    <span class="gt-ph">${thumbHTML(p, it.emoji)}${q ? `<span class="gt-q">${esc(q)}</span>` : ""}${badgeHTML(p)}<span class="gt-cat" aria-hidden="true">${(CAT_LOOK[CATS.includes(it.cat) ? it.cat : "Otros"] ?? CAT_LOOK.Otros)[0]}</span><span class="gt-ck" aria-hidden="true">${CHECK_SVG}</span><span class="gt-del" aria-hidden="true">${TRASH_SVG}Quitar</span></span>
    <span class="gt-n">${esc(it.label)}</span>${algWarn(it)}
    <span class="gt-s">${esc(it.note || (p ? [p.f, l.store === "any" ? STORE_NAME[p.s] : ""].filter(Boolean).join(" · ") : ""))}</span>
    ${price != null ? `<span class="gt-p">${eur(price)}</span>` : ""}
  </li>`;
}
function renderFavs() {
  const inList = new Set(list().items.filter((i) => !i.done).map((i) => norm(i.label)));
  // Primero lo que se te puede estar acabando (lo compras cada X días y ya toca), luego lo que más compras.
  const due = new Map(runningOut().map((r) => [r.k, r]));
  const favs = Object.entries(st.freq).filter(([k]) => !inList.has(k))
    .sort((a, b) => due.has(b[0]) - due.has(a[0]) || b[1].count - a[1].count || b[1].last - a[1].last).slice(0, 12);
  $("favs").hidden = !favs.length;
  $("favs").innerHTML = favs.map(([k, f]) => { const d = due.get(k);
    return `<button class="fav${d ? " due" : ""}" type="button" data-fav="${esc(k)}"${d ? ` title="Sueles comprarlo cada ${d.every} días y hace ${d.days}"` : ""}>${thumbHTML(f.prod, f.emoji)}${d ? '<span class="due-ic" aria-hidden="true">⏰</span>' : ""}${esc(f.label)}</button>`; }).join("");
}

// ---------- Hojas ----------
const sheet = $("sheet");
// Versión grande de la foto: Mercadona (imgix) y Open Food Facts permiten pedir más resolución.
function bigImg(u) {
  return String(u).replace(/([?&])h=\d+&w=\d+/, "$1h=800&w=800").replace(/\.(100|200)\.jpg$/, ".400.jpg");
}
function openSheet(title, html, cls = "") {
  sheet.className = `sheet ${cls}`.trim();
  setSheetBack(false);
  $("sheetTitle").textContent = title;
  $("sheetBody").innerHTML = html;
  if (!sheet.open) sheet.showModal();
}
function closeSheet() { if (sheet.open) sheet.close(); }
// En recetas, cerrar una receta vuelve a la lista de recetas en vez de salir del todo.
const CLOSE_SVG = $("sheetClose").innerHTML;
const BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
function setSheetBack(on) {
  $("sheetClose").innerHTML = on ? BACK_SVG : CLOSE_SVG;
  $("sheetClose").setAttribute("aria-label", on ? "Volver a las recetas" : "Cerrar");
}
function sheetBack() { if (sheet.classList.contains("cooking") && cookBack()) return; closeSheet(); }
$("sheetClose").addEventListener("click", sheetBack);
sheet.addEventListener("cancel", (e) => { if (sheet.classList.contains("cooking") && cookBack()) e.preventDefault(); });
sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
// Si la hoja se ha vuelto a abrir con otro contenido (p. ej. del menú a «Editar»), no se borra.
sheet.addEventListener("close", () => { if (sheet.open) return; placeToast(); delete sheet.dataset.sec; stopScan(); $("sheetBody").innerHTML = ""; renderIdeas($("ideas")).catch(() => {}); if (home) renderHome(); });

async function openPicker(id, query) {
  const l = list();
  const it = l.items.find((i) => i.id === id);
  if (!it) return;
  query ??= it.label;
  openSheet(it.label, `<label class="field">Buscar en ${esc(STORE_NAME[l.store])}<input id="pickQ" type="search" value="${esc(query)}" enterkeyhint="search"></label>
    <div id="pickBar"></div><p class="note" id="pickNote">Cargando productos…</p><div class="opts" id="pickOpts"></div>`);
  const cat = await catalogFor(l.store);
  if (!sheet.open) return;
  const fs = { sort: "rel", diets: new Set() };
  const all = search(cat, query, 150);
  let opts;
  const draw = () => {
  const filtered = fs.sort !== "rel" || fs.diets.size;
  const res = applyFilters(all, fs).slice(0, filtered ? 40 : 30);
  opts = [{ none: true }, ...res];
  if (all.length > 1) $("pickBar").innerHTML = filterBarHTML(fs);
  $("pickNote").textContent = res.length ? "Elige el producto que quieres:" : filtered ? "No hay productos así. Quita algún filtro." : (cat.length ? "No encuentro ese producto. Prueba con otras palabras." : "Aún no hay catálogo de este supermercado.");
  $("pickOpts").innerHTML = opts.map((p, k) => p.none
    ? `<button class="opt" type="button" data-choose="none" aria-pressed="${!it.prod}"><span class="ph"><span class="emo">${esc(it.emoji)}</span></span><span class="on">Sin producto concreto</span></button>`
    : `<button class="opt" type="button" data-choose="${k}" aria-pressed="${it.prod?.n === p.n && it.prod?.s === p.s}">
        <span class="ph">${thumbHTML(p, it.emoji)}</span><span class="on">${esc(p.n)}</span>
        <span class="op">${offerHTML(p)}${esc([p.f, p.p != null ? eur(p.p) : "", p.u, l.store === "any" ? STORE_NAME[p.s] : ""].filter(Boolean).join(" · "))}</span></button>`).join("");
  };
  draw();
  $("pickBar").onclick = (e) => { if (filterBarClick(e, fs)) draw(); };
  $("pickOpts").onclick = (e) => {
    const b = e.target.closest("[data-choose]");
    if (!b) return;
    const p = b.dataset.choose === "none" ? null : opts[+b.dataset.choose];
    it.prod = pick(p);
    if (p) { it.cat = p.c; st.memory[memKey(it.label, l.store)] = it.prod; }
    else delete st.memory[memKey(it.label, l.store)];
    const f = st.freq[norm(it.label)]; if (f) f.prod = it.prod;
    save(); render(); closeSheet();
  };
  $("pickQ").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); openPicker(id, e.target.value); } };
}

// Editar un producto: el texto (por si el dictado se equivoca) y la cantidad.
function openEdit(id, focusName = true) {
  const it = list().items.find((i) => i.id === id);
  if (!it) return;
  openSheet("Editar producto", `<label class="field">Nombre<input id="eName" value="${esc(it.label)}" enterkeyhint="done" autocomplete="off" autocapitalize="sentences"></label>
    <div class="row"><span class="note" style="flex:1">Cantidad</span><button class="round" type="button" id="qMinus" aria-label="Menos">−</button>
      <strong id="qCount" style="font-size:1.6rem;min-width:2ch;text-align:center">${it.count || 1}</strong>
      <button class="round" type="button" id="qPlus" aria-label="Más">+</button></div>
    <label class="field">O escribe la cantidad (por ejemplo «2 kg» o «pack de 6»)<input id="qText" value="${esc(it.qty)}" autocomplete="off"></label>
    <label class="field">Nota (marca, tamaño, «sin lactosa», «la de oferta»…)<input id="eNote" value="${esc(it.note ?? "")}" autocomplete="off" placeholder="Opcional"></label>
    <div class="row"><button class="btn" type="button" id="qSave">Guardar</button>
    <button class="btn danger" type="button" id="qDel">Quitar de la lista</button></div>`);
  // El foco en el mismo toque hace que el móvil abra el teclado.
  if (focusName) { const n = $("eName"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  let c = it.count || 1;
  const upd = (d) => { c = Math.max(1, c + d); $("qCount").textContent = c; $("qText").value = String(c); };
  $("qMinus").onclick = () => upd(-1);
  $("qPlus").onclick = () => upd(1);
  const doSave = async () => {
    const t = $("qText").value.trim();
    it.qty = t; it.count = /^\d+$/.test(t) ? +t : c;
    const note = $("eNote").value.trim(); if (note) it.note = note; else delete it.note;
    const name = capital($("eName").value.trim());
    closeSheet();
    if (name && name !== it.label) {
      // Nuevo nombre: nuevo dibujo y el producto que mejor encaje en el súper.
      it.label = name; it.emoji = guess(name).emoji;
      const cat = await catalogFor(list().store);
      it.prod = st.memory[memKey(name, list().store)] ?? bestProd(cat, name);
      it.cat = it.prod?.c ?? guess(name).cat;
      fresh.add(it.id);
    }
    save(); render();
  };
  $("qSave").onclick = doSave;
  $("eName").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); doSave(); } };
  $("qDel").onclick = () => { closeSheet(); removeItem(it.id); };
}

function openLists() {
  const rows = st.lists.map((l) => {
    const left = l.items.filter((i) => !i.done).length;
    return `<button class="l" type="button" data-list="${l.id}" aria-current="${l.id === st.current}"><span>${esc(l.name)}</span><span class="meta">${left} · ${esc(STORE_NAME[l.store])}</span></button>`;
  }).join("");
  openSheet("Tus listas", `<div class="lists">${rows}</div>
    <label class="field">Nueva lista<input id="newList" placeholder="Cumpleaños, Lidl, Casa de la playa…"></label>
    <div class="row"><button class="btn" type="button" id="addList">Crear lista</button></div>
    ${shareHTML(list())}
    <label class="field">Nombre de la lista actual<input id="renList" value="${esc(list().name)}"></label>
    <div class="row"><button class="btn ghost" type="button" id="saveName">Cambiar nombre</button>
    ${st.lists.length > 1 ? `<button class="btn danger" type="button" id="delList">Borrar esta lista</button>` : ""}</div>`);
  $("sheetBody").querySelector(".lists").onclick = (e) => {
    const b = e.target.closest("[data-list]"); if (!b) return;
    st.current = b.dataset.list; save(); render(); closeSheet();
  };
  $("addList").onclick = () => {
    const name = $("newList").value.trim() || `Lista ${st.lists.length + 1}`;
    const l = { id: uid(), name, store: list().store, items: [] };
    st.lists.push(l); st.current = l.id; save(); render(); closeSheet();
  };
  bindShare();
  $("saveName").onclick = () => { const n = $("renList").value.trim(); if (n) { list().name = n; save(); render(); closeSheet(); } };
  const del = $("delList");
  if (del) del.onclick = () => {
    if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "Toca otra vez para borrarla"; return; }
    st.lists = st.lists.filter((l) => l.id !== st.current); st.current = st.lists[0].id; save(); render(); closeSheet();
  };
}

// ---------- Compartir lista ----------
function shareHTML(l) {
  if (!syncReady()) return "";
  return l.sid ? `<div class="share"><p><b>👥 Lista compartida.</b> Quien tenga el enlace ve y cambia «${esc(l.name)}» al momento.</p>
      <div class="row"><button class="btn ghost small" type="button" id="shareSend">Enviar el enlace</button>
      <button class="btn danger small" type="button" id="shareStop">Dejar de compartir</button></div></div>`
    : `<div class="share"><p>👥 Comparte «${esc(l.name)}» con tu familia: lo que apunte cualquiera se ve al momento en todos los móviles.</p>
      <div class="row"><button class="btn ghost small" type="button" id="shareStart">Compartir esta lista</button></div></div>`;
}
async function sendLink(l) {
  const url = shareURL(l);
  try {
    if (navigator.share) { await navigator.share({ title: "Super Lista", text: `Únete a mi lista de la compra «${l.name}»`, url }); return; }
  } catch (e) { if (e?.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(url); setStatus("Enlace copiado: pégalo en WhatsApp o donde quieras."); }
  catch { prompt("Copia este enlace y envíalo:", url); }
}
function bindShare() {
  const l = list();
  const go = $("shareStart");
  if (go) go.onclick = async () => {
    go.disabled = true; go.textContent = "Compartiendo…";
    if (await share(l)) { render(); openLists(); sendLink(l); }
    else { go.disabled = false; go.textContent = "Compartir esta lista"; setStatus("No he podido compartirla. Revisa la conexión y prueba otra vez.", true); }
  };
  const send = $("shareSend"); if (send) send.onclick = () => sendLink(l);
  const stop = $("shareStop");
  if (stop) stop.onclick = () => {
    if (stop.dataset.sure !== "1") { stop.dataset.sure = "1"; stop.textContent = "Toca otra vez: dejarás de ver sus cambios"; return; }
    unshare(l); render(); openLists(); setStatus(`«${l.name}» ya no está compartida en este móvil.`);
  };
}

// ---------- Comparar el precio de la lista en cada súper ----------
const pricedStores = () => STORES.slice(1).map(([s]) => s).filter((s) => meta?.stores?.[s]?.prices && meta.stores[s].count);
async function openCompare() {
  const l = list(), items = l.items.filter((i) => !i.done);
  if (!items.length) return;
  const stores = pricedStores();
  openSheet("¿Dónde sale más barata?", `<p class="note">Buscando cada producto en ${stores.map((s) => STORE_NAME[s]).join(", ")}…</p>`);
  const cats = await Promise.all(stores.map(loadStore));
  if (!sheet.open) return;
  const res = stores.map((s, k) => {
    const rows = items.map((it) => {
      const prod = it.prod?.s === s && it.prod.p != null ? it.prod : st.memory[memKey(it.label, s)] ?? bestProd(cats[k], it.label);
      return { it, prod, price: prod?.p != null ? prod.p * (it.count || 1) : null };
    });
    return { s, rows, found: rows.filter((r) => r.price != null).length, total: rows.reduce((a, r) => a + (r.price ?? 0), 0) };
  });
  // Lo que un súper no tiene se cuenta con el precio medio de los que sí, para comparar la lista entera.
  const avg = items.map((_, j) => { const ps = res.map((r) => r.rows[j].price).filter((x) => x != null); return ps.length ? ps.reduce((a, x) => a + x, 0) / ps.length : null; });
  for (const r of res) r.est = r.rows.reduce((a, x, j) => a + (x.price ?? avg[j] ?? 0), 0);
  const nAny = avg.filter((x) => x != null).length;
  const ok = res.filter((r) => r.found).sort((a, b) => a.est - b.est);
  const best = ok[0];
  const fmtRow = (x) => `<li><span>${esc(x.it.label)}</span><small>${x.prod ? esc(x.prod.n) : "No lo encuentro"}</small><b>${x.price != null ? eur(x.price) : "—"}</b></li>`;
  $("sheetBody").innerHTML = ok.length ? `
    <p class="note">Precio aproximado de tus ${nAny} productos con precio, eligiendo en cada súper el que más se parece. Si un súper no tiene algo, se cuenta lo que cuesta de media en los demás.</p>
    <div class="cmp">${ok.map((r) => {
      const cur = r.s === l.store, top = r === best && ok.length > 1, diff = r.est - best.est;
      const miss = nAny - r.found;
      return `<article class="cmp-s${top ? " best" : ""}">
        <div class="cmp-h"><span class="cmp-logo" style="background-image:url('img/logos/${r.s}.png')" aria-hidden="true"></span>
          <span class="cmp-n"><b>${esc(STORE_NAME[r.s])}</b>${top ? `<span class="badge">Más barato</span>` : ""}${cur ? `<span class="badge ghost">Tu súper</span>` : ""}</span>
          <span class="cmp-p">${eur(r.est)}${diff > 0.005 ? `<small>+${eur(diff)}</small>` : ""}</span></div>
        <p class="cmp-sub">${miss > 0 ? `Tiene ${r.found} de ${nAny} · ${miss === 1 ? "1 producto calculado" : `${miss} productos calculados`} con el precio medio` : `Tiene los ${nAny} productos`}</p>
        <details><summary>Ver productos</summary><ul class="cmp-l">${r.rows.map(fmtRow).join("")}</ul></details>
        ${cur ? "" : `<button class="btn ghost small" type="button" data-use="${r.s}">Hacer la compra en ${esc(STORE_NAME[r.s])}</button>`}
      </article>`;
    }).join("")}</div>` : `<p class="note">No encuentro precios para lo que tienes en la lista.</p>`;
  $("sheetBody").onclick = (e) => {
    const b = e.target.closest("[data-use]"); if (!b) return;
    const r = res.find((x) => x.s === b.dataset.use);
    // La lista pasa a ese súper con el producto que se ha usado para comparar.
    for (const x of r.rows) {
      if (x.prod) { x.it.prod = pick(x.prod); x.it.cat = x.prod.c ?? x.it.cat; }
      else if (x.it.prod && x.it.prod.s !== r.s) x.it.prod = null; // para no mezclar precios de otro súper
    }
    l.store = r.s; save(); render(); closeSheet(); buzz(20);
    setStatus(`Lista cambiada a ${STORE_NAME[r.s]}: unos ${eur(r.total)} por lo que encuentra.`);
  };
}

function openHistory() {
  const nc = (st.cards ?? []).length;
  const tile = (id, e, t, d) => `<button type="button" class="qa" id="${id}"><span class="qa-e" aria-hidden="true">${e}</span><b>${t}</b><small>${esc(d)}</small></button>`;
  const top = `<div class="qa-grid">
    ${tile("hTicket", "🧾", "Escanear ticket", "Con una foto")}
    ${tile("hCards", "💳", "Tarjetas", nc ? `${nc} guardada${nc === 1 ? "" : "s"}` : "Añadir")}
    ${tile("hBackup", "💾", "Copia", st.lastBackup ? `Última: ${new Date(st.lastBackup).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}` : "Hacer ahora")}
    ${tile("hSettings", "⚙️", "Ajustes", `Avisos: ${st.alerts?.on ? "sí" : "no"}`)}</div>`;
  const wire = () => { $("hTicket").onclick = () => openTicket(); $("hCards").onclick = () => openCards(); $("hBackup").onclick = () => openBackup(); $("hSettings").onclick = () => openSettings(); if ($("spBudget")) wireSpend(); };
  if (!st.history.length) { openSheet("Compras", `${top}<p class="note">Aquí verás cada compra cuando pulses «Terminar compra» o escanees un ticket.</p>`); wire(); return; }
  openSheet("Compras", `${spendHTML()}${top}<h3 class="cgroup hist-t">Tus compras <span>desliza a la izquierda para borrar</span></h3><div class="hist">${st.history.slice().reverse().map((h, k) => {
    const d = new Date(h.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    const n = h.items.length, logo = logoOf(h.store);
    return `<div class="sw" data-sw="h:${st.history.length - 1 - k}"><div class="sw-act"><button type="button" class="sw-del">${TRASH_SVG}Borrar</button></div><article class="sw-in"><div class="h-top">${logo ? `<span class="h-logo" style="background-image:url('${logo}')" aria-hidden="true"></span>` : `<span class="h-logo any" aria-hidden="true">🛒</span>`}
        <span class="h-who"><b>${esc(STORE_NAME[h.store] ?? "Compra")}</b><small>${esc(d)}</small></span>${h.total ? `<b class="h-tot">${eur(h.total)}</b>` : ""}</div>
      <p class="h-items"><span>${n} producto${n === 1 ? "" : "s"}:</span> ${esc(h.items.map((i) => i.label).join(", "))}</p>
      <div class="h-btns"><button class="btn ghost small" type="button" data-repeat="${st.history.length - 1 - k}">↺ Volver a apuntar</button>
        <button class="btn ghost small" type="button" data-fix="${st.history.length - 1 - k}">✎ Corregir</button>
        <button type="button" class="sw-del only-mouse">Borrar</button></div></article></div>`;
  }).join("")}</div>`);
  wire();
  $("sheetBody").onclick = async (e) => {
    const f = e.target.closest("[data-fix]"); if (f) return openPurchase(+f.dataset.fix);
    const b = e.target.closest("[data-repeat]"); if (!b) return;
    const h = st.history[+b.dataset.repeat];
    for (const i of h.items) await addItem({ query: i.label, qty: i.qty, count: i.count || 1 }, i.prod);
    save(); render(); closeSheet(); setStatus(`Apuntados ${h.items.length} productos de esa compra.`);
  };
}

// Corregir una compra: quitar lo que se marcó sin querer o devolverlo a la lista. Siempre con «Deshacer».
function openPurchase(idx) {
  const h = st.history[idx]; if (!h) return openHistory();
  const d = new Date(h.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const back = (i) => {
    const l = list(); if (l.items.some((x) => !x.done && norm(x.label) === norm(i.label))) return;
    const g = guess(i.label), it = { id: uid(), label: i.label, qty: i.qty ?? "", count: i.count || 1, done: false, prod: i.prod ?? null, cat: i.prod?.c ?? g.cat, emoji: g.emoji, added: Date.now() };
    l.items.push(it); fresh.add(it.id);
  };
  const fixTotal = () => { if (h.total) h.total = Math.max(0, Math.round(h.items.reduce((s, i) => s + (itemPrice(i) ?? 0), 0) * 100) / 100); };
  const reopen = () => { const y = sheet.scrollTop; openPurchase(idx); sheet.scrollTop = y; };
  openSheet("Corregir compra", `<button class="btn ghost small pc-back" type="button" id="pcBack">‹ Volver a Compras</button>
    <p class="note">${esc(STORE_NAME[h.store] ?? "Compra")} · ${esc(d)}. Si marcaste algo sin querer, quítalo de aquí. «A la lista» lo vuelve a apuntar como pendiente.</p>
    <ul class="pc-list">${h.items.map((i, k) => {
      const pr = itemPrice(i);
      return `<li><span class="pc-ph">${photoHTML(i.prod?.img, guess(i.label).emoji, i.label)}</span>
        <span class="pc-name"><b>${esc(i.label)}</b>${pr != null ? `<small>${eur(pr)}</small>` : ""}</span>
        <button type="button" class="pc-btn" data-back="${k}">A la lista</button>
        <button type="button" class="pc-btn del" data-del="${k}" aria-label="Quitar ${esc(i.label)}">Quitar</button></li>`;
    }).join("")}</ul>
    <div class="pc-foot"><button class="btn ghost" type="button" id="pcAllBack">↩ Devolver todo a la lista</button>
      <button class="btn ghost danger" type="button" id="pcDel">Borrar esta compra</button></div>`);
  $("pcBack").onclick = openHistory;
  // Si se queda sin productos, la compra desaparece del historial.
  const drop = (k, toList) => withUndo(toList ? `«${h.items[k].label}» vuelve a la lista` : `Quitado «${h.items[k].label}»`, () => {
    const [i] = h.items.splice(k, 1);
    if (toList) back(i);
    fixTotal();
    if (!h.items.length) st.history.splice(idx, 1);
  }, reopen);
  $("sheetBody").onclick = (e) => {
    const b = e.target.closest("[data-back],[data-del]"); if (!b) return;
    const k = +(b.dataset.back ?? b.dataset.del);
    buzz(); drop(k, b.dataset.back != null);
    if (st.history[idx] === h) reopen(); else openHistory();
  };
  $("pcAllBack").onclick = () => {
    withUndo(`${h.items.length} producto${h.items.length === 1 ? "" : "s"} de vuelta en la lista`, () => { h.items.forEach(back); st.history.splice(idx, 1); }, openHistory);
    openHistory();
  };
  $("pcDel").onclick = () => {
    withUndo(`Compra borrada${h.total ? ` (${eur(h.total)})` : ""}`, () => { st.history.splice(idx, 1); }, openHistory);
    openHistory();
  };
}

// ---------- Escanear el ticket ----------
// Se lee en el propio móvil; luego se revisa y se guarda como una compra más (gasto del mes, «se te acaba», En casa).
function openTicket(note = "") {
  openSheet("Escanear ticket", `<p class="note">Haz una foto al ticket entero, estirado y con buena luz. Se lee en tu móvil: la foto no se envía a ningún sitio.</p>
    ${note ? `<p class="bk-msg warn" role="alert">${esc(note)}</p>` : ""}
    <div class="row tk-pick"><label class="btn"><input type="file" accept="image/*" capture="environment" id="tkCam" hidden>📷 Hacer foto</label>
      <label class="btn ghost"><input type="file" accept="image/*" id="tkGal" hidden>Elegir de la galería</label></div>
    <div class="tk-prog" id="tkProg" hidden><p id="tkMsg" aria-live="polite">Preparando el lector…</p><progress id="tkBar" max="1"></progress></div>`, "ticketing");
  const go = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    $("tkProg").hidden = false; document.querySelector(".tk-pick").hidden = true;
    try {
      const text = await readTicket(f, (fase, v) => { if (!$("tkBar")) return; $("tkBar").value = v;
        $("tkMsg").textContent = fase === "lectura" ? `Leyendo el ticket… ${Math.round(v * 100)} %` : "Preparando el lector (la primera vez tarda un poco)…"; });
      if (!(sheet.open && sheet.classList.contains("ticketing"))) return;
      ticketReview(parseTicket(text), text);
    } catch {
      if (sheet.open && sheet.classList.contains("ticketing")) openTicket("No se ha podido cargar el lector. Necesita internet la primera vez; prueba otra vez con conexión.");
    }
  };
  $("tkCam").onchange = go; $("tkGal").onchange = go;
}
function ticketReview(t, text) {
  const day = (ms) => new Date(ms - new Date(ms).getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const row = (i = { label: "", count: 1, price: "" }) => `<li class="tk-it"><input class="tk-n" aria-label="Producto" value="${esc(i.count > 1 ? `${i.count} ${i.label}` : i.label)}" placeholder="Producto">
    <input class="tk-p" aria-label="Precio" inputmode="decimal" value="${i.price === "" ? "" : i.price.toFixed(2).replace(".", ",")}" placeholder="0,00"><button type="button" class="tk-x" aria-label="Quitar">×</button></li>`;
  const ok = t.items.length || t.total;
  openSheet("Revisa el ticket", `<p class="note">${ok ? `He leído ${t.items.length} producto${t.items.length === 1 ? "" : "s"}. Corrige lo que no esté bien antes de guardar.` : "No he podido leer bien el ticket. Puedes repetir la foto o apuntar a mano el total."}</p>
    <form id="tkForm" class="tk-form">
      <div class="tk-top"><label class="field">Súper<select id="tkStore">${STORES.map(([s, n]) => `<option value="${s}"${s === t.store ? " selected" : ""}>${esc(s === "any" ? "Otro" : n)}</option>`).join("")}</select></label>
        <label class="field">Día<input type="date" id="tkDate" value="${day(t.date ?? Date.now())}" max="${day(Date.now())}"></label>
        <label class="field">Total (€)<input id="tkTotal" inputmode="decimal" value="${t.total ? t.total.toFixed(2).replace(".", ",") : ""}" placeholder="0,00"></label></div>
      ${t.total && t.items.length && Math.abs(t.sum - t.total) > 0.05 ? `<p class="tk-diff">Los productos suman ${eur(t.sum)}; puede faltar alguno o haber descuentos.</p>` : ""}
      <ul class="tk-list" id="tkList">${t.items.map(row).join("")}</ul>
      <button type="button" class="padd" id="tkAdd">+ Añadir producto</button>
      <label class="tk-chk"><input type="checkbox" id="tkHome" checked> Pasar lo comprado a «En casa»</label>
      <div class="row"><button class="btn" type="submit">Guardar compra</button><button class="btn ghost" type="button" id="tkAgain">Repetir foto</button></div>
      <details class="tk-raw"><summary>Ver el texto leído</summary><pre>${esc(text)}</pre></details>
    </form>`, "ticketing");
  $("tkList").onclick = (e) => { const x = e.target.closest(".tk-x"); if (x) x.closest("li").remove(); };
  $("tkAdd").onclick = () => { $("tkList").insertAdjacentHTML("beforeend", row()); $("tkList").lastElementChild.querySelector("input").focus(); };
  $("tkAgain").onclick = () => openTicket();
  $("tkForm").onsubmit = (e) => {
    e.preventDefault();
    const money = (v) => { const n = parseFloat(String(v).replace(/[^\d,.-]/g, "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
    const items = [...$("tkList").children].map((li) => {
      const raw = li.querySelector(".tk-n").value.trim(), m = raw.match(/^(\d{1,2})\s+(.+)/);
      return { label: capital(m ? m[2] : raw), qty: "", count: m ? +m[1] : 1, price: money(li.querySelector(".tk-p").value) };
    }).filter((i) => i.label);
    const total = money($("tkTotal").value) || Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100;
    if (!items.length && !total) { $("tkTotal").focus(); return; }
    const d = $("tkDate").value ? new Date(`${$("tkDate").value}T12:00`).getTime() : Date.now();
    const date = Math.min(d, Date.now());
    const h = { date, list: "Ticket", store: $("tkStore").value, total, items, ticket: true };
    const at = st.history.findIndex((x) => x.date > date);
    if (at < 0) st.history.push(h); else st.history.splice(at, 0, h);
    if (st.history.length > 100) st.history.shift();
    if ($("tkHome").checked) learnPurchase(items);
    save(); render(); openHistory();
    setStatus(`Ticket guardado: ${items.length} producto${items.length === 1 ? "" : "s"}${total ? `, ${eur(total)}` : ""}.`);
  };
}

// ---------- Copia de seguridad ----------
// Todo vive en este móvil: la copia guarda listas, recetas propias, menú, despensa, compras y tarjetas en un archivo.
const PHOTOS_KEY = "superlista.misfotos";
function openBackup(note = "") {
  const myR = (st.myR ?? []).length, nl = st.lists.length;
  openSheet("Copia de seguridad", `<p class="note">Guarda en un archivo todo lo que tienes en la app: ${nl} lista${nl === 1 ? "" : "s"}, ${st.history.length} compra${st.history.length === 1 ? "" : "s"}, ${myR} receta${myR === 1 ? "" : "s"} tuya${myR === 1 ? "" : "s"}, el menú, lo que tienes en casa y tus tarjetas. Guárdalo en Drive o mándatelo por WhatsApp; si cambias de móvil o se borran los datos, lo recuperas aquí.</p>
    ${st.lastBackup ? `<p class="note">Última copia: ${esc(new Date(st.lastBackup).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }))}.</p>` : ""}
    ${note ? `<p class="bk-msg" role="status">${esc(note)}</p>` : ""}
    <div class="bk-row"><button class="btn" type="button" id="bkSave">Guardar copia</button>
    <label class="btn ghost" for="bkFile">Recuperar una copia</label><input type="file" id="bkFile" accept=".json,application/json" hidden></div>
    <div id="bkAsk"></div>`);
  $("bkSave").onclick = saveBackup;
  $("bkFile").onchange = (e) => readBackup(e.target.files?.[0]);
}
async function saveBackup() {
  let fotos = {}; try { fotos = JSON.parse(localStorage.getItem(PHOTOS_KEY) || "{}"); } catch {}
  const now = new Date();
  const name = `super-lista-${now.toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify({ app: "superlista", v: 1, date: now.toISOString(), state: st, fotos })], { type: "application/json" });
  const file = new File([blob], name, { type: "application/json" });
  let done = false;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Copia de Super Lista" }); done = true; }
    catch (e) { if (e?.name === "AbortError") return; }
  }
  if (!done) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  st.lastBackup = now.getTime(); persist(); buzz(20);
  openBackup(`Copia guardada: ${name}`);
}
async function readBackup(f) {
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch { return openBackup("Ese archivo no es una copia de Super Lista."); }
  const s2 = data?.state;
  if (data?.app !== "superlista" || !Array.isArray(s2?.lists) || !s2.lists.length) return openBackup("Ese archivo no es una copia de Super Lista.");
  const d = new Date(data.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  $("bkAsk").innerHTML = `<div class="bk-ask"><b>¿Recuperar la copia del ${esc(d)}?</b>
    <span>Tiene ${s2.lists.length} lista${s2.lists.length === 1 ? "" : "s"} y ${(s2.history ?? []).length} compra${(s2.history ?? []).length === 1 ? "" : "s"}. Sustituye lo que hay ahora en la app.</span>
    <div class="bk-row"><button class="btn" type="button" id="bkYes">Sí, recuperar</button><button class="btn ghost" type="button" id="bkNo">Cancelar</button></div></div>`;
  $("bkNo").onclick = () => openBackup();
  $("bkYes").onclick = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s2));
      localStorage.setItem(PHOTOS_KEY, JSON.stringify(data.fotos ?? {}));
    } catch { return openBackup("No he podido guardar la copia: el móvil no tiene espacio para la app."); }
    location.reload();
  };
}

// ---------- Se te acaba (como las sugerencias de Listonic y Bring!) ----------
// Mira cada cuánto compras cada cosa en tus compras terminadas y avisa cuando ya toca.
const DAY = 864e5;
function runningOut() {
  const dates = {};
  for (const h of st.history) for (const i of h.items ?? []) {
    const k = norm(i.label), d = Math.floor(h.date / DAY);
    const a = (dates[k] ??= { label: i.label, d: [] }); if (a.d.at(-1) !== d) a.d.push(d);
  }
  const today = Math.floor(Date.now() / DAY), inList = new Set(list().items.filter((i) => !i.done).map((i) => norm(i.label)));
  return Object.entries(dates).filter(([k, a]) => a.d.length >= 2 && !inList.has(k)).map(([k, a]) => {
    const ds = a.d.sort((x, y) => x - y), every = Math.max(1, Math.round((ds.at(-1) - ds[0]) / (ds.length - 1)));
    return { k, label: a.label, every, days: today - ds.at(-1) };
  }).filter((r) => r.every >= 2 && r.days >= Math.round(r.every * 0.9)).sort((a, b) => b.days / b.every - a.days / a.every);
}

// ---------- Gasto al mes (como Listonic o AnyList) ----------
const monthKey = (t) => { const d = new Date(t); return d.getFullYear() * 12 + d.getMonth(); };
function monthSpent(t = Date.now()) { const k = monthKey(t); return st.history.reduce((s, h) => s + (monthKey(h.date) === k ? h.total || 0 : 0), 0); }
function spendHTML() {
  const now = new Date(), months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 15); months.push({ d, t: monthSpent(d) }); }
  const cur = months[5].t, b = st.budget, max = Math.max(...months.map((m) => m.t), b || 0, 1);
  const past = months.slice(0, 5).filter((m) => m.t), avg = past.length ? past.reduce((x, m) => x + m.t, 0) / past.length : 0;
  const byStore = {};
  for (const h of st.history) if (monthKey(h.date) === monthKey(now) && h.total) byStore[h.store] = (byStore[h.store] ?? 0) + h.total;
  const stores = Object.entries(byStore).sort((x, y) => y[1] - x[1]), topS = stores[0]?.[1] || 1;
  const mName = (d) => d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  const pct = b ? Math.round((cur / b) * 100) : 0, over = b && cur > b;
  return `<section class="spend" aria-label="Gasto al mes">
    <div class="sp-head"><span class="sp-lbl">Gastado en ${esc(now.toLocaleDateString("es-ES", { month: "long" }))}</span>
      <button type="button" class="pill-btn" id="spBudget">${b ? `✎ Tope ${eur(b)}` : "+ Poner un tope"}</button></div>
    <b class="sp-big">${eur(cur)}</b>
    <div id="spEdit"></div>
    ${b ? `<div class="sp-budget"><div class="sp-meter${over ? " over" : ""}" role="img" aria-label="${pct} % del tope"><span style="width:${Math.min(100, pct)}%"></span></div>
      <p class="sp-note${over ? " over" : ""}"><span>${pct} % del tope</span><span>${over ? `Te has pasado ${eur(cur - b)}` : `Te quedan <b>${eur(b - cur)}</b>`}</span></p></div>` : ""}
    <div class="sp-sec"><p class="sp-sub"><span>Últimos 6 meses</span>${avg ? `<span>Media: ${Math.round(avg)} €</span>` : ""}</p>
    <div class="sp-bars">${months.map((m, i) => `<div class="sp-col${i === 5 ? " now" : ""}"><span class="sp-track"><span class="sp-v">${m.t ? Math.round(m.t) + " €" : "–"}</span>
      <span class="sp-bar" style="height:${Math.max(3, (m.t / max) * 78)}%"></span></span><span class="sp-m">${esc(mName(m.d))}</span></div>`).join("")}</div></div>
    ${stores.length ? `<div class="sp-sec"><p class="sp-sub"><span>Este mes por súper</span></p><ul class="sp-stores">${stores.map(([s2, t]) => {
      const logo = logoOf(s2);
      return `<li>${logo ? `<span class="h-logo" style="background-image:url('${logo}')" aria-hidden="true"></span>` : `<span class="h-logo any" aria-hidden="true">🛒</span>`}
        <span class="sp-sn">${esc(STORE_NAME[s2] ?? "Otro")}<span class="sp-sbar"><span style="width:${Math.max(4, (t / topS) * 100)}%"></span></span></span><b>${eur(t)}</b></li>`;
    }).join("")}</ul></div>` : ""}
    <p class="sp-foot">Precio aproximado de lo que marcas al pulsar «Terminar compra» o de tus tickets.</p></section>`;
}
function wireSpend() {
  $("spBudget").onclick = () => {
    $("spEdit").innerHTML = `<form class="sp-form" id="spForm"><label class="vh" for="spIn">Tope de gasto al mes en euros</label>
      <input id="spIn" type="number" inputmode="decimal" min="0" step="10" placeholder="Tope al mes, en €" value="${st.budget ?? ""}">
      <button class="btn" type="submit">Guardar</button>${st.budget ? '<button class="btn ghost" type="button" id="spOff">Quitar</button>' : ""}</form>`;
    $("spIn").focus();
    $("spForm").onsubmit = (e) => { e.preventDefault(); const v = parseFloat($("spIn").value); st.budget = v > 0 ? Math.round(v) : undefined; save(); render(); openHistory(); };
    if ($("spOff")) $("spOff").onclick = () => { delete st.budget; save(); render(); openHistory(); };
  };
}

// ---------- Orden de los pasillos de cada súper (como AnyList u OurGroceries) ----------
function aisleOrder(store) {
  const o = st.aisles?.[store];
  return o ? [...o.filter((c) => CATS.includes(c)), ...CATS.filter((c) => !o.includes(c))] : CATS;
}
function openAisles() {
  const l = list(), name = l.store === "any" ? "tu súper" : STORE_NAME[l.store] ?? "tu súper";
  const draw = () => {
    const o = aisleOrder(l.store);
    openSheet(`Pasillos de ${name}`, `<p class="note">Pon los pasillos en el orden en que recorres ${esc(name)}. La lista se ordenará igual y no tendrás que volver atrás.</p>
      <ol class="aisles">${o.map((c, i) => `<li><span class="a-n">${i + 1}</span><span class="a-ic" aria-hidden="true">${(CAT_LOOK[c] ?? CAT_LOOK.Otros)[0]}</span><span class="a-t">${esc(c)}</span>
        <button type="button" class="icon a-mv" data-up="${i}" aria-label="Subir ${esc(c)}"${i ? "" : " disabled"}>↑</button>
        <button type="button" class="icon a-mv" data-down="${i}" aria-label="Bajar ${esc(c)}"${i === o.length - 1 ? " disabled" : ""}>↓</button></li>`).join("")}</ol>
      ${st.aisles?.[l.store] ? '<button class="btn ghost" type="button" id="aReset">Volver al orden normal</button>' : ""}`);
    $("sheetBody").onclick = (e) => {
      const up = e.target.closest("[data-up]"), dn = e.target.closest("[data-down]");
      if (!up && !dn) return;
      const i = +(up ?? dn).dataset[up ? "up" : "down"], j = up ? i - 1 : i + 1, o2 = aisleOrder(l.store).slice();
      [o2[i], o2[j]] = [o2[j], o2[i]];
      (st.aisles ??= {})[l.store] = o2; save(); render(); buzz(); draw();
      $("sheetBody").querySelector(`[data-${up ? "up" : "down"}="${j}"]`)?.focus();
    };
    if ($("aReset")) $("aReset").onclick = () => { delete st.aisles[l.store]; save(); render(); draw(); };
  };
  draw();
}

// ---------- Tarjetas de cliente (como Stocard o Bring!) ----------
const logoOf = (s) => STORE_NAME[s] && s !== "any" ? `img/logos/${s}.png` : "";
function openCards() {
  const cs = (st.cards ??= []);
  openSheet("Tarjetas de cliente", `
    <p class="note">Guarda las tarjetas de tus súpers y enséñalas en la caja sin sacar la cartera. Funcionan sin cobertura.</p>
    ${cs.length ? `<div class="cards">${cs.map((c, k) => `<button type="button" class="lcard" data-card="${k}">
      <span class="clogo big" style="${logoOf(c.store) ? `background-image:url('${logoOf(c.store)}')` : ""}" aria-hidden="true">${logoOf(c.store) ? "" : "💳"}</span>
      <span class="lcard-t"><b>${esc(c.name)}</b><small>${esc(c.code)}</small></span><span class="lnk">Enseñar</span></button>`).join("")}</div>` : ""}
    <h3 class="cgroup">Añadir una tarjeta</h3>
    <label class="field">Súper<select id="cStore">${STORES.slice(1).map(([s, n]) => `<option value="${s}"${s === list().store ? " selected" : ""}>${esc(n)}</option>`).join("")}<option value="otro">Otra tienda</option></select></label>
    <label class="field">Número de la tarjeta<input id="cCode" autocomplete="off" autocapitalize="characters" placeholder="El número que hay debajo del código de barras"></label>
    <div class="row"><button class="btn ghost" type="button" id="cScan">📷 Escanear la tarjeta</button><button class="btn" type="button" id="cAdd">Guardar tarjeta</button></div>
    <p class="note" id="cErr" hidden></p>`);
  $("sheetBody").querySelector(".cards")?.addEventListener("click", (e) => { const b = e.target.closest("[data-card]"); if (b) showCard(+b.dataset.card); });
  $("cScan").onclick = () => {
    const storeSel = $("cStore").value;
    openScan({ cards: true, title: "Escanear la tarjeta", note: "Apunta la cámara al código de barras de la tarjeta.", handler: async (code) => {
      if (!scanner) return; await stopScan(); addCard(storeSel, code);
    } });
  };
  $("cAdd").onclick = () => {
    const code = $("cCode").value.replace(/\s+/g, "").trim();
    if (!/^[\x20-\x7e]{4,40}$/.test(code)) { $("cErr").hidden = false; $("cErr").textContent = "Escribe el número de la tarjeta (solo letras y números)."; return; }
    addCard($("cStore").value, code);
  };
}
function addCard(store, code) {
  (st.cards ??= []).push({ store, name: STORE_NAME[store] ?? "Tarjeta", code, fmt: bestFormat(code) });
  save(); buzz(20); setStatus(`💳 Tarjeta de ${STORE_NAME[store] ?? "la tienda"} guardada.`);
  showCard(st.cards.length - 1);
}
function showCard(k) {
  const c = st.cards?.[k]; if (!c) return;
  openSheet(`Tarjeta ${c.name}`, `<div class="bigcard">
      ${logoOf(c.store) ? `<span class="clogo huge" style="background-image:url('${logoOf(c.store)}')" aria-hidden="true"></span>` : ""}
      <div class="bc-wrap">${barcodeSVG(c.code, c.fmt) || `<p class="note">Este número no se puede dibujar como código de barras; díctalo en la caja.</p>`}</div>
      <p class="bc-num">${esc(c.code)}</p></div>
    <p class="note">Sube el brillo de la pantalla para que el lector de la caja la lea a la primera.</p>
    <div class="row"><button class="btn ghost" type="button" id="cBack">Mis tarjetas</button><button class="btn danger" type="button" id="cDel">Borrar tarjeta</button></div>`, "carding");
  $("cBack").onclick = openCards;
  $("cDel").onclick = (e) => {
    const b = e.currentTarget;
    if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Toca otra vez para borrarla"; return; }
    st.cards.splice(k, 1); save(); openCards();
  };
}

function finishShopping() {
  const l = list();
  const done = l.items.filter((i) => i.done);
  if (!done.length) return;
  const total = done.reduce((s, i) => s + (itemPrice(i) ?? 0), 0);
  withUndo(`Compra guardada${total ? ` (${eur(total)})` : ""}`, () => {
  st.history.push({ date: Date.now(), list: l.name, store: l.store, total: Math.round(total * 100) / 100,
    items: done.map(({ label, qty, count, prod }) => ({ label, qty, count, prod })) });
  if (st.history.length > 100) st.history.shift();
  l.items = l.items.filter((i) => !i.done);
  learnPurchase(done);
  });
}

// ---------- Catálogo para marcar productos (como Softlist) ----------
let browse = null;
const DEALS_TAB = "⬇ Bajadas";
const OFFERS_TAB = "🏷 Ofertas";
// Ofertas del súper (2ª unidad, 3x2, precio rebajado) y novedades; primero las más rebajadas.
const offPct = (p) => (p.pt != null && p.p != null ? 1 - p.p / p.pt : 0);
function offers(cat, n) {
  return cat.filter((p) => offerTag(p) || p.nw).sort((a, b) => NON_FOOD.has(a.c) - NON_FOOD.has(b.c) || !!b.o - !!a.o || offPct(b) - offPct(a)).slice(0, n);
}
// Lo que más ha bajado; primero comida y bebida, que es lo que más se compra.
const NON_FOOD = new Set(["Limpieza", "Higiene", "Bebé y mascotas"]);
function deals(cat, n) {
  return cat.filter((p) => dropPct(p) >= 5).sort((a, b) => NON_FOOD.has(a.c) - NON_FOOD.has(b.c) || dropPct(b) - dropPct(a)).slice(0, n);
}
// Tira de «Ha bajado de precio» en la pantalla principal (como los folletos de Bring!).
let dealsHTML = "";
async function renderDeals() {
  const el = $("deals"), l = list();
  const stores = l.store === "any" ? pricedStores() : [l.store];
  if (!stores.length || (l.store !== "any" && !meta?.stores?.[l.store]?.prices)) { el.hidden = true; return; }
  const cat = (await Promise.all(stores.map(loadStore))).flat();
  if (list() !== l) return;
  const ds = deals(cat, 12);
  if (!ds.length) { el.hidden = true; return; }
  const inL = new Set(l.items.filter((i) => !i.done).map((i) => i.prod && `${i.prod.s}|${i.prod.n}`));
  const html = `<div class="ideas-head"><h2>⬇ Ha bajado de precio</h2><button type="button" class="lnk" data-deals-all>Ver todo</button></div>
    <p class="deals-sub">${l.store === "any" ? "En los súpers con precios" : `En ${esc(STORE_NAME[l.store])}`}, comparado con la semana pasada. Toca para apuntarlo.</p>
    <div class="ideas-row">${ds.map((p, k) => `<button type="button" class="deal" data-deal="${k}" aria-pressed="${inL.has(`${p.s}|${p.n}`)}">
      <span class="deal-ph">${photoHTML(p.img, guess(p.n).emoji, p.n, onlyAt(p))}<span class="drop">⬇ ${dropPct(p)}%</span><span class="tck" aria-hidden="true">${CHECK_SVG}</span></span>
      <span class="deal-n">${esc(p.n)}</span>
      <span class="deal-p"><b>${eur(p.p)}</b> <s>${eur(p.pb)}</s>${l.store === "any" ? ` · ${esc(STORE_NAME[p.s])}` : ""}</span></button>`).join("")}</div>`;
  el._deals = ds;
  if (html !== dealsHTML) { el.innerHTML = html; dealsHTML = html; }
  el.hidden = false;
}
async function openBrowse(tab) {
  const l = list();
  const freq = Object.values(st.freq).sort((a, b) => b.count - a.count || b.last - a.last).slice(0, 24).map((f) => f.label);
  const tabs = [...(freq.length ? ["Frecuentes"] : []), OFFERS_TAB, DEALS_TAB, ...Object.keys(BASICS)];
  browse = { tab: tab && tabs.includes(tab) ? tab : tabs[0], q: "", cat: [], tiles: new Map(), added: 0, f: { sort: "rel", diets: new Set() } };
  openSheet("Añadir productos", `
    <label class="vh" for="bq">Buscar producto</label>
    <input id="bq" class="bsearch" type="search" placeholder="Buscar en ${esc(STORE_NAME[l.store])}…" enterkeyhint="search" autocomplete="off">
    <div class="btabs" id="btabs">${tabs.map((t) => `<button type="button" class="chip" data-tab="${esc(t)}" aria-pressed="${t === browse.tab}">${esc(t)}</button>`).join("")}</div>
    <div id="bfbar" hidden></div>
    <div class="bgrid" id="bgrid"><p class="note">Cargando productos…</p></div>
    <div class="bfoot"><span id="bcount"></span><button class="btn" type="button" id="bdone">Listo</button></div>`, "browsing");
  browse.cat = await catalogFor(l.store);
  browse.freq = freq;
  if (!sheet.open) return;
  renderBrowse();
  $("btabs").onclick = (e) => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    browse.tab = b.dataset.tab; browse.q = ""; $("bq").value = "";
    for (const c of $("btabs").children) c.setAttribute("aria-pressed", String(c === b));
    renderBrowse(); $("bgrid").scrollTop = 0;
  };
  let tmo;
  $("bq").oninput = (e) => { clearTimeout(tmo); tmo = setTimeout(() => { browse.q = e.target.value.trim(); renderBrowse(); }, 180); };
  $("bgrid").onclick = (e) => { const b = e.target.closest("[data-tile]"); if (b) toggleTile(b.dataset.tile); };
  $("bfbar").onclick = (e) => { if (filterBarClick(e, browse.f)) { renderBrowse(); $("bgrid").scrollTop = 0; } };
  $("bdone").onclick = closeSheet;
}
function inListByLabel(label) {
  const k = norm(label);
  return list().items.find((i) => !i.done && norm(i.label) === k);
}
// Texto bajo la foto de un producto: formato, precio y oferta.
const prodSub = (p) => [p.f, p.p != null ? eur(p.p) : "", p.o && p.o !== "Ha bajado" ? p.o : ""].filter(Boolean).join(" · ");
function renderBrowse() {
  const tiles = browse.tiles; tiles.clear();
  let names;
  // Ordenar y filtrar por dieta: cuando se ven productos concretos (búsqueda, ofertas y bajadas).
  const prodView = !!browse.q || browse.tab === DEALS_TAB || browse.tab === OFFERS_TAB;
  const fb = $("bfbar");
  fb.hidden = !prodView;
  if (prodView) fb.innerHTML = filterBarHTML(browse.f);
  const filtered = browse.f.sort !== "rel" || browse.f.diets.size;
  if (browse.q) {
    // Básicos que encajan con la búsqueda y después productos concretos del súper.
    const qt = tokens(browse.q);
    const basics = Object.values(BASICS).flat().filter((n) => { const t = tokens(n); return qt.every((w) => t.some((x) => x.startsWith(w))); });
    for (const n of basics) tiles.set(`b:${n}`, { label: n, prod: bestProd(browse.cat, n) });
    if (filtered) tiles.clear(); // con filtros, solo productos concretos
    for (const p of applyFilters(search(browse.cat, browse.q, filtered ? 150 : 40), browse.f).slice(0, 40)) tiles.set(`p:${p.s}:${p.n}:${p.f ?? ""}`, { label: p.n, prod: pick(p), sub: prodSub(p) });
    if (!tiles.size && filtered) { $("bgrid").innerHTML = `<p class="note">No hay productos así. Quita algún filtro.</p>`; updateBrowseCount(); return; }
    if (!tiles.size) tiles.set(`b:${capital(browse.q)}`, { label: capital(browse.q), prod: null });
  } else {
    if (browse.tab === DEALS_TAB) {
      for (const p of applyFilters(deals(browse.cat, filtered ? 400 : 60), browse.f).slice(0, 60)) tiles.set(`p:${p.s}:${p.n}:${p.f ?? ""}`, { label: p.n, prod: pick(p), sub: `${eur(p.p)} · antes ${eur(p.pb)}` });
      if (!tiles.size) { $("bgrid").innerHTML = `<p class="note">${filtered ? "No hay bajadas así. Quita algún filtro." : "Ahora mismo no hay bajadas de precio en este súper."}</p>`; updateBrowseCount(); return; }
    }
    if (browse.tab === OFFERS_TAB) {
      for (const p of applyFilters(offers(browse.cat, filtered ? 600 : 80), browse.f).slice(0, 80)) tiles.set(`p:${p.s}:${p.n}:${p.f ?? ""}`, { label: p.n, prod: pick(p), sub: [p.p != null ? eur(p.p) : "", p.o && p.o !== "Ha bajado" ? p.o : p.pt != null ? `antes ${eur(p.pt)}` : "Novedad"].filter(Boolean).join(" · ") });
      if (!tiles.size) { $("bgrid").innerHTML = `<p class="note">${filtered ? "No hay ofertas así. Quita algún filtro." : "Ahora mismo no hay ofertas en este súper. Las de Alcampo, Consum, Dia y Mercadona se miran cada noche."}</p>`; updateBrowseCount(); return; }
    }
    names = browse.tab === DEALS_TAB || browse.tab === OFFERS_TAB ? [] : browse.tab === "Frecuentes" ? browse.freq : BASICS[browse.tab] ?? [];
    for (const n of names) {
      const f = st.freq[norm(n)];
      tiles.set(`b:${n}`, { label: n, prod: f?.prod ?? st.memory[memKey(n, list().store)] ?? bestProd(browse.cat, n) });
    }
  }
  $("bgrid").innerHTML = [...tiles].map(([k, t]) => {
    const on = !!inListByLabel(t.label);
    return `<button type="button" class="tile" data-tile="${esc(k)}" aria-pressed="${on}">
      <span class="tph">${photoHTML(t.prod?.img, guess(t.label).emoji, t.label, onlyAt(t.prod))}${badgeHTML(t.prod)}<span class="tck" aria-hidden="true">${CHECK_SVG}</span></span>
      <span class="tn">${esc(t.label)}</span>${t.sub ? `<span class="ts">${esc(t.sub)}</span>` : ""}</button>`;
  }).join("");
  updateBrowseCount();
}
function updateBrowseCount() {
  const n = list().items.filter((i) => !i.done).length;
  $("bcount").textContent = `${n} ${n === 1 ? "producto" : "productos"} en la lista${browse.added ? ` · ${browse.added} nuevos` : ""}`;
}
async function toggleTile(key) {
  const t = browse.tiles.get(key); if (!t) return;
  const btn = [...$("bgrid").children].find((b) => b.dataset.tile === key);
  const ex = inListByLabel(t.label);
  buzz();
  if (ex) {
    list().items = list().items.filter((i) => i !== ex);
    browse.added = Math.max(0, browse.added - 1);
    btn?.setAttribute("aria-pressed", "false");
  } else {
    btn?.setAttribute("aria-pressed", "true");
    await addItem({ query: t.label }, t.prod);
    browse.added++;
  }
  save(); render(); updateBrowseCount();
}

// ---------- Modo tienda ----------
let wakeLock = null;
async function keepAwake() {
  if (!st.shop || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try { wakeLock = await navigator.wakeLock.request("screen"); } catch {}
}
document.addEventListener("visibilitychange", keepAwake);

// ---------- Voz ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
// Dictado seguido: cada frase se apunta al momento y se sigue escuchando hasta tocar otra vez el micro
// o hasta unos segundos de silencio. Así se pueden dictar muchos productos de una vez.
let voice = null;
function startVoice() {
  const mic = $("micBtn");
  if (!SR) return dictHint();
  voice = { on: true, last: Date.now(), prev: "", count: 0, queue: Promise.resolve() };
  const v = voice;
  const stop = () => { v.on = false; try { rec?.stop(); } catch {} };
  v.stop = stop;
  const listen = () => {
    try {
      rec = new SR();
      rec.lang = "es-ES"; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        v.last = Date.now();
        let interim = "";
        for (let k = e.resultIndex; k < e.results.length; k++) {
          const r = e.results[k], t = r[0].transcript;
          if (!r.isFinal) { interim += t; continue; }
          // Algunos Android repiten lo ya dicho al principio de cada frase: se quita.
          let nuevo = t.trim();
          if (v.prev && norm(nuevo).startsWith(norm(v.prev))) nuevo = nuevo.slice(v.prev.length).trim();
          v.prev = t.trim();
          if (!nuevo) continue;
          v.queue = v.queue.then(() => handle(nuevo, { quiet: true })).then((added) => {
            v.count += added?.length ?? 0;
            if (v.on) setStatus(`Te escucho… ${v.count} apuntado${v.count === 1 ? "" : "s"}. Toca el micro para terminar.`);
          });
        }
        $("q").value = interim;
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { v.on = false; dictHint(); }
      };
      rec.onend = () => {
        $("q").value = "";
        // Chrome corta tras un silencio: si seguimos en modo dictado, vuelve a escuchar.
        if (v.on && Date.now() - v.last < 12000) { v.prev = ""; return listen(); }
        v.on = false; mic.classList.remove("rec");
        v.queue.then(() => setStatus(v.count ? `Listo: ${v.count} producto${v.count === 1 ? "" : "s"} apuntado${v.count === 1 ? "" : "s"}.` : "No te he oído. Toca el micro y prueba otra vez."));
      };
      rec.start();
    } catch { v.on = false; mic.classList.remove("rec"); dictHint(); }
  };
  mic.classList.add("rec");
  setStatus("Te escucho… di todos los productos que quieras. Toca el micro para terminar.");
  listen();
}
function dictHint() {
  setStatus("Tu móvil no deja usar el micro aquí. Toca el cuadro de texto y usa el micrófono del teclado.", true);
  $("q").focus();
}

// ---------- Código de barras ----------
let scanner = null;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}
async function openScan({ handler = onCode, title = "Escanear código de barras", note = "Apunta la cámara al código de barras del envase.", cards = false } = {}) {
  openSheet(title, `<div id="reader" class="scan-box"></div><p class="note" id="scanNote">${esc(note)}</p>`);
  try {
    if (!window.Html5Qrcode) await loadScript("https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js");
    const F = window.Html5QrcodeSupportedFormats;
    const formats = [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, ...(cards ? [F.CODE_128, F.CODE_39, F.ITF, F.CODABAR] : [])];
    scanner = new window.Html5Qrcode("reader", { formatsToSupport: formats, verbose: false });
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 280, height: 140 } }, handler, () => {});
  } catch {
    $("scanNote").textContent = "No puedo abrir la cámara. Revisa que la app tenga permiso de cámara en los ajustes del móvil.";
  }
}
async function stopScan() { const s = scanner; scanner = null; if (s) { try { await s.stop(); s.clear(); } catch {} } }
async function onCode(code) {
  if (!scanner) return;
  await stopScan();
  $("scanNote").textContent = `Código ${code}: buscando…`;
  let prod = null;
  // Primero en el súper de la lista y luego en todos (Consum y Open Food Facts traen el código de barras).
  const order = [list().store, ...STORES.slice(1).map(([s]) => s)].filter((s, k, a) => s !== "any" && a.indexOf(s) === k);
  for (const s of order) { const p = (await loadStore(s)).find((x) => x.e === code); if (p) { prod = p; break; } }
  if (!prod) {
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name_es,product_name,brands,image_front_small_url,quantity`);
      const d = await r.json();
      if (d.product) {
        const p = d.product; const b = (p.brands || "").split(",")[0].trim();
        const n = p.product_name_es || p.product_name;
        if (n) prod = { n: b && !norm(n).includes(norm(b)) ? `${n} ${b}` : n, img: p.image_front_small_url, f: p.quantity, e: code };
      }
    } catch {}
  }
  if (!prod) { $("scanNote").textContent = `No conozco el código ${code}. Escribe el producto a mano.`; return; }
  // Se enseña su ficha (ingredientes, Nutri-Score, dónde está más barato) con un botón para apuntarlo.
  openFicha(prod, { title: prod.n, onAdd: addScanned });
}
async function addScanned(prod) {
  const it = await addItem({ query: prod.n }, pick(prod));
  save(); render(); closeSheet();
  setStatus(`Apuntado: ${it.label}`);
}

// ---------- Eventos ----------
$("bar").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("q").value;
  if (!v.trim()) return openBrowse(); // «+» sin texto: abrir el catálogo para marcar productos
  $("q").value = ""; handle(v);
});
$("micBtn").addEventListener("click", () => { if (voice?.on) { voice.stop(); return; } startVoice(); });
$("scanBtn").addEventListener("click", () => openScan());
$("listBtn").addEventListener("click", openLists);
$("histBtn").addEventListener("click", openHistory);
$("cookBtn").addEventListener("click", () => openRecipes());
$("tabbar").addEventListener("click", (e) => {
  const t = e.target.closest("[data-tab]")?.dataset.tab; if (!t) return;
  if (t === "list" && !home && !sheet.open) { buzz(); return scrollTo({ top: 0, behavior: "smooth" }); }
  goSection(t);
});
$("ideas").addEventListener("click", (e) => {
  const r = e.target.closest("[data-recipe]"); if (r) return openRecipes(+r.dataset.recipe);
  const m = e.target.closest("[data-cook-moment]"); if (m) return openRecipes(null, m.dataset.cookMoment);
  if (e.target.closest("[data-cook-plan]")) return openRecipes(null, null, "plan");
  const u = e.target.closest("[data-cook-use]"); if (u) return openRecipes(null, null, `use:${u.dataset.cookUse}`);
  if (e.target.closest("[data-cook-all]")) openRecipes(null, "Todo");
});
initCocina({ st, list, addItem, markGeneric, save, render, setStatus, buzz, esc, openSheet, sheet, CHECK_SVG, swipeDel: SWIPE_DEL, TRASH_SVG,
  body: () => $("sheetBody"), setTitle: (t, sub) => { $("sheetTitle").textContent = t; setSheetBack(!!sub); } });
$("finishBtn").addEventListener("click", finishShopping);
$("shopBtn").addEventListener("click", () => {
  st.shop = !st.shop; save(); render();
  if (st.shop) keepAwake(); else { wakeLock?.release?.(); wakeLock = null; }
  setStatus(st.shop ? "Modo tienda: letra grande y la pantalla no se apaga." : "Modo tienda desactivado.");
});
$("stores").addEventListener("click", (e) => {
  const b = e.target.closest("[data-s]"); if (!b) return;
  list().store = b.dataset.s; save(); render();
  catalogFor(b.dataset.s);
  const m = meta?.stores?.[b.dataset.s];
  setStatus(b.dataset.s === "any" ? "Buscaré en todos los supermercados." :
    m && !m.count ? `Todavía no tengo el catálogo de ${STORE_NAME[b.dataset.s]}.` :
    `Lo nuevo se buscará en ${STORE_NAME[b.dataset.s]}${m && !m.prices ? " (sin precios)" : ""}.`);
});
$("list").addEventListener("click", (e) => {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
  const t = e.target;
  const tryB = t.closest("[data-try]"); if (tryB) return handle(tryB.dataset.try);
  if (t.closest("[data-browse]")) return openBrowse();
  const pk = t.closest("[data-pick]"); if (pk) return openPicker(pk.dataset.pick);
  const q = t.closest("[data-qty]"); if (q) return openEdit(q.dataset.qty, false);
  const li = t.closest("li.item"); if (!li) return;
  toggleItem(li.dataset.id);
});
$("toastUndo").addEventListener("click", undo);
$("deals").addEventListener("click", async (e) => {
  if (e.target.closest("[data-deals-all]")) return openBrowse(DEALS_TAB);
  const b = e.target.closest("[data-deal]"); if (!b) return;
  const p = $("deals")._deals?.[+b.dataset.deal]; if (!p) return;
  const ex = list().items.find((i) => !i.done && i.prod?.n === p.n && i.prod?.s === p.s);
  if (ex) { list().items = list().items.filter((i) => i !== ex); save(); render(); setStatus(`Quitado: ${ex.label}`); return; }
  b.setAttribute("aria-pressed", "true");
  const it = await addItem({ query: p.n }, pick(p));
  save(); render(); flyIn([it.id]); setStatus(`Apuntado: ${it.label} a ${eur(p.p)} (antes ${eur(p.pb)}).`);
});
$("summary").addEventListener("click", (e) => {
  if (e.target.closest("[data-compare]")) return openCompare();
  if (e.target.closest("[data-aisles]")) return openAisles();
  const sc = e.target.closest("[data-showcard]"); if (sc) return showCard(+sc.dataset.showcard);
  const v = e.target.closest("[data-view]");
  if (v && v.dataset.view !== (st.view ?? "grid")) { st.view = v.dataset.view; persist(); render(); buzz(); }
});
$("list").addEventListener("keydown", (e) => {
  const li = e.target.closest?.("li.gt"); if (!li || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault(); toggleItem(li.dataset.id);
});

// ---------- Gestos ----------
// Deslizar a la izquierda: borrar. A la derecha: marcar como comprado. Mantener pulsado: opciones.
let suppressClickUntil = 0;
let g = null;
const SWIPE = 90, TILE_SWIPE = 60;
$("list").addEventListener("pointerdown", (e) => {
  const row = e.target.closest(".row-in, li.gt"); if (!row || e.button > 0) return;
  const tile = row.classList.contains("gt"), li = tile ? row : row.parentElement;
  g = { row, li, tile, id: li.dataset.id, x: e.clientX, y: e.clientY, dx: 0, mode: null, passed: false, pid: e.pointerId };
  g.timer = setTimeout(() => {
    if (!g || g.mode) return;
    g.mode = "long"; buzz(25); st.gestured = true; suppressClickUntil = Date.now() + 600;
    openOptions(g.id); g = null;
  }, 520);
});
$("list").addEventListener("pointermove", (e) => {
  if (!g || e.pointerId !== g.pid) return;
  let dx = e.clientX - g.x; const dy = e.clientY - g.y;
  // En la cuadrícula solo se desliza a la izquierda, para quitar el producto.
  if (!g.mode && g.tile && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) && dx > 0) { clearTimeout(g.timer); g = null; return; }
  if (!g.mode) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(g.timer); g = null; return; }
    if (Math.abs(dx) > 10) { g.mode = "swipe"; clearTimeout(g.timer); try { g.row.setPointerCapture?.(e.pointerId); } catch {} g.li.classList.add("swiping"); }
    else return;
  }
  if (g.tile) dx = Math.min(dx, 0);
  g.dx = dx;
  g.row.style.transform = `translateX(${dx}px)`;
  if (g.tile) g.row.style.setProperty("--k", Math.min(1, -dx / TILE_SWIPE));
  g.li.classList.toggle("to-del", dx < 0);
  g.li.classList.toggle("to-done", dx > 0);
  const passed = Math.abs(dx) > (g.tile ? TILE_SWIPE : SWIPE);
  if (passed !== g.passed) { g.passed = passed; g.li.classList.toggle("armed", passed); if (passed) buzz(); }
});
function endGesture(e) {
  if (!g || (e && e.pointerId !== g.pid)) return;
  clearTimeout(g.timer);
  const { row, li, dx, mode, id, tile } = g;
  g = null;
  if (mode !== "swipe") return;
  st.gestured = true;
  suppressClickUntil = Date.now() + 400;
  li.classList.remove("swiping");
  if (tile) {
    if (dx < -TILE_SWIPE) { row.style.transform = "translateX(-130%)"; li.classList.add("leaving"); setTimeout(() => removeItem(id), 180); }
    else { row.style.transform = ""; row.style.removeProperty("--k"); li.classList.remove("to-del", "to-done", "armed"); }
    return;
  }
  if (dx < -SWIPE) {
    row.style.transform = `translateX(-110%)`;
    li.classList.add("leaving");
    setTimeout(() => removeItem(id), 180);
  } else if (dx > SWIPE) {
    row.style.transform = "";
    toggleItem(id);
  } else {
    row.style.transform = "";
    li.classList.remove("to-del", "to-done", "armed");
  }
}
$("list").addEventListener("pointerup", endGesture);
$("list").addEventListener("pointercancel", endGesture);
// El menú del navegador al mantener pulsado solo se permite en los campos de texto.
document.addEventListener("contextmenu", (e) => { if (!e.target.closest("input, textarea")) e.preventDefault(); });
document.addEventListener("dragstart", (e) => { if (e.target.tagName === "IMG") e.preventDefault(); });

// Ficha del producto (al mantenerlo pulsado), como en la tienda online del súper: fotos, oferta,
// ingredientes, alérgenos, nutrición, gráfico del precio y enlace a su web. Debajo, las opciones de la lista.
function openOptions(id) {
  const it = list().items.find((i) => i.id === id); if (!it) return;
  openFicha(it.prod, { it, title: it.label });
}
// «Hay uno más barato»: lo mismo (sin la marca) en los súpers con precio, más barato por kilo o litro.
async function showAlts(p, it, mine) {
  const cat = (await Promise.all(pricedStores().map(loadStore))).flat();
  const alts = cheaperAlts(p, cat, search, 3);
  const el = $("fAlt");
  if (!alts.length || !el || !sheet.open || $("sheetBody").firstElementChild !== mine) return;
  const noPrice = p.p == null;
  el.innerHTML = `<h3>${noPrice ? "🛒 Dónde lo encuentras" : "💡 Hay uno más barato"}</h3>${alts.map(({ x, save, per }, k) => {
    const u = unitPrice(x);
    return `<button type="button" class="alt" data-alt="${k}"><span class="alt-ph">${thumbHTML(x, guess(x.n).emoji)}</span>
      <span class="alt-t"><b>${esc(x.n)}</b><span>${esc([STORE_NAME[x.s], x.f, eur(x.p), x.u].filter(Boolean).join(" · "))}</span></span>
      ${!noPrice && save >= 0.05 ? `<span class="alt-s">-${Math.round(save * 100)}%<small>por ${esc(per)}</small></span>` : ""}</button>`; }).join("")}`;
  el.hidden = false;
  el.onclick = (e) => { const b = e.target.closest("[data-alt]"); if (!b) return; const x = alts[+b.dataset.alt].x;
    openFicha(x, it ? { it, title: x.n, swap: true } : { title: x.n, onAdd: addScanned }); };
}
// ---------- Ajustes ----------
// st.alerts = { on: avisos de bajadas activados, notif: también como notificación del móvil, seen: { clave: «día de la bajada» ya avisado } }
function openSettings() {
  const a = st.alerts ?? {};
  const canNotif = "Notification" in window;
  openSheet("Ajustes", `<label class="tset"><span><b>Avisos de bajadas de precio</b><small>Al abrir la app te aviso si ha bajado o está de oferta algo que compras a menudo.</small></span>
      <input type="checkbox" role="switch" id="setAlerts"${a.on ? " checked" : ""}></label>
    ${canNotif ? `<label class="tset"${a.on ? "" : " hidden"} id="setNotifRow"><span><b>También como notificación del móvil</b><small>Sale aunque estés en otra app, solo si Super Lista está abierta o en segundo plano.</small></span>
      <input type="checkbox" role="switch" id="setNotif"${a.notif && Notification.permission === "granted" ? " checked" : ""}></label>` : ""}
    <p class="note" id="setNote"></p>
    ${comReady() ? `<button type="button" class="pantry-btn set-link" id="setAcct"><span><b>Tu cuenta</b><small>${esc(meNow()?.nombre ? `Has entrado como ${meNow().nombre}` : "Entra para valorar, comentar y compartir recetas")}</small></span><span class="lnk">›</span></button>` : ""}
    ${canInstall() ? `<button type="button" class="pantry-btn set-link" id="setIns"><span><b>📲 Instalar la app</b><small>Tenla en tu pantalla de inicio y úsala sin cobertura</small></span><span class="lnk">›</span></button>` : ""}
    <button type="button" class="pantry-btn set-link" id="setDiet"><span><b>🛡️ Alergias y dieta</b><small>${esc(st.diet?.evita?.length ? `Marcadas: ${st.diet.evita.map((k) => ALLER.get(k)?.[2]).filter(Boolean).join(", ")}` : "Marca lo que no puedes tomar y adapto las recetas")}</small></span><span class="lnk">Cambiar ›</span></button>
    <button type="button" class="pantry-btn set-link" id="setCred"><span><b>Fotos de las recetas</b><small>De dónde salen y su licencia</small></span><span class="lnk">Ver ›</span></button>`);
  $("setCred").onclick = () => openCredits();
  $("setDiet").onclick = () => openRecipes(null, null, "diet");
  if ($("setAcct")) $("setAcct").onclick = () => openCuenta({ back: null });
  if ($("setIns")) $("setIns").onclick = () => install(openSheet);
  $("setAlerts").onchange = (e) => {
    st.alerts = { ...(st.alerts ?? {}), on: e.target.checked };
    persist();
    if ($("setNotifRow")) $("setNotifRow").hidden = !e.target.checked;
    $("setNote").textContent = e.target.checked ? "Hecho. Te avisaré de lo que compras a menudo." : "Avisos apagados.";
    if (e.target.checked) priceAlerts(true).catch(() => {});
  };
  if ($("setNotif")) $("setNotif").onchange = async (e) => {
    let ok = e.target.checked;
    if (ok && Notification.permission !== "granted") ok = (await Notification.requestPermission().catch(() => "denied")) === "granted";
    if (e.target.checked && !ok) { e.target.checked = false; $("setNote").textContent = "El móvil no ha dado permiso para notificaciones. Puedes darlo en los ajustes del navegador."; }
    st.alerts = { ...(st.alerts ?? {}), notif: ok }; persist();
  };
}
// Autores y licencias de las fotos (Wikimedia Commons). Van aquí, en Ajustes, para que el resto de pantallas quede limpio.
async function openCredits() {
  openSheet("Fotos de las recetas", `<p class="note">Cargando…</p>`);
  const fotos = await fetch("data/recetas-fotos.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const rows = Object.entries(fotos).filter(([, f]) => f?.autor).sort(([a], [b]) => a.localeCompare(b, "es"));
  $("sheetBody").innerHTML = `<p class="note">Las fotos son de Wikimedia Commons y se usan con licencias libres. Gracias a sus autores.</p>
    <ul class="creds">${rows.map(([n, f]) => `<li><span>${esc(n)}</span><a href="${esc(f.fuente)}" target="_blank" rel="noopener">${esc(f.autor)}</a><small>${esc(f.licencia)}</small></li>`).join("")}</ul>`;
}
// Bajadas y ofertas de lo que compras a menudo (2 veces o más), una vez por cada bajada u oferta.
async function priceAlerts(force = false) {
  const a = st.alerts;
  if (!a?.on) return;
  const freq = Object.entries(st.freq).filter(([, f]) => f.count >= 2 && f.prod?.s && meta?.stores?.[f.prod.s]?.prices);
  const seen = a.seen ?? {};
  const hits = [];
  for (const [k, f] of freq) {
    const cat = await loadStore(f.prod.s);
    const cur = cat.find((x) => x.n === f.prod.n && (x.f ?? "") === (f.prod.f ?? ""));
    if (!cur) continue;
    const tag = cur.pb != null && dropPct(cur) >= 3 ? `b${cur.pd}` : offerTag(cur) ? `o${cur.o ?? ""}${cur.ot ?? ""}${cur.p}` : "";
    if (!tag || (seen[k] === tag && !force)) continue;
    seen[k] = tag;
    hits.push({ f, cur });
  }
  st.alerts = { ...a, seen }; persist();
  if (!hits.length) { if (force) setStatus("Ahora mismo no ha bajado nada de lo que sueles comprar."); return; }
  const txt = (h) => `${h.f.label}: ${eur(h.cur.p)}${h.cur.pb != null ? ` (antes ${eur(h.cur.pb)})` : h.cur.o && h.cur.o !== "Ha bajado" ? ` · ${h.cur.o}` : ""} en ${STORE_NAME[h.cur.s]}`;
  const el = $("alerts");
  el.innerHTML = `<div class="ideas-head"><h2>🔔 Ha bajado lo que sueles comprar</h2><button type="button" class="lnk" data-alerts-x>Vale</button></div>
    <ul class="alert-l">${hits.slice(0, 5).map((h) => `<li>${esc(txt(h))}</li>`).join("")}</ul>`;
  el.hidden = false;
  el.querySelector("[data-alerts-x]").onclick = () => { el.hidden = true; };
  if (a.notif && "Notification" in window && Notification.permission === "granted") {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const body = hits.slice(0, 3).map(txt).join("\n");
      if (reg?.showNotification) reg.showNotification("Ha bajado lo que sueles comprar", { body, icon: "icons/icon-192.png", tag: "bajadas" });
      else new Notification("Ha bajado lo que sueles comprar", { body, icon: "icons/icon-192.png" });
    } catch {}
  }
}
function webBtnHTML(p) {
  const u = webUrl(p);
  return u ? `<a class="btn ghost fweb" href="${esc(u)}" target="_blank" rel="noopener">${SELLS_ONLINE.has(p.s) ? "Comprar en" : "Ver en"} la web de ${esc(STORE_NAME[p.s])} ↗</a>` : "";
}
// swap: se ha abierto desde «Hay uno más barato» de un producto de la lista (it) → botón para cambiarlo.
// onAdd: se ha abierto al escanear → botón para apuntarlo.
function openFicha(p, { it = null, title = p?.n ?? "", swap = false, onAdd = null } = {}) {
  const only = onlyAt(p);
  const info = p ? [p.f, p.p != null ? eur(p.p) : "", p.u, only ? `Solo en ${STORE_NAME[only]}` : (it ? list().store === "any" : true) && p.s ? STORE_NAME[p.s] : ""].filter(Boolean).join(" · ") : "";
  const web = webBtnHTML(p);
  const action = swap && it ? `<button class="btn fact" type="button" id="fSwap">Cambiar a este en la lista</button>`
    : onAdd ? `<button class="btn fact" type="button" id="fAdd">Apuntar en la lista</button>` : "";
  const menu = it && !swap ? `<div class="menu">
    <button type="button" data-o="done">${it.done ? "Marcar como pendiente" : "Marcar como comprado"}</button>
    <button type="button" data-o="edit">Editar texto</button>
    <button type="button" data-o="pick">Cambiar producto</button>
    <button type="button" data-o="qty">Cambiar cantidad</button>
    <button type="button" data-o="dup">Duplicar</button>
    <button type="button" data-o="del" class="danger">Borrar</button></div>` : "";
  openSheet(title, `<figure class="peek">
      <div class="peek-ph" id="fPhotos">${photoHTML(p?.img && bigImg(p.img), it?.emoji ?? guess(title).emoji, p?.n, only)}</div>
      <figcaption>${p ? `<b>${esc(p.n)}</b>${info ? `<span>${esc(info)}</span>` : ""}` : "<span>Sin producto concreto. Elige uno con «Cambiar producto».</span>"}</figcaption>
    </figure>
    ${action}<div id="fOffer">${p ? offerLineHTML(p) : ""}${web}</div>
    <div id="fAlt" class="falt" hidden></div>
    <div id="ficha" class="ficha">${p ? `<p class="note">Buscando ingredientes y nutrición…</p>` : ""}</div>
    ${menu}`, "peeking");
  const body = $("sheetBody");
  if ($("fSwap")) $("fSwap").onclick = () => {
    it.prod = pick(p); it.cat = p.c ?? it.cat; st.memory[memKey(it.label, list().store)] = it.prod;
    const f = st.freq[norm(it.label)]; if (f) f.prod = it.prod;
    save(); render(); closeSheet(); buzz(20);
    setStatus(`Cambiado a ${p.n}${p.s ? ` (${STORE_NAME[p.s]})` : ""}.`);
  };
  if ($("fAdd")) $("fAdd").onclick = () => onAdd(p);
  if (it && !swap) body.querySelector(".menu").onclick = (e) => {
    const o = e.target.closest("[data-o]")?.dataset.o; if (!o) return;
    closeSheet();
    if (o === "done") toggleItem(it.id);
    else if (o === "pick") openPicker(it.id);
    else if (o === "edit") openEdit(it.id);
    else if (o === "qty") openEdit(it.id, false);
    else if (o === "del") removeItem(it.id);
    else if (o === "dup") { const c = { ...structuredClone(it), id: uid(), done: false, added: Date.now() }; list().items.push(c); fresh.add(c.id); save(); render(); }
  };
  if (!p) return;
  const mine = body.firstElementChild;
  // Los productos apuntados hace tiempo no traen el número de la tienda: se busca en el catálogo de hoy.
  const now = p.s ? loadStore(p.s).then((cat) => cat.find((x) => x.n === p.n && (x.f ?? "") === (p.f ?? ""))).catch(() => null) : Promise.resolve(null);
  showAlts(p, it, mine);
  now.then((cur) => {
    if (cur) {
      p = { ...p, ...pick(cur) };
      if (sheet.open && body.firstElementChild === mine) $("fOffer").innerHTML = offerLineHTML(p) + webBtnHTML(p);
    }
    return Promise.all([fichaData(p), priceHistory(p)]); }).then(([d, ph]) => {
    if (!sheet.open || body.firstElementChild !== mine) return;
    // Varias fotos: se pasan deslizando.
    const photos = [...new Set([p.img && bigImg(p.img), ...(d.photos ?? [])].filter(Boolean))];
    if (photos.length > 1) {
      $("fPhotos").outerHTML = `<div class="fgal" id="fPhotos" aria-label="Fotos del producto">${photos.slice(0, 6).map((u) => `<span class="fgal-i">${photoHTML(u, "🛒", p.n)}</span>`).join("")}</div>
        <div class="fdots" aria-hidden="true">${photos.slice(0, 6).map((_, k) => `<i class="${k ? "" : "on"}"></i>`).join("")}</div>`;
      const g = $("fPhotos"), dots = g.nextElementSibling;
      g.addEventListener("scroll", () => { const k = Math.round(g.scrollLeft / g.clientWidth); [...dots.children].forEach((x, j) => x.classList.toggle("on", j === k)); }, { passive: true });
    }
    const secs = fichaSections(p, d, ph);
    const el = $("ficha");
    if (!secs.length) { el.innerHTML = fichaAlgHTML(p, d) + `<p class="note">${esc(STORE_NAME[p.s] ?? "Este súper")} no publica los ingredientes de este producto.</p>`; return; }
    const src = d.src?.length ? `<p class="note fsrc">Datos de ${esc(d.src.join(" y "))}. Revisa siempre el envase si tienes alergias.</p>` : "";
    el.innerHTML = fichaAlgHTML(p, d) + secs.map(([n, h]) => `<section class="fsec">${n === "Resumen" ? "" : `<h3>${esc(n)}</h3>`}${h}</section>`).join("") + src;
  });
}

// En la ficha: si el producto lleva (o puede llevar) algo que has marcado en 🛡️ Alergias.
function fichaAlgHTML(p, d) {
  const av = avoidSet(st.diet?.evita);
  if (!av.size) return "";
  const nm = (ks) => ks.filter((k) => !(k === "lactosa" && av.has("leche"))).map((k) => ALLER.get(k)[2].replace(" (alergia)", "").toLowerCase()).join(", ");
  const has = [...new Set([...labelAllergens([...(d.alg ?? []), d.algText ?? ""], av), ...conflicts(p.n, av)])];
  const tr = labelAllergens(d.traces, av).filter((k) => !has.includes(k));
  if (has.length) return `<div class="adbox bad"><b>⚠️ Lleva ${esc(nm(has))}</b><span>Lo has marcado en Alergias. Mira si hay una versión «sin» en otro súper.</span></div>`;
  if (tr.length) return `<div class="adbox warn"><b>⚠️ Puede contener trazas de ${esc(nm(tr))}</b><span>Según la etiqueta.</span></div>`;
  if (d.alg?.length || d.algText) return `<div class="adbox ok"><b>✓ Según la etiqueta, no lleva lo que has marcado</b><span>${esc(dietSummary(av))}. Revisa el envase por si cambia.</span></div>`;
  return "";
}
const dietSummary = (av) => `Sin ${[...av].filter((k) => !(k === "lactosa" && av.has("leche"))).map((k) => ALLER.get(k)[2].replace(" (alergia)", "").toLowerCase()).join(", sin ")}`;

// Gestos de la hoja (arrastrar abajo para cerrar, desde el borde izquierdo para volver) y deslizar para borrar.
sheetGestures(sheet, { close: closeSheet, back: sheetBack });
// Qué hacer al borrar deslizando, según el tipo de fila (h = compra; p = receta del menú, en cocina.js).
SWIPE_DEL.h = (i) => {
    const h = st.history[+i]; if (!h) return;
    withUndo(`Compra borrada${h.total ? ` (${eur(h.total)})` : ""}`, () => { st.history.splice(+i, 1); });
    const y = sheet.scrollTop; openHistory(); sheet.scrollTop = y;
};
swipeRows($("sheetBody"), (key) => { const k = key.indexOf(":"); SWIPE_DEL[key.slice(0, k)]?.(key.slice(k + 1)); });
// Tirar hacia abajo en Inicio o en la lista: vuelve a mirar los precios.
pullToRefresh(async () => {
  const m = await fetch("data/meta.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (m) { if (m.generated !== meta?.generated) { catalogs.clear(); loading.clear(); } meta = m; }
  render(); renderSummary(); await renderDeals().catch(() => {});
  setStatus(m ? "Precios al día." : "Sin conexión: sigues con los precios guardados.", !m);
});
$("favs").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-fav]"); if (!b) return;
  const f = st.freq[b.dataset.fav]; if (!f) return;
  const it = await addItem({ query: f.label }, f.prod);
  save(); render(); setStatus(`Apuntado: ${it.label}`);
});
// Si una foto no carga, se muestra el emoji del producto.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName === "IMG" && img.classList.contains("pimg")) {
    const s = document.createElement("span"); s.className = "emo"; s.textContent = img.dataset.emoji || "🛒"; img.replaceWith(s);
  }
}, true);

// ---------- Arranque ----------
initSync({ st, list, persist, render: () => render(), setStatus, uid });
initComunidad({ st, save, setStatus, buzz, esc, openSheet, sheet, body: () => $("sheetBody"), setTitle: (t, sub) => { $("sheetTitle").textContent = t; setSheetBack(!!sub); } });
render();
catalogFor(list().store);
if (st.shop) keepAwake();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
