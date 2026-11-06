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

// Más productos y marcas conocidas, para que el catálogo de cada súper tenga de casi todo.
const MAS = `mandarinas, peras, melocotón, nectarina, kiwi, piña, mango, melón, sandía, cerezas, ciruelas, granada, frambuesas, arándanos,
pomelo, higos, caqui, papaya, coco, dátiles, ciruelas pasas, orejones, puerro, apio, berenjena, coliflor, col, repollo, lombarda, alcachofas,
espárragos verdes, espárragos blancos, judías verdes, guisantes, habas, maíz, rúcula, canónigos, espinacas frescas, ensalada en bolsa,
brotes, setas, boniato, calabaza, remolacha, rábanos, jengibre, cebolleta, ajo negro, hierbas frescas, cilantro fresco, albahaca fresca,
pollo entero, muslos de pollo, contramuslos, alitas de pollo, pavo filetes, solomillo de cerdo, secreto ibérico, costillas de cerdo, panceta,
cordero, conejo, ternera filetes, entrecot, solomillo de ternera, carrillada, rabo de toro, morcilla, longaniza, butifarra, salchichas frescas,
albóndigas, carne picada mixta, chistorra, codillo, pinchos morunos, hamburguesa vegetal, tofu, seitán, tempeh, heura,
lubina, dorada, sardinas frescas, boquerones, rape, rodaballo, lenguado, emperador, atún fresco, salmón ahumado, bacalao desalado,
gulas, surimi, palitos de cangrejo, pulpo, sepia, chipirones, langostinos, almejas, berberechos, navajas, anchoas, caballa, mejillones en escabeche,
jamón ibérico, lomo embuchado, salchichón, fuet, mortadela, chopped, pechuga de pavo en lonchas, sobrasada, paté, foie, queso manchego,
queso semicurado, queso de cabra, queso azul, queso brie, queso camembert, mozzarella, burrata, queso feta, queso parmesano, queso emmental,
queso gouda, queso havarti, queso de burgos, requesón, queso crema, queso en lonchas, queso para fundir, tortilla de patatas, hummus, guacamole,
leche semidesnatada, leche sin lactosa, leche de cabra, bebida de soja, bebida de almendra, bebida de avena, bebida de arroz, batido de chocolate,
kéfir, yogur de sabores, yogur desnatado, yogur proteico, skyr, actimel, petit suisse, natillas, flan, arroz con leche, cuajada, gelatina,
nata montada, nata para cocinar, margarina, huevos frescos, claras de huevo, pan de barra, baguette, pan rústico, pan sin gluten, pan de hamburguesa,
pan de perritos, pan rallado, picos, regañás, colines, biscotes, pan de pita, tortillas de trigo, tortillas de maíz, croissant, magdalenas,
bizcocho, donuts, palmeras, ensaimada, brioche, sobaos, napolitanas, bollería, tarta, quinoa, cuscús, bulgur, arroz basmati, arroz integral,
arroz bomba, fideos, fideos de arroz, noodles, lasaña, canelones, tallarines, tortellini, gnocchi, ñoquis, harina de trigo, harina integral,
harina de maíz, levadura, maicena, pan de molde integral, azúcar moreno, edulcorante, sal marina, pimienta, pimentón, orégano, comino, curry,
canela, azafrán, colorante, especias, caldo de pollo, caldo de pescado, caldo de verduras, pastillas de caldo, sopa de sobre, crema de verduras,
gazpacho, salmorejo, garbanzos cocidos, lentejas cocidas, alubias cocidas, alubias rojas, judiones, fabada, cocido, pisto, tomate natural,
tomate concentrado, pimientos del piquillo, pimientos asados, espárragos en lata, alcachofas en conserva, maíz dulce, champiñones laminados,
atún claro, bonito del norte, ventresca, sardinillas, berberechos en lata, pulpo en lata, calamares en su tinta, paté de atún, aceite de coco,
aceite de oliva suave, aceite de orujo, vinagre de módena, salsa de soja, salsa barbacoa, salsa brava, alioli, salsa césar, salsa pesto, salsa carbonara,
salsa boloñesa, bechamel, salsa de queso, salsa picante, tabasco, salsa sriracha, leche de coco, encurtidos, pepinillos, cebollitas, alcaparras,
aceitunas rellenas, aceitunas negras, almendras, nueces, pistachos, anacardos, cacahuetes, pipas, avellanas, mezcla de frutos secos, pasas,
patatas chips, nachos, palomitas, gusanitos, tortitas de arroz, tortitas de maíz, barritas de cereales, crema de cacahuete, crema de cacao, nocilla,
nutella, mermelada de fresa, mermelada de melocotón, miel de flores, sirope, cola cao, nesquik, café en grano, café soluble, café descafeinado,
cápsulas nespresso, cápsulas dolce gusto, té verde, té negro, manzanilla, poleo menta, rooibos, cereales de chocolate, copos de maíz, corn flakes,
muesli, granola, copos de avena, galletas maría, galletas digestive, galletas de chocolate, oreo, príncipe, tostadas de pan, chocolate negro,
chocolate con leche, chocolate blanco, bombones, turrón, polvorones, mazapán, caramelos, chicles, gominolas, regaliz, chocolatinas, kinder,
agua mineral grande, agua con gas, agua de 5 litros, coca cola zero, fanta naranja, fanta limón, sprite, 7up, nestea, aquarius, gaseosa, tónica,
bitter, bebida isotónica, bebida energética, red bull, monster, zumo de naranja, zumo de piña, zumo de melocotón, néctar, mosto, horchata,
batido, bebida vegetal, cerveza sin alcohol, cerveza mahou, cerveza estrella, cerveza cruzcampo, cerveza san miguel, cerveza alhambra, cerveza heineken,
tinto de verano, vino blanco, vino rosado, rioja, ribera del duero, cava, sidra, sangría, vermut, ginebra, ron, whisky, vodka, licor, brandy,
pizza congelada, lasaña congelada, croquetas congeladas, empanadillas, san jacobos, varitas de merluza, calamares a la romana, gambas congeladas,
langostinos congelados, merluza congelada, salmón congelado, verduras para wok, espinacas congeladas, judías verdes congeladas, menestra congelada,
patatas fritas congeladas, patatas gajo, nuggets, alitas congeladas, helado de vainilla, helado de chocolate, polos, conos, tarrinas, hielo,
masa de pizza, masa de hojaldre, masa quebrada, obleas de empanadilla, gyozas, rollitos de primavera, sushi,
detergente líquido, detergente en cápsulas, detergente en polvo, quitamanchas, lavavajillas a mano, sal para lavavajillas, abrillantador,
limpiador multiusos, limpiador baño, limpiador cocina, desengrasante, friegasuelos, amoniaco, quitagrasas, ambientador, insecticida,
bayetas, fregona, recambio fregona, escoba, guantes de limpieza, papel de aluminio, film transparente, papel de horno, bolsas de congelación,
bolsas de basura, pilas, bombillas, velas, cerillas, mechero, servilletas de papel, pañuelos de papel, platos desechables, vasos desechables,
gel de baño, jabón de manos, champú anticaspa, acondicionador, mascarilla de pelo, laca, gomina, espuma de afeitar, cuchillas de afeitar,
crema hidratante, crema corporal, protector solar, after sun, desmaquillante, algodón, bastoncillos, colutorio, hilo dental, cepillo de dientes,
compresas, tampones, salvaslip, protege slips, pañales de adulto, preservativos, tiritas, alcohol, agua oxigenada, toallitas desmaquillantes,
leche de fórmula, leche infantil, papilla, potitos, cereales para bebé, toallitas bebé, crema para bebé, champú para bebé,
pienso para perro, latas para perro, snacks para perro, pienso para gato, latas para gato, arena para gato, comida para pájaros,
hacendado, deliplus, bosque verde, carrefour, auchan, eroski, consum, dia, el corte inglés, pascual, central lechera asturiana, puleva,
kaiku, danone, activia, la lechera, nestlé, president, el pozo, campofrío, navidul, argal, casa tarradellas, buitoni, gallo, barilla,
brillante, sos, la fallera, la española, carbonell, koipe, ybarra, hojiblanca, borges, calvo, isabel, ortiz, cuca, rianxeira, orlando, apis,
heinz, hellmann's, ligeresa, knorr, gallina blanca, avecrem, bimbo, panrico, artiach, cuétara, fontaneda, gullón, siro, kellogg's, chocapic,
nesquik cereales, marcilla, saimaza, nescafé, bonka, pompadour, hornimans, lindt, valor, nestlé chocolate, milka, ferrero, haribo, chupa chups,
matutano, lay's, pringles, risi, grefusa, coca cola, pepsi, schweppes, font vella, lanjarón, bezoya, solán de cabras, don simón, granini,
zumosol, juver, mahou, estrella galicia, estrella damm, ambar, ariel, skip, dixan, mimosín, flor, fairy, finish, sanytol, don limpio, kh-7,
estrella lejía, scottex, renova, colhogar, dodot, huggies, nivea, sanex, dove, h&s, pantene, colgate, oral-b, signal, rexona, axe, gillette,
ausonia, evax, tampax, isdin, purina, whiskas, friskies, affinity, pedigree, felix, royal canin`;

export async function terminos() {
  const recetas = JSON.parse(await readFile("data/recetas.json", "utf8"));
  const set = new Map();
  const add = (t) => { const k = t.toLowerCase().trim(); if (k && !set.has(k)) set.set(k, t.trim()); };
  for (const names of Object.values(BASICS)) names.forEach(add);
  for (const r of recetas) for (const [n] of r.i) add(n);
  EXTRA.split(",").forEach(add);
  MAS.split(",").forEach(add);
  return [...set.values()];
}
