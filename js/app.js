import { parseCommand, search, indexCatalog, guess, norm, capital, tokens } from "./parser.js";
import { BASICS } from "./basics.js";
import { initCocina, openRecipes, learnPurchase, cookBack, renderIdeas } from "./cocina.js";

const STORES = [
  ["any", "Cualquiera"], ["mercadona", "Mercadona"], ["carrefour", "Carrefour"], ["lidl", "Lidl"], ["dia", "Dia"],
  ["alcampo", "Alcampo"], ["eroski", "Eroski"], ["aldi", "Aldi"], ["consum", "Consum"], ["elcorteingles", "El Corte Inglés"],
];
const STORE_NAME = Object.fromEntries(STORES);
const CATS = [
  "Frutas y verduras", "Carne", "Pescado", "Charcutería y quesos", "Lácteos y huevos", "Panadería",
  "Despensa", "Dulces y desayuno", "Bebidas", "Congelados", "Limpieza", "Higiene", "Bebé y mascotas", "Otros",
];
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
function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }
const list = () => st.lists.find((l) => l.id === st.current) ?? st.lists[0];

// ---------- Catálogos ----------
const catalogs = new Map(); // slug -> productos indexados
const loading = new Map();
let meta = null;
fetch("data/meta.json").then((r) => (r.ok ? r.json() : null)).then((m) => { meta = m; renderSummary(); }).catch(() => {});

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
  "leche de avena": "bebida de avena", "leche de soja": "bebida de soja", "leche de almendras": "bebida de almendras", "leche de arroz": "bebida de arroz",
};
markGeneric(Object.values(ALIAS));
function bestProd(cat, query) {
  const alias = ALIAS[norm(query)];
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
  for (const k of ["img", "p", "u", "f", "e", "b", "c"]) if (prod[k] != null) o[k] = prod[k];
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
let undoSnap = null, toastTimer = null;
function snapshot() { return JSON.stringify({ lists: st.lists, history: st.history }); }
function withUndo(msg, fn) {
  const snap = snapshot();
  fn();
  save(); render();
  undoSnap = snap;
  const t = $("toast");
  $("toastMsg").textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; undoSnap = null; }, 5000);
}
function undo() {
  if (!undoSnap) return;
  Object.assign(st, JSON.parse(undoSnap));
  if (!st.lists.some((l) => l.id === st.current)) st.current = st.lists[0].id;
  undoSnap = null; $("toast").hidden = true;
  save(); render(); buzz();
}
const buzz = (ms = 12) => { try { navigator.vibrate?.(ms); } catch {} };
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
function photoHTML(url, emoji, label = "") {
  const emo = `<span class="emo" aria-hidden="true">${esc(emoji || "🛒")}</span>`;
  if (!url) return emo;
  return `<span class="photo" role="img" aria-label="${esc(label)}">${emo}<span class="photo-img" style="background-image:url('${cssUrl(url)}')"></span></span>`;
}
function thumbHTML(prod, emoji) { return photoHTML(prod?.img, emoji, prod?.n); }
const itemPrice = (i) => (i.prod?.p != null ? i.prod.p * (i.count || 1) : null);

