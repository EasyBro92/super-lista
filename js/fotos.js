// Fotos de «Mis recetas». Van en IndexedDB, aparte de la lista, porque localStorage solo tiene unos 5 MB para todo:
// con muchas fotos se llenaba y la lista dejaba de guardarse. Si el navegador no tiene IndexedDB, se sigue usando localStorage.
const OLD = "superlista.misfotos"; // donde estaban antes
const DB = "superlista", STORE = "fotos";
let mem = {}; // uid -> foto (data:… o enlace), para leerlas sin esperar
let db = null; // null = sin IndexedDB

const req = (r) => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
function openDB() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error("blocked"));
    setTimeout(() => ko(new Error("timeout")), 4000); // algunos Safari se quedan colgados al abrirla
  });
}
// Hace los cambios en una sola vez; termina cuando están guardados de verdad.
function write(fn) {
  return new Promise((ok, ko) => {
    const t = db.transaction(STORE, "readwrite");
    fn(t.objectStore(STORE));
    t.oncomplete = () => ok(true);
    t.onerror = t.onabort = () => ko(t.error);
  });
}
const readOld = () => { try { return JSON.parse(localStorage.getItem(OLD) || "{}") ?? {}; } catch { return {}; } };
const writeOld = () => { try { localStorage.setItem(OLD, JSON.stringify(mem)); return true; } catch { return false; } };

// Carga las fotos al abrir la app y pasa las antiguas de localStorage a IndexedDB (solo la primera vez).
export const ready = (async () => {
  const old = readOld();
  try {
    if (!("indexedDB" in self)) throw new Error("sin IndexedDB");
    db = await openDB();
    const t = db.transaction(STORE, "readonly").objectStore(STORE);
    const [keys, vals] = await Promise.all([req(t.getAllKeys()), req(t.getAll())]);
    mem = Object.fromEntries(keys.map((k, n) => [k, vals[n]]));
    const moving = Object.entries(old).filter(([k]) => !(k in mem));
    if (moving.length) await write((s) => { for (const [k, v] of moving) s.put(v, k); });
    Object.assign(mem, Object.fromEntries(moving));
    // Solo se borran de localStorage cuando ya están a salvo en IndexedDB.
    if (Object.keys(old).length) try { localStorage.removeItem(OLD); } catch {}
  } catch {
    db = null; mem = old;
  }
})();

export const getFoto = (uid) => mem[uid] ?? null;
export const allFotos = () => ({ ...mem });

// Guarda (o quita, con url vacía) la foto de una receta. Devuelve false si no cabe en el móvil.
export async function setFoto(uid, url) {
  await ready;
  const before = mem[uid];
  if (url) mem[uid] = url; else delete mem[uid];
  try {
    if (!db) { if (!writeOld()) throw new Error("lleno"); return true; }
    await write((s) => (url ? s.put(url, uid) : s.delete(uid)));
    return true;
  } catch {
    if (before) mem[uid] = before; else delete mem[uid];
    return false;
  }
}

// Al recuperar una copia: cambia todas las fotos por las de la copia.
export async function replaceFotos(fotos) {
  await ready;
  const next = { ...(fotos ?? {}) };
  if (!db) {
    const prev = mem; mem = next;
    if (!writeOld()) { mem = prev; throw new Error("lleno"); }
    return;
  }
  await write((s) => { s.clear(); for (const [k, v] of Object.entries(next)) s.put(v, k); });
  mem = next;
}
