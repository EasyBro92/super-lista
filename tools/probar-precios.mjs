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

// Mercadona: una categoría y la ficha de dos productos.
const cat = j(await get("merc-cat", "https://tienda.mercadona.es/api/categories/112/?lang=es&wh=mad1"));
const ids = (cat?.categories ?? [cat]).flatMap((c) => c?.products ?? []).slice(0, 2).map((p) => p.id);
for (const id of ids) await get(`merc-prod-${id}`, `https://tienda.mercadona.es/api/products/${id}/?lang=es&wh=mad1`);
await get("merc-prod-yogur", "https://tienda.mercadona.es/api/products/20227/?lang=es&wh=mad1");
// Dia: búsqueda y posible ficha.
const dia = j(await get("dia-search", "https://www.dia.es/api/v1/search-back/search/reduced?q=leche&page=1", 60000));
const dp = dia?.search_items?.[0];
if (dp?.url) { await get("dia-page", `https://www.dia.es${dp.url}`, 600000); }
if (dp?.object_id) await get("dia-pdp", `https://www.dia.es/api/v1/pdp-back/reduced/${dp.object_id}`);
// Alcampo: la primera ficha del buscador y su página.
const al = await get("alcampo-search", "https://www.compraonline.alcampo.es/search?q=yogur", 10);
{
  const t = await (await fetch("https://www.compraonline.alcampo.es/search?q=yogur", { headers: BROWSER }).catch(() => null))?.text?.() ?? "";
  const a = t.indexOf("__INITIAL_STATE__=");
  if (a >= 0) {
    const st = j(t.slice(a + 18, t.indexOf("</script>", a)).trim().replace(/;$/, ""));
    const ents = Object.values(st?.data?.products?.productEntities ?? {});
    await fs.writeFile("out/probe/alcampo-ents.json", JSON.stringify(ents.slice(0, 4), null, 1));
    const pid = ents[0]?.productId ?? ents[0]?.retailerProductId;
    sum.push(`alcampo ents ${ents.length} keys ${Object.keys(ents[0] ?? {}).join(",")}`);
    if (pid) await get("alcampo-api", `https://www.compraonline.alcampo.es/api/v6/products/${pid}`);
    if (ents[0]?.retailerProductId) await get("alcampo-page", `https://www.compraonline.alcampo.es/products/x/${ents[0].retailerProductId}`, 800000);
  } else sum.push("alcampo: sin estado");
}
// Consum: dos productos completos y una ficha.
const co = j(await get("consum", "https://tienda.consum.es/api/rest/V1.0/catalog/product?limit=3&offset=0"));
if (co?.products?.[0]) await get("consum-prod", `https://tienda.consum.es/api/rest/V1.0/catalog/product/${co.products[0].id}`);
// Open Food Facts por código de barras (¿se deja leer desde la web?).
await get("off", "https://world.openfoodfacts.org/api/v2/product/8410128010119.json?fields=product_name,ingredients_text_es,allergens_tags,traces_tags,nutriments,nutriscore_grade,nova_group,labels_tags,image_front_url,origins");

await fs.writeFile("out/probe/resumen.txt", sum.join("\n"));
console.log(sum.join("\n"));
