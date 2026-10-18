// Recetas: qué cocinar con lo que tienes en casa y apuntar en la lista lo que falta.
import { tokens, guess, norm } from "./parser.js";

// Sección de cada ingrediente, para ordenar «Lo que tengo en casa» como en el súper.
const SECTIONS = {
  "Frutas y verduras": "Plátanos, Manzanas, Naranjas, Mandarinas, Limones, Fresas, Uvas, Peras, Melón, Sandía, Aguacates, Tomates, Lechuga, Cebollas, Ajos, Patatas, Zanahorias, Pimientos, Calabacín, Pepino, Brócoli, Champiñones, Espinacas, Berenjenas, Puerros, Calabaza, Coliflor, Judías verdes, Cebolla morada, Tomates cherry, Perejil, Cilantro, Albahaca, Jengibre, Rúcula, Maíz dulce, Limas, Mango, Piña, Arándanos, Repollo, Kiwis, Frutos rojos, Batatas, Brotes de soja, Cebolletas, Hierbabuena, Menta",
  "Carne": "Pechuga de pollo, Muslos de pollo, Pollo entero, Carne picada, Ternera, Filetes de ternera, Lomo de cerdo, Costillas, Hamburguesas, Salchichas, Bacon, Panceta, Cordero, Pavo picado, Alitas de pollo, Carne picada de cordero",
  "Pescado": "Salmón, Merluza, Gambas, Bacalao, Calamares, Mejillones, Atún fresco, Lubina, Dorada, Sepia, Almejas, Langostinos, Surimi, Salmón ahumado",
  "Charcutería y quesos": "Jamón serrano, Jamón cocido, Pechuga de pavo, Chorizo, Salchichón, Queso en lonchas, Queso curado, Queso fresco, Queso rallado, Mozzarella, Queso parmesano, Queso de cabra, Queso crema, Queso feta, Mascarpone, Morcilla, Queso brie",
  "Lácteos y huevos": "Leche, Huevos, Yogures, Yogur griego, Mantequilla, Nata, Nata para cocinar, Leche de coco, Bebida de avena, Leche condensada",
  "Panadería": "Pan, Pan de molde, Pan rallado, Pan de hamburguesa, Pan de pita, Tortillas de trigo, Masa de pizza, Hojaldre, Masa de empanadillas, Masa quebrada, Bizcochos de soletilla, Galletas, Croissants, Tortitas de arroz, Nachos, Tortillas de maíz",
  "Despensa": "Aceite de oliva, Aceite de girasol, Arroz, Arroz basmati, Macarrones, Espaguetis, Fideos, Lasaña, Tallarines, Gnocchi, Tortellini, Cuscús, Quinoa, Garbanzos, Lentejas, Alubias, Tomate frito, Tomate triturado, Atún en lata, Sardinas en lata, Vinagre, Mayonesa, Ketchup, Mostaza, Salsa de soja, Caldo de pollo, Caldo de verduras, Caldo de pescado, Aceitunas, Alcaparras, Pimiento del piquillo, Frutos secos, Nueces, Almendras, Pasas, Hummus, Guacamole, Pesto, Salsa barbacoa, Tahini, Edamame, Fideos de arroz, Salsa de ostras, Vino blanco, Vino tinto, Cerveza, Anís, Alubias con tomate, Crema de cacao, Crema de cacahuete, Alga nori, Arroz para sushi, Fideos ramen, Lentejas rojas, Papel de arroz, Pasta de curry verde, Salsa de pescado, Salsa sriracha, Vinagre de arroz, Aceite de sésamo, Anacardos, Cacahuetes, Caldo de carne, Gochujang, Pasta de soja picante, Wasabi, Kimchi, Tofu, Alubias negras, Bulgur, Chipotle, Harina de maíz precocida, Limones en conserva, Almidón de yuca",
  "Especias y repostería": "Sal, Pimienta negra, Pimentón, Comino, Orégano, Laurel, Canela, Curry, Azafrán, Colorante alimentario, Guindilla, Tomillo, Romero, Nuez moscada, Sésamo, Azúcar, Harina, Levadura, Maicena, Gelatina, Azúcar glas, Esencia de vainilla, Coco rallado, Miel, Chocolate, Cacao en polvo, Mermelada, Copos de avena, Cereales, Café, Granola, Semillas de chía, Pepitas de chocolate, Levadura de panadería, Cúrcuma, Garam masala, Pimienta de Sichuan, Pimienta de Jamaica, Anís estrellado, Ají amarillo",
  "Congelados": "Guisantes, Menestra, Patatas congeladas, Croquetas, Varitas de merluza, Pizza, Helado, Gyozas, Verduras para wok",
};
const ORDER = [...Object.keys(SECTIONS), "Otros"];
const key = (n) => tokens(n).join(" ");
const SECTION_OF = new Map();
for (const [s, names] of Object.entries(SECTIONS)) for (const n of names.split(", ")) SECTION_OF.set(key(n), s);
const sectionOf = (n) => SECTION_OF.get(key(n)) ?? (ORDER.includes(guess(n).cat) ? guess(n).cat : "Otros");

// Lo que casi todo el mundo tiene; se puede quitar en «En casa».
const STAPLES = ["Sal", "Aceite de oliva", "Pimienta negra", "Azúcar", "Harina"];
const FILTERS = ["Todas", "Favoritas", "Mis recetas", "Del mundo", "Rápidas", "Española", "Vegetariana", "Pasta y arroz", "Legumbres", "Carne", "Pescado", "Ensaladas",
  "Sopas y cremas", "Cenas ligeras", "Desayunos", "Postres", "Internacional", "Para niños", "Freidora de aire", "Con productos del súper"];
// Momentos del día y, dentro de cada uno, sus tipos (campo «m» de cada receta). Una receta puede estar en varios.
const MOMENTS = [
  ["Desayuno", "☕", "Para desayunar", ["Dulce", "Salado", "Saludable", "Batidos y zumos"]],
  ["Brunch", "🥐", "Para el brunch", ["Huevos", "Tostadas y bocadillos", "Horneados", "Dulce"]],
  ["Comida", "🍲", "Para comer", ["Arroces", "Pasta", "Legumbres y guisos", "Carne", "Pescado", "Verduras y ensaladas", "Internacional", "Postres"]],
  ["Merienda", "🧁", "Para merendar", ["Bizcochos y repostería", "Dulce rápido", "Salado", "Fruta y batidos"]],
  ["Cena", "🌙", "Para cenar", ["Ligera", "Huevos", "Sopas y cremas", "Para picar", "Pizza y hamburguesas", "Postres"]],
];
const ALL = "Todo";
// País de origen (campo «z») de las recetas de fuera.
const FLAGS = { "Argentina": "🇦🇷", "Brasil": "🇧🇷", "China": "🇨🇳", "Corea del Sur": "🇰🇷", "Estados Unidos": "🇺🇸", "Filipinas": "🇵🇭",
  "Francia": "🇫🇷", "Grecia": "🇬🇷", "Hawái": "🌺", "India": "🇮🇳", "Indonesia": "🇮🇩", "Italia": "🇮🇹", "Jamaica": "🇯🇲", "Japón": "🇯🇵",
  "Líbano": "🇱🇧", "Marruecos": "🇲🇦", "México": "🇲🇽", "Perú": "🇵🇪", "Reino Unido": "🇬🇧", "Senegal": "🇸🇳", "Suecia": "🇸🇪",
  "Tailandia": "🇹🇭", "Turquía": "🇹🇷", "Túnez": "🇹🇳", "Venezuela": "🇻🇪", "Vietnam": "🇻🇳" };
const origin = (r) => r.z ? `${FLAGS[r.z] ?? "🌍"} ${r.z}` : "";
const MOMENT = new Map(MOMENTS.map((m) => [m[0], m]));
// Filtros de siempre que siguen a mano dentro de cada momento.
const EXTRA = ["Favoritas", "Mis recetas", "Del mundo", "Rápidas", "Vegetariana", "Para niños", "Española", "Internacional", "Freidora de aire", "Con productos del súper"];
// El momento según la hora: lo primero que ves es lo que toca ahora.
function nowMoment(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60, finde = d.getDay() === 0 || d.getDay() === 6;
  if (h >= 5 && h < (finde ? 10 : 11.5)) return "Desayuno";
  if (h >= 5 && h < 13) return finde ? "Brunch" : "Comida";
  if (h >= 5 && h < 16.5) return "Comida";
  if (h >= 5 && h < 20) return "Merienda";
  return "Cena";
}
const chipsFor = (mo) => mo === ALL ? FILTERS : ["Todas", ...MOMENT.get(mo)[3], ...EXTRA.filter((t) => !MOMENT.get(mo)[3].includes(t))];
function matches(r) {
  if (ui.moment !== ALL && !r.m?.[ui.moment]) return false;
  if (ui.tag === "Todas") return true;
  if (ui.moment !== ALL && MOMENT.get(ui.moment)[3].includes(ui.tag)) return r.m[ui.moment].includes(ui.tag);
  if (ui.tag === "Favoritas") return isFav(r);
  return r.filters.includes(ui.tag);
}

