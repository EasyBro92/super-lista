// Pasar tus datos o una lista a otro móvil sin archivos: un código de 6 letras (con enlace y QR) que sirve 24 horas,
// o, con cuenta, mandárselo a una persona por su nombre en la app (le llega a su buzón).
// Todo pasa por las funciones «env_…» de supabase/envios.sql. El archivo .json de la copia de seguridad sigue igual.
import { supaCfg, rpc } from "./sync.js";
import { meNow, comCall, openCuenta } from "./comunidad.js";

let A; // funciones de la app
let inbox = []; // lo que te han mandado a tu cuenta
const $ = (id) => document.getElementById(id);
export const sendReady = () => !!supaCfg();

const pretty = (c) => `${c.slice(0, 3)} ${c.slice(3)}`;
const clean = (c) => String(c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const linkOf = (c) => `${location.origin}${location.pathname}#recoger=${c}`;
// Con cuenta, se llama con tu sesión (para poder recoger lo que te mandan y saber quién envía).
async function R(fn, args) {
  if (meNow()) return comCall(fn, args); // sus errores ya vienen explicados
  try { return await rpc(fn, args); }
  catch (e) {
    if (e?.limit) throw e; // límites del servidor, con su mensaje
    throw new Error(e instanceof TypeError ? "Sin conexión. Prueba otra vez cuando tengas internet."
      : /: 404$/.test(e?.message ?? "") ? "Esta parte aún no está activada. Prueba más adelante." : "Algo ha fallado. Prueba otra vez en un momento.");
  }
}

// ---------- Lo que se envía ----------
const MAX = 3900000;
async function payload(kind) {
  if (kind === "lista") {
    const l = A.list();
    return { note: "", datos: { name: l.name, store: l.store, items: l.items.map(({ t, ...i }) => i) } };
  }
  const d = await A.backupData();
  if (JSON.stringify(d).length <= MAX) return { note: "", datos: d };
  // Muchas fotos tuyas: se envía todo lo demás y se avisa.
  return { note: "Tus fotos ocupan demasiado para enviarlas así: van todos tus datos menos las fotos. Para pasarlas también, usa «Guardar en un archivo».", datos: { ...d, fotos: {} } };
}
const what = (kind) => (kind === "lista" ? `la lista «${A.list().name}»` : "todos tus datos");

// ---------- Hoja «Enviar» ----------
export function sendHTML(kind) {
  if (!sendReady()) return "";
  const me = meNow();
  return `<div class="env" data-kind="${kind}">
    <div class="env-box"><p><b>📲 Con un código</b><br>Crea un código y escríbelo en el otro móvil, o mándale el enlace por WhatsApp. Sirve 24 horas.</p>
      <div id="envOut"><button class="btn" type="button" id="envMake">Crear código</button></div></div>
    <div class="env-box"><p><b>👤 A una persona de la app</b><br>${me?.nombre ? `Escribe su nombre en la app y le llega a su buzón al momento. Para pasártelo a ti mismo, escribe el tuyo (<b>${A.esc(me.nombre)}</b>) y entra con tu cuenta en el otro móvil.` : "Si los dos tenéis cuenta, se lo mandas escribiendo su nombre y le llega solo, sin códigos."}</p>
      ${me?.nombre ? `<form class="env-row" id="envTo"><input id="envName" maxlength="30" placeholder="Su nombre en la app" autocomplete="off" aria-label="Nombre de la persona"><button class="btn" type="submit">Enviar</button></form>`
        : `<button class="btn ghost" type="button" id="envLogin">Entrar o crear cuenta</button>`}
      <p class="bk-msg" id="envToMsg" role="status" hidden></p></div>
  </div>`;
}
export function pickupHTML() {
  if (!sendReady()) return "";
  return `<div class="env-box"><p><b>🔑 ¿Te han dado un código?</b></p>
    <form class="env-row" id="envGet"><input id="envCode" maxlength="9" placeholder="ABC 123" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Código"><button class="btn" type="submit">Recoger</button></form>
    <p class="bk-msg warn" id="envGetMsg" role="status" hidden></p></div>`;
}
export function bindSend(back) {
  const box = document.querySelector(".env");
  const get = $("envGet");
  if (get) get.onsubmit = async (e) => {
    e.preventDefault();
    const c = clean($("envCode").value), m = $("envGetMsg");
    if (c.length !== 6) { m.hidden = false; m.textContent = "El código tiene 6 letras y números."; return; }
    m.hidden = true; await pickup(c, back, (msg) => { m.hidden = false; m.textContent = msg; });
  };
  if (!box) return;
  const kind = box.dataset.kind;
  $("envMake").onclick = async () => {
    const b = $("envMake"); b.disabled = true; b.textContent = "Creando código…";
    try {
      const p = await payload(kind);
      const code = await R("env_crear", { p_tipo: kind, p_datos: p.datos });
      A.buzz?.(20); showCode(code, kind, p.note);
    } catch (e) { b.disabled = false; b.textContent = "Crear código"; A.setStatus(e.message, true); $("envOut").insertAdjacentHTML("beforeend", `<p class="bk-msg warn">${A.esc(e.message)}</p>`); }
  };
  const login = $("envLogin"); if (login) login.onclick = () => openCuenta({ back: null });
  const to = $("envTo");
  if (to) to.onsubmit = async (e) => {
    e.preventDefault();
    const name = $("envName").value.trim(), m = $("envToMsg"), btn = to.querySelector("button");
    if (!name) return $("envName").focus();
    btn.disabled = true; m.hidden = false; m.classList.remove("warn"); m.textContent = "Enviando…";
    try {
      const p = await payload(kind);
      const who = await R("env_enviar", { p_nombre: name, p_tipo: kind, p_datos: p.datos });
      A.buzz?.(20); $("envName").value = "";
      m.textContent = `Enviado a ${who}: le aparecerá ${kind === "lista" ? `la lista «${A.list().name}»` : "tu copia"} al abrir la app.${p.note ? ` ${p.note}` : ""}`;
    } catch (err) { m.classList.add("warn"); m.textContent = err.message; }
    btn.disabled = false;
  };
}
function showCode(code, kind, note) {
  const url = linkOf(code);
  $("envOut").innerHTML = `<div class="env-code" aria-label="Código ${code.split("").join(" ")}">${pretty(code)}</div>
    <div class="env-qr" id="envQr" aria-hidden="true"></div>
    <p class="fine">En el otro móvil: abre Super Lista y escribe el código en «¿Te han dado un código?», o escanea el QR con la cámara.</p>
    ${note ? `<p class="bk-msg warn">${A.esc(note)}</p>` : ""}
    <div class="bk-row"><button class="btn" type="button" id="envShare">Enviar por WhatsApp…</button><button class="btn ghost" type="button" id="envCopy">Copiar</button></div>`;
  qr(url).then((svg) => { if (svg && $("envQr")) $("envQr").innerHTML = svg; });
  const text = `Para pasar ${kind === "lista" ? `mi lista «${A.list().name}»` : "mis datos"} de Super Lista: abre este enlace o escribe el código ${pretty(code)} en la app (sirve 24 horas).`;
  $("envShare").onclick = async () => {
    try { if (navigator.share) { await navigator.share({ title: "Super Lista", text, url }); return; } }
    catch (e) { if (e?.name === "AbortError") return; }
    location.href = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  };
  $("envCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(`${text} ${url}`); $("envCopy").textContent = "¡Copiado!"; }
    catch { prompt("Copia esto y envíalo:", `${text} ${url}`); }
  };
}
// QR con qrcode-generator (js/qrcode.js, licencia MIT), cargado solo cuando hace falta.
let qrLib = null;
function qr(text) {
  qrLib ??= new Promise((ok) => {
    if (window.qrcode) return ok(window.qrcode);
    const s = document.createElement("script"); s.src = "js/qrcode.js";
    s.onload = () => ok(window.qrcode); s.onerror = () => { qrLib = null; ok(null); };
    document.head.append(s);
  });
  return qrLib.then((q) => {
    if (!q) return "";
    const g = q(0, "M"); g.addData(text); g.make();
    return g.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }).catch(() => "");
}

// ---------- Recoger ----------
async function pickup(code, back, fail, fromInbox = false) {
  let r;
  try { r = await R("env_recoger", { p_codigo: code }); }
  catch (e) { return fail(e.message); }
  if (!r) return fail(fromInbox ? "Ya no está disponible." : "No encuentro ese código. Revisa las letras o pide uno nuevo (duran 24 horas).");
  const d = r.datos ?? {}, de = r.de ? ` de ${A.esc(r.de)}` : "";
  const when = new Date(r.creado).toLocaleString("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const done = () => { if (fromInbox) R("env_borrar", { p_codigo: code }).catch(() => {}); };
  // Lo que te mandan otros se añade a tus listas, marcado como compartido; las tuyas no se tocan.
  const tag = (l0) => ({ id: A.uid(), name: String(l0?.name || "Lista").slice(0, 60), store: l0?.store || A.list().store,
    items: (l0?.items ?? []).filter((i) => i && i.label).map(({ t, ...i }) => ({ ...i, id: A.uid() })),
    from: r.de ? String(r.de).slice(0, 30) : "", got: Date.now() });
  const added = (ls) => {
    const n = ls.reduce((s, l) => s + l.items.length, 0);
    A.st.lists.push(...ls); A.st.current = ls[0].id; A.save(); done(); refreshInbox();
    A.closeSheet(); A.showList();
    A.setStatus(ls.length === 1 ? `Lista «${ls[0].name}» añadida como compartida, con ${n} producto${n === 1 ? "" : "s"}. Tus listas siguen igual.`
      : `${ls.length} listas añadidas como compartidas. Tus listas siguen igual.`);
  };
  if (r.tipo === "lista") {
    const n = (d.items ?? []).length;
    A.openSheet("Te han enviado una lista", `<div class="bk-ask"><b>¿Añadir la lista «${A.esc(d.name || "Lista")}»${de}?</b>
      <span>Tiene ${n} producto${n === 1 ? "" : "s"}. Se añade a tus listas como compartida; las tuyas no cambian.</span>
      <div class="bk-row"><button class="btn" type="button" id="envYes">Sí, añadirla</button><button class="btn ghost" type="button" id="envNo">Ahora no</button></div></div>`);
    $("envNo").onclick = () => (back ? back() : A.closeSheet());
    $("envYes").onclick = () => added([tag(d)]);
    return;
  }
  const s2 = d.state;
  if (d.app !== "superlista" || !Array.isArray(s2?.lists) || !s2.lists.length) return fail("Eso no es una copia de Super Lista.");
  // Una copia entera: lo normal es quedarse solo con sus listas. Cambiar todo el móvil es solo para pasar tus propios datos.
  const lists = s2.lists.filter((l) => (l?.items ?? []).some((i) => i?.label));
  const mine = !!r.de && r.de === meNow()?.nombre;
  const nl = lists.length, nh = (s2.history ?? []).length, nr = (s2.myR ?? []).length;
  A.openSheet(mine ? "Pasar tus datos" : "Te han enviado sus datos", `<div class="bk-ask"><b>${mine ? `Tus datos del ${A.esc(when)}` : `Datos${de} del ${A.esc(when)}`}</b>
    <span>Tiene ${s2.lists.length} lista${s2.lists.length === 1 ? "" : "s"}, ${nh} compra${nh === 1 ? "" : "s"} y ${nr} receta${nr === 1 ? "" : "s"} propia${nr === 1 ? "" : "s"}.</span>
    ${nl ? `<div class="bk-row"><button class="btn${mine ? " ghost" : ""}" type="button" id="envAdd">Añadir sus listas a las mías</button></div>
    <span class="fine">Se añade${nl === 1 ? " 1 lista" : `n ${nl} listas`} como compartida${nl === 1 ? "" : "s"}. Tus listas, compras y recetas no cambian.</span>` : ""}
    <div class="bk-row"><button class="btn${mine || !nl ? "" : " ghost"}" type="button" id="envYes">Cambiar todo lo de este móvil</button></div>
    <span class="fine">Solo si estás pasando tus propios datos a otro móvil: <b>borra lo que hay ahora aquí</b> y pone lo de la copia.</span>
    <div class="bk-row"><button class="btn ghost" type="button" id="envNo">Cancelar</button></div>
    <p class="bk-msg warn" id="envErr" hidden></p></div>`);
  $("envNo").onclick = () => (back ? back() : A.closeSheet());
  const add = $("envAdd"); if (add) add.onclick = () => added(lists.map(tag));
  $("envYes").onclick = async () => {
    const y = $("envYes");
    if (y.dataset.sure !== "1") { y.dataset.sure = "1"; y.textContent = "Toca otra vez: se borra lo de este móvil"; y.classList.add("danger"); return; }
    y.disabled = true;
    if (fromInbox) await R("env_borrar", { p_codigo: code }).catch(() => {}); // antes de volver a abrir la app
    const err = await A.restore(d);
    if (err) { $("envErr").hidden = false; $("envErr").textContent = err; }
  };
}

// ---------- Buzón (con cuenta) ----------
export const inboxNow = () => inbox;
export async function refreshInbox() {
  if (!sendReady() || !meNow()?.nombre) { inbox = []; A?.inboxChanged(); return; }
  try { inbox = (await comCall("env_buzon", {})) ?? []; } catch { return; }
  A.inboxChanged();
}
export function openInbox() {
  if (!inbox.length) return A.setStatus("No tienes nada nuevo.");
  A.openSheet("Te han enviado", `<ul class="env-inbox">${inbox.map((e) => `<li><span><b>${e.tipo === "lista" ? `🛒 ${A.esc(e.nombre || "Una lista")}` : "📦 Todos sus datos"}</b>
      <small>De ${A.esc(e.de)} · ${new Date(e.creado).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}${e.tipo === "lista" ? ` · ${e.n} producto${e.n === 1 ? "" : "s"}` : ""}</small></span>
      <button class="btn small" type="button" data-open="${A.esc(e.codigo)}">Ver</button><button class="btn ghost small" type="button" data-drop="${A.esc(e.codigo)}" aria-label="Quitar">✕</button></li>`).join("")}</ul>
    <p class="bk-msg warn" id="envGetMsg" hidden></p>`);
  $("sheetBody").querySelector(".env-inbox").onclick = async (ev) => {
    const o = ev.target.closest("[data-open]"), x = ev.target.closest("[data-drop]");
    if (o) pickup(o.dataset.open, openInbox, (msg) => { const m = $("envGetMsg"); if (m) { m.hidden = false; m.textContent = msg; } }, true);
    if (x) { x.disabled = true; await R("env_borrar", { p_codigo: x.dataset.drop }).catch(() => {}); inbox = inbox.filter((e) => e.codigo !== x.dataset.drop); A.inboxChanged(); inbox.length ? openInbox() : A.closeSheet(); }
  };
}

export function initEnviar(api) {
  A = api;
  const fromHash = () => {
    const m = location.hash.match(/recoger=([A-Za-z0-9]{6})\b/);
    if (!m) return;
    history.replaceState(null, "", location.pathname + location.search);
    if (!sendReady()) return A.setStatus("Esta parte aún no está activada en esta app.", true);
    pickup(clean(m[1]), null, (msg) => A.setStatus(msg, true));
  };
  fromHash();
  addEventListener("hashchange", fromHash);
  if (!sendReady()) return;
  addEventListener("superlista:cuenta", refreshInbox);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshInbox(); });
  refreshInbox();
}
