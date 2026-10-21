// Rellena data/precios/ con los precios de los catálogos guardados en el historial de git (una vez).
import { execSync } from "node:child_process";
import { addHistory } from "../scripts/historial.mjs";
import { writeJSON } from "../scripts/lib.mjs";

const sh = (c) => execSync(c, { maxBuffer: 1 << 30 }).toString();
for (const s of ["mercadona", "dia", "alcampo", "consum"]) {
  const commits = sh(`git log --reverse --format="%H %cs" -- data/stores/${s}.json`).trim().split("\n").map((l) => l.split(" "));
  const hist = {};
  let prev = null, cambios = 0;
  for (const [h, day] of commits) {
    let items;
    try { items = JSON.parse(sh(`git show ${h}:data/stores/${s}.json`)); } catch { continue; }
    if (!items.some((p) => p.p != null)) continue;
    if (!prev) { hist.desde = day; prev = items; continue; }
    cambios += addHistory(hist, prev, items, day);
    prev = items;
  }
  await writeJSON(`data/precios/${s}.json`, hist);
  console.log(`${s}: desde ${hist.desde}, ${Object.keys(hist.h ?? {}).length} productos con cambios (${cambios} cambios)`);
}
