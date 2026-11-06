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
    await fs.writeFile(`out/probe/${k}.txt`, `${r.status} ${r.headers.get("content-type")} cors=${cors} final=${r.url}\n${u}\n\n${t.slice(0, 300000)}`);
    const marks = ["__INITIAL_STATE__", "productEntities", "\"price\"", "€", "application/ld+json", "__NEXT_DATA__", "dataLayer"].filter((m) => t.includes(m)).join(",");
    sum.push(`${k}: ${r.status} ${t.length}b cors=${cors} [${marks}] → ${r.url}`);
    return t;
  } catch (e) { sum.push(`${k}: ERROR ${e.message}`); return ""; }
}

// Súpers nuevos: buscar «leche» en su tienda online.
const SEARCH = {
  bonpreu: "https://www.compraonline.bonpreuesclat.cat/search?q=llet",
  condis: "https://compraonline.condis.es/search?q=leche",
  condis2: "https://compraonline.condis.es/",
  ahorramas: "https://www.ahorramas.com/buscador?q=leche",
  ahorramas2: "https://www.ahorramas.com/on/demandware.store/Sites-Ahorramas-Site/es/Search-UpdateGrid?q=leche&start=0&sz=48",
  bm: "https://www.online.bmsupermercados.es/es/buscar?q=leche",
  bm2: "https://www.online.bmsupermercados.es/",
  caprabo: "https://www.capraboacasa.com/es/search?q=leche",
  caprabo2: "https://www.capraboacasa.com/",
  gadis: "https://www.gadisline.com/buscar?q=leche",
  gadis2: "https://www.gadisline.com/",
  hiperdino: "https://www.hiperdino.es/c9495/catalogsearch/result/?q=leche",
  hiperdino2: "https://www.hiperdino.es/",
  masymas: "https://www.masymas.com/buscar?q=leche",
  masymas2: "https://tienda.masymas.com/",
  froiz: "https://tienda.froiz.com/",
  lupa: "https://www.supermercadoslupa.es/",
  eroski: "https://supermercado.eroski.es/es/search/results/?q=leche",
  carrefour: "https://www.carrefour.es/cloud-api/plp-food-papi/v1/search?query=leche",
  eci: "https://www.elcorteingles.es/supermercado/buscar/?term=leche",
  eci2: "https://www.elcorteingles.es/supermercado/api/catalog/supermercado/search/?term=leche",
  hipercor: "https://www.hipercor.es/supermercado/buscar/?term=leche",
  spar: "https://www.sparenlinea.es/",
  coviran: "https://www.coviran.es/",
  family: "https://www.familycash.es/",
  lidl: "https://www.lidl.es/q/api/search?q=leche&locale=es_ES&assortment=ES&version=2.1.0",
  aldi: "https://www.aldi.es/ofertas.html",
};
for (const [k, u] of Object.entries(SEARCH)) await get(k, u);
await fs.writeFile("out/probe/resumen.txt", sum.join("\n"));
console.log(sum.join("\n"));
