// Alergias e intolerancias: qué lleva cada ingrediente o producto y por qué cambiarlo.
// Se deduce por el nombre; es una ayuda y no sustituye mirar la etiqueta del envase.
import { norm } from "./parser.js";

// [clave, emoji, nombre, explicación corta, «lo lleva», «no lo lleva aunque lo parezca», palabras de las etiquetas de los envases]
export const ALLERGENS = [
  ["gluten", "🌾", "Gluten", "Celiaquía o intolerancia",
    /\b(harina(?! de (maiz|arroz|garbanzo|almendra))|pan|pan rallado|macarrones|espaguetis|fideos(?! de arroz)|lasana|tallarines|gnocchi|tortellini|pasta(?! de (curry|soja|sesamo))|cuscus|bulgur|cerveza|galletas|hojaldre|masa( de pizza| de empanadillas| quebrada)?|bizcochos?|croissants?|tortillas de trigo|pan de pita|cereales|copos de avena|salsa de soja|seitan|picatostes|muesli|granola|gyozas|fideos ramen|trigo|cebada|centeno|espelta)\b/,
    /\bsin gluten\b|\btamari\b|\bgluten free\b/, /\b(gluten|trigo|cebada|centeno|avena|espelta|kamut)\b/],
  ["lactosa", "🥛", "Lactosa", "Intolerancia: vale lo «sin lactosa»",
    /\b(leche(?! de (coco|avena|almendras?|soja|arroz))|mantequilla|nata|queso|quesos|yogur|yogures|mozzarella|mascarpone|parmesano|leche condensada|helado|crema de cacao|bechamel|requeson|burrata)\b/,
    /\bsin lactosa\b|\b0\s?% lactosa\b|\bvegan[oa]?\b|\bvegetal\b|\bbebida de\b|\bde (coco|soja|avena|almendras?|arroz)\b/, /\b(lactosa|leche|lacteos?|lacticos?|nata|queso|mantequilla|suero)\b/],
  ["leche", "🍼", "Leche (alergia)", "Alergia a la proteína: nada de lácteos",
    /\b(leche(?! de (coco|avena|almendras?|soja|arroz))|mantequilla|nata|queso|quesos|yogur|yogures|mozzarella|mascarpone|parmesano|leche condensada|helado|crema de cacao|bechamel|requeson|burrata|ghee)\b/,
    /\bvegan[oa]?\b|\bvegetal\b|\bbebida de\b|\bsin leche\b|\bmargarina\b|\bde (coco|soja|avena|almendras?|arroz)\b/, /\b(leche|lacteos?|lacticos?|lactosa|nata|queso|mantequilla|suero|caseina)\b/],
  ["huevo", "🥚", "Huevo", "Alergia al huevo",
    /\b(huevos?|yemas?|claras?|mayonesa|bizcochos de soletilla)\b/, /\bsin huevo\b|\bvegan[oa]?\b/, /\b(huevos?|ovoproductos?|albumina)\b/],
  ["frutos", "🥜", "Frutos secos", "Nueces, almendras, cacahuete…",
    /\b(nueces|nuez(?! moscada)|almendras?|avellanas?|anacardos?|cacahuetes?|pistachos?|pinones|frutos secos|crema de cacahuete|pesto|praline|crema de cacao)\b/,
    /\bsin frutos secos\b/, /\b(frutos de cascara|frutos secos|cacahuetes?|almendras?|avellanas?|nueces|nuez(?! moscada)|pistachos?|anacardos?|macadamia|pecan)\b/],
  ["marisco", "🦐", "Marisco", "Gambas, mejillones, calamar…",
    /\b(gambas?|langostinos?|mejillones|almejas|calamares|calamar|sepia|pulpo|surimi|berberechos|cigalas|salsa de ostras)\b/,
    null, /\b(crustaceos?|moluscos?|gambas?|mejillon(es)?|marisco)\b/],
  ["pescado", "🐟", "Pescado", "Cualquier pescado",
    /\b(salmon|merluza|bacalao|atun|sardinas|lubina|dorada|anchoas|boquerones|salsa de pescado|caldo de pescado|corvina|caballa|rape)\b/,
    null, /\b(pescados?|anchoas?|atun|salmon|merluza|bacalao)\b/],
  ["soja", "🫘", "Soja", "Salsa de soja, tofu, edamame…",
    /\b(salsa de soja|tofu|edamame|gochujang|pasta de soja picante|miso|bebida de soja|yogur de soja|tamari|soja texturizada)\b/,
    null, /\b(soja|soya)\b/],
  ["sesamo", "🥯", "Sésamo", "Semillas, tahini, hummus…",
    /\b(sesamo|tahini|hummus|aceite de sesamo)\b/, null, /\b(sesamo)\b/],
  ["mostaza", "🌭", "Mostaza", "Salsas con mostaza",
    /\b(mostaza)\b/, null, /\b(mostaza)\b/],
  ["apio", "🥬", "Apio", "Apio y sal de apio",
    /\b(apio)\b/, null, /\b(apio)\b/],
  ["sulfitos", "🍷", "Sulfitos", "Vino, vinagre, pasas…",
    /\b(vino blanco|vino tinto|vino|vinagre|pasas|orejones)\b/, null, /\b(sulfitos?|sulfuroso|metabisulfito|e-?22\d)\b/],
  ["cerdo", "🐷", "Cerdo", "Por religión o gusto",
    /\b(bacon|panceta|chorizo(?! de (pavo|pollo))|jamon(?! de pavo)|lomo de cerdo|costillas|salchichas(?! de (pollo|pavo))|salchichon|morcilla|cerdo|sobrasada|lacon)\b/,
    /\b(de pavo|de pollo)\b/, /\b(cerdo|porcino)\b/],
];
export const ALLER = new Map(ALLERGENS.map((a) => [a[0], a]));
// Las «sin lactosa» no valen a quien es alérgico a la leche: marcar leche ya cubre lactosa.
const IMPLIES = { leche: ["lactosa"] };