let A; // funciones de la app (lista, guardar, pintar…)
let recipes = null, loading = null;
const ui = { view: "list", mode: "tengo", moment: null, tag: "Todas", q: "", id: null, pq: "", scroll: 0, serv: {}, step: 0, from: null, pickDay: null };

export function initCocina(api) {
  A = api;
  // En el modo cocinar la pantalla no se apaga; al salir se deja de pedir.
  A.sheet.addEventListener("close", () => setView("closed"));
  document.addEventListener("visibilitychange", () => { if (ui.view === "cook" && A.sheet.open) lockScreen(); });
  document.addEventListener("keydown", (e) => {
    if (ui.view !== "cook" || !A.sheet.open || e.target.closest?.("input, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); stepTo(ui.step + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); stepTo(ui.step - 1); }
  });
}
function setView(v) {
  ui.view = v;
  if (v === "cook") lockScreen(); else { screenLock?.release?.().catch(() => {}); screenLock = null; }
}
let screenLock = null;
async function lockScreen() {
  if (screenLock || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try { screenLock = await navigator.wakeLock.request("screen"); screenLock.addEventListener("release", () => { screenLock = null; }); } catch {}
}

function prep(r, idx) {
  r.id = idx;
  r.ings = r.i.map(([n, q]) => ({ n, q, k: key(n), opt: !!r.o?.includes(n) }));
  r.toks = new Set(tokens(`${r.n} ${r.z ?? ""} ${r.i.map((x) => x[0]).join(" ")}`));
  r.filters = [...r.tags, ...(r.t <= 20 ? ["Rápidas"] : []), ...(r.tags.includes("Vegana") ? ["Vegetariana"] : []), ...(r.z ? ["Del mundo"] : [])];
  r.lleva = allergens(r);
  return r;
}
let baseCount = 0, homeFotos = {};
// Datos para las tarjetas de la pantalla de inicio.
export async function homeInfo() {
  await loadRecipes();
  const [mo, emo, para] = MOMENT.get(nowMoment());
  const staples = new Set(STAPLES.map(key));
  const ready = recipes.filter((r) => allowed(r) && !check(r).missing.length && r.ings.some((i) => !i.opt && !staples.has(i.k))).length;
  const hoy = plan().filter((e) => e.d === ymd()).map((e) => e.n);
  const pick = (f) => recipes.filter((r) => r.foto && !r.mine && f(r))[Math.floor(Date.now() / 864e5) % 7];
  const today = recipes.find((r) => r.n === hoy[0] && r.foto);
  return {
    total: recipes.length, moment: mo, momentEmo: emo, para, inMoment: recipes.filter((r) => r.m?.[mo]).length,
    ready, pantryN: Object.keys(pantry()).length, soon: expiring(2), planN: plan().length, hoy,
    fotos: homeFotos,
    // Si aún no hay foto propia de la tarjeta, una receta que encaje.
    alt: { Recetas: pick((r) => r.m?.[mo])?.foto.img, "Menú": (today ?? pick((r) => r.m?.Comida))?.foto.img, "En casa": pick((r) => r.filters.includes("Rápidas"))?.foto.img },
  };
}
function loadRecipes() {
  const get = (u, d) => fetch(u).then((r) => (r.ok ? r.json() : d)).catch(() => d);
  loading ??= Promise.all([get("data/recetas.json", []), get("data/recetas-fotos.json", {})]).then(([rs, fotos]) => {
    rs.forEach((r, idx) => { prep(r, idx); r.foto = fotos[r.n] ?? null; });
    homeFotos = Object.fromEntries(Object.entries(fotos).filter(([k]) => k.startsWith("Inicio ")).map(([k, v]) => [k.slice(7), v]));
    A.markGeneric(rs.flatMap((r) => r.i.map((x) => x[0])));
    baseCount = rs.length;
    recipes = rs;
    addMine();
    return recipes;
  });
  return loading;
}

// ---------- Dieta y alergias ----------
// Se deduce de los ingredientes; es una ayuda, no sustituye mirar las etiquetas.
const ALLERGENS = [
  ["gluten", "🌾", "Gluten", /\b(harina(?! de (maiz|arroz|garbanzo))|pan|pan rallado|macarrones|espaguetis|fideos(?! de arroz)|lasana|tallarines|gnocchi|tortellini|pasta|cuscus|bulgur|cerveza|galletas|hojaldre|masa|bizcochos?|croissants?|tortillas de trigo|pan de pita|cereales|copos de avena|salsa de soja|seitan|picatostes|muesli|granola)\b/],
  ["lactosa", "🥛", "Lactosa", /\b(leche(?! de (coco|avena|almendras?|soja|arroz))|mantequilla|nata|queso|quesos|yogur|yogures|mozzarella|mascarpone|parmesano|leche condensada|helado|crema de cacao|bechamel|requeson|burrata|ghee)\b/],
  ["huevo", "🥚", "Huevo", /\b(huevos?|yemas?|claras?|mayonesa|bizcochos de soletilla)\b/],
  ["frutos", "🥜", "Frutos secos", /\b(nueces|nuez|almendras?|avellanas?|anacardos?|cacahuetes?|pistachos?|pinones|frutos secos|crema de cacahuete|pesto|praline|cacahuete)\b/],
  ["marisco", "🦐", "Marisco", /\b(gambas?|langostinos?|mejillones|almejas|calamares|calamar|sepia|pulpo|surimi|berberechos|cigalas)\b/],
  ["pescado", "🐟", "Pescado", /\b(salmon|merluza|bacalao|atun|sardinas|lubina|dorada|anchoas|boquerones|salsa de pescado|caldo de pescado|corvina|caballa|rape)\b/],
  ["cerdo", "🐷", "Cerdo", /\b(bacon|panceta|chorizo|jamon(?! de pavo)|lomo de cerdo|costillas|salchichas|salchichon|morcilla|cerdo|sobrasada|lacon)\b/],
];
const ALLER = new Map(ALLERGENS.map((a) => [a[0], a]));
function allergens(r) {
  const names = r.i.filter(([n]) => !r.o?.includes(n)).map(([n]) => norm(n)).join(" | ");
  return ALLERGENS.filter(([, , , re]) => re.test(names)).map((a) => a[0]);
}
const diet = () => (A.st.diet ??= { tipo: "", evita: [] });
function allowed(r) {
  const d = diet();
  if (d.tipo === "vegana" && !r.tags.includes("Vegana")) return false;
  if (d.tipo === "vegetariana" && !r.filters.includes("Vegetariana")) return false;
  return !r.lleva.some((a) => d.evita.includes(a));
}
const dietLabel = () => {
  const d = diet(), bits = [d.tipo && cap(d.tipo), ...d.evita.map((a) => `sin ${ALLER.get(a)[2].toLowerCase()}`)].filter(Boolean);
  return bits.length ? bits.join(", ") : "Sin filtros";
};
function showDiet() {
  keepScroll();
  setView("diet");
  A.setTitle("Dieta y alergias", true);
  const d = diet();
  A.body().innerHTML = `
    <button type="button" class="back" id="cback">‹ Recetas</button>
    <div class="plan">
      <p class="note">Las recetas que no encajen dejan de salir en la lista de recetas y en las ideas. Se mira por los ingredientes: revisa siempre las etiquetas.</p>
      <h3 class="cgroup">Tu dieta</h3>
      <div class="dgrid" id="dtipo">${[["", "🍽️", "Como de todo"], ["vegetariana", "🥕", "Vegetariana"], ["vegana", "🌱", "Vegana"]].map(([v, e, t]) =>
        `<button type="button" class="dbtn" data-tipo="${v}" aria-pressed="${d.tipo === v}"><span aria-hidden="true">${e}</span>${t}</button>`).join("")}</div>
      <h3 class="cgroup">No quiero recetas con</h3>
      <div class="dgrid" id="devita">${ALLERGENS.map(([k, e, t]) =>
        `<button type="button" class="dbtn" data-evita="${k}" aria-pressed="${d.evita.includes(k)}"><span aria-hidden="true">${e}</span>${t}</button>`).join("")}</div>
    </div>
    <div class="bfoot"><span id="dcount"></span><button class="btn" type="button" id="ddone">Ver recetas</button></div>`;
  const count = () => { const n = recipes.filter(allowed).length; $$("dcount").textContent = `${n} de ${recipes.length} recetas encajan`; };
  count();
  $$("dtipo").onclick = (e) => {
    const b = e.target.closest("[data-tipo]"); if (!b) return;
    d.tipo = b.dataset.tipo;
    for (const c of $$("dtipo").children) c.setAttribute("aria-pressed", String(c === b));
    A.buzz(); A.save(); count();
  };
  $$("devita").onclick = (e) => {
    const b = e.target.closest("[data-evita]"); if (!b) return;
    const k = b.dataset.evita, i = d.evita.indexOf(k);
    if (i >= 0) d.evita.splice(i, 1); else d.evita.push(k);
    b.setAttribute("aria-pressed", String(i < 0));
    A.buzz(); A.save(); count();
  };
  $$("cback").onclick = () => cookBack();
  $$("ddone").onclick = () => showList();
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
export async function openRecipes(id, moment, view) {
  A.openSheet("Recetas", `<p class="note">Cargando recetas…</p>`, "browsing cooking");
  await loadRecipes();
  if (!A.sheet.open) return;
  ui.from = null; ui.pickDay = null;
  if (moment && (MOMENT.has(moment) || moment === ALL) && moment !== ui.moment) { ui.moment = moment; ui.tag = "Todas"; ui.scroll = 0; }
  if (view === "plan") return showPlan();
  if (view === "pantry") return showPantry();
  if (view === "tengo") { ui.mode = "tengo"; ui.q = ""; return showList(); }
  if (view?.startsWith("use:")) { ui.q = view.slice(4); ui.mode = "todas"; ui.moment = ALL; ui.tag = "Todas"; return showList(); }
  if (id != null && recipes[id]) { ui.view = "list"; return showRecipe(id); }
  showList(true);
}

// Botón de cerrar, gesto de atrás o deslizar hacia abajo: un paso atrás (paso a paso → receta → recetas o menú).
export function cookBack() {
  if (ui.view === "cook") { showRecipe(ui.id); return true; }
  if ((ui.view === "recipe" && ui.from === "plan") || (ui.view === "list" && ui.pickDay)) { showPlan(); return true; }
  if (ui.view === "edit" && ui.editId != null) { showRecipe(ui.editId); return true; }
  if (["recipe", "pantry", "plan", "diet", "edit"].includes(ui.view)) { showList(true); return true; }
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
  // Ideas del momento del día que toca (desayuno por la mañana, cena por la noche…).
  const [mo, emo, para] = MOMENT.get(nowMoment());
  const inMo = (r) => !!r.m?.[mo];
  // Lo que tienes en el menú de hoy va primero.
  const hoy = new Set(plan().filter((e) => e.d === ymd()).map((e) => e.n)), np = plan().length;
  // Y luego las que aprovechan lo que caduca pronto.
  const soon = expiring(2), soonK = new Map(soon.map((x) => [x.k, x.n]));
  const uses = (r) => r.ings.find((i) => soonK.has(i.k))?.n;
  const rows = recipes.filter((r) => hoy.has(r.n) || (r.foto && allowed(r))).map((r) => ({ r, c: check(r) }));
  rows.sort((a, b) => hoy.has(b.r.n) - hoy.has(a.r.n) || !!uses(b.r) - !!uses(a.r) || inMo(b.r) - inMo(a.r) || (cooking ? Math.min(a.c.missing.length, 4) - Math.min(b.c.missing.length, 4) : 0) || rot(a.r) - rot(b.r));
  const pick = rows.slice(0, 8);
  const html = `<div class="ideas-head"><h2>¿Qué cocino hoy?</h2><button type="button" class="lnk" data-cook-all>Ver las ${recipes.length} recetas</button></div>
    ${soon.length ? `<button type="button" class="expbar" data-cook-use="${A.esc(soon[0].n)}"><span aria-hidden="true">⏰</span>
      <span><b>${A.esc(soon.slice(0, 3).map((x) => `${x.n} (${whenTxt(x.left).replace("caduca ", "").replace("caducó ", "caducó ")})`).join(", "))}</b> · Recetas para aprovecharlo ›</span></button>` : ""}
    <div class="ideas-pills"><button type="button" class="ideas-mo" data-cook-moment="${mo}"><span aria-hidden="true">${emo}</span> ${para} · ver ${recipes.filter(inMo).length} recetas</button>
      <button type="button" class="ideas-mo" data-cook-plan><span aria-hidden="true">📅</span> ${np ? `Tu menú · ${plural(np, "receta", "recetas")}` : "Planificar el menú"}</button></div>
    <div class="ideas-row">${pick.map(({ r, c }) => `<button type="button" class="idea" data-recipe="${r.id}">
      <span class="idea-ph" style="${r.foto ? `background-image:url('${A.esc(r.foto.img)}')` : ""}">${r.foto ? "" : A.esc(r.e)}</span>
      <span class="idea-n">${A.esc(r.n)}</span>
      <span class="idea-m${c.missing.length && !hoy.has(r.n) ? "" : " ok"}">${hoy.has(r.n) ? "📅 En tu menú de hoy" : uses(r) ? `⏰ Aprovecha: ${A.esc(uses(r))}` : c.missing.length ? (cooking ? `Faltan ${c.missing.length}` : mins(r.t)) : "✓ Tienes todo"}</span></button>`).join("")}</div>`;
  if (html !== ideasHTML) { el.innerHTML = html; ideasHTML = html; }
  el.hidden = false;
}

const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const mins = (t) => t < 60 ? `${t} min` : `${Math.floor(t / 60)} h${t % 60 ? ` ${t % 60} min` : ""}`;
const meta = (r, s = r.r) => `${r.z ? `${origin(r)} · ` : ""}${mins(r.t)} · ${s} ${s === 1 ? "ración" : "raciones"} · ${r.d}`;
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

function showList(restore = false) {
  setView("list");
  ui.moment ??= nowMoment();
  if (!chipsFor(ui.moment).includes(ui.tag)) ui.tag = "Todas";
  A.setTitle(ui.pickDay ? "Elige una receta" : "Recetas", !!ui.pickDay);
  const n = Object.keys(pantry()).length, np = plan().length;
  const tabs = [...MOMENTS, [ALL, "📖"]].map(([mo, emo]) => `<button type="button" data-moment="${mo}" aria-pressed="${mo === ui.moment}">
      <span class="mo-e" aria-hidden="true">${emo}</span><span class="mo-n">${mo}</span></button>`).join("");
  A.body().innerHTML = `
    <div class="moments" id="cmoment" role="group" aria-label="Momento del día">${tabs}</div>
    <div class="seg" id="cmode" role="group" aria-label="Qué recetas ver">
      <button type="button" data-mode="tengo" aria-pressed="${ui.mode === "tengo"}">Con lo que tengo</button>
      <button type="button" data-mode="todas" aria-pressed="${ui.mode === "todas"}">Todas</button>
    </div>
    ${ui.pickDay ? `<div class="pickbar"><span>📅 Toca una receta para el menú <b>${A.esc(delDay(ui.pickDay))}</b></span><button type="button" class="lnk" id="cpickx">Cancelar</button></div>`
    : `<div class="cbtns"><button type="button" class="pantry-btn" id="cpantry"><span>🏠 En casa</span><b>${plural(n, "ingrediente", "ingredientes")}</b></button>
      <button type="button" class="pantry-btn" id="cplan"><span>📅 Menú</span><b>${np ? plural(np, "receta", "recetas") : "Planificar"}</b></button>
      <button type="button" class="pantry-btn" id="cdiet"><span>🥗 Dieta</span><b>${A.esc(dietLabel())}</b></button></div>`}
    <div class="srow"><label class="vh" for="cq">Buscar receta o ingrediente</label>
    <input id="cq" class="bsearch" type="search" placeholder="Busca una receta o un ingrediente…" value="${A.esc(ui.q)}" enterkeyhint="search" autocomplete="off">
    <button type="button" class="round" id="cnew" title="Crear o pegar tu propia receta" aria-label="Crear tu receta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button></div>
    <div class="btabs" id="ctags">${tagChips()}</div>
    <div class="clist" id="clist"></div>`;
  fillList();
  const on = $$("ctags").querySelector('[aria-pressed="true"]');
  if (on && on.dataset.tag !== "Todas") $$("ctags").scrollLeft = on.offsetLeft - $$("ctags").offsetLeft - 16;
  if (restore) { const l = $$("clist"), y = ui.scroll; l.scrollTop = y; requestAnimationFrame(() => { l.scrollTop = y; }); }
  $$("cmode").onclick = (e) => {
    const b = e.target.closest("[data-mode]"); if (!b) return;
    ui.mode = b.dataset.mode;
    for (const c of $$("cmode").children) c.setAttribute("aria-pressed", String(c === b));
    fillList();
  };
  $$("cmoment").onclick = (e) => {
    const b = e.target.closest("[data-moment]"); if (!b || b.dataset.moment === ui.moment) return;
    ui.moment = b.dataset.moment; ui.tag = "Todas";
    for (const c of $$("cmoment").children) c.setAttribute("aria-pressed", String(c === b));
    $$("ctags").innerHTML = tagChips(); $$("ctags").scrollLeft = 0;
    A.buzz(); fillList(); $$("clist").scrollTop = 0;
  };
  $$("ctags").onclick = (e) => {
    const b = e.target.closest("[data-tag]"); if (!b) return;
    ui.tag = b.dataset.tag;
    for (const c of $$("ctags").querySelectorAll("[data-tag]")) c.setAttribute("aria-pressed", String(c === b));
    fillList();
  };
  let tmo;
  $$("cq").oninput = (e) => { clearTimeout(tmo); tmo = setTimeout(() => { ui.q = e.target.value.trim(); fillList(); }, 160); };
  if (ui.pickDay) $$("cpickx").onclick = showPlan;
  else { $$("cpantry").onclick = showPantry; $$("cplan").onclick = showPlan; $$("cdiet").onclick = showDiet; }
  $$("cnew").onclick = () => showEdit(null);
  $$("clist").onclick = (e) => {
    const h = e.target.closest("[data-fav-r]");
    if (h) { const on = toggleFav(recipes[+h.dataset.favR]); h.setAttribute("aria-pressed", String(on)); h.textContent = on ? "❤️" : "🤍"; if (ui.tag === "Favoritas") fillList(); return; }
    const b = e.target.closest("[data-r]");
    if (b && ui.pickDay) { addToPlan(+b.dataset.r, ui.pickDay); return showPlan(); }
    if (b) { ui.from = null; return showRecipe(+b.dataset.r); }
    if (e.target.closest("[data-gopantry]")) showPantry();
    if (e.target.closest("[data-all]")) { ui.mode = "todas"; showList(); }
    if (e.target.closest("[data-new]")) showEdit(null);
    if (e.target.closest("[data-diet]")) showDiet();
  };
}
const $$ = (id) => document.getElementById(id);
// Tipos del momento elegido (Dulce, Salado…) y, tras una raya, los filtros de siempre.
function tagChips() {
  const subs = ui.moment === ALL ? [] : MOMENT.get(ui.moment)[3];
  return chipsFor(ui.moment).map((t, k, all) => `${subs.length && k === subs.length + 1 ? `<span class="chip-sep" aria-hidden="true"></span>` : ""}<button type="button" class="chip${subs.includes(t) ? " sub" : ""}" data-tag="${A.esc(t)}" aria-pressed="${t === ui.tag}">${A.esc(t)}</button>`).join("");
}

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

// Recetas favoritas (corazón en la foto y en la receta).
const favs = () => (A.st.favR ??= []);
const isFav = (r) => favs().includes(r.n);
function toggleFav(r) {
  const f = favs(), k = f.indexOf(r.n);
  if (k >= 0) f.splice(k, 1); else f.push(r.n);
  A.buzz(); A.save();
  A.setStatus(k >= 0 ? `Quitada de favoritas: ${r.n}.` : `❤️ Guardada en favoritas: ${r.n}.`);
  return k < 0;
}
const heart = (r) => `<button type="button" class="rfav" data-fav-r="${r.id}" aria-pressed="${isFav(r)}" aria-label="${isFav(r) ? "Quitar de" : "Guardar en"} favoritas">${isFav(r) ? "❤️" : "🤍"}</button>`;
function card(r, c) {
  const miss = c.missing.map((i) => i.n);
  const line = !miss.length ? `<span class="rh ok">✓ Tienes todo lo necesario</span>`
    : `<span class="rh">${miss.length === 1 ? "Te falta" : `Te faltan ${miss.length}`}: ${A.esc(miss.slice(0, 4).join(", "))}${miss.length > 4 ? "…" : ""}</span>`;
  return `<div class="rcw"><button type="button" class="rc" data-r="${r.id}">${pic(r)}
    <span class="ri"><span class="rn">${A.esc(r.n)}</span><span class="rm">${A.esc(meta(r))}</span>${line}</span></button>${heart(r)}</div>`;
}

function fillList() {
  const qt = tokens(ui.q);
  // Al buscar se busca en todas, sin importar el momento elegido.
  let rs = recipes.filter((r) => (qt.length || matches(r))
    && qt.every((w) => [...r.toks].some((t) => t.startsWith(w))));
  const hidden = rs.filter((r) => !allowed(r) && !r.mine).length;
  rs = rs.filter((r) => allowed(r) || r.mine);
  const hideNote = hidden ? `<button type="button" class="dnote" data-diet>🥗 ${plural(hidden, "receta oculta", "recetas ocultas")} por tu dieta (${A.esc(dietLabel())}) · Cambiar</button>` : "";
  const rows = rs.map((r) => ({ r, c: check(r) }));
  const el = $$("clist");
  if (ui.mode === "todas" && ui.tag === "Del mundo" && !qt.length) {
    // Recetas de fuera agrupadas por país.
    const by = new Map();
    for (const x of rows.sort((a, b) => a.r.z.localeCompare(b.r.z, "es") || a.c.missing.length - b.c.missing.length)) {
      if (!by.has(x.r.z)) by.set(x.r.z, []);
      by.get(x.r.z).push(x);
    }
    el.innerHTML = hideNote + [...by].map(([z, g]) => `<h3 class="cgroup">${FLAGS[z] ?? "🌍"} ${A.esc(z)}</h3>${g.map(({ r, c }) => card(r, c)).join("")}`).join("")
      || `<p class="note">No hay recetas de fuera para este momento.</p>`;
    lazyBg(el);
    return;
  }
  if (ui.tag === "Mis recetas" && !rows.length && !qt.length) {
    el.innerHTML = `<div class="empty"><span class="empty-art" aria-hidden="true">📝</span><b>Guarda aquí tus recetas</b>
      <span>Escríbela o pega una receta de cualquier web y la app separa ingredientes y pasos. Luego puedes apuntar lo que falta y cocinarla paso a paso.</span>
      <button class="btn" type="button" data-new>Crear mi receta</button></div>`;
    return;
  }
  if (ui.tag === "Favoritas" && !rows.length && !qt.length) {
    el.innerHTML = `<div class="empty"><span class="empty-art" aria-hidden="true">🤍</span><b>Aún no tienes favoritas</b>
      <span>Toca el corazón de una receta para guardarla aquí.</span></div>`;
    return;
  }
  // Favoritas y Mis recetas salen siempre todas, tengas o no los ingredientes.
  if (ui.mode === "todas" || ui.tag === "Favoritas" || ui.tag === "Mis recetas") {
    rows.sort((a, b) => a.c.missing.length - b.c.missing.length || a.r.n.localeCompare(b.r.n, "es"));
    el.innerHTML = hideNote + (rows.length ? rows.map(({ r, c }) => card(r, c)).join("") : `<p class="note">No hay recetas con eso. Prueba con otra palabra.</p>`);
    lazyBg(el);
    return;
  }
  // «Con lo que tengo»: primero lo que puedes hacer ya, luego lo que necesita 1, 2 o 3 cosas más.
  const staples = new Set(STAPLES.map(key));
  const usable = ({ r, c }) => c.missing.length <= 3 && r.ings.some((i) => !i.opt && !staples.has(i.k) && has(i.k));
  const useful = rows.filter(usable);
  if (!useful.length && recipes.some((r) => usable({ r, c: check(r) }))) {
    const mo = ui.moment === ALL ? "" : ` ${MOMENT.get(ui.moment)[2].toLowerCase()}`;
    el.innerHTML = `<div class="empty"><b>Con lo que tienes no sale nada${A.esc(mo)}${ui.tag === "Todas" ? "" : ` (${A.esc(ui.tag)})`}</b>
      <span>Prueba otro momento del día o mira todas las recetas de aquí y lo que te faltaría.</span>
      <button class="btn" type="button" data-all>Ver todas las recetas</button></div>`;
    return;
  }
  if (!useful.length) {
    el.innerHTML = `<div class="empty"><b>Dime qué tienes en casa</b>
      <span>Marca los ingredientes que tienes y te diré qué puedes cocinar. Lo que compres con «Terminar compra» se apunta solo.</span>
      <button class="btn" type="button" data-gopantry>Marcar lo que tengo</button>
      <button class="btn ghost" type="button" data-all>Ver todas las recetas</button></div>`;
    return;
  }
  useful.sort((a, b) => a.c.missing.length - b.c.missing.length || b.c.have - a.c.have);
  const groups = [[0, "Puedes hacerlas ya"], [1, "Te falta 1 ingrediente"], [2, "Te faltan 2"], [3, "Te faltan 3"]];
  el.innerHTML = hideNote + groups.map(([m, t]) => {
    const g = useful.filter((x) => x.c.missing.length === m);
    return g.length ? `<h3 class="cgroup">${t}</h3>${g.map(({ r, c }) => card(r, c)).join("")}` : "";
  }).join("");
  lazyBg(el);
}

// ---------- Raciones ----------
// Las cantidades se recalculan al cambiar las raciones: «1/2 cucharadita» × 2 = «1 cucharadita».
const FRAC = { 0.25: "¼", 0.5: "½", 0.75: "¾" };
const PLURAL = new Set(("cucharada cucharadita rebanada diente bote trozo barra lata oblea rama hoja lámina rodaja loncha yema bolsa sobre "
  + "tarrina vasito filete lomo contramuslo muslo bola cabeza cogollo envase paquete puñado ramita rulo tarro manojo onza panecillo estrella "
  + "guindilla chile chorrito taza vaso pieza tira rojo roja verde maduro madura grande mediano mediana pequeño pequeña fresco fresca "
  + "blanco blanca cocido cocida troceado deshuesado entero entera").split(" "));
const MEASURE = new Set(["g", "kg", "ml", "l", "cl", "cm", "cucharada", "cucharadas", "cucharadita", "cucharaditas", "taza", "tazas", "vaso", "vasos", "vasito", "vasitos"]);
// Lo que se cuenta por piezas (huevos, dientes, lonchas) va en enteros o medios; lo que se mide, en cuartos.
function roundQty(v, dec, pieces) {
  if (v >= 20) v = Math.max(5, Math.round(v / 5) * 5);
  else if (dec) v = Math.max(0.1, Math.round(v * 10) / 10);
  else if (pieces) v = v >= 2 ? Math.round(v) : Math.max(0.5, Math.round(v * 2) / 2);
  else if (v >= 3) v = Math.round(v * 2) / 2;
  else v = Math.max(0.25, Math.round(v * 4) / 4);
  const ent = Math.floor(v), fr = +(v - ent).toFixed(2);
  return [!dec && FRAC[fr] ? (ent ? `${ent} ${FRAC[fr]}` : FRAC[fr]) : String(v).replace(".", ","), v];
}
export function scaleQty(q, f) {
  if (!q || Math.abs(f - 1) < 1e-9) return q;
  // Lo que va entre paréntesis («1 envase (125 g)») es el tamaño de cada uno: no cambia.
  return q.split(/(\([^)]*\))/).map((part, k) => k % 2 ? part
    : part.replace(/(\d+(?:[.,]\d+)?)(?:\/(\d+))?(\s+)?([a-záéíóúüñ]+)?/gi, (m, a, b, sp = "", w) => {
      const n = b ? parseFloat(a) / +b : parseFloat(a.replace(",", "."));
      const [txt, v] = roundQty(n * f, /[.,]/.test(a), !MEASURE.has(w?.toLowerCase()));
      if (!w) return txt + sp;
      const lw = w.toLowerCase();
      if ((lw === "g" || lw === "ml") && v >= 1000) return `${String(Math.round(v / 100) / 10).replace(".", ",")}${sp}${lw === "g" ? "kg" : "l"}`;
      if (v > 1 && PLURAL.has(lw)) w += "s";
      else if (v <= 1 && lw.endsWith("s") && PLURAL.has(lw.slice(0, -1))) w = w.slice(0, -1);
      return `${txt}${sp}${w}`;
    })).join("");
}
const servOf = (r) => ui.serv[r.id] ?? r.r;
function setServ(r, s) {
  s = Math.max(1, Math.min(24, s));
  ui.serv[r.id] = s;
  // Si vienes del menú, las raciones se guardan en ese día.
  const e = ui.from === "plan" ? plan()[ui.planIdx] : null;
  if (e && e.n === r.n) { e.s = s; A.save(); }
}

const keepScroll = () => { const l = $$("clist"); if (l) ui.scroll = l.scrollTop; };
function showRecipe(id) {
  const r = recipes[id]; if (!r) return;
  keepScroll();
  const same = ui.view === "recipe" && ui.id === id, prev = same ? A.body().querySelector(".cdetail")?.scrollTop ?? 0 : 0;
  setView("recipe"); ui.id = id;
  A.setTitle(r.n, true);
  const c = check(r), sv = servOf(r), f = sv / r.r;
  const toAdd = c.missing.filter((i) => !inList(i.k));
  const ings = r.ings.map((i) => {
    const st = has(i.k) ? "have" : inList(i.k) ? "list" : i.opt ? "optional" : "miss";
    const label = { have: "En casa", list: "En la lista", optional: "Opcional", miss: "Falta" }[st];
    return `<li><button type="button" class="ing ${st}" data-ing="${A.esc(i.k)}" data-n="${A.esc(i.n)}" aria-pressed="${st === "have"}">
      <span class="ic" aria-hidden="true">${A.CHECK_SVG}</span><span class="ie" aria-hidden="true">${A.esc(guess(i.n).emoji)}</span>
      <span class="inm">${A.esc(i.n)}<small>${A.esc(scaleQty(i.q, f) || "")}</small></span><span class="ist">${label}</span></button></li>`;
  }).join("");
  const btn = !c.missing.length ? `<p class="ready">🎉 Tienes todo para hacerla.</p>`
    : toAdd.length ? `<button class="btn" type="button" id="cadd">Apuntar lo que falta (${toAdd.length})</button>`
    : `<p class="ready">Ya tienes en la lista todo lo que falta.</p>`;
  const days = nextDays(), inPlan = new Set(plan().filter((e) => e.n === r.n).map((e) => e.d));
  A.body().innerHTML = `
    <button type="button" class="back" id="cback">‹ ${ui.from === "plan" ? "Menú de la semana" : "Recetas"}</button>
    <div class="cdetail">
      ${r.foto ? `<figure class="hero"><span class="hero-img" style="background-image:url('${A.esc(r.foto.img)}')" role="img" aria-label="${A.esc(r.n)}"></span>${heart(r)}
        ${r.mine ? "" : `<figcaption>Foto: <a href="${A.esc(r.foto.fuente)}" target="_blank" rel="noopener">${A.esc(r.foto.autor)}</a> · ${A.esc(r.foto.licencia)}</figcaption>`}</figure>` : ""}
      <div class="rhead">${r.foto ? "" : `<span class="re big" style="--h:${hue(r.n)}">${A.esc(r.e)}</span>${heart(r)}`}
        <div><p class="rm">${A.esc(meta(r, sv))}</p><p class="rtags">${r.tags.map(A.esc).join(" · ")}</p>
          ${r.lleva.length ? `<p class="rlleva${r.lleva.some((a) => diet().evita.includes(a)) ? " warn" : ""}">Lleva: ${r.lleva.map((a) => `${ALLER.get(a)[1]} ${ALLER.get(a)[2].toLowerCase()}`).join(" · ")}</p>` : ""}
          ${r.m ? `<p class="rmo">${Object.keys(r.m).filter((m) => MOMENT.has(m)).map((m) => `<button type="button" class="mo-tag" data-go-moment="${m}">${MOMENT.get(m)[1]} ${m}</button>`).join("")}</p>` : ""}</div></div>
      <div class="rtools">
        <div class="serv" role="group" aria-label="Raciones"><span>Raciones</span>
          <button type="button" class="round" id="sminus" aria-label="Menos raciones"${sv <= 1 ? " disabled" : ""}>−</button>
          <b aria-live="polite">${sv}</b><button type="button" class="round" id="splus" aria-label="Más raciones">+</button></div>
        <button type="button" class="btn ghost small" id="cplanadd" aria-expanded="false">📅 ${inPlan.size ? "En tu menú" : "Al menú"}</button>
      </div>
      ${r.mine ? `<div class="row"><button type="button" class="btn ghost small" id="cedit">✏️ Editar mi receta</button>
        <button type="button" class="btn danger small" id="cdel">Borrar</button></div>` : ""}
      <div class="pdays" id="pdays" hidden><span>¿Qué día la haces?</span><div>${days.map((d) =>
        `<button type="button" class="chip" data-day="${d}" aria-pressed="${inPlan.has(d)}">${A.esc(dayShort(d))}</button>`).join("")}</div></div>
      <h3 class="cgroup">Ingredientes <span>toca para marcar lo que tienes</span></h3>
      <ul class="ings">${ings}</ul>
      <div class="row">${btn}</div>
      <h3 class="cgroup">Preparación</h3>
      <button class="btn cookgo" type="button" id="ccook">👩‍🍳 Cocinar paso a paso</button>
      <ol class="steps">${r.p.map((s) => `<li>${A.esc(s)}</li>`).join("")}</ol>
    </div>`;
  $$("cback").onclick = () => cookBack();
  A.body().querySelector(".rmo")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go-moment]"); if (!b) return;
    if (ui.moment !== b.dataset.goMoment) { ui.moment = b.dataset.goMoment; ui.tag = "Todas"; ui.scroll = 0; }
    ui.from = null; showList(true);
  });
  A.body().querySelector(".ings").onclick = (e) => {
    const b = e.target.closest("[data-ing]"); if (!b) return;
    const p = pantry();
    if (b.dataset.ing in p) delete p[b.dataset.ing]; else p[b.dataset.ing] = b.dataset.n;
    A.buzz(); A.save(); showRecipe(id);
  };
  $$("sminus").onclick = () => { setServ(r, sv - 1); A.buzz(); showRecipe(id); };
  $$("splus").onclick = () => { setServ(r, sv + 1); A.buzz(); showRecipe(id); };
  $$("cplanadd").onclick = (e) => {
    const open = $$("pdays").hidden;
    $$("pdays").hidden = !open; e.currentTarget.setAttribute("aria-expanded", String(open));
  };
  $$("pdays").onclick = (e) => {
    const b = e.target.closest("[data-day]"); if (!b) return;
    const d = b.dataset.day, k = plan().findIndex((x) => x.d === d && x.n === r.n);
    if (k >= 0) { plan().splice(k, 1); A.setStatus(`Quitada del menú ${delDay(d)}: ${r.n}.`); }
    else { addToPlan(id, d); A.setStatus(`Añadida al menú ${delDay(d)}: ${r.n}.`); }
    b.setAttribute("aria-pressed", String(k < 0)); A.buzz(); A.save();
    $$("cplanadd").textContent = `📅 ${plan().some((x) => x.n === r.n) ? "En tu menú" : "Al menú"}`;
  };
  $$("ccook").onclick = () => showCook(id, 0);
  if (r.mine) {
    $$("cedit").onclick = () => showEdit(id);
    $$("cdel").onclick = (e) => {
      const b = e.currentTarget;
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Toca otra vez para borrarla"; return; }
      const k = A.st.myR.findIndex((x) => x.uid === r.uid);
      if (k >= 0) A.st.myR.splice(k, 1);
      delPhoto(r.uid); A.save(); addMine(); A.setStatus(`Receta borrada: ${r.n}.`); showList(true);
    };
  }
  A.body().querySelector(".cdetail").addEventListener("click", (e) => {
    const h = e.target.closest("[data-fav-r]"); if (!h) return;
    const on = toggleFav(r); h.setAttribute("aria-pressed", String(on)); h.textContent = on ? "❤️" : "🤍";
  });
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

// ---------- Cocinar paso a paso ----------
// Pasos grandes de uno en uno, la pantalla no se apaga y los tiempos del paso («20 minutos») son temporizadores.
const TIME_RE = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|a|o)\s*(\d+))?\s*(minutos?|min\b|horas?|segundos?)/gi;
function stepTimers(s) {
  const out = [];
  for (const m of s.matchAll(TIME_RE)) {
    const n = parseFloat(m[1].replace(",", ".")), u = m[3][0].toLowerCase();
    const sec = Math.round(n * (u === "h" ? 3600 : u === "s" ? 1 : 60));
    if (sec >= 10 && sec <= 12 * 3600 && !out.includes(sec)) out.push(sec);
  }
  return out;
}
const fmtDur = (sec) => sec >= 3600 ? `${Math.floor(sec / 3600)} h${sec % 3600 >= 60 ? ` ${Math.round((sec % 3600) / 60)} min` : ""}`
  : sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec} s`;
const clock = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s).padStart(2, "0")}`; };
const timers = []; // { id, name, sec, end, rang }
let tick = null, audio = null;
function startTimer(r, sec) {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch {}
  timers.push({ id: Math.random().toString(36).slice(2), name: r.n, sec, end: Date.now() + sec * 1000, rang: false });
  tick ??= setInterval(onTick, 1000);
  paintTimers();
}
function onTick() {
  for (const t of timers) if (!t.rang && t.end <= Date.now()) { t.rang = true; ring(t); }
  if (!timers.some((t) => !t.rang)) { clearInterval(tick); tick = null; }
  paintTimers();
}
function ring(t) {
  try { navigator.vibrate?.([400, 200, 400, 200, 600]); } catch {}
  try {
    if (audio) for (let k = 0; k < 4; k++) {
      const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + k * 0.45;
      o.frequency.value = k % 2 ? 660 : 880; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
      o.start(t0); o.stop(t0 + 0.4);
    }
  } catch {}
  A.setStatus(`⏰ ¡Tiempo! ${fmtDur(t.sec)} de ${t.name}`);
}
function paintTimers() {
  const el = $$("ctimers"); if (!el) return;
  el.hidden = !timers.length;
  el.innerHTML = timers.map((t) => `<div class="ctimer${t.rang ? " rang" : ""}"><span>⏱ ${t.rang ? "¡Tiempo!" : clock(t.end - Date.now())}</span>
    <small>${A.esc(fmtDur(t.sec))} · ${A.esc(t.name)}</small><button type="button" class="lnk" data-tstop="${t.id}">${t.rang ? "Vale" : "Parar"}</button></div>`).join("");
}
function stepTo(k) {
  const r = recipes[ui.id]; if (!r) return;
  if (k >= r.p.length) { A.setStatus(`¡Que aproveche! ${r.n} terminada.`); A.buzz(30); return showRecipe(ui.id); }
  if (k >= 0) showCook(ui.id, k);
}
function showCook(id, step) {
  const r = recipes[id]; if (!r) return;
  setView("cook"); ui.id = id; ui.step = Math.max(0, Math.min(step, r.p.length - 1));
  A.setTitle(r.n, true);
  const n = r.p.length, s = r.p[ui.step], last = ui.step === n - 1, sv = servOf(r), f = sv / r.r;
  const tms = stepTimers(s);
  A.body().innerHTML = `
    <button type="button" class="back" id="cback">‹ Receta</button>
    <div class="cook" id="cook">
      <div class="cook-top"><span>Paso ${ui.step + 1} de ${n}</span><span class="cook-bar"><span style="width:${((ui.step + 1) / n) * 100}%"></span></span></div>
      <div class="ctimers" id="ctimers" hidden></div>
      <p class="cook-t">${A.esc(s)}</p>
      ${tms.length ? `<div class="cook-tm">${tms.map((t) => `<button type="button" class="btn ghost" data-timer="${t}">⏱ Temporizador ${fmtDur(t)}</button>`).join("")}</div>` : ""}
      <details class="cook-ings"${ui.step === 0 ? " open" : ""}><summary>Ingredientes para ${plural(sv, "ración", "raciones")}</summary>
        <ul>${r.ings.map((i) => `<li><span>${A.esc(i.n)}</span><small>${A.esc(scaleQty(i.q, f) || "")}</small></li>`).join("")}</ul></details>
    </div>
    <div class="bfoot"><button type="button" class="btn ghost" id="cprev"${ui.step ? "" : " disabled"}>‹ Anterior</button>
      <button type="button" class="btn" id="cnext">${last ? "Terminar 🎉" : "Siguiente ›"}</button></div>`;
  paintTimers();
  $$("cback").onclick = () => cookBack();
  $$("cprev").onclick = () => stepTo(ui.step - 1);
  $$("cnext").onclick = () => stepTo(ui.step + 1);
  $$("cook").onclick = (e) => {
    const t = e.target.closest("[data-timer]");
    if (t) { startTimer(r, +t.dataset.timer); A.buzz(); A.setStatus(`Temporizador de ${fmtDur(+t.dataset.timer)} en marcha.`); return; }
    const x = e.target.closest("[data-tstop]");
    if (x) { const k = timers.findIndex((tt) => tt.id === x.dataset.tstop); if (k >= 0) timers.splice(k, 1); paintTimers(); }
  };
  // Deslizar a los lados también pasa de paso (con las manos ocupadas es más fácil).
  let x0 = null;
  $$("cook").onpointerdown = (e) => { x0 = e.clientX; };
  $$("cook").onpointerup = (e) => {
    if (x0 == null) return; const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 70) stepTo(ui.step + (dx < 0 ? 1 : -1));
  };
}

