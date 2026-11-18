// Cuánto cuesta una receta con los precios de los súpers: lo que gastas de cada ingrediente (no el paquete entero)
// y, aparte, lo que pagarías por comprar lo que te falta.
import { norm } from "./parser.js";
// Como norm pero sin quitar «/», «,» ni «.» de los números («1/2 l», «1,5 kg»).
const low = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[()]/g, " ").replace(/\s+/g, " ").trim();

// Peso de una pieza («2 cebollas», «1 pechuga») para los productos que se venden al kilo.
const PIECE = [
  [/huevo/, 60], [/diente/, 5], [/cabeza de ajo|^ajos?$/, 50], [/cebolleta|cebollino/, 60], [/cebolla/, 150], [/patata|batata|boniato/, 200],
  [/tomate cherry/, 15], [/tomate/, 150], [/zanahoria/, 80], [/pimiento/, 180], [/limon/, 120], [/lima/, 70], [/pepino|calabacin|berenjena/, 300],
  [/aguacate|mango/, 200], [/manzana|pera|naranja/, 180], [/platano/, 120], [/mandarina|kiwi/, 90], [/puerro/, 150], [/champinon/, 20],
  [/pechuga/, 250], [/muslo/, 150], [/filete|lomo|bistec|chuleta/, 150], [/salchicha/, 50], [/hamburguesa/, 120], [/langostino|gamba/, 20],
  [/lechuga|coliflor|brocoli|repollo|calabaza/, 600], [/pan de hamburguesa|pan de pita|tortilla|croissant/, 60], [/^pan$|barra/, 250],
  [/loncha/, 20], [/rebanada/, 30], [/alcachofa/, 150], [/melocoton|nectarina/, 150],
];
const pieceG = (name) => PIECE.find(([re]) => re.test(name))?.[1] ?? 150;

// Medidas de cocina a gramos o mililitros (para cocinar vale 1 g ≈ 1 ml).
const MEASURE = [
  [/^(kg|kilos?)$/, 1000, "g"], [/^(g|gr|grs|gramos?)$/, 1, "g"], [/^mg$/, 0.001, "g"],
  [/^(l|litros?)$/, 1000, "ml"], [/^ml$/, 1, "ml"], [/^cl$/, 10, "ml"], [/^dl$/, 100, "ml"],
  [/^(cucharadas?|cdas?)$/, 15, "ml"], [/^(cucharaditas?|cdtas?)$/, 5, "ml"], [/^tazas?$/, 240, "ml"], [/^(vasos?)$/, 200, "ml"], [/^vasitos?$/, 100, "ml"],
  [/^chorritos?$/, 10, "ml"], [/^pizcas?$/, 0.5, "g"], [/^pu[ñn]ados?$/, 30, "g"], [/^manojos?$/, 30, "g"], [/^(ramas?|ramitas?)$/, 3, "g"], [/^hojas?$/, 1, "g"],
  [/^dientes?$/, 5, "g"], [/^lonchas?$/, 20, "g"], [/^rebanadas?$/, 30, "g"], [/^cm$/, 5, "g"], [/^hebras?$/, 0.01, "g"],
  [/^(latas?|botes?|sobres?|paquetes?|tarrinas?|bricks?|tabletas?|laminas?|bolsas?)$/, 1, "pk"],
  [/^cabezas?$/, 50, "g"], [/^(unidades?|uds?|piezas?|trozos?|filetes?)$/, 1, "ud"],
];
const WORDNUM = { un: 1, una: 1, uno: 1, unos: 2, unas: 2, dos: 2, tres: 3, cuatro: 4, media: 0.5, medio: 0.5 };
// Sin cantidad que contar: lo pone cada uno (sal, aceite para freír…).
const LOOSE = /al gusto|para (servir|freir|acompanar|decorar|untar|engrasar)|un poco|c\/n|opcional/;