function renderStores() {
  const cur = list().store;
  $("stores").innerHTML = STORES.map(([s, n]) => `<button class="chip" type="button" data-s="${s}" aria-pressed="${cur === s}">${esc(n)}</button>`).join("");
}
function renderSummary() {
  const l = list();
  const left = l.items.filter((i) => !i.done);
  if (!l.items.length) { $("summary").textContent = ""; return; }
  const priced = left.filter((i) => itemPrice(i) != null);
  const total = priced.reduce((s, i) => s + itemPrice(i), 0);
  let t = `<b>${left.length}</b> por comprar`;
  if (priced.length) t += ` · total aprox. <b>${eur(total)}</b>`;
  if (left.length - priced.length > 0 && priced.length) t += ` (${left.length - priced.length} sin precio)`;
  $("summary").innerHTML = t;
}
function render() {
  const l = list();
  renderIdeas($("ideas")).catch(() => {});
  $("listName").textContent = l.name;
  document.body.classList.toggle("shop", !!st.shop);
  $("shopBtn").setAttribute("aria-pressed", String(!!st.shop));
  renderStores();
  renderSummary();
  renderFavs();
  $("finishWrap").hidden = !l.items.some((i) => i.done);
  const el = $("list");
  if (!l.items.length) {
    el.innerHTML = `<div class="empty"><b>La lista está vacía</b><span>Escribe o dicta lo que necesitas, por ejemplo:</span>
      <button class="btn ghost" type="button" data-try="apunta leche, huevos y oreos">«apunta leche, huevos y oreos»</button>
      <span>o elige de la lista de productos:</span>
      <button class="btn" type="button" data-browse>Ver productos</button></div>`;
    return;
  }
  const by = {};
  for (const it of l.items) (by[CATS.includes(it.cat) ? it.cat : "Otros"] ??= []).push(it);
  el.innerHTML = CATS.filter((c) => by[c]).map((c) => {
    const rows = by[c].sort((a, b) => a.done - b.done || a.added - b.added).map((it) => {
      const p = it.prod;
      const sub = p ? [p.n, p.f, l.store === "any" ? STORE_NAME[p.s] : ""].filter(Boolean).join(" · ") : "Toca la foto para elegir producto";
      const price = itemPrice(it);
      return `<li class="item${it.done ? " done" : ""}${fresh.has(it.id) ? " fresh" : ""}${incoming.has(it.id) ? " incoming" : ""}" data-id="${it.id}">
        <div class="swipe-bg" aria-hidden="true"><span class="bg-done">${CHECK_SVG}${it.done ? "Pendiente" : "Comprado"}</span><span class="bg-del">Borrar${TRASH_SVG}</span></div>
        <div class="row-in">
        <button class="thumb" type="button" data-pick="${it.id}" aria-label="Cambiar producto de ${esc(it.label)}">${thumbHTML(p, it.emoji)}</button>
        <span class="info"><span class="name">${esc(it.label)}</span><span class="sub">${esc(sub)}</span></span>
        <span class="right">
          <button class="qty" type="button" data-qty="${it.id}">${esc(it.qty || "1")}</button>
          ${price != null ? `<span class="price">${eur(price)}</span>` : ""}
        </span>
        <span class="check" role="checkbox" aria-checked="${it.done}" aria-label="Comprado">${CHECK_SVG}</span>
        </div>
      </li>`;
    }).join("");
    return `<section class="cat"><h2>${esc(c)}</h2><ul class="items">${rows}</ul></section>`;
  }).join("") + (st.gestured ? "" : `<p class="hint">Consejo: desliza un producto a la izquierda para borrarlo, a la derecha para marcarlo como comprado, o mantenlo pulsado para ver más opciones.</p>`);
  fresh.clear();
}
function renderFavs() {
  const inList = new Set(list().items.filter((i) => !i.done).map((i) => norm(i.label)));
  const favs = Object.entries(st.freq).filter(([k]) => !inList.has(k))
    .sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last).slice(0, 12);
  $("favs").hidden = !favs.length;
  $("favs").innerHTML = favs.map(([k, f]) => `<button class="fav" type="button" data-fav="${esc(k)}">${thumbHTML(f.prod, f.emoji)}${esc(f.label)}</button>`).join("");
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
sheet.addEventListener("close", () => { if (sheet.open) return; stopScan(); $("sheetBody").innerHTML = ""; renderIdeas($("ideas")).catch(() => {}); });

