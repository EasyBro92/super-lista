// Recetas: qué cocinar con lo que tienes en casa y apuntar en la lista lo que falta.
import { tokens, guess, norm } from "./parser.js";

// Sección de cada ingrediente, para ordenar «Lo que tengo en casa» como en el súper.
const SECTIONS = {
  "Frutas y verduras": "Plátanos, Manzanas, Naranjas, Mandarinas, Limones, Fresas, Uvas, Peras, Melón, Sandía, Aguacates, Tomates, Lechuga, Cebollas, Ajos, Patatas, Zanahorias, Pimientos, Calabacín, Pepino, Brócoli, Champiñones, Espinacas, Berenjenas, Puerros, Calabaza, Coliflor, Judías verdes, Cebolla morada, Tomates cherry, Perejil, Cilantro, Albahaca, Jengibre, Rúcula, Maíz dulce, Limas, Mango, Piña, Arándanos, Repollo",
  "Carne": "Pechuga de pollo, Muslos de pollo, Pollo entero, Carne picada, Ternera, Filetes de ternera, Lomo de cerdo, Costillas, Hamburguesas, Salchichas, Bacon, Panceta, Cordero, Pavo picado, Alitas de pollo",
  "Pescado": "Salmón, Merluza, Gambas, Bacalao, Calamares, Mejillones, Atún fresco, Lubina, Dorada, Sepia, Almejas, Langostinos, Surimi",
  "Charcutería y quesos": "Jamón serrano, Jamón cocido, Pechuga de pavo, Chorizo, Salchichón, Queso en lonchas, Queso curado, Queso fresco, Queso rallado, Mozzarella, Queso parmesano, Queso de cabra, Queso crema, Queso feta, Mascarpone, Morcilla",
  "Lácteos y huevos": "Leche, Huevos, Yogures, Yogur griego, Mantequilla, Nata, Nata para cocinar, Leche de coco, Bebida de avena, Leche condensada",
  "Panadería": "Pan, Pan de molde, Pan rallado, Pan de hamburguesa, Pan de pita, Tortillas de trigo, Masa de pizza, Hojaldre, Masa de empanadillas, Masa quebrada, Bizcochos de soletilla, Galletas",
  "Despensa": "Aceite de oliva, Aceite de girasol, Arroz, Arroz basmati, Macarrones, Espaguetis, Fideos, Lasaña, Tallarines, Gnocchi, Tortellini, Cuscús, Quinoa, Garbanzos, Lentejas, Alubias, Tomate frito, Tomate triturado, Atún en lata, Sardinas en lata, Vinagre, Mayonesa, Ketchup, Mostaza, Salsa de soja, Caldo de pollo, Caldo de verduras, Caldo de pescado, Aceitunas, Alcaparras, Pimiento del piquillo, Frutos secos, Nueces, Almendras, Pasas, Hummus, Guacamole, Pesto, Salsa barbacoa, Tahini, Edamame, Fideos de arroz, Salsa de ostras, Vino blanco, Vino tinto, Cerveza",
  "Especias y repostería": "Sal, Pimienta negra, Pimentón, Comino, Orégano, Laurel, Canela, Curry, Azafrán, Colorante alimentario, Guindilla, Tomillo, Romero, Nuez moscada, Sésamo, Azúcar, Harina, Levadura, Maicena, Gelatina, Azúcar glas, Esencia de vainilla, Coco rallado, Miel, Chocolate, Cacao en polvo, Mermelada, Copos de avena, Cereales, Café",
  "Congelados": "Guisantes, Menestra, Patatas congeladas, Croquetas, Varitas de merluza, Pizza, Helado, Gyozas, Verduras para wok",
};
const ORDER = [...Object.keys(SECTIONS), "Otros"];
const key = (n) => tokens(n).join(" ");
const SECTION_OF = new Map();
for (const [s, names] of Object.entries(SECTIONS)) for (const n of names.split(", ")) SECTION_OF.set(key(n), s);
const sectionOf = (n) => SECTION_OF.get(key(n)) ?? (ORDER.includes(guess(n).cat) ? guess(n).cat : "Otros");

// Lo que casi todo el mundo tiene; se puede quitar en «En casa».
const STAPLES = ["Sal", "Aceite de oliva", "Pimienta negra", "Azúcar", "Harina"];
const FILTERS = ["Todas", "Rápidas", "Española", "Vegetariana", "Pasta y arroz", "Legumbres", "Carne", "Pescado", "Ensaladas",
  "Sopas y cremas", "Cenas ligeras", "Desayunos", "Postres", "Internacional", "Para niños", "Freidora de aire", "Con productos del súper"];