// Alérgenos que lleva un ingrediente o producto por su nombre.
export function allergensOf(name) {
  const t = norm(name);
  return ALLERGENS.filter(([, , , , re, free]) => re.test(t) && !(free && free.test(t))).map((a) => a[0]);
}
// Lo que la persona no puede tomar, con lo que eso implica.
export function avoidSet(evita = []) {
  const s = new Set(evita);
  for (const k of evita) for (const x of IMPLIES[k] ?? []) s.add(x);
  return s;
}
export const conflicts = (name, avoid) => allergensOf(name).filter((a) => avoid.has(a));

// Alérgenos de la etiqueta de un producto (lo que publica el súper u Open Food Facts).
export function labelAllergens(words, avoid) {
  const t = norm((words ?? []).join(" | ")).replace(/\bsin (gluten|lactosa|huevo)\b/g, "");
  return [...avoid].filter((k) => ALLER.get(k)?.[6]?.test(t));
}

// ---------- Sustitutos ----------
// Para cada alergia, por qué cambiar cada ingrediente. Se prueba en orden y se queda el primero que no
// choque con otra alergia marcada. «» = se puede quitar sin más (va de adorno o en poca cantidad).
const SUBS = {
  gluten: {
    "Harina": ["Harina sin gluten"], "Pan": ["Pan sin gluten"], "Pan rallado": ["Pan rallado sin gluten"],
    "Pan de molde": ["Pan de molde sin gluten"], "Pan de hamburguesa": ["Pan de hamburguesa sin gluten"], "Pan de pita": ["Pan sin gluten", "Tortillas de maíz"],
    "Macarrones": ["Macarrones sin gluten"], "Espaguetis": ["Espaguetis sin gluten"], "Fideos": ["Fideos sin gluten", "Fideos de arroz"],
    "Tallarines": ["Tallarines sin gluten"], "Lasaña": ["Lasaña sin gluten"], "Gnocchi": ["Gnocchi sin gluten"], "Tortellini": ["Pasta rellena sin gluten"],
    "Cuscús": ["Quinoa"], "Bulgur": ["Quinoa"], "Cerveza": ["Cerveza sin gluten"], "Galletas": ["Galletas sin gluten"],
    "Hojaldre": ["Hojaldre sin gluten"], "Masa de pizza": ["Masa de pizza sin gluten"], "Masa quebrada": ["Masa quebrada sin gluten"],
    "Masa de empanadillas": ["Obleas de empanadillas sin gluten"], "Bizcochos de soletilla": ["Bizcochos sin gluten"],
    "Croissants": ["Croissants sin gluten"], "Tortillas de trigo": ["Tortillas de maíz", "Wraps sin gluten"], "Cereales": ["Cereales sin gluten"],
    "Copos de avena": ["Copos de avena sin gluten"], "Granola": ["Granola sin gluten"], "Salsa de soja": ["Tamari (salsa de soja sin gluten)"],
    "Fideos ramen": ["Fideos de arroz"], "Gyozas": ["Gyozas sin gluten"],
  },
  lactosa: {
    "Leche": ["Leche sin lactosa"], "Mantequilla": ["Mantequilla sin lactosa"], "Nata": ["Nata sin lactosa"], "Nata para cocinar": ["Nata para cocinar sin lactosa"],
    "Queso rallado": ["Queso rallado sin lactosa"], "Queso en lonchas": ["Queso en lonchas sin lactosa"], "Queso curado": ["Queso curado sin lactosa"],
    "Queso fresco": ["Queso fresco sin lactosa"], "Queso crema": ["Queso crema sin lactosa"], "Mozzarella": ["Mozzarella sin lactosa"],
    "Queso parmesano": ["Queso rallado sin lactosa"], "Queso feta": ["Queso fresco sin lactosa"], "Queso de cabra": ["Queso fresco sin lactosa"], "Queso brie": ["Queso sin lactosa"],
    "Mascarpone": ["Queso crema sin lactosa"], "Yogur griego": ["Yogur griego sin lactosa"], "Yogures": ["Yogures sin lactosa"],
    "Leche condensada": ["Leche condensada sin lactosa"], "Helado": ["Helado sin lactosa"], "Crema de cacao": ["Crema de cacao sin lactosa"],
  },
  leche: {
    "Leche": ["Bebida de avena", "Bebida de arroz"], "Mantequilla": ["Margarina vegetal", "Aceite de oliva"], "Nata": ["Nata vegetal", "Leche de coco"],
    "Nata para cocinar": ["Nata vegetal para cocinar", "Leche de coco"], "Queso rallado": ["Queso vegano rallado", "Levadura nutricional"],
    "Queso en lonchas": ["Queso vegano en lonchas"], "Queso curado": ["Queso vegano"], "Queso fresco": ["Tofu", "Queso vegano"],
    "Queso crema": ["Queso crema vegano"], "Mozzarella": ["Mozzarella vegana"], "Queso parmesano": ["Levadura nutricional", "Queso vegano rallado"],
    "Queso feta": ["Queso vegano", "Tofu"], "Queso de cabra": ["Queso vegano"], "Queso brie": ["Queso vegano"], "Mascarpone": ["Queso crema vegano"],
    "Yogur griego": ["Yogur de coco", "Yogur de soja"], "Yogures": ["Yogur de coco", "Yogur de soja"],
    "Leche condensada": ["Leche condensada de coco"], "Helado": ["Helado vegano", "Sorbete"], "Crema de cacao": ["Crema de cacao vegana"],
  },
  huevo: {
    "Mayonesa": ["Mayonesa vegana"], "Huevos@dulce": ["Semillas de chía (1 cucharada + 3 de agua por huevo)"],
  },
  frutos: {
    "Nueces": ["Pipas de girasol peladas"], "Almendras": ["Pipas de calabaza"], "Anacardos": ["Pipas de girasol peladas"],
    "Cacahuetes": ["Garbanzos tostados"], "Frutos secos": ["Pipas de girasol peladas"], "Pesto": ["Pesto sin frutos secos"],
    "Crema de cacahuete": ["Crema de pipas de girasol"], "Crema de cacao": ["Cacao en polvo", ""],
  },
  marisco: { "Salsa de ostras": ["Salsa hoisin", "Salsa de soja"] },
  pescado: { "Caldo de pescado": ["Caldo de verduras"], "Salsa de pescado": ["Salsa de soja", "Tamari (salsa de soja sin gluten)"] },
  soja: {
    "Salsa de soja": ["Salsa de aminos de coco"], "Tamari (salsa de soja sin gluten)": ["Salsa de aminos de coco"], "Edamame": ["Guisantes"],
    "Tofu": ["Garbanzos"], "Yogur de soja": ["Yogur de coco"],
  },
  sesamo: { "Sésamo": [""], "Aceite de sésamo": ["Aceite de oliva"] },
  mostaza: { "Mostaza": [""] },
  sulfitos: { "Vino blanco": ["Caldo de verduras"], "Vino tinto": ["Caldo de carne", "Caldo de verduras"], "Vinagre": ["Zumo de limón"], "Pasas": [""] },
  cerdo: {
    "Bacon": ["Bacon de pavo"], "Panceta": ["Bacon de pavo"], "Jamón serrano": ["Jamón de pavo"], "Jamón cocido": ["Pechuga de pavo"],
    "Chorizo": ["Chorizo de pavo"], "Salchichas": ["Salchichas de pollo"], "Lomo de cerdo": ["Lomo de pavo", "Pechuga de pollo"],
  },
};
// Cosas que van de adorno o en pizca: si no hay sustituto, se pueden quitar.
const GARNISH = /\b(sesamo|perejil|cilantro|nueces|almendras|pinones|pistachos|cacahuetes|frutos secos|mostaza|pasas|queso rallado|queso parmesano)\b/;