async function openPicker(id, query) {
  const l = list();
  const it = l.items.find((i) => i.id === id);
  if (!it) return;
  query ??= it.label;
  openSheet(it.label, `<label class="field">Buscar en ${esc(STORE_NAME[l.store])}<input id="pickQ" type="search" value="${esc(query)}" enterkeyhint="search"></label>
    <p class="note" id="pickNote">Cargando productos…</p><div class="opts" id="pickOpts"></div>`);
  const cat = await catalogFor(l.store);
  if (!sheet.open) return;
  const res = search(cat, query, 30);
  const opts = [{ none: true }, ...res];
  $("pickNote").textContent = res.length ? "Elige el producto que quieres:" : (cat.length ? "No encuentro ese producto. Prueba con otras palabras." : "Aún no hay catálogo de este supermercado.");
  $("pickOpts").innerHTML = opts.map((p, k) => p.none
    ? `<button class="opt" type="button" data-choose="none" aria-pressed="${!it.prod}"><span class="ph"><span class="emo">${esc(it.emoji)}</span></span><span class="on">Sin producto concreto</span></button>`
    : `<button class="opt" type="button" data-choose="${k}" aria-pressed="${it.prod?.n === p.n && it.prod?.s === p.s}">
        <span class="ph">${thumbHTML(p, it.emoji)}</span><span class="on">${esc(p.n)}</span>
        <span class="op">${esc([p.f, p.p != null ? eur(p.p) : "", l.store === "any" ? STORE_NAME[p.s] : ""].filter(Boolean).join(" · "))}</span></button>`).join("");
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
  $("saveName").onclick = () => { const n = $("renList").value.trim(); if (n) { list().name = n; save(); render(); closeSheet(); } };
  const del = $("delList");
  if (del) del.onclick = () => {
    if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "Toca otra vez para borrarla"; return; }
    st.lists = st.lists.filter((l) => l.id !== st.current); st.current = st.lists[0].id; save(); render(); closeSheet();
  };
}

