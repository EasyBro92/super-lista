// Prueba qué webs de supermercados responden con precios desde GitHub Actions (el contenedor de desarrollo no llega).
// Guarda en out/probe/ la respuesta de cada una y los iconos de cada súper.
import fs from "node:fs/promises";

const BROWSER = { "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Accept-Language": "es-ES,es;q=0.9", Accept: "application/json, text/plain, */*" };
const TESTS = {
  consum: "https://tienda.consum.es/api/rest/V1.0/catalog/product?limit=3&offset=0&q=leche",
  consum2: "https://tienda.consum.es/api/rest/V1.0/catalog/searcher/products?q=leche&limit=3&offset=0",
  carrefour: "https://www.carrefour.es/search-api/query/v1/search?query=leche&scope=desktop&lang=es&rows=3&start=0&origin=default&f.op=OR",
  dia: "https://www.dia.es/api/v1/search-back/search/reduced?q=leche&page=1",
  dia2: "https://www.dia.es/api/v1/plp-back/reduced/L104",
  alcampo: "https://www.compraonline.alcampo.es/api/v5/products/search?limit=3&offset=0&term=leche",
  alcampo2: "https://www.compraonline.alcampo.es/api/webproductpagews/v5/products/search?term=leche",
  eroski: "https://supermercado.eroski.es/es/search/results/?q=leche&suggestionsFilter=false",
  lidl: "https://www.lidl.es/q/api/search?q=leche&locale=es_ES&assortment=ES&version=2.1.0&fetchsize=3",
  aldi: "https://www.aldi.es/productos/frescos.html",
  eci: "https://www.elcorteingles.es/supermercado/api/catalog/supermercado/type_ahead/?question=leche&scope=supermarket&center=010MOH&results=3",
  hipercor: "https://www.hipercor.es/supermercado/buscar/?term=leche",
  openprices: "https://prices.openfoodfacts.org/api/v1/prices?size=3&location__osm_address_country=Espa%C3%B1a",
  openprices2: "https://prices.openfoodfacts.org/api/v1/locations?size=5&osm_address_country=Espa%C3%B1a&order_by=-price_count",
};
const LOGOS = { mercadona: "mercadona.es", carrefour: "carrefour.es", lidl: "lidl.es", dia: "dia.es", alcampo: "alcampo.es", eroski: "eroski.es", aldi: "aldi.es", consum: "consum.es", elcorteingles: "elcorteingles.es" };

await fs.mkdir("out/probe/logos", { recursive: true });
const sum = [];
for (const [k, u] of Object.entries(TESTS)) {
  try {
    const r = await fetch(u, { headers: BROWSER, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    await fs.writeFile(`out/probe/${k}.txt`, `${r.status} ${r.headers.get("content-type")}\n${u}\n\n${t.slice(0, 60000)}`);
    sum.push(`${k}: ${r.status} ${t.length}b ${t.slice(0, 120).replace(/\s+/g, " ")}`);
  } catch (e) { sum.push(`${k}: ERROR ${e.message}`); }
}
for (const [k, d] of Object.entries(LOGOS)) {
  for (const [n, u] of [["g", `https://www.google.com/s2/favicons?domain=${d}&sz=128`], ["a", `https://www.${d}/apple-touch-icon.png`]]) {
    try {
      const r = await fetch(u, { headers: BROWSER, signal: AbortSignal.timeout(15000) });
      if (r.ok) await fs.writeFile(`out/probe/logos/${k}-${n}.png`, Buffer.from(await r.arrayBuffer()));
      sum.push(`logo ${k}-${n}: ${r.status}`);
    } catch (e) { sum.push(`logo ${k}-${n}: ERROR`); }
  }
}
await fs.writeFile("out/probe/resumen.txt", sum.join("\n"));
console.log(sum.join("\n"));
