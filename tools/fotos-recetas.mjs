// Fotos reales de las recetas desde Wikimedia Commons (licencias libres, con autor).
//   node tools/fotos-recetas.mjs candidatas  → descarga varias opciones por receta en out/cand para elegir a mano
//   node tools/fotos-recetas.mjs final       → descarga las elegidas en tools/fotos-eleccion.json a img/recetas
import fs from "node:fs/promises";

const UA = "SuperLista/1.0 (https://github.com/EasyBro92/super-lista; lista de la compra)";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const LIBRE = /^(cc0|public domain|pd|cc by(-sa)? [\d.]+|cc by(-sa)?|attribution|gfdl)/i;

async function api(host, params) {
  const u = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) u.searchParams.set(k, v);
  for (let i = 0; i < 4; i++) {
    const r = await fetch(u, { headers: { "User-Agent": UA } });
    if (r.ok) { await wait(250); return r.json(); }
    await wait(3000 * (i + 1));
  }
  throw new Error(`API ${host} falló`);
}
const strip = (h) => String(h ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function info(page) {
  const ii = page.imageinfo?.[0]; if (!ii) return null;
  const m = ii.extmetadata ?? {};
  const lic = strip(m.LicenseShortName?.value);
  if (!LIBRE.test(lic) || /nc|nd/i.test(lic.replace(/^cc by(-sa)?/i, ""))) return null;
  return { file: page.title, thumb: ii.thumburl, w: ii.width, h: ii.height, lic, autor: strip(m.Artist?.value) || "Desconocido",
    pagina: ii.descriptionurl, desc: strip(m.ImageDescription?.value).slice(0, 140) };
}

async function filesInfo(titles, width) {
  if (!titles.length) return [];
  const d = await api("commons.wikimedia.org", { action: "query", titles: titles.join("|"), prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: width });
  return (d.query?.pages ?? []).map(info).filter(Boolean);
}

async function pageImage(host, title) {
  const d = await api(host, { action: "query", titles: title, prop: "pageimages", piprop: "name", redirects: "1" });
  const n = d.query?.pages?.[0]?.pageimage;
  return n ? `File:${n}` : null;
}

async function candidatas() {
  const busq = JSON.parse(await fs.readFile("tools/fotos-busquedas.json", "utf8"));
  await fs.mkdir("out/cand", { recursive: true });
  const res = [];
  let i = 0;
  for (const [n, qs] of Object.entries(busq)) {
    const files = [];
    for (const [host, q] of [["es.wikipedia.org", qs[0]], ["en.wikipedia.org", qs[1] ?? qs[0]]]) {
      try { const f = await pageImage(host, q); if (f) files.push(f); } catch {}
    }
    for (const q of qs) {
      try {
        const d = await api("commons.wikimedia.org", { action: "query", list: "search", srsearch: `${q} filetype:bitmap`, srnamespace: "6", srlimit: "5" });
        for (const s of d.query?.search ?? []) files.push(s.title);
      } catch {}
    }
    const uniq = [...new Set(files)].slice(0, 9);
    const c = (await filesInfo(uniq, 300)).filter((x) => x.thumb);
    c.sort((a, b) => uniq.indexOf(a.file) - uniq.indexOf(b.file));
    for (const [k, x] of c.entries()) {
      try {
        const r = await fetch(x.thumb, { headers: { "User-Agent": UA } });
        if (r.ok) { x.local = `${i}-${k}.jpg`; await fs.writeFile(`out/cand/${x.local}`, Buffer.from(await r.arrayBuffer())); }
      } catch {}
      await wait(150);
    }
    res.push({ i, n, c: c.filter((x) => x.local) });
    console.log(`${i} ${n}: ${res.at(-1).c.length} opciones`);
    i++;
  }
  await fs.writeFile("out/cand/candidatas.json", JSON.stringify(res, null, 1));
}

async function final() {
  const elec = JSON.parse(await fs.readFile("tools/fotos-eleccion.json", "utf8"));
  await fs.mkdir("img/recetas", { recursive: true });
  const out = {};
  const names = Object.keys(elec);
  for (let k = 0; k < names.length; k += 20) {
    const part = names.slice(k, k + 20);
    const infos = await filesInfo(part.map((n) => elec[n]), 560);
    const by = new Map(infos.map((x) => [x.file.replace(/_/g, " "), x]));
    for (const n of part) {
      const x = by.get(elec[n].replace(/_/g, " "));
      if (!x) { console.log(`Sin foto: ${n} (${elec[n]})`); continue; }
      const file = `img/recetas/${slug(n)}.jpg`;
      const r = await fetch(x.thumb, { headers: { "User-Agent": UA } });
      if (!r.ok) { console.log(`Descarga fallida: ${n}`); continue; }
      await fs.writeFile(file, Buffer.from(await r.arrayBuffer()));
      out[n] = { img: file, autor: x.autor.slice(0, 80), licencia: x.lic, fuente: x.pagina };
      await wait(200);
    }
  }
  await fs.writeFile("data/recetas-fotos.json", JSON.stringify(out, null, 1));
  console.log(`${Object.keys(out).length} fotos guardadas`);
}

const modo = process.argv[2];
await (modo === "final" ? final() : candidatas());
