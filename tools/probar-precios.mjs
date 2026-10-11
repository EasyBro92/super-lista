// Prueba qué webs de supermercados responden con precios desde GitHub Actions (el contenedor de desarrollo no llega).
// Guarda en out/probe/ la respuesta de cada una y los iconos de cada súper.
import fs from "node:fs/promises";

const BROWSER = { "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Accept-Language": "es-ES,es;q=0.9", Accept: "application/json, text/plain, */*" };
const TESTS = {
  consumall: "https://tienda.consum.es/api/rest/V1.0/catalog/product?limit=2&offset=0",
  alcampo: "https://www.compraonline.alcampo.es/search?q=leche",
  alcampo3: "https://www.compraonline.alcampo.es/api/v6/products/search?term=leche&limit=3",
  aldi: "https://www.aldi.es/",
  aldi2: "https://www.aldi.es/sitemap.xml",
  eci: "https://www.elcorteingles.es/supermercado/buscar/?term=leche",
  carrefour: "https://www.carrefour.es/supermercado/",
  eroski: "https://supermercado.eroski.es/",
  diacat: "https://www.dia.es/api/v1/search-back/search/reduced?q=tomate&page=2",
};
const LOGOS = { mercadona: "mercadona.es", carrefour: "carrefour.es", lidl: "lidl.es", dia: "dia.es", alcampo: "alcampo.es", eroski: "eroski.es", aldi: "aldi.es", consum: "consum.es", elcorteingles: "elcorteingles.es" };

await fs.mkdir("out/probe/logos", { recursive: true });
const sum = [];
for (const [k, u] of Object.entries(TESTS)) {
  try {
    const r = await fetch(u, { headers: BROWSER, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    await fs.writeFile(`out/probe/${k}.txt`, `${r.status} ${r.headers.get("content-type")}\n${u}\n\n${t.slice(0, 3000000)}`);
    sum.push(`${k}: ${r.status} ${t.length}b ${t.slice(0, 120).replace(/\s+/g, " ")}`);
  } catch (e) { sum.push(`${k}: ERROR ${e.message}`); }
}
for (const [k, d] of Object.entries(process.env.LOGOS ? LOGOS : {})) {
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
