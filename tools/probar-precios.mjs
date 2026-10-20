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

// Ofertas de Consum y enlaces cortos a la ficha de cada tienda.
const co = j(await get("consum", "https://tienda.consum.es/api/rest/V1.0/catalog/product?limit=100&offset=2000", 10));
const ofs = (co?.products ?? []).filter((p) => p.offers?.length || p.productData?.novelty);
await fs.writeFile("out/probe/consum-offers.json", JSON.stringify(ofs.slice(0, 4), null, 1));
const food = (co?.products ?? []).find((p) => p.productData?.containAllergensIntolernacies);
if (food) await get("consum-food", `https://tienda.consum.es/api/rest/V1.0/catalog/product/${food.id}`);
sum.push(`consum ofertas ${ofs.length}/${co?.products?.length}`);
for (const [k, u] of Object.entries({
  mercShort: "https://tienda.mercadona.es/product/4241", consumShort: "https://tienda.consum.es/es/p/x/1669",
  diaShort: "https://www.dia.es/x/p/504P6", diaShort2: "https://www.dia.es/p/504P6", alcampoShort: "https://www.compraonline.alcampo.es/products/91400",
})) {
  try { const r = await fetch(u, { headers: BROWSER, redirect: "manual" }); sum.push(`${k}: ${r.status} ${r.headers.get("location") ?? ""}`); } catch (e) { sum.push(`${k}: ERROR`); }
}
await fs.writeFile("out/probe/resumen.txt", sum.join("\n"));
console.log(sum.join("\n"));