let A; // funciones de la app (lista, guardar, pintar…)
let recipes = null, loading = null;
const ui = { view: "list", mode: "tengo", tag: "Todas", q: "", id: null, pq: "", scroll: 0 };

export function initCocina(api) { A = api; }

function loadRecipes() {
  const get = (u, d) => fetch(u).then((r) => (r.ok ? r.json() : d)).catch(() => d);
  loading ??= Promise.all([get("data/recetas.json", []), get("data/recetas-fotos.json", {})]).then(([rs, fotos]) => {
    rs.forEach((r, idx) => {
      r.id = idx;
      r.ings = r.i.map(([n, q]) => ({ n, q, k: key(n), opt: !!r.o?.includes(n) }));
      r.toks = new Set(tokens(`${r.n} ${r.i.map((x) => x[0]).join(" ")}`));
      r.foto = fotos[r.n] ?? null;
      r.filters = [...r.tags, ...(r.t <= 20 ? ["Rápidas"] : []), ...(r.tags.includes("Vegana") ? ["Vegetariana"] : [])];
    });
    A.markGeneric(rs.flatMap((r) => r.i.map((x) => x[0])));
    return (recipes = rs);
  });
  return loading;
}

function pantry() {
  const st = A.st;
  if (!st.pantry) { st.pantry = {}; for (const n of STAPLES) st.pantry[key(n)] = n; }
  return st.pantry;
}
const has = (k) => k in pantry();
const inList = (k) => A.list().items.some((i) => !i.done && key(i.label) === k);

function check(r) {
  const need = r.ings.filter((i) => !i.opt);
  const missing = need.filter((i) => !has(i.k));
  return { need, missing, have: need.length - missing.length };
}

// Lo comprado al terminar la compra pasa a «En casa».
export function learnPurchase(items) {
  const p = pantry();
  for (const i of items) p[key(i.label)] = i.label;
}

// Se vuelve a abrir donde lo dejaste: mismos filtros, búsqueda y posición.
export async function openRecipes(id) {
  A.openSheet("Recetas", `<p class="note">Cargando recetas…</p>`, "browsing cooking");
  await loadRecipes();
  if (!A.sheet.open) return;
  if (id != null && recipes[id]) { ui.view = "list"; return showRecipe(id); }
  showList(true);
}

// Botón de cerrar, gesto de atrás o deslizar hacia abajo: desde una receta o «En casa», vuelve a las recetas.
export function cookBack() {
  if (ui.view === "recipe" || ui.view === "pantry") { showList(true); return true; }
  return false;
}

// «¿Qué cocino hoy?» debajo de la lista: unas cuantas recetas con foto para que se vean sin buscarlas.
let ideasHTML = "";
export async function renderIdeas(el) {
  await loadRecipes();
  if (!recipes.length) { el.hidden = true; return; }
  const staples = new Set(STAPLES.map(key));
  const cooking = Object.keys(pantry()).some((k) => !staples.has(k));
  const day = Math.floor(Date.now() / 864e5);
  const rot = (r) => ((r.id * 7919 + day * 104729) % 9973);
  const rows = recipes.filter((r) => r.foto).map((r) => ({ r, c: check(r) }));
  rows.sort((a, b) => (cooking ? Math.min(a.c.missing.length, 4) - Math.min(b.c.missing.length, 4) : 0) || rot(a.r) - rot(b.r));
  const pick = rows.slice(0, 8);
  const html = `<div class="ideas-head"><h2>¿Qué cocino hoy?</h2><button type="button" class="lnk" data-cook-all>Ver las ${recipes.length} recetas</button></div>
    <div class="ideas-row">${pick.map(({ r, c }) => `<button type="button" class="idea" data-recipe="${r.id}">
      <span class="idea-ph" style="background-image:url('${A.esc(r.foto.img)}')"></span>
      <span class="idea-n">${A.esc(r.n)}</span>
      <span class="idea-m${c.missing.length ? "" : " ok"}">${c.missing.length ? (cooking ? `Faltan ${c.missing.length}` : `${r.t} min`) : "✓ Tienes todo"}</span></button>`).join("")}</div>`;
  if (html !== ideasHTML) { el.innerHTML = html; ideasHTML = html; }
  el.hidden = false;
}