// ¿Es dulce o de horno? Ahí el huevo se cambia bien por chía; en una tortilla, no.
const sweet = (r) => (r.tags ?? []).includes("Postres") || !!r.m?.Merienda || r.i.some(([n]) => /^(azucar|azucar glas|levadura)$/.test(norm(n)));

// Cambia un ingrediente para que no lleve nada de lo marcado. Devuelve { to, why } o null si no hay forma.
export function substitute(name, r, avoid, opt = false) {
  const bad = conflicts(name, avoid);
  if (!bad.length) return { to: name, why: [] };
  let cur = name;
  for (let round = 0; round < 3; round++) {
    const c = conflicts(cur, avoid);
    if (!c.length) return { to: cur, why: bad };
    // Opciones de todas las alergias que choca; gana la primera que no choque con ninguna.
    const opts = c.flatMap((a) => [...(sweet(r) ? SUBS[a]?.[`${cur}@dulce`] ?? [] : []), ...(SUBS[a]?.[cur] ?? [])]);
    const ok = opts.find((o) => o === "" || !conflicts(o, avoid).length) ?? opts.find((o) => o !== "");
    if (ok === "") return { to: "", why: bad };
    if (ok == null) return opt || GARNISH.test(norm(cur)) ? { to: "", why: bad } : null;
    cur = ok;
  }
  return conflicts(cur, avoid).length ? null : { to: cur, why: bad };
}