// ---------- Mis recetas ----------
// Se guardan en el móvil; la foto va aparte para no hacer pesado el guardado de la lista.
const PHOTOS = "superlista.misfotos";
const readPhotos = () => { try { return JSON.parse(localStorage.getItem(PHOTOS) || "{}"); } catch { return {}; } };
function setPhoto(uid, url) { const f = readPhotos(); if (url) f[uid] = url; else delete f[uid]; try { localStorage.setItem(PHOTOS, JSON.stringify(f)); return true; } catch { return false; } }
const delPhoto = (uid) => setPhoto(uid, null);
function addMine() {
  if (!recipes) return;
  recipes.length = baseCount;
  const fotos = readPhotos();
  for (const m of A.st.myR ?? []) {
    const r = prep(structuredClone(m), recipes.length);
    r.mine = true; r.foto = fotos[m.uid] ? { img: fotos[m.uid] } : null;
    recipes.push(r);
  }
  A.markGeneric((A.st.myR ?? []).flatMap((r) => r.i.map((x) => x[0])));
}
// «200 g de harina», «Harina: 200 g», «- 2 huevos», «1/2 cebolla» → [nombre, cantidad]
const UNITS = "kg|g|gr|grs|gramos?|mg|l|litros?|ml|cl|dl|cucharadas?|cucharaditas?|cdas?|cdtas?|tazas?|vasos?|vasitos?|dientes?|latas?|botes?|sobres?|unidades?|uds?|rebanadas?|lonchas?|ramitas?|ramas?|hojas?|pizcas?|pu[ñn]ados?|chorritos?|trozos?|filetes?|piezas?|paquetes?";
function parseIng(line) {
  let t = line.replace(/^\s*([-•*·▢☐□✓]|\d+[.)]\s)\s*/, "").trim();
  if (!t) return null;
  let m = t.match(/^(.+?)\s*(?::|\s[–-]\s)\s*(.+)$/);
  if (m && !/^[\d\s/.,½¼¾-]+$/.test(m[1]) && /\d|al gusto|pizca/i.test(m[2])) return [capFirst(m[1]), m[2].trim()];
  m = t.match(new RegExp(`^((?:\\d+(?:[.,/]\\d+)?|[½¼¾])(?:\\s*(?:-|a)\\s*\\d+)?\\s*(?:(?:${UNITS})\\.?\\b)?)\\s*(?:de\\s+)?(.+)$`, "i"));
  if (m) return [capFirst(m[2]), m[1].trim()];
  m = t.match(/^(.+?)\s+(al gusto|una pizca|un poco|c\/n)$/i);
  if (m) return [capFirst(m[1]), m[2]];
  return [capFirst(t), ""];
}
const capFirst = (s) => { s = s.trim().replace(/[.;,]$/, ""); return s.charAt(0).toUpperCase() + s.slice(1); };
// Texto pegado de una web: lo de antes de «Preparación» son ingredientes; lo de después, pasos.
function splitPasted(txt) {
  const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = { name: "", ings: [], steps: [] };
  let zone = "start";
  for (const l of lines) {
    const n = norm(l);
    if (/^(ingredientes|ingredients)\b/.test(n)) { zone = "ings"; continue; }
    if (/^(preparacion|elaboracion|pasos|instrucciones|modo de preparacion|como se hace|procedimiento)\b/.test(n)) { zone = "steps"; continue; }
    if (zone === "start") {
      if (!out.name && l.length < 80 && !/\d/.test(l)) { out.name = l; continue; }
      zone = "ings";
    }
    if (zone === "ings") out.ings.push(l); else out.steps.push(l.replace(/^(paso\s*)?\d+[.):-]?\s*/i, ""));
  }
  return out;
}
async function shrink(file) {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return null;
  const w = Math.min(640, img.width), h = Math.round(img.height * (w / img.width));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.72);
}
const EMOJIS = ["🍲", "🥘", "🍝", "🍛", "🥗", "🍳", "🥩", "🍗", "🐟", "🍤", "🥪", "🌮", "🍕", "🍔", "🥞", "🍰", "🧁", "🍪", "🥤", "🍜"];
function showEdit(id) {
  keepScroll();
  const r = id != null ? recipes[id] : null;
  setView("edit"); ui.editId = id;
  A.setTitle(r ? "Editar mi receta" : "Nueva receta", true);
  const st = { emoji: r?.e ?? "🍲", photo: r?.foto?.img ?? null, moms: r ? Object.keys(r.m ?? {}) : [nowMoment()] };
  A.body().innerHTML = `
    <button type="button" class="back" id="cback">‹ ${r ? "Receta" : "Recetas"}</button>
    <div class="plan editr" id="eform">
      ${r ? "" : `<details class="paste"><summary>📋 Pegar una receta de internet</summary>
        <textarea id="epaste" rows="5" placeholder="Copia la receta entera (título, ingredientes y preparación) y pégala aquí: la separo yo."></textarea></details>`}
      <label class="photo-pick" id="ephoto"><input type="file" accept="image/*" id="efile" hidden>
        <span class="pp-img" id="epimg"${st.photo ? ` style="background-image:url('${st.photo}')"` : ""}>${st.photo ? "" : `<span>📷</span>Añadir foto`}</span></label>
      <label class="field">Nombre<input id="ename" value="${A.esc(r?.n ?? "")}" placeholder="Lentejas de la abuela" autocomplete="off"></label>
      <div class="field"><span>Dibujo</span><div class="emojis" id="eemo">${EMOJIS.map((e) => `<button type="button" data-e="${e}" aria-pressed="${e === st.emoji}">${e}</button>`).join("")}</div></div>
      <div class="erow"><label class="field">Raciones<input id="eserv" type="number" min="1" max="24" value="${r?.r ?? 2}" inputmode="numeric"></label>
        <label class="field">Minutos<input id="etime" type="number" min="1" max="1440" value="${r?.t ?? 30}" inputmode="numeric"></label></div>
      <div class="field"><span>¿Para cuándo?</span><div class="emojis moms" id="emoms">${MOMENTS.map(([m, e]) => `<button type="button" data-m="${m}" aria-pressed="${st.moms.includes(m)}">${e} ${m}</button>`).join("")}</div></div>
      <label class="field">Ingredientes (uno por línea: «200 g de harina», «2 huevos»)<textarea id="eings" rows="7">${A.esc(r ? r.i.map(([n, q]) => q ? `${q} ${n}` : n).join("\n") : "")}</textarea></label>
      <label class="field">Preparación (un paso por línea)<textarea id="esteps" rows="7">${A.esc(r ? r.p.join("\n") : "")}</textarea></label>
      <p class="note" id="eerr" hidden></p>
    </div>
    <div class="bfoot"><span>Se guarda en este móvil</span><button class="btn" type="button" id="esave">${r ? "Guardar cambios" : "Guardar receta"}</button></div>`;
  $$("cback").onclick = () => cookBack();
  $$("eemo").onclick = (e) => { const b = e.target.closest("[data-e]"); if (!b) return; st.emoji = b.dataset.e; for (const c of $$("eemo").children) c.setAttribute("aria-pressed", String(c === b)); };
  $$("emoms").onclick = (e) => {
    const b = e.target.closest("[data-m]"); if (!b) return;
    const k = st.moms.indexOf(b.dataset.m); if (k >= 0) st.moms.splice(k, 1); else st.moms.push(b.dataset.m);
    b.setAttribute("aria-pressed", String(k < 0));
  };
  $$("efile").onchange = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    st.photo = await shrink(f);
    if (st.photo) { $$("epimg").style.backgroundImage = `url('${st.photo}')`; $$("epimg").textContent = ""; }
  };
  const paste = $$("epaste");
  if (paste) paste.oninput = () => {
    const x = splitPasted(paste.value);
    if (x.name && !$$("ename").value) $$("ename").value = x.name;
    if (x.ings.length) $$("eings").value = x.ings.join("\n");
    if (x.steps.length) $$("esteps").value = x.steps.join("\n");
  };
  $$("esave").onclick = () => {
    const name = $$("ename").value.trim();
    const ings = $$("eings").value.split(/\n/).map(parseIng).filter(Boolean);
    const steps = $$("esteps").value.split(/\n/).map((x) => x.trim()).filter(Boolean);
    const err = !name ? "Ponle un nombre a la receta." : !ings.length ? "Añade al menos un ingrediente." : !steps.length ? "Añade al menos un paso." : "";
    if (err) { $$("eerr").hidden = false; $$("eerr").textContent = err; $$("eerr").scrollIntoView({ block: "center" }); return; }
    const uid = r?.uid ?? Math.random().toString(36).slice(2, 10);
    const mins = Math.max(1, +$$("etime").value || 30);
    const rec = { uid, n: name, e: st.emoji, t: mins, r: Math.max(1, Math.min(24, +$$("eserv").value || 2)), d: "Fácil",
      tags: ["Mis recetas"], m: Object.fromEntries((st.moms.length ? st.moms : [nowMoment()]).map((m) => [m, []])), i: ings, p: steps };
    A.st.myR ??= [];
    const k = A.st.myR.findIndex((x) => x.uid === uid);
    // Si el nombre cambia, el menú sigue apuntando a la receta.
    if (k >= 0 && A.st.myR[k].n !== name) for (const e of plan()) if (e.n === A.st.myR[k].n) e.n = name;
    if (k >= 0) A.st.myR[k] = rec; else A.st.myR.push(rec);
    if (st.photo !== (r?.foto?.img ?? null) && !setPhoto(uid, st.photo)) A.setStatus("La receta se ha guardado, pero la foto no cabe en el móvil.", true);
    A.save(); addMine(); A.buzz(20);
    if (!r) A.setStatus(`📝 Receta guardada: ${name}.`);
    showRecipe(recipes.findIndex((x) => x.uid === uid));
  };
}

