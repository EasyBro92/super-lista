// Valor nutricional aproximado para las recetas (como Mealime o Samsung Food), sin servicios de pago.
// Por cada ingrediente: [kcal, proteínas, hidratos, grasas] por 100 g (tablas de composición habituales, BEDCA/USDA),
// y opcionalmente u = gramos por unidad, c = gramos por cucharada, p = gramos por puñado o manojo,
// e = parte comestible (pollo con hueso).
const T = {
  "Aceite de girasol": [884, 0, 0, 100, {c:13}],
  "Aceite de oliva": [884, 0, 0, 100, {c:13}],
  "Aceite de sésamo": [884, 0, 0, 100, {c:13}],
  "Aceitunas": [145, 1, 4, 15, {u:4}],
  "Aguacates": [160, 2, 9, 15, {u:170}],
  "Ajos": [149, 6, 33, 0.5, {u:40}],
  "Ají amarillo": [40, 1, 8, 0.5, {u:15,c:15}],
  "Albahaca": [23, 3, 3, 0.6, {p:10}],
  "Alga nori": [35, 6, 5, 0.3, {u:3}],
  "Alitas de pollo": [203, 18, 0, 14, {u:90}],
  "Almejas": [74, 13, 3, 1, {u:10}],
  "Almendras": [579, 21, 22, 50, {u:1.2,c:9,p:30}],
  "Almidón de yuca": [358, 0, 88, 0],
  "Alubias": [110, 7, 15, 0.5, {u:400}],
  "Alubias con tomate": [80, 5, 13, 0.5, {u:400}],
  "Alubias negras": [130, 9, 24, 0.5, {u:400}],
  "Anacardos": [553, 18, 30, 44, {p:30}],
  "Anís": [300, 0, 30, 0, {c:15}],
  "Anís estrellado": [337, 18, 50, 16, {u:0.5}],
  "Arroz": [360, 7, 79, 0.6, {c:15}],
  "Arroz basmati": [360, 7, 79, 0.6],
  "Arroz para sushi": [360, 7, 79, 0.6],
  "Arándanos": [57, 0.7, 14, 0.3, {u:1,p:40}],
  "Atún en lata": [200, 25, 0, 11, {u:60}],
  "Atún fresco": [144, 23, 0, 5],
  "Azafrán": [0, 0, 0, 0],
  "Azúcar": [400, 0, 100, 0, {c:12}],
  "Azúcar glas": [400, 0, 100, 0, {c:8}],
  "Bacalao": [82, 18, 0, 0.7, {u:175}],
  "Bacon": [400, 14, 1, 38, {u:12}],
  "Batatas": [86, 1.6, 20, 0.1, {u:250}],
  "Bebida de avena": [45, 1, 7, 1.5],
  "Berenjenas": [25, 1, 6, 0.2, {u:300}],
  "Bizcochos de soletilla": [390, 8, 80, 4, {u:8}],
  "Brotes de soja": [30, 3, 6, 0.2],
  "Brócoli": [34, 2.8, 7, 0.4, {u:400}],
  "Bulgur": [342, 12, 76, 1.3],
  "Cacahuetes": [567, 26, 16, 49, {p:30}],
  "Cacao en polvo": [228, 20, 58, 14, {c:7}],
  "Café": [2, 0.3, 0, 0],
  "Calabacín": [17, 1.2, 3, 0.3, {u:250}],
  "Calabaza": [26, 1, 6.5, 0.1],
  "Calamares": [92, 16, 3, 1.4],
  "Caldo de carne": [7, 1, 0.5, 0.3],
  "Caldo de pescado": [7, 1, 0.3, 0.3],
  "Caldo de pollo": [7, 1, 0.5, 0.3],
  "Caldo de verduras": [5, 0.3, 1, 0.2],
  "Canela": [247, 4, 81, 1.2, {u:2,c:7}],
  "Carne picada": [250, 17, 0, 20],
  "Carne picada de cordero": [282, 17, 0, 23],
  "Cebolla morada": [40, 1.1, 9, 0.1, {u:150}],
  "Cebollas": [40, 1.1, 9, 0.1, {u:150}],
  "Cebolletas": [32, 1.8, 7, 0.2, {u:60}],
  "Cereales": [357, 8, 84, 0.4],
  "Champiñones": [22, 3, 3, 0.3],
  "Chipotle": [50, 2, 10, 1, {u:15}],
  "Chocolate": [546, 5, 60, 31, {u:5}],
  "Chorizo": [455, 24, 2, 38, {u:100}],
  "Cilantro": [23, 2, 4, 0.5, {p:10}],
  "Coco rallado": [660, 7, 24, 64, {c:6}],
  "Coliflor": [25, 2, 5, 0.3, {u:800}],
  "Colorante alimentario": [0, 0, 0, 0],
  "Comino": [375, 18, 44, 22, {c:6}],
  "Copos de avena": [379, 13, 67, 7, {c:8}],
  "Costillas": [277, 16, 0, 23],
  "Crema de cacahuete": [588, 25, 20, 50, {c:16}],
  "Crema de cacao": [539, 6, 58, 31, {c:20}],
  "Croissants": [406, 8, 46, 21, {u:60}],
  "Curry": [325, 14, 58, 14, {c:6}],
  "Cuscús": [376, 13, 77, 0.6],
  "Cúrcuma": [312, 10, 67, 3, {c:6}],
  "Dorada": [121, 20, 0, 4, {u:250}],
  "Edamame": [121, 12, 9, 5],
  "Esencia de vainilla": [0, 0, 0, 0],
  "Espaguetis": [358, 12, 72, 1.5],
  "Espinacas": [23, 2.9, 3.6, 0.4, {p:30}],
  "Fideos": [358, 12, 72, 1.5],
  "Fideos de arroz": [364, 6, 80, 0.6],
  "Fideos ramen": [360, 10, 70, 3],
  "Filetes de ternera": [140, 21, 0, 6, {u:120}],
  "Fresas": [32, 0.7, 7.7, 0.3, {u:15}],
  "Frutos rojos": [45, 0.8, 10, 0.3, {p:40}],
  "Frutos secos": [600, 20, 20, 50, {p:30}],
  "Galletas": [470, 7, 70, 18, {u:8}],
  "Gambas": [99, 24, 0.2, 0.3],
  "Garam masala": [380, 14, 50, 15, {c:6}],
  "Garbanzos": [139, 7, 22, 2.6, {u:400}],
  "Gnocchi": [150, 4, 32, 0.5],
  "Gochujang": [210, 4, 45, 2, {c:18}],
  "Granola": [471, 10, 64, 20],
  "Guacamole": [160, 2, 9, 15, {u:200,c:15}],
  "Guindilla": [40, 2, 9, 0.4, {u:3,c:2}],
  "Guisantes": [81, 5, 14, 0.4],
  "Gyozas": [220, 9, 28, 8, {u:20}],
  "Hamburguesas": [250, 17, 3, 19, {u:120}],
  "Harina": [364, 10, 76, 1, {c:8}],
  "Harina de maíz precocida": [365, 7, 78, 1.6],
  "Helado": [207, 3.5, 24, 11],
  "Hierbabuena": [0, 0, 0, 0],
  "Hojaldre": [550, 7, 45, 38, {u:230}],
  "Huevos": [143, 12.6, 0.7, 9.5, {u:55}],
  "Hummus": [166, 8, 14, 10, {c:15}],
  "Jamón cocido": [110, 18, 1, 3.5, {u:15}],
  "Jamón serrano": [241, 31, 0, 13, {u:15}],
  "Jengibre": [80, 1.8, 18, 0.8, {c:6}],
  "Judías verdes": [31, 1.8, 7, 0.2],
  "Ketchup": [112, 1.2, 26, 0.1, {c:17}],
  "Kimchi": [15, 1.1, 2.4, 0.5],
  "Kiwis": [61, 1.1, 15, 0.5, {u:75}],
  "Laurel": [0, 0, 0, 0],
  "Leche": [64, 3.3, 4.8, 3.6, {c:15}],
  "Leche de coco": [197, 2, 3, 21],
  "Lechuga": [15, 1.4, 3, 0.2, {u:300}],
  "Lentejas": [352, 24, 60, 1.1],
  "Lentejas rojas": [358, 24, 63, 2],
  "Levadura": [0, 0, 0, 0],
  "Levadura de panadería": [0, 0, 0, 0],
  "Limas": [30, 0.7, 10, 0.2, {u:60}],
  "Limones": [29, 1.1, 9, 0.3, {u:100}],
  "Limones en conserva": [29, 1.1, 9, 0.3, {u:100}],
  "Lomo de cerdo": [143, 21, 0, 6, {u:75}],
  "Macarrones": [358, 12, 72, 1.5],
  "Maicena": [381, 0.3, 91, 0.1, {c:8}],
  "Mango": [60, 0.8, 15, 0.4, {u:300}],
  "Mantequilla": [717, 0.9, 0.1, 81, {c:14}],
  "Manzanas": [52, 0.3, 14, 0.2, {u:180}],
  "Masa de empanadillas": [300, 8, 55, 5, {u:15}],
  "Masa de pizza": [270, 8, 50, 4, {u:260}],
  "Masa quebrada": [480, 6, 50, 28, {u:230}],
  "Mascarpone": [429, 4.6, 4, 44],
  "Mayonesa": [680, 1, 1, 75, {c:14}],
  "Maíz dulce": [86, 3, 19, 1.2, {u:140,c:15}],
  "Mejillones": [26, 3.6, 1.2, 0.7],
  "Menta": [0, 0, 0, 0],
  "Merluza": [71, 17, 0, 0.4, {u:200}],
  "Miel": [304, 0.3, 82, 0, {c:21}],
  "Morcilla": [379, 15, 2, 35, {u:100}],
  "Mostaza": [66, 4, 5, 4, {c:15}],
  "Mozzarella": [254, 18, 2.2, 19, {u:125}],
  "Muslos de pollo": [200, 18, 0, 14, {u:200,e:0.7}],
  "Nachos": [489, 7, 63, 23],
  "Naranjas": [47, 0.9, 12, 0.1, {u:200}],
  "Nata": [337, 2, 3, 35, {c:15}],
  "Nata para cocinar": [195, 2.5, 3.5, 18, {c:15}],
  "Nueces": [654, 15, 14, 65, {p:30}],
  "Nuez moscada": [0, 0, 0, 0],
  "Orégano": [0, 0, 0, 0],
  "Pan": [265, 9, 49, 3.2, {u:250}],
  "Pan de hamburguesa": [270, 9, 48, 4, {u:60}],
  "Pan de molde": [265, 8, 49, 4, {u:25}],
  "Pan de pita": [275, 9, 55, 1.2, {u:60}],
  "Pan rallado": [395, 13, 72, 5, {c:8}],
  "Panceta": [400, 13, 0, 39],
  "Papel de arroz": [330, 6, 80, 0.3, {u:9}],
  "Pasas": [299, 3, 79, 0.5, {c:12}],
  "Pasta de curry verde": [150, 2, 10, 10, {c:15}],
  "Pasta de soja picante": [180, 8, 20, 8, {c:18}],
  "Patatas": [77, 2, 17, 0.1, {u:200}],
  "Pechuga de pavo": [105, 18, 2, 2, {u:15}],
  "Pechuga de pollo": [120, 23, 0, 2.6, {u:250}],
  "Pepino": [15, 0.7, 3.6, 0.1, {u:300}],
  "Pepitas de chocolate": [500, 5, 63, 27],
  "Perejil": [36, 3, 6, 0.8, {p:15}],
  "Pesto": [450, 5, 6, 45, {c:15}],
  "Pimentón": [282, 14, 54, 13, {c:7}],
  "Pimienta de Jamaica": [263, 6, 72, 8.7, {c:6}],
  "Pimienta de Sichuan": [0, 0, 0, 0],
  "Pimienta negra": [0, 0, 0, 0],
  "Pimiento del piquillo": [25, 1, 5, 0.3, {u:30}],
  "Pimientos": [26, 1, 6, 0.3, {u:160}],
  "Piña": [50, 0.5, 13, 0.1, {u:1000}],
  "Plátanos": [89, 1.1, 23, 0.3, {u:120}],
  "Pollo entero": [165, 17, 0, 10, {u:1500,e:0.6}],
  "Puerros": [61, 1.5, 14, 0.3, {u:150}],
  "Queso brie": [334, 21, 0.5, 28],
  "Queso crema": [342, 6, 4, 34, {c:15}],
  "Queso de cabra": [364, 22, 2, 30, {u:150}],
  "Queso en lonchas": [330, 22, 1, 27, {u:20}],
  "Queso feta": [264, 14, 4, 21],
  "Queso fresco": [175, 12, 3, 13],
  "Queso parmesano": [431, 38, 4, 29],
  "Queso rallado": [400, 28, 1, 32],
  "Quinoa": [368, 14, 64, 6],
  "Repollo": [25, 1.3, 6, 0.1, {u:1000}],
  "Romero": [0, 0, 0, 0],
  "Rúcula": [25, 2.6, 3.7, 0.7, {p:20}],
  "Sal": [0, 0, 0, 0],
  "Salchichas": [300, 12, 2, 27, {u:60}],
  "Salmón": [208, 20, 0, 13, {u:150}],
  "Salmón ahumado": [117, 18, 0, 4.3],
  "Salsa barbacoa": [172, 0.8, 40, 0.6, {c:17}],
  "Salsa de ostras": [51, 1.4, 11, 0.3, {c:18}],
  "Salsa de pescado": [35, 5, 3.6, 0, {c:18}],
  "Salsa de soja": [53, 8, 5, 0.6, {c:16}],
  "Salsa sriracha": [0, 0, 0, 0],
  "Semillas de chía": [486, 17, 42, 31, {c:12}],
  "Sésamo": [573, 18, 23, 50, {c:9}],
  "Tahini": [595, 17, 21, 54, {c:15}],
  "Tallarines": [358, 12, 72, 1.5],
  "Ternera": [150, 21, 0, 7],
  "Tofu": [76, 8, 1.9, 4.8],
  "Tomate frito": [85, 1.5, 10, 4, {c:15}],
  "Tomate triturado": [30, 1.3, 5, 0.2],
  "Tomates": [18, 0.9, 3.9, 0.2, {u:150}],
  "Tomates cherry": [18, 0.9, 3.9, 0.2, {u:15}],
  "Tomillo": [0, 0, 0, 0],
  "Tortellini": [300, 12, 45, 8],
  "Tortillas de maíz": [218, 5.7, 45, 2.9, {u:25}],
  "Tortillas de trigo": [300, 8, 50, 7, {u:50}],
  "Tortitas de arroz": [387, 8, 81, 3, {u:9}],
  "Verduras para wok": [30, 1.5, 5, 0.3],
  "Vinagre": [18, 0, 0.5, 0, {c:15}],
  "Vinagre de arroz": [18, 0, 0.5, 0, {c:15}],
  "Vino blanco": [82, 0.1, 2.6, 0],
  "Vino tinto": [85, 0.1, 2.6, 0],
  "Wasabi": [0, 0, 0, 0],
  "Yogur griego": [133, 6, 4, 10, {u:125}],
  "Yogures": [61, 3.5, 4.7, 3.3, {u:125}],
  "Zanahorias": [41, 0.9, 10, 0.2, {u:80}],
};