const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const meta = (r) => `${r.t} min · ${r.r} ${r.r === 1 ? "ración" : "raciones"} · ${r.d}`;
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

function showList(restore = false) {
  ui.view = "list";
  A.setTitle("Recetas", false);
  const n = Object.keys(pantry()).length;
  A.body().innerHTML = `
    <div class="seg" id="cmode" role="group" aria-label="Qué recetas ver">
      <button type="button" data-mode="tengo" aria-pressed="${ui.mode === "tengo"}">Con lo que tengo</button>
      <button type="button" data-mode="todas" aria-pressed="${ui.mode === "todas"}">Todas</button>
    </div>
    <button type="button" class="pantry-btn" id="cpantry"><span>🏠 En casa tienes <b>${plural(n, "ingrediente", "ingredientes")}</b></span><span class="lnk">Cambiar</span></button>
    <label class="vh" for="cq">Buscar receta o ingrediente</label>
    <input id="cq" class="bsearch" type="search" placeholder="Busca una receta o un ingrediente…" value="${A.esc(ui.q)}" enterkeyhint="search" autocomplete="off">
    <div class="btabs" id="ctags">${FILTERS.map((t) => `<button type="button" class="chip" data-tag="${A.esc(t)}" aria-pressed="${t === ui.tag}">${A.esc(t)}</button>`).join("")}</div>
    <div class="clist" id="clist"></div>`;
  fillList();
  if (restore) { const l = $$("clist"), y = ui.scroll; l.scrollTop = y; requestAnimationFrame(() => { l.scrollTop = y; }); }
  $$("cmode").onclick = (e) => {
    const b = e.target.closest("[data-mode]"); if (!b) return;
    ui.mode = b.dataset.mode;
    for (const c of $$("cmode").children) c.setAttribute("aria-pressed", String(c === b));
    fillList();
  };
  $$("ctags").onclick = (e) => {
    const b = e.target.closest("[data-tag]"); if (!b) return;
    ui.tag = b.dataset.tag;
    for (const c of $$("ctags").children) c.setAttribute("aria-pressed", String(c === b));
    fillList();
  };
  let tmo;
  $$("cq").oninput = (e) => { clearTimeout(tmo); tmo = setTimeout(() => { ui.q = e.target.value.trim(); fillList(); }, 160); };
  $$("cpantry").onclick = showPantry;
  $$("clist").onclick = (e) => {
    const b = e.target.closest("[data-r]"); if (b) return showRecipe(+b.dataset.r);
    if (e.target.closest("[data-gopantry]")) showPantry();
    if (e.target.closest("[data-all]")) { ui.mode = "todas"; showList(); }
  };
}
const $$ = (id) => document.getElementById(id);

// Foto de la receta como fondo (sin menú de «Guardar imagen» al mantener pulsado); se carga al aparecer en pantalla.
const pic = (r) => `<span class="re" style="--h:${hue(r.n)}"${r.foto ? ` data-bg="${A.esc(r.foto.img)}"` : ""}>${A.esc(r.e)}</span>`;
let seen = null;
function lazyBg(root) {
  const els = root.querySelectorAll("[data-bg]");
  const show = (el) => { el.style.backgroundImage = `url('${el.dataset.bg}')`; el.classList.add("has-foto"); el.removeAttribute("data-bg"); };
  if (!("IntersectionObserver" in window)) return els.forEach(show);
  seen?.disconnect();
  seen = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { show(e.target); seen.unobserve(e.target); } }), { root: null, rootMargin: "300px" });
  els.forEach((el) => seen.observe(el));
}

function card(r, c) {
  const miss = c.missing.map((i) => i.n);
  const line = !miss.length ? `<span class="rh ok">✓ Tienes todo lo necesario</span>`
    : `<span class="rh">${miss.length === 1 ? "Te falta" : `Te faltan ${miss.length}`}: ${A.esc(miss.slice(0, 4).join(", "))}${miss.length > 4 ? "…" : ""}</span>`;
  return `<button type="button" class="rc" data-r="${r.id}">${pic(r)}
    <span class="ri"><span class="rn">${A.esc(r.n)}</span><span class="rm">${A.esc(meta(r))}</span>${line}</span></button>`;
}

