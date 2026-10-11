// Palabras con las que se busca en los súpers que no dejan descargar el catálogo entero:
// los productos básicos, los ingredientes de las recetas y algunas secciones típicas.
import { readFile } from "node:fs/promises";
import { BASICS } from "../js/basics.js";

const EXTRA = `leche entera, leche desnatada, yogur natural, yogur griego, queso tierno, queso curado, queso rallado, mantequilla, nata,
huevos camperos, pan de molde, pan integral, tostadas, galletas, cereales, cacao soluble, café molido, café en cápsulas, infusiones,
azúcar, harina, aceite de oliva virgen extra, aceite de girasol, vinagre, sal, arroz, pasta, macarrones, espaguetis, lentejas, garbanzos,
alubias, atún en aceite, sardinas, tomate frito, tomate triturado, mayonesa, ketchup, mostaza, caldo, sopa, legumbres cocidas,
patatas fritas, aceitunas, frutos secos, chocolate, mermelada, miel, zumo, agua mineral, refresco de cola, cerveza, vino tinto,
pollo, pechuga de pollo, carne picada, lomo, chuletas, hamburguesas, salchichas, jamón serrano, jamón cocido, pavo, chorizo,
salmón, merluza, gambas, calamares, mejillones, bacalao, pizza, croquetas, verduras congeladas, helado, patatas congeladas,
plátano, manzana, naranja, tomate, cebolla, patata, lechuga, zanahoria, pimiento, calabacín, aguacate, fresas, uvas,
detergente, suavizante, lavavajillas, lejía, papel higiénico, servilletas, gel de ducha, champú, pasta de dientes, desodorante,
pañales, toallitas, comida para perro, comida para gato`;

export async function terminos() {
  const recetas = JSON.parse(await readFile("data/recetas.json", "utf8"));
  const set = new Map();
  const add = (t) => { const k = t.toLowerCase().trim(); if (k && !set.has(k)) set.set(k, t.trim()); };
  for (const names of Object.values(BASICS)) names.forEach(add);
  for (const r of recetas) for (const [n] of r.i) add(n);
  EXTRA.split(",").forEach(add);
  return [...set.values()];
}
