// Historial de precios: data/precios/<tienda>.json = { desde: día en que empezó a apuntarse, h: { "nombre|formato": [[día, precio], …] } }.
// Solo se guardan los productos que han cambiado de precio alguna vez; el resto cuesta lo mismo desde «desde».
export const keyOf = (p) => `${p.n}|${p.f ?? ""}`;

// Añade al historial los cambios entre el catálogo anterior y el nuevo.
export function addHistory(hist, prevItems, items, day) {
  hist.desde ??= day;
  hist.h ??= {};
  // Si dos productos se llaman igual, vale el primero (como en la lista).
  const old = new Map();
  for (const p of prevItems) if (p.p != null && !old.has(keyOf(p))) old.set(keyOf(p), p.p);
  const done = new Set();
  let n = 0;
  for (const p of items) {
    if (p.p == null) continue;
    const k = keyOf(p);
    if (done.has(k)) continue;
    done.add(k);
    const o = old.get(k), h = hist.h[k];
    const last = h ? h[h.length - 1][1] : o;
    if (last == null || Math.abs(last - p.p) < 0.005) continue;
    if (!h) hist.h[k] = [[hist.desde, o]];
    // Dos cambios el mismo día: vale el último.
    const arr = hist.h[k];
    if (arr[arr.length - 1][0] === day) arr[arr.length - 1][1] = p.p; else arr.push([day, p.p]);
    n++;
  }
  // Se olvidan los productos que ya no están en el catálogo y los puntos de hace más de un año.
  const live = new Set(items.map(keyOf));
  const limit = new Date(Date.parse(day) - 366 * 864e5).toISOString().slice(0, 10);
  for (const k of Object.keys(hist.h)) {
    if (!live.has(k)) { delete hist.h[k]; continue; }
    const arr = hist.h[k];
    while (arr.length > 2 && arr[1][0] < limit) arr.shift();
  }
  return n;
}
