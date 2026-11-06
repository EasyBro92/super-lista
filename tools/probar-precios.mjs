// Prueba qué datos dan las webs de supermercados desde GitHub Actions (el contenedor de desarrollo no llega).
// Guarda en out/probe/ la respuesta de cada una.
import fs from "node:fs/promises";

const BROWSER = { "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Accept-Language": "es-ES,es;q=0.9", Accept: "application/json, text/html, */*" };
await fs.mkdir("out/probe", { recursive: true });
const sum = [];
async function get(k, u, opts = {}) {
  try {
    const r = await fetch(u, { headers: { ...BROWSER, ...(opts.headers ?? {}) }, method: opts.method ?? "GET", body: opts.body, redirect: "follow", signal: AbortSignal.timeout(25000) });
    const t = await r.text();
    const cors = r.headers.get("access-control-allow-origin");
    await fs.writeFile(`out/probe/${k}.txt`, `${r.status} ${r.headers.get("content-type")} cors=${cors} final=${r.url}\n${u}\n\n${t.slice(0, 3000000)}`);
    const marks = ["__INITIAL_STATE__", "productEntities", "\"price\"", "€", "application/ld+json", "__NEXT_DATA__", "dataLayer"].filter((m) => t.includes(m)).join(",");
    sum.push(`${k}: ${r.status} ${t.length}b cors=${cors} [${marks}] → ${r.url}`);
    return t;
  } catch (e) { sum.push(`${k}: ERROR ${e.message}`); return ""; }
}

// Segunda ronda: páginas de sección y paginación de los que respondieron.
const SEARCH = {
  ahorramas48: "https://www.ahorramas.com/on/demandware.store/Sites-Ahorramas-Site/es/Search-UpdateGrid?q=leche&start=48&sz=48",
  ahorramasYog: "https://www.ahorramas.com/on/demandware.store/Sites-Ahorramas-Site/es/Search-UpdateGrid?q=yogur&start=0&sz=48",
  gadisLac: "https://www.gadisline.com/lacteos",
  gadisLac2: "https://www.gadisline.com/lacteos?page=2",
  gadisBus: "https://www.gadisline.com/busqueda?q=leche",
  gadisBus2: "https://www.gadisline.com/search?q=leche",
  eciLac: "https://www.elcorteingles.es/supermercado/lacteos/",
  eciLac2: "https://www.elcorteingles.es/supermercado/lacteos/2/",
  eciBus: "https://www.elcorteingles.es/supermercado/buscar/?term=leche&search=text",
  lidlYog: "https://www.lidl.es/q/api/search?q=yogur&locale=es_ES&assortment=ES&version=2.1.0&fetchsize=100",
  aldiOf: "https://www.aldi.es/ofertas.html",
  aldiProd: "https://www.aldi.es/productos.html",
  aldiFres: "https://www.aldi.es/productos/frescos.html",
  bonpreuEs: "https://www.compraonline.bonpreuesclat.cat/search?q=leche&lang=es",
};
for (const [k, u] of Object.entries(SEARCH)) await get(k, u);
await fs.writeFile("out/probe/resumen.txt", sum.join("\n"));
console.log(sum.join("\n"));
