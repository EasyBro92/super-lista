// Listas compartidas en tiempo real con Supabase. Solo se activa si js/config.js tiene la URL y la clave pública.
// Cada producto lleva la hora de su último cambio («t») y lo borrado deja una marca en «gone»: al juntar dos copias gana lo más reciente.
import { SUPABASE } from "./config.js";

const SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.99.3/+esm";
let A; // { st, list, persist, render, setStatus, uid }
const cfg = () => {
  try { const o = JSON.parse(localStorage.getItem("superlista.supabase") || "null"); if (o?.url && o?.key) return o; } catch {}
  return SUPABASE?.url && SUPABASE?.key ? SUPABASE : null;
};
export const syncReady = () => !!cfg();

async function rpc(fn, args) {
  const c = cfg();
  const h = { apikey: c.key, "Content-Type": "application/json" };
  if (c.key.startsWith("eyJ")) h.Authorization = `Bearer ${c.key}`; // clave «anon» antigua
  const r = await fetch(`${c.url.replace(/\/+$/, "")}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn}: ${r.status}`);
  return r.json();
}

// ---------- Marcar qué ha cambiado (se llama en cada guardado) ----------
const strip = (it) => { const { t, ...o } = it; return JSON.stringify(o); };
const snaps = new Map(); // id de lista -> cómo estaba al último guardado
const snapOf = (l) => ({ items: new Map(l.items.map((i) => [i.id, strip(i)])), meta: JSON.stringify([l.name, l.store]) });
export function stamp() {
  if (!A) return;
  const now = Date.now();
  for (const l of A.st.lists) {
    if (!l.sid) continue;
    const prev = snaps.get(l.id);
    if (prev) {
      let ch = false;
      l.gone ??= {};
      for (const i of l.items) if (prev.items.get(i.id) !== strip(i)) { i.t = now; ch = true; }
      const ids = new Set(l.items.map((i) => i.id));
      for (const id of prev.items.keys()) if (!ids.has(id)) { l.gone[id] = now; ch = true; }
      if (JSON.stringify([l.name, l.store]) !== prev.meta) { l.mt = now; ch = true; }
      if (ch) { l.pend = true; later(l.id); }
    }
    snaps.set(l.id, snapOf(l));
  }
}

// ---------- Juntar dos copias ----------
const docOf = (l) => ({ name: l.name, store: l.store, mt: l.mt ?? 0, items: l.items, gone: l.gone ?? {} });
const sig = (d) => JSON.stringify([d.name, d.store, d.mt ?? 0, (d.items ?? []).map((i) => `${i.id}:${i.t ?? 0}`).sort(), Object.keys(d.gone ?? {}).sort()]);
function merge(l, d) {
  const gone = { ...(d.gone ?? {}) };
  for (const [k, v] of Object.entries(l.gone ?? {})) if (!(gone[k] >= v)) gone[k] = v;
  const cut = Date.now() - 30 * 864e5;
  for (const k of Object.keys(gone)) if (gone[k] < cut) delete gone[k];
  const mine = new Map(l.items.map((i) => [i.id, i])), out = [];
  const seen = new Set();
  for (const o of d.items ?? []) {
    seen.add(o.id);
    const i = mine.get(o.id);
    // Se conserva el mismo objeto para no romper lo que esté abierto en pantalla.
    const w = !i ? { ...o } : (o.t ?? 0) >= (i.t ?? 0) ? Object.assign(i, o) : i;
    if (!(gone[w.id] >= (w.t ?? 0))) out.push(w);
  }
  for (const i of l.items) if (!seen.has(i.id) && !(gone[i.id] >= (i.t ?? 0))) out.push(i);
  const m = (d.mt ?? 0) > (l.mt ?? 0) ? d : l;
  return { name: m.name ?? l.name, store: m.store ?? l.store, mt: Math.max(d.mt ?? 0, l.mt ?? 0), items: out, gone };
}
function apply(l, m) {
  Object.assign(l, { name: m.name, store: m.store, mt: m.mt, items: m.items, gone: m.gone });
  snaps.set(l.id, snapOf(l));
}

// ---------- Subir y bajar ----------
const waits = new Map(), busy = new Map();
function later(id, ms = 400) { clearTimeout(waits.get(id)); waits.set(id, setTimeout(() => push(id), ms)); }
async function push(id) {
  const l = A.st.lists.find((x) => x.id === id);
  if (!l?.sid || !cfg()) return;
  if (busy.get(id)) { busy.set(id, "again"); return; }
  busy.set(id, true);
  try {
    for (let k = 0; k < 6; k++) {
      const res = await rpc("guardar_lista", { p_id: l.sid, p_datos: docOf(l), p_rev: l.rev ?? 0 });
      if (res.ok) { l.rev = res.rev; l.pend = false; A.persist(); ping(l); break; }
      // Otro móvil guardó antes: se junta con lo suyo y se vuelve a intentar.
      apply(l, merge(l, res.datos ?? {})); l.rev = res.rev; A.persist(); A.render();
    }
    offline(false);
  } catch { offline(true); later(id, 15000); }
  finally { const again = busy.get(id) === "again"; busy.delete(id); if (again) push(id); }
}
async function pull(l) {
  if (!l?.sid || !cfg() || busy.get(l.id)) return;
  try {
    const res = await rpc("leer_lista", { p_id: l.sid });
    offline(false);
    if (!res) { l.rev = 0; return push(l.id); } // no está en el servidor: se vuelve a subir
    if (res.rev === l.rev && !l.pend) return;
    const before = sig(docOf(l)), m = merge(l, res.datos ?? {});
    const mine = sig(m) !== sig(res.datos ?? {}), changed = sig(m) !== before;
    apply(l, m); l.rev = res.rev; A.persist();
    if (changed) A.render();
    if (mine || l.pend) push(l.id);
  } catch { offline(true); }
}
let wasOff = false;
function offline(off) { if (off && !wasOff) A.setStatus("Sin conexión: los cambios de la lista compartida se enviarán al volver.", true); wasOff = off; }

