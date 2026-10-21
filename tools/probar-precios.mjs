// Prueba qué datos dan las webs de supermercados desde GitHub Actions (el contenedor de desarrollo no llega).
// Guarda en out/probe/ la respuesta de cada una.
import fs from "node:fs/promises";

const BROWSER = { "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Accept-Language": "es-ES,es;q=0.9", Accept: "application/json, text/plain, */*", Origin: "https://easybro92.github.io" };
await fs.mkdir("out/probe", { recursive: true });
const sum = [];
async function get(k, u, cut = 400000) {
  try {
    const r = await fetch(u, { headers: BROWSER, signal: AbortSignal.timeout(25000) });
    const t = await r.text();
    const cors = r.headers.get("access-control-allow-origin");
    await fs.writeFile(`out/probe/${k}.txt`, `${r.status} ${r.headers.get("content-type")} cors=${cors}\n${u}\n\n${t.slice(0, cut)}`);
    sum.push(`${k}: ${r.status} ${t.length}b cors=${cors}`);
    return t;
  } catch (e) { sum.push(`${k}: ERROR ${e.message}`); return ""; }
}
const j = (t) => { try { return JSON.parse(t); } catch { return null; } };

// Fotos y datos para probar la ficha del producto, y los buscadores de cada súper.
await fs.mkdir("out/probe/img", { recursive: true });
const IMGS = {
  "m1.jpg": "https://prod-mercadona.imgix.net/images/3b8cde7b3cb069ee0316029012cf8562.jpg?fit=crop&h=800&w=800",
  "m2.jpg": "https://prod-mercadona.imgix.net/images/3eb95d1e4b1daee2df5e5c85dafbfe38.jpg?fit=crop&h=800&w=800",
  "d1.jpg": "https://www.dia.es/product_images/504P6/504P6_ISO_0_ES.jpg", "d2.jpg": "https://www.dia.es/product_images/504P6/504P6_FRO_0_ES.jpg",
  "d3.jpg": "https://www.dia.es/product_images/504P6/504P6_TRA_0_ES.jpg",
};
for (const [k, u] of Object.entries(IMGS)) {
  try { const r = await fetch(u, { headers: BROWSER }); if (r.ok) await fs.writeFile(`out/probe/img/${k}`, Buffer.from(await r.arrayBuffer())); sum.push(`img ${k}: ${r.status}`); } catch { sum.push(`img ${k}: ERROR`); }
}
await get("off-aceite", "https://world.openfoodfacts.org/api/v2/product/8402001027482.json?fields=product_name,ingredients_text_es,allergens_tags,traces_tags,nutriments,nutriscore_grade,nova_group,labels_tags,image_front_url,origins");
const SEARCH = {
  mercadona: "https://tienda.mercadona.es/search-results?query=leche", dia: "https://www.dia.es/search?q=leche",
  consum: "https://tienda.consum.es/es/s/leche", carrefour: "https://www.carrefour.es/?q=leche",
  eroski: "https://supermercado.eroski.es/es/search/results/?q=leche", eci: "https://www.elcorteingles.es/supermercado/buscar/?term=leche",
  lidl: "https://www.lidl.es/q/search?q=leche", aldi: "https://www.aldi.es/busqueda.html?query=leche",
};
for (const [k, u] of Object.entries(SEARCH)) {
  try { const r = await fetch(u, { headers: { ...BROWSER, Accept: "text/html" }, redirect: "manual" }); sum.push(`buscar ${k}: ${r.status} ${r.headers.get("location") ?? ""}`); } catch (e) { sum.push(`buscar ${k}: ERROR`); }
}
await fs.writeFile("out/probe/resumen.txt", sum.join("\n"));
console.log(sum.join("\n"));