function fillList() {
  const qt = tokens(ui.q);
  let rs = recipes.filter((r) => (ui.tag === "Todas" || r.filters.includes(ui.tag))
    && qt.every((w) => [...r.toks].some((t) => t.startsWith(w))));
  const rows = rs.map((r) => ({ r, c: check(r) }));
  const el = $$("clist");
  if (ui.mode === "todas") {
    rows.sort((a, b) => a.c.missing.length - b.c.missing.length || a.r.n.localeCompare(b.r.n, "es"));
    el.innerHTML = rows.length ? rows.map(({ r, c }) => card(r, c)).join("") : `<p class="note">No hay recetas con eso. Prueba con otra palabra.</p>`;
    lazyBg(el);
    return;
  }
  // «Con lo que tengo»: primero lo que puedes hacer ya, luego lo que necesita 1, 2 o 3 cosas más.
  const staples = new Set(STAPLES.map(key));
  const useful = rows.filter(({ r, c }) => c.missing.length <= 3 && r.ings.some((i) => !i.opt && !staples.has(i.k) && has(i.k)));
  if (!useful.length) {
    el.innerHTML = `<div class="empty"><b>Dime qué tienes en casa</b>
      <span>Marca los ingredientes que tienes y te diré qué puedes cocinar. Lo que compres con «Terminar compra» se apunta solo.</span>
      <button class="btn" type="button" data-gopantry>Marcar lo que tengo</button>
      <button class="btn ghost" type="button" data-all>Ver todas las recetas</button></div>`;
    return;
  }
  useful.sort((a, b) => a.c.missing.length - b.c.missing.length || b.c.have - a.c.have);
  const groups = [[0, "Puedes hacerlas ya"], [1, "Te falta 1 ingrediente"], [2, "Te faltan 2"], [3, "Te faltan 3"]];
  el.innerHTML = groups.map(([m, t]) => {
    const g = useful.filter((x) => x.c.missing.length === m);
    return g.length ? `<h3 class="cgroup">${t}</h3>${g.map(({ r, c }) => card(r, c)).join("")}` : "";
  }).join("");
  lazyBg(el);
}

const keepScroll = () => { const l = $$("clist"); if (l) ui.scroll = l.scrollTop; };
function showRecipe(id) {
  const r = recipes[id]; if (!r) return;
  keepScroll();
  const same = ui.view === "recipe" && ui.id === id, prev = same ? A.body().querySelector(".cdetail")?.scrollTop ?? 0 : 0;
  ui.view = "recipe"; ui.id = id;
  A.setTitle(r.n, true);
  const c = check(r);
  const toAdd = c.missing.filter((i) => !inList(i.k));
  const ings = r.ings.map((i) => {
    const st = has(i.k) ? "have" : inList(i.k) ? "list" : i.opt ? "optional" : "miss";
    const label = { have: "En casa", list: "En la lista", optional: "Opcional", miss: "Falta" }[st];
    return `<li><button type="button" class="ing ${st}" data-ing="${A.esc(i.k)}" data-n="${A.esc(i.n)}" aria-pressed="${st === "have"}">
      <span class="ic" aria-hidden="true">${A.CHECK_SVG}</span><span class="ie" aria-hidden="true">${A.esc(guess(i.n).emoji)}</span>
      <span class="inm">${A.esc(i.n)}<small>${A.esc(i.q || "")}</small></span><span class="ist">${label}</span></button></li>`;
  }).join("");
  const btn = !c.missing.length ? `<p class="ready">🎉 Tienes todo para hacerla.</p>`
    : toAdd.length ? `<button class="btn" type="button" id="cadd">Apuntar lo que falta (${toAdd.length})</button>`
    : `<p class="ready">Ya tienes en la lista todo lo que falta.</p>`;
  A.body().innerHTML = `
    <button type="button" class="back" id="cback">‹ Recetas</button>
    <div class="cdetail">
      ${r.foto ? `<figure class="hero"><span class="hero-img" style="background-image:url('${A.esc(r.foto.img)}')" role="img" aria-label="${A.esc(r.n)}"></span>
        <figcaption>Foto: <a href="${A.esc(r.foto.fuente)}" target="_blank" rel="noopener">${A.esc(r.foto.autor)}</a> · ${A.esc(r.foto.licencia)}</figcaption></figure>` : ""}
      <div class="rhead">${r.foto ? "" : `<span class="re big" style="--h:${hue(r.n)}">${A.esc(r.e)}</span>`}
        <div><p class="rm">${A.esc(meta(r))}</p><p class="rtags">${r.tags.map(A.esc).join(" · ")}</p></div></div>
      <h3 class="cgroup">Ingredientes <span>toca para marcar lo que tienes</span></h3>
      <ul class="ings">${ings}</ul>
      <div class="row">${btn}</div>
      <h3 class="cgroup">Preparación</h3>
      <ol class="steps">${r.p.map((s) => `<li>${A.esc(s)}</li>`).join("")}</ol>
    </div>`;
  $$("cback").onclick = () => showList(true);
  A.body().querySelector(".ings").onclick = (e) => {
    const b = e.target.closest("[data-ing]"); if (!b) return;
    const p = pantry();
    if (b.dataset.ing in p) delete p[b.dataset.ing]; else p[b.dataset.ing] = b.dataset.n;
    A.buzz(); A.save(); showRecipe(id);
  };
  const add = $$("cadd");
  if (add) add.onclick = async () => {
    add.disabled = true;
    for (const i of toAdd) await A.addItem({ query: i.n });
    A.save(); A.render(); A.buzz(20);
    A.setStatus(`Apuntado para ${r.n}: ${toAdd.map((i) => i.n).join(", ")}.`);
    showRecipe(id);
  };
  A.body().querySelector(".cdetail").scrollTop = prev;
}