// ---------- Menú de la semana ----------
const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nextDays = () => Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() + k); return ymd(d); });
const dateOf = (d) => new Date(`${d}T12:00`);
function dayName(d) {
  const [hoy, man] = nextDays();
  return d === hoy ? "hoy" : d === man ? "mañana" : dateOf(d).toLocaleDateString("es-ES", { weekday: "long", day: "numeric" });
}
const delDay = (d) => { const n = dayName(d); return n === "hoy" || n === "mañana" ? `de ${n}` : `del ${n}`; };
const dayShort = (d) => { const [hoy, man] = nextDays(); return d === hoy ? "Hoy" : d === man ? "Mañana" : cap(dateOf(d).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(".", "")); };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Los días que ya han pasado se quitan solos.
function plan() {
  const st = A.st, hoy = ymd();
  if (!Array.isArray(st.plan)) st.plan = [];
  if (st.plan.some((e) => e.d < hoy)) st.plan = st.plan.filter((e) => e.d >= hoy);
  return st.plan;
}
function addToPlan(id, d) {
  const r = recipes[id]; if (!r) return;
  plan().push({ d, n: r.n, s: servOf(r) });
  A.st.plan.sort((a, b) => a.d.localeCompare(b.d));
  A.save();
}
// Lo que falta para todo el menú, sin repetir lo que se usa en varias recetas ni lo que ya está en la lista.
function planMissing() {
  const by = new Map(recipes.map((r) => [r.n, r])), out = new Map();
  for (const e of plan()) {
    const r = by.get(e.n); if (!r) continue;
    for (const i of check(r).missing) if (!inList(i.k) && !out.has(i.k)) out.set(i.k, i.n);
  }
  return [...out.values()];
}
function showPlan() {
  keepScroll();
  setView("plan"); ui.pickDay = null; ui.from = null;
  A.setTitle("Menú de la semana", true);
  const by = new Map(recipes.map((r) => [r.n, r])), p = plan(), miss = planMissing();
  A.body().innerHTML = `
    <button type="button" class="back" id="cback">‹ Recetas</button>
    <div class="plan" id="cplanl">
      <p class="note">Elige qué vas a cocinar cada día y apunta de una vez todo lo que te falta.</p>
      ${nextDays().map((d) => `<section class="pday"><h3 class="cgroup">${A.esc(cap(dayName(d)))}</h3>
        ${p.map((e, k) => [e, k]).filter(([e]) => e.d === d).map(([e, k]) => {
          const r = by.get(e.n); if (!r) return "";
          const m = check(r).missing.length;
          return `<div class="pent"><button type="button" class="rc" data-open="${k}">${pic(r)}<span class="ri"><span class="rn">${A.esc(r.n)}</span>
            <span class="rm">${A.esc(`${mins(r.t)} · ${plural(e.s, "ración", "raciones")}`)}</span>
            <span class="rh${m ? "" : " ok"}">${m ? `Te ${m === 1 ? "falta 1 ingrediente" : `faltan ${m} ingredientes`}` : "✓ Tienes todo"}</span></span></button>
            <button type="button" class="pdel" data-del="${k}" aria-label="Quitar ${A.esc(r.n)} del menú">×</button></div>`;
        }).join("")}
        <button type="button" class="padd" data-addday="${d}">+ Añadir receta</button></section>`).join("")}
    </div>
    <div class="bfoot"><span>${p.length ? plural(p.length, "receta", "recetas") : "Menú vacío"}</span>
      ${miss.length ? `<button class="btn" type="button" id="pmiss">Apuntar lo que falta (${miss.length})</button>`
        : p.length ? `<span class="ready">✓ Nada que comprar</span>` : ""}</div>`;
  lazyBg($$("cplanl"));
  $$("cback").onclick = () => cookBack();
  $$("cplanl").onclick = (e) => {
    const o = e.target.closest("[data-open]");
    if (o) { const k = +o.dataset.open, r = by.get(p[k].n); ui.from = "plan"; ui.planIdx = k; ui.serv[r.id] = p[k].s; return showRecipe(r.id); }
    const del = e.target.closest("[data-del]");
    if (del) { p.splice(+del.dataset.del, 1); A.buzz(); A.save(); return showPlan(); }
    const add = e.target.closest("[data-addday]");
    if (add) { ui.pickDay = add.dataset.addday; ui.mode = "todas"; ui.q = ""; return showList(); }
  };
  const pm = $$("pmiss");
  if (pm) pm.onclick = async () => {
    pm.disabled = true;
    for (const n of miss) await A.addItem({ query: n });
    A.save(); A.render(); A.buzz(20);
    A.setStatus(`Apuntado para el menú: ${miss.join(", ")}.`);
    showPlan();
  };
}

