// Prueba desde GitHub Actions (el contenedor de desarrollo no llega) los programas que descargan cada súper,
// con pocas búsquedas, y guarda en out/probe/ un resumen y una muestra de productos.
import fs from "node:fs/promises";
process.env.TERMS_MAX ||= "12";
process.env.ECI_MAX_PAGES ||= "2";
process.env.GADIS_MAX ||= "14";
const { fetchAhorramas } = await import("../scripts/fetch-ahorramas.mjs");
const { fetchGadis } = await import("../scripts/fetch-gadis.mjs");
const { fetchEci } = await import("../scripts/fetch-eci.mjs");
const { fetchAldiOfertas } = await import("../scripts/fetch-aldi.mjs");
await fs.mkdir("out/probe", { recursive: true });
const sum = [];
for (const [k, f] of Object.entries({ ahorramas: fetchAhorramas, gadis: fetchGadis, elcorteingles: fetchEci, aldi: fetchAldiOfertas })) {
  const t0 = Date.now();
  try {
    const items = await f();
    const conPrecio = items.filter((p) => p.p != null).length;
    sum.push(`${k}: ${items.length} productos, ${conPrecio} con precio, ${items.filter((p) => p.o).length} ofertas, ${Math.round((Date.now() - t0) / 1000)} s`);
    await fs.writeFile(`out/probe/${k}.json`, JSON.stringify(items.slice(0, 400), null, 1));
  } catch (e) { sum.push(`${k}: ERROR ${e.message}`); }
}
await fs.writeFile("out/probe/resumen.txt", sum.join("\n"));
console.log(sum.join("\n"));