function num(s) {
  s = s.replace(/½/g, " 1/2").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4").trim();
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)/); if (m) return [+m[1] + m[2] / m[3], s.slice(m[0].length)];
  m = s.match(/^(\d+)\/(\d+)/); if (m) return [m[1] / m[2], s.slice(m[0].length)];
  m = s.match(/^(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|a|o)\s*(\d+(?:[.,]\d+)?))?/);
  if (m) { const a = +m[1].replace(",", "."), b = m[2] ? +m[2].replace(",", ".") : a; return [(a + b) / 2, s.slice(m[0].length)]; }
  m = s.match(/^(un|una|uno|unos|unas|dos|tres|cuatro|media|medio)\b/); if (m) return [WORDNUM[m[1]], s.slice(m[0].length)];
  return [null, s];
}

// «700 g» → {amt:700,u:"g"} · «2 dientes» → 10 g · «6» huevos → 6 ud · «1 lata» → 1 paquete · «al gusto» → null
export function needQty(name, q, f = 1) {
  const t = low(q);
  if (LOOSE.test(t)) return null;
  const [n, rest] = num(t);
  if (n == null) return t ? null : { amt: f, u: "ud" };
  const w = rest.trim().split(/\s+/)[0]?.replace(/\.$/, "") ?? "";
  const r = w && MEASURE.find(([re]) => re.test(w));
  if (r) return { amt: n * r[1] * f, u: r[2] };
  return { amt: n * f, u: "ud" };
}

// Precio por gramo, mililitro o unidad a partir de «3,35 €/L», «0,12 €/ud»… o del tamaño del paquete.
const SIZE = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramos|l|litros?|ml|cl|uds?|unidades|u)\b/i;
export function unitPriceOf(p) {
  if (p?.p == null) return null;
  const m = (p.u ?? "").match(/([\d.,]+)\s*€\s*\/\s*([a-záéíóú]+)/i);
  if (m) {
    const v = +m[1].replace(/\./g, "").replace(",", "."), u = norm(m[2]);
    if (/^(kg|kilo)/.test(u)) return { per: "g", eur: v / 1000 };
    if (/^(g|gr|gram)/.test(u)) return { per: "g", eur: v };
    if (/^l$|^litro/.test(u)) return { per: "ml", eur: v / 1000 };
    if (/ml$/.test(u)) return { per: "ml", eur: v };
    if (/^(ud|u|unidad|launidad)$/.test(u)) return { per: "ud", eur: v };
    if (/docena/.test(u)) return { per: "ud", eur: v / 12 };
  }
  const s = (p.f ?? "").match(SIZE);
  if (s) {
    const a = +s[1].replace(",", "."), u = norm(s[2]);
    if (a > 0) {
      if (u === "kg") return { per: "g", eur: p.p / (a * 1000) };
      if (/^g/.test(u)) return { per: "g", eur: p.p / a };
      if (/^l/.test(u)) return { per: "ml", eur: p.p / (a * 1000) };
      if (u === "ml") return { per: "ml", eur: p.p / a };
      if (u === "cl") return { per: "ml", eur: p.p / (a * 10) };
      return { per: "ud", eur: p.p / a };
    }
  }
  return null;
}

// Lo que cuesta la cantidad que usa la receta. Si no se sabe, una parte del paquete (nunca más de 3 paquetes).
export function ingCost(prod, need, name) {
  if (!need || prod?.p == null) return need ? null : 0;
  if (need.u === "pk") return prod.p * need.amt;
  const up = unitPriceOf(prod), nm = norm(name);
  let c = null;
  if (up) {
    const g = (x) => (x.u === "ud" ? x.amt * pieceG(nm) : x.amt);
    if (up.per === "ud") c = need.u === "ud" ? need.amt * up.eur : (need.amt / pieceG(nm)) * up.eur;
    else c = g(need) * up.eur;
  }
  if (c == null) c = need.u === "ud" ? prod.p * Math.min(need.amt, 1) : need.amt <= 20 ? prod.p * 0.1 : prod.p * 0.5;
  return Math.min(c, prod.p * 3);
}

// Coste de la receta en un súper. find(nombre) da el producto de ese súper que más se parece (o null).
export function recipeCost(ings, f, find) {
  const rows = ings.map((i) => {
    const need = needQty(i.n, i.q, f), prod = find(i.n);
    return { i, need, prod, cost: ingCost(prod, need, i.n) };
  });
  const priced = rows.filter((r) => r.cost != null && r.need);
  return { rows, total: rows.reduce((a, r) => a + (r.cost ?? 0), 0), found: priced.length, need: rows.filter((r) => r.need).length };
}