const WORDS = { un: 1, una: 1, unos: 1, unas: 1, medio: 0.5, media: 0.5 };
function amount(s) {
  const m = s.match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?(?:\s*-\s*(\d+(?:[.,]\d+)?))?/);
  let n = null;
  if (m) {
    n = parseFloat(m[1].replace(",", "."));
    if (m[2]) n /= +m[2];
    if (m[3]) n = (n + parseFloat(m[3].replace(",", "."))) / 2;
  } else { const w = s.match(/^(\p{L}+)/u); if (w && WORDS[w[1]]) n = WORDS[w[1]]; }
  if (n != null && /\by medi[oa]\b/.test(s)) n += 0.5;
  return n;
}
// Gramos aproximados de una línea de ingredientes («2 cucharadas», «1 bote (400 g)», «3 dientes»…).
export function grams(info, q) {
  const o = info[4] ?? {};
  return raw(info, q) * (o.e ?? 1);
}
function raw(info, q) {
  const s = String(q ?? "").toLowerCase().trim();
  const o = info[4] ?? {};
  if (!s || (/al gusto|para (decorar|servir|acompañar|el molde)/.test(s) && !/\d/.test(s))) return 0;
  const w = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)(?!\p{L})/u);
  if (w) {
    const g = parseFloat(w[1].replace(",", ".")) * { kg: 1000, g: 1, ml: 1, l: 1000 }[w[2]];
    // Aceite para freír o confitar: casi todo se queda en la sartén
    if (info[3] >= 99 && (/para freír/.test(s) || g >= 200)) return g * 0.12;
    return g;
  }
  const n = amount(s) ?? 1;
  if (/cucharadita/.test(s)) return (n * (o.c ?? 12)) / 3;
  if (/cucharada/.test(s)) return n * (o.c ?? 12);
  if (/puñado|manojo/.test(s)) return n * (o.p ?? 25);
  if (/pizca|hebra|hoja|ramita|rama\b/.test(s)) return 0.5;
  if (/diente/.test(s)) return n * 5;
  if (/chorrito|nuez\b/.test(s)) return 10;
  if (/(la|de) piel|ralladura/.test(s)) return 3;
  if (/zumo/.test(s)) return n * (o.u ?? 100) * 0.4;
  if (/vasito/.test(s)) return n * 110;
  if (/rebanada/.test(s)) return n * Math.min(o.u ?? 40, 40);
  if (/rodaja/.test(s)) return n * 30;
  if (/panecillo/.test(s)) return n * 60;
  if (/onza/.test(s)) return n * 5;
  const cm = s.match(/(\d+)\s*cm/); if (cm) return +cm[1] * 3;
  const inside = s.match(/\((?:unas |unos )?(\d+)[^)]*\)/); // «1 bolsa (unas 15)», «1 paquete (16 obleas)»
  if (inside) return +inside[1] * (o.u ?? 0);
  return n * (o.u ?? 0);
}
// Por ración: { kcal, p, h, g, all } (all = si se conocían todos los ingredientes).
export function nutrition(r, find = (n) => T[n]) {
  let k = 0, p = 0, h = 0, g = 0, all = true;
  for (const [n, q] of r.i) {
    const info = find(n);
    if (!info) { all = false; continue; }
    const gr = grams(info, q) / 100;
    k += info[0] * gr; p += info[1] * gr; h += info[2] * gr; g += info[3] * gr;
  }
  const s = Math.max(1, r.r || 1);
  return { kcal: Math.round(k / s / 10) * 10, p: Math.round(p / s), h: Math.round(h / s), g: Math.round(g / s), all };
}
export const NUT = T;