function showPantry() {
  keepScroll();
  ui.view = "pantry";
  A.setTitle("Lo que tengo en casa", true);
  const all = new Map();
  for (const r of recipes) for (const i of r.ings) if (!all.has(i.k)) all.set(i.k, i.n);
  for (const [k, n] of Object.entries(pantry())) if (!all.has(k)) all.set(k, n);
  const last = A.st.history.at(-1);
  A.body().innerHTML = `
    <button type="button" class="back" id="cback">‹ Recetas</button>
    <p class="note">Marca lo que tienes. Al pulsar «Terminar compra», lo comprado se marca solo.</p>
    <label class="vh" for="pq">Buscar ingrediente</label>
    <input id="pq" class="bsearch" type="search" placeholder="Buscar ingrediente…" autocomplete="off">
    <div class="row">${last ? `<button class="btn ghost small" type="button" id="plast">Lo de mi última compra</button>` : ""}
      <button class="btn ghost small" type="button" id="pclear">Desmarcar todo</button></div>
    <div class="pgrid" id="pgrid"></div>
    <div class="bfoot"><span id="pcount"></span><button class="btn" type="button" id="pdone">Ver recetas</button></div>`;
  const fill = () => {
    const qt = tokens($$("pq").value);
    const items = [...all].filter(([k]) => qt.every((w) => k.split(" ").some((t) => t.startsWith(w))));
    const by = {};
    for (const [k, n] of items) (by[sectionOf(n)] ??= []).push([k, n]);
    $$("pgrid").innerHTML = ORDER.filter((s) => by[s]).map((s) => `<h3 class="cgroup">${A.esc(s)}</h3><div class="pchips">${
      by[s].sort((a, b) => a[1].localeCompare(b[1], "es")).map(([k, n]) =>
        `<button type="button" class="pc" data-k="${A.esc(k)}" data-n="${A.esc(n)}" aria-pressed="${has(k)}"><span aria-hidden="true">${A.esc(guess(n).emoji)}</span>${A.esc(n)}</button>`).join("")
    }</div>`).join("") || `<p class="note">No encuentro ese ingrediente.</p>`;
    count();
  };
  const count = () => { $$("pcount").textContent = `${plural(Object.keys(pantry()).length, "ingrediente", "ingredientes")} en casa`; };
  fill();
  $$("pq").oninput = fill;
  $$("pgrid").onclick = (e) => {
    const b = e.target.closest("[data-k]"); if (!b) return;
    const p = pantry();
    if (b.dataset.k in p) delete p[b.dataset.k]; else p[b.dataset.k] = b.dataset.n;
    b.setAttribute("aria-pressed", String(b.dataset.k in p));
    A.buzz(); A.save(); count();
  };
  const pl = $$("plast");
  if (pl) pl.onclick = () => { learnPurchase(last.items); A.save(); fill(); A.buzz(); };
  $$("pclear").onclick = () => { A.st.pantry = {}; A.save(); fill(); };
  $$("cback").onclick = () => showList(true);
  $$("pdone").onclick = () => { ui.mode = "tengo"; showList(); };
}