// ---------- Tiempo real: un aviso por la lista abierta y los demás la vuelven a leer ----------
let client = null, chan = null, chanSid = null;
async function connect() {
  const l = A.list();
  if (chanSid === (l.sid ?? null)) return;
  leave();
  if (!cfg() || !l.sid) return;
  chanSid = l.sid;
  try {
    if (!client) {
      const { createClient } = await import(SDK);
      client ??= createClient(cfg().url, cfg().key, { auth: { persistSession: false, autoRefreshToken: false } });
    }
    if (chanSid !== l.sid || chan) return;
    chan = client.channel(`lista-${l.sid}`, { config: { broadcast: { self: false } } });
    chan.on("broadcast", { event: "cambio" }, () => pull(A.st.lists.find((x) => x.sid === l.sid)));
    chan.subscribe();
  } catch {}
}
function leave() { if (chan) { try { client?.removeChannel(chan); } catch {} } chan = null; chanSid = null; }
function ping(l) { if (chan && chanSid === l.sid) chan.send({ type: "broadcast", event: "cambio", payload: { at: Date.now() } }).catch?.(() => {}); }

// Al cambiar de lista o de pantalla.
let lastCur = null;
export function syncCurrent() {
  if (!A || !cfg()) return;
  const l = A.list();
  if (l.id === lastCur) return;
  lastCur = l.id;
  connect(); pull(l);
}

// ---------- Compartir, dejar de compartir y unirse ----------
export const shareURL = (l) => `${location.origin}${location.pathname}#unirse=${l.sid}`;
export async function share(l) {
  const now = Date.now();
  l.sid = crypto.randomUUID?.() ?? "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
  l.rev = 0; l.gone = {}; l.mt = now; l.pend = true;
  for (const i of l.items) i.t = now;
  snaps.set(l.id, snapOf(l));
  A.persist();
  await push(l.id);
  lastCur = null; syncCurrent();
  return !l.pend;
}
export function unshare(l) {
  for (const k of ["sid", "rev", "gone", "mt", "pend"]) delete l[k];
  for (const i of l.items) delete i.t;
  snaps.delete(l.id); leave(); lastCur = null;
  A.persist();
}
async function join(sid) {
  history.replaceState(null, "", location.pathname + location.search);
  if (!cfg()) return A.setStatus("Las listas compartidas aún no están activadas en esta app.", true);
  const have = A.st.lists.find((l) => l.sid === sid);
  if (have) { A.st.current = have.id; A.persist(); A.render(); return A.setStatus(`Ya estabas en la lista «${have.name}».`); }
  A.setStatus("Uniéndote a la lista…");
  try {
    const res = await rpc("leer_lista", { p_id: sid });
    if (!res) return A.setStatus("No encuentro esa lista compartida. Pide que te envíen el enlace otra vez.", true);
    const l = { id: A.uid(), name: "Compartida", store: "mercadona", items: [], sid, rev: 0, gone: {} };
    apply(l, merge(l, res.datos ?? {})); l.rev = res.rev;
    A.st.lists.push(l); A.st.current = l.id; A.persist(); A.render();
    A.setStatus(`Te has unido a «${l.name}». Lo que apunte cualquiera se ve al momento.`);
  } catch { A.setStatus("No he podido unirme a la lista. Revisa la conexión y abre el enlace otra vez.", true); }
}

export function initSync(api) {
  A = api;
  for (const l of A.st.lists) if (l.sid) snaps.set(l.id, snapOf(l));
  const fromHash = () => { const m = location.hash.match(/unirse=([0-9a-f-]{36})/i); if (m) join(m[1].toLowerCase()); };
  fromHash();
  addEventListener("hashchange", fromHash); // enlace abierto con la app ya abierta
  if (!cfg()) return;
  for (const l of A.st.lists) if (l.sid && l.pend) later(l.id, 1000);
  syncCurrent();
  const again = () => { if (document.visibilityState === "visible") { pull(A.list()); connect(); } };
  document.addEventListener("visibilitychange", again);
  addEventListener("online", again);
  // Por si el aviso en tiempo real no llega (red del súper, móvil en reposo…).
  setInterval(() => { if (document.visibilityState === "visible" && A.list().sid) pull(A.list()); }, 20000);
}