function openHistory() {
  if (!st.history.length) return openSheet("Historial", `<p class="note">Aquí verás cada compra cuando pulses «Terminar compra».</p>`);
  openSheet("Historial", `<div class="hist">${st.history.slice().reverse().map((h, k) => {
    const d = new Date(h.date).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
    return `<article><div class="h"><span>${esc(d)} · ${esc(STORE_NAME[h.store] ?? "")}</span><span>${h.total ? eur(h.total) : ""}</span></div>
      <p>${esc(h.items.map((i) => i.label).join(", "))}</p>
      <div class="row"><button class="btn ghost" type="button" data-repeat="${st.history.length - 1 - k}">Volver a apuntar</button></div></article>`;
  }).join("")}</div>`);
  $("sheetBody").onclick = async (e) => {
    const b = e.target.closest("[data-repeat]"); if (!b) return;
    const h = st.history[+b.dataset.repeat];
    for (const i of h.items) await addItem({ query: i.label, qty: i.qty, count: i.count || 1 }, i.prod);
    save(); render(); closeSheet(); setStatus(`Apuntados ${h.items.length} productos de esa compra.`);
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
async function openBrowse() {
  const l = list();
  const freq = Object.values(st.freq).sort((a, b) => b.count - a.count || b.last - a.last).slice(0, 24).map((f) => f.label);
  const tabs = [...(freq.length ? ["Frecuentes"] : []), ...Object.keys(BASICS)];
  browse = { tab: tabs[0], q: "", cat: [], tiles: new Map(), added: 0 };
  openSheet("Añadir productos", `
    <label class="vh" for="bq">Buscar producto</label>
    <input id="bq" class="bsearch" type="search" placeholder="Buscar en ${esc(STORE_NAME[l.store])}…" enterkeyhint="search" autocomplete="off">
    <div class="btabs" id="btabs">${tabs.map((t) => `<button type="button" class="chip" data-tab="${esc(t)}" aria-pressed="${t === browse.tab}">${esc(t)}</button>`).join("")}</div>
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
  $("bdone").onclick = closeSheet;
}
function inListByLabel(label) {
  const k = norm(label);
  return list().items.find((i) => !i.done && norm(i.label) === k);
}
function renderBrowse() {
  const tiles = browse.tiles; tiles.clear();
  let names;
  if (browse.q) {
    // Básicos que encajan con la búsqueda y después productos concretos del súper.
    const qt = tokens(browse.q);
    const basics = Object.values(BASICS).flat().filter((n) => { const t = tokens(n); return qt.every((w) => t.some((x) => x.startsWith(w))); });
    for (const n of basics) tiles.set(`b:${n}`, { label: n, prod: bestProd(browse.cat, n) });
    for (const p of search(browse.cat, browse.q, 40)) tiles.set(`p:${p.s}:${p.n}:${p.f ?? ""}`, { label: p.n, prod: pick(p), sub: [p.f, p.p != null ? eur(p.p) : ""].filter(Boolean).join(" · ") });
    if (!tiles.size) tiles.set(`b:${capital(browse.q)}`, { label: capital(browse.q), prod: null });
  } else {
    names = browse.tab === "Frecuentes" ? browse.freq : BASICS[browse.tab] ?? [];
    for (const n of names) {
      const f = st.freq[norm(n)];
      tiles.set(`b:${n}`, { label: n, prod: f?.prod ?? st.memory[memKey(n, list().store)] ?? bestProd(browse.cat, n) });
    }
  }
  $("bgrid").innerHTML = [...tiles].map(([k, t]) => {
    const on = !!inListByLabel(t.label);
    return `<button type="button" class="tile" data-tile="${esc(k)}" aria-pressed="${on}">
      <span class="tph">${photoHTML(t.prod?.img, guess(t.label).emoji, t.label)}<span class="tck" aria-hidden="true">${CHECK_SVG}</span></span>
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
async function openScan() {
  openSheet("Escanear código de barras", `<div id="reader" class="scan-box"></div><p class="note" id="scanNote">Apunta la cámara al código de barras del envase.</p>`);
  try {
    if (!window.Html5Qrcode) await loadScript("https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js");
    const F = window.Html5QrcodeSupportedFormats;
    scanner = new window.Html5Qrcode("reader", { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E], verbose: false });
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 260, height: 140 } }, onCode, () => {});
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
  for (const cat of catalogs.values()) { const p = cat.find((x) => x.e === code); if (p) { prod = p; break; } }
  if (!prod) {
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name_es,product_name,brands,image_front_small_url,quantity`);
      const d = await r.json();
      if (d.product) {
        const p = d.product; const b = (p.brands || "").split(",")[0].trim();
        const n = p.product_name_es || p.product_name;
        if (n) prod = { n: b && !norm(n).includes(norm(b)) ? `${n} ${b}` : n, img: p.image_front_small_url, f: p.quantity, e: code, s: list().store };
      }
    } catch {}
  }
  if (!prod) { $("scanNote").textContent = `No conozco el código ${code}. Escribe el producto a mano.`; return; }
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
$("scanBtn").addEventListener("click", openScan);
$("listBtn").addEventListener("click", openLists);
$("histBtn").addEventListener("click", openHistory);
$("cookBtn").addEventListener("click", () => openRecipes());
$("ideas").addEventListener("click", (e) => {
  const r = e.target.closest("[data-recipe]"); if (r) return openRecipes(+r.dataset.recipe);
  if (e.target.closest("[data-cook-all]")) openRecipes();
});
initCocina({ st, list, addItem, markGeneric, save, render, setStatus, buzz, esc, openSheet, sheet, CHECK_SVG,
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

// ---------- Gestos ----------
// Deslizar a la izquierda: borrar. A la derecha: marcar como comprado. Mantener pulsado: opciones.
let suppressClickUntil = 0;
let g = null;
const SWIPE = 90;
$("list").addEventListener("pointerdown", (e) => {
  const row = e.target.closest(".row-in"); if (!row || e.button > 0) return;
  const li = row.parentElement;
  g = { row, li, id: li.dataset.id, x: e.clientX, y: e.clientY, dx: 0, mode: null, passed: false, pid: e.pointerId };
  g.timer = setTimeout(() => {
    if (!g || g.mode) return;
    g.mode = "long"; buzz(25); st.gestured = true; suppressClickUntil = Date.now() + 600;
    openOptions(g.id); g = null;
  }, 520);
});
$("list").addEventListener("pointermove", (e) => {
  if (!g || e.pointerId !== g.pid) return;
  const dx = e.clientX - g.x, dy = e.clientY - g.y;
  if (!g.mode) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(g.timer); g = null; return; }
    if (Math.abs(dx) > 10) { g.mode = "swipe"; clearTimeout(g.timer); g.row.setPointerCapture?.(e.pointerId); g.li.classList.add("swiping"); }
    else return;
  }
  g.dx = dx;
  g.row.style.transform = `translateX(${dx}px)`;
  g.li.classList.toggle("to-del", dx < 0);
  g.li.classList.toggle("to-done", dx > 0);
  const passed = Math.abs(dx) > SWIPE;
  if (passed !== g.passed) { g.passed = passed; g.li.classList.toggle("armed", passed); if (passed) buzz(); }
});
function endGesture(e) {
  if (!g || (e && e.pointerId !== g.pid)) return;
  clearTimeout(g.timer);
  const { row, li, dx, mode, id } = g;
  g = null;
  if (mode !== "swipe") return;
  st.gestured = true;
  suppressClickUntil = Date.now() + 400;
  li.classList.remove("swiping");
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

function openOptions(id) {
  const it = list().items.find((i) => i.id === id); if (!it) return;
  const p = it.prod;
  const info = p ? [p.f, p.p != null ? eur(p.p) : "", p.u, list().store === "any" ? STORE_NAME[p.s] : ""].filter(Boolean).join(" · ") : "";
  openSheet(it.label, `<figure class="peek">
      <div class="peek-ph">${photoHTML(p?.img && bigImg(p.img), it.emoji, p?.n)}</div>
      <figcaption>${p ? `<b>${esc(p.n)}</b>${info ? `<span>${esc(info)}</span>` : ""}` : "<span>Sin producto concreto. Elige uno con «Cambiar producto».</span>"}</figcaption>
    </figure>
    <div class="menu">
    <button type="button" data-o="done">${it.done ? "Marcar como pendiente" : "Marcar como comprado"}</button>
    <button type="button" data-o="edit">Editar texto</button>
    <button type="button" data-o="pick">Cambiar producto</button>
    <button type="button" data-o="qty">Cambiar cantidad</button>
    <button type="button" data-o="dup">Duplicar</button>
    <button type="button" data-o="del" class="danger">Borrar</button></div>`, "peeking");
  $("sheetBody").querySelector(".menu").onclick = (e) => {
    const o = e.target.closest("[data-o]")?.dataset.o; if (!o) return;
    closeSheet();
    if (o === "done") toggleItem(id);
    else if (o === "pick") openPicker(id);
    else if (o === "edit") openEdit(id);
    else if (o === "qty") openEdit(id, false);
    else if (o === "del") removeItem(id);
    else if (o === "dup") { const c = { ...structuredClone(it), id: uid(), done: false, added: Date.now() }; list().items.push(c); fresh.add(c.id); save(); render(); }
  };
}

// Deslizar hacia abajo una hoja la cierra.
(() => {
  let y0 = null, dy = 0;
  const box = () => sheet;
  sheet.addEventListener("pointerdown", (e) => { if (e.target.closest(".sheet-head")) { y0 = e.clientY; dy = 0; } });
  sheet.addEventListener("pointermove", (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    box().style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (y0 == null) return;
    y0 = null; box().style.transform = "";
    if (dy > 80) sheetBack();
  };
  sheet.addEventListener("pointerup", end);
  sheet.addEventListener("pointercancel", end);
})();
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
render();
catalogFor(list().store);
if (st.shop) keepAwake();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