// ---------- Caducidades ----------
const exps = () => (A.st.exp ??= {});
const daysLeft = (d) => Math.round((dateOf(d) - dateOf(ymd())) / 864e5);
const whenTxt = (n) => n < 0 ? (n === -1 ? "caducó ayer" : `caducó hace ${-n} días`) : n === 0 ? "caduca hoy" : n === 1 ? "caduca mañana" : `caduca en ${n} días`;
// Lo que caduca en los próximos días (y lo caducado hace poco), de lo que sigue en casa.
export function expiring(days = 3) {
  if (!A) return [];
  const p = pantry(), e = exps();
  for (const k of Object.keys(e)) if (!(k in p) || daysLeft(e[k]) < -7) delete e[k];
  return Object.entries(e).map(([k, d]) => ({ k, n: p[k], d, left: daysLeft(d) })).filter((x) => x.left <= days).sort((a, b) => a.left - b.left);
}
function showPantry() {
  keepScroll();
  setView("pantry");
  A.setTitle("Lo que tengo en casa", true);
  ui.pmode ??= "have";
  const all = new Map();
  for (const r of recipes) for (const i of r.ings) if (!all.has(i.k)) all.set(i.k, i.n);
  for (const [k, n] of Object.entries(pantry())) if (!all.has(k)) all.set(k, n);
  const last = A.st.history.at(-1);
  A.body().innerHTML = `
    <button type="button" class="back" id="cback">‹ Recetas</button>
    <div class="seg" id="pmode" role="group" aria-label="Qué hacer">
      <button type="button" data-pm="have" aria-pressed="${ui.pmode === "have"}">🏠 Lo que tengo</button>
      <button type="button" data-pm="exp" aria-pressed="${ui.pmode === "exp"}">⏰ Caducidades</button></div>
    <p class="note" id="pnote"></p>
    <label class="vh" for="pq">Buscar ingrediente</label>
    <input id="pq" class="bsearch" type="search" placeholder="Buscar ingrediente…" autocomplete="off">
    <div class="row" id="pacts">${last ? `<button class="btn ghost small" type="button" id="plast">Lo de mi última compra</button>` : ""}
      <button class="btn ghost small" type="button" id="pclear">Desmarcar todo</button></div>
    <div class="pgrid" id="pgrid"></div>
    <div class="bfoot"><span id="pcount"></span><button class="btn" type="button" id="pdone">Ver recetas</button></div>`;
  let editing = null;
  const fill = () => {
    const ex = ui.pmode === "exp", e = exps();
    $$("pnote").textContent = ex ? "Toca un ingrediente para ponerle fecha. Lo que caduca pronto sale primero en las ideas de recetas."
      : "Marca lo que tienes. Al pulsar «Terminar compra», lo comprado se marca solo.";
    $$("pacts").hidden = ex;
    const qt = tokens($$("pq").value);
    const items = [...all].filter(([k]) => (!ex || has(k)) && qt.every((w) => k.split(" ").some((t) => t.startsWith(w))));
    const by = {};
    for (const [k, n] of items) (by[sectionOf(n)] ??= []).push([k, n]);
    const soon = expiring(3);
    const chip = ([k, n]) => {
      const d = e[k], left = d ? daysLeft(d) : null;
      const badge = d ? `<small class="pexp${left <= 0 ? " bad" : left <= 3 ? " soon" : ""}">${left < 0 ? "caducado" : left === 0 ? "hoy" : left === 1 ? "mañana" : dateOf(d).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</small>` : "";
      return `<button type="button" class="pc${ex ? " ex" : ""}" data-k="${A.esc(k)}" data-n="${A.esc(n)}" aria-pressed="${ex ? k === editing : has(k)}"><span aria-hidden="true">${A.esc(guess(n).emoji)}</span>${A.esc(n)}${badge}</button>`;
    };
    const panel = editing ? (() => {
      const n = pantry()[editing] ?? all.get(editing), d = e[editing];
      const q = (k, t) => { const x = new Date(); x.setDate(x.getDate() + k); return `<button type="button" class="chip" data-set="${ymd(x)}">${t}</button>`; };
      return `<div class="pexpbox" id="pexpbox"><b>${A.esc(guess(n).emoji)} ${A.esc(n)}</b><span>${d ? A.esc(whenTxt(daysLeft(d))) : "¿Cuándo caduca?"}</span>
        <div class="row">${q(0, "Hoy")}${q(1, "Mañana")}${q(3, "En 3 días")}${q(7, "En una semana")}${q(30, "En un mes")}</div>
        <div class="row"><label class="vh" for="pdate">Otra fecha</label><input type="date" id="pdate" value="${d ?? ""}" min="${ymd()}">
          ${d ? `<button type="button" class="btn danger small" data-set="">Quitar fecha</button>` : ""}<button type="button" class="lnk" data-close>Cerrar</button></div></div>`;
    })() : "";
    $$("pgrid").innerHTML = panel + (soon.length && !qt.length ? `<h3 class="cgroup">⏰ Caduca pronto</h3><div class="pchips">${soon.map((x) => chip([x.k, x.n])).join("")}</div>` : "")
      + (ex && !items.length ? `<p class="note">Primero marca en «Lo que tengo» los ingredientes que hay en casa.</p>` : "")
      + ORDER.filter((s) => by[s]).map((s) => `<h3 class="cgroup">${A.esc(s)}</h3><div class="pchips">${
      by[s].sort((a, b) => a[1].localeCompare(b[1], "es")).map(chip).join("")
    }</div>`).join("") || `<p class="note">No encuentro ese ingrediente.</p>`;
    const pd = $$("pdate"); if (pd) pd.onchange = () => { if (pd.value) { exps()[editing] = pd.value; A.save(); editing = null; fill(); } };
    count();
  };
  const count = () => {
    const n = Object.keys(pantry()).length, s = expiring(3).length;
    $$("pcount").textContent = `${plural(n, "ingrediente", "ingredientes")} en casa${s ? ` · ${s} caduca${s === 1 ? "" : "n"} pronto` : ""}`;
  };
  fill();
  $$("pq").oninput = fill;
  $$("pmode").onclick = (e) => {
    const b = e.target.closest("[data-pm]"); if (!b) return;
    ui.pmode = b.dataset.pm; editing = null;
    for (const c of $$("pmode").children) c.setAttribute("aria-pressed", String(c === b));
    A.buzz(); fill();
  };
  $$("pgrid").onclick = (e) => {
    const set = e.target.closest("[data-set]");
    if (set) { if (set.dataset.set) exps()[editing] = set.dataset.set; else delete exps()[editing]; A.buzz(); A.save(); editing = null; return fill(); }
    if (e.target.closest("[data-close]")) { editing = null; return fill(); }
    const b = e.target.closest("[data-k]"); if (!b) return;
    if (ui.pmode === "exp") { editing = editing === b.dataset.k ? null : b.dataset.k; fill(); $$("pgrid").scrollTop = 0; return; }
    const p = pantry();
    if (b.dataset.k in p) { delete p[b.dataset.k]; delete exps()[b.dataset.k]; } else p[b.dataset.k] = b.dataset.n;
    b.setAttribute("aria-pressed", String(b.dataset.k in p));
    A.buzz(); A.save(); count();
  };
  const pl = $$("plast");
  if (pl) pl.onclick = () => { learnPurchase(last.items); A.save(); fill(); A.buzz(); };
  $$("pclear").onclick = () => { A.st.pantry = {}; A.st.exp = {}; A.save(); fill(); };
  $$("cback").onclick = () => showList(true);
  $$("pdone").onclick = () => { ui.mode = "tengo"; showList(); };
}
