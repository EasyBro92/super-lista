// Cuentas y comunidad con Supabase: entrar con correo y contraseña, recetas de la gente, estrellas, comentarios con foto,
// una charla para todos, denuncias y un apartado para moderar. Solo aparece si js/config.js tiene la URL y la clave pública.
// Todo pasa por las funciones «com_…» de supabase/comunidad.sql, que comprueban permisos y límites en el servidor.
import { supaCfg, SDK } from "./sync.js";
import { openShared, comView, showRecipesList, newRecipe, readPhoto, saveCopy } from "./cocina.js";

let A; // funciones de la app
let client = null, starting = null;
let me = null; // null: sin cuenta | { id, email, nombre, moderador, bloqueado }
const ME = "superlista.cuenta"; // lo último que se supo de tu cuenta, para no esperar a la red al abrir
const cm = { tab: "recetas", orden: "nuevas", q: "", rows: [], more: false, from: null, chat: [], chatMore: false, timer: null };

export const comReady = () => !!supaCfg();
try { if (comReady()) me = JSON.parse(localStorage.getItem(ME) || "null"); } catch {}
export const meNow = () => me;

// ---------- Conexión ----------
async function sb() {
  if (client) return client;
  const c = supaCfg();
  const { createClient } = await import(SDK);
  if (client) return client;
  client = createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "superlista.sesion" } });
  client.auth.onAuthStateChange((ev) => {
    // Dentro de este aviso no se puede llamar a Supabase: se hace justo después.
    if (ev === "PASSWORD_RECOVERY") setTimeout(newPassword, 0);
    if (ev === "SIGNED_OUT") setMe(null);
  });
  return client;
}
function start() {
  starting ??= sb().then(refreshMe).catch(() => me);
  return starting;
}
function setMe(m) {
  me = m;
  try { if (m) localStorage.setItem(ME, JSON.stringify(m)); else localStorage.removeItem(ME); } catch {}
  dispatchEvent(new Event("superlista:cuenta")); // la pantalla de inicio cambia el saludo
}
async function refreshMe() {
  const c = await sb();
  const { data } = await c.auth.getSession();
  const s = data?.session;
  if (!s) { setMe(null); return null; }
  const md = s.user.user_metadata ?? {};
  acct.wanted ??= String(md.full_name ?? md.name ?? "").trim().slice(0, 30) || undefined; // nombre que da Google o Apple
  try { setMe({ ...(await call("com_yo")), email: s.user.email }); }
  catch { me ??= { id: s.user.id, email: s.user.email, nombre: null }; } // sin conexión: lo último que se sabía
  return me;
}
class ComError extends Error {}
const OFFLINE = "Sin conexión. Prueba otra vez cuando tengas internet.";
async function call(fn, args = {}) {
  const c = await sb();
  let res;
  try { res = await c.rpc(fn, args); } catch { throw new ComError(OFFLINE); }
  if (res.error) {
    const e = res.error;
    throw new ComError(e.code === "P0001" ? e.message : /fetch|network|load failed/i.test(e.message ?? "") || navigator.onLine === false ? OFFLINE : "Algo ha fallado. Prueba otra vez en un momento.");
  }
  return res.data;
}
const AUTH_ERR = {
  invalid_credentials: "El correo o la contraseña no son correctos.",
  user_already_exists: "Ya hay una cuenta con ese correo. Toca «Entrar».",
  email_exists: "Ya hay una cuenta con ese correo. Toca «Entrar».",
  weak_password: "La contraseña es muy fácil. Usa al menos 6 letras o números.",
  email_address_invalid: "Ese correo no parece válido.",
  validation_failed: "Revisa el correo y la contraseña.",
  email_not_confirmed: "Aún no has confirmado el correo. Abre el mensaje que te enviamos y toca el enlace.",
  over_email_send_rate_limit: "Se han enviado muchos correos. Espera unos minutos y prueba otra vez.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos.",
  signup_disabled: "Ahora mismo no se pueden crear cuentas nuevas.",
  same_password: "Esa ya es tu contraseña.",
};
const authMsg = (e) => AUTH_ERR[e?.code] ?? (/fetch|network/i.test(e?.message ?? "") ? OFFLINE : e?.message || "Algo ha fallado. Prueba otra vez.");

export function initComunidad(api) {
  A = api;
  if (!comReady()) return;
  // Volviendo del correo de «nueva contraseña», de Google o Apple, o si ya habías entrado: se conecta al abrir.
  const back = /access_token=|type=recovery|error_description=/.test(location.hash);
  if (me || back) start().then(() => afterOAuth(back));
}
// Al volver de Google o Apple: si es la primera vez, a elegir nombre; si no, un saludo.
const OAUTH = "superlista.oauth";
function afterOAuth(back) {
  let from = null;
  try { from = localStorage.getItem(OAUTH); localStorage.removeItem(OAUTH); } catch {}
  if (!back || !from) return;
  if (!me) return A.setStatus("No se ha podido entrar. Prueba otra vez.", true);
  if (!me.nombre) return openCuenta({ back: null, then: () => openComunidad({ from: null }) });
  A.setStatus(`¡Hola, ${me.nombre}!`);
}
// Qué formas de entrar están activadas en Supabase (Google, Apple…). Los botones solo salen si lo están.
let provs = null;
function providers() {
  const c = supaCfg();
  provs ??= fetch(`${c.url.replace(/\/+$/, "")}/auth/v1/settings`, { headers: { apikey: c.key } })
    .then((r) => (r.ok ? r.json() : {})).then((x) => x.external ?? {}).catch(() => { provs = null; return {}; });
  return provs;
}
const PROV = [
  ["google", "Seguir con Google", `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6H1.4a12 12 0 0 0 0 10.9l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>`],
  ["apple", "Seguir con Apple", `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8a4.6 4.6 0 0 0-3.6-2c-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.9a4.9 4.9 0 0 0-4.1 2.5c-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.6s1.7-.8 3.3-.8 2 .8 3.3.8 2.2-1.3 3-2.5a10 10 0 0 0 1.4-2.8 4.3 4.3 0 0 1-2.7-4.1zM13.9 5.2A4.4 4.4 0 0 0 15 2a4.5 4.5 0 0 0-2.9 1.5 4.2 4.2 0 0 0-1.1 3.1 3.7 3.7 0 0 0 2.9-1.4z"/></svg>`],
];
async function paintProviders() {
  const el = $("aoauth"); if (!el) return;
  const on = await providers();
  const list = PROV.filter(([k]) => on[k]);
  if (!list.length || !el.isConnected) return;
  el.hidden = false;
  el.innerHTML = list.map(([k, t, svg]) => `<button type="button" class="btn oauth-btn oauth-${k}" data-prov="${k}">${svg}<span>${t}</span></button>`).join("")
    + `<p class="oauth-or"><span>o con tu correo</span></p>`;
  el.onclick = async (e) => {
    const b = e.target.closest("[data-prov]"); if (!b) return;
    b.disabled = true;
    try { localStorage.setItem(OAUTH, b.dataset.prov); } catch {}
    const { error } = await (await sb()).auth.signInWithOAuth({ provider: b.dataset.prov, options: { redirectTo: location.origin + location.pathname } })
      .catch(() => ({ error: { message: OFFLINE } }));
    if (error) { b.disabled = false; errBox($("aerr"), new ComError(authMsg(error))); }
  };
}

// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => A.esc(s);
const fotoURL = (p) => (p ? `${supaCfg().url.replace(/\/+$/, "")}/storage/v1/object/public/fotos/${p.split("/").map(encodeURIComponent).join("/")}` : "");
const hue = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const avatar = (n) => `<span class="avatar" style="--h:${hue(n)}" aria-hidden="true">${esc(String(n || "?").trim().charAt(0).toUpperCase())}</span>`;
function ago(t) {
  const s = (Date.now() - new Date(t)) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) { const d = Math.floor(s / 86400); return d === 1 ? "ayer" : `hace ${d} días`; }
  return new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
const num = (x) => String(x).replace(".", ",");
const starsTxt = (m) => { const n = Math.min(5, Math.max(0, Math.round(m))); return "★".repeat(n) + "☆".repeat(5 - n); };
async function shrink(file) {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return null;
  const w = Math.min(1080, img.width), h = Math.round(img.height * (w / img.width));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  return new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.78));
}
async function upload(blob) {
  const c = await sb();
  const path = `${me.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await c.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new ComError(/fetch|network/i.test(error.message ?? "") ? OFFLINE : "No he podido subir la foto. Prueba con otra más pequeña.");
  return path;
}
async function dropFoto(p) { if (p) try { await (await sb()).storage.from("fotos").remove([p]); } catch {} }
// Botones que piden un segundo toque antes de hacer algo que no se puede deshacer.
function sure(b, txt) {
  if (b.dataset.sure === "1") return true;
  b.dataset.sure = "1"; b.dataset.was = b.textContent; b.textContent = txt;
  setTimeout(() => { if (b.isConnected && b.dataset.sure === "1") { b.dataset.sure = ""; b.textContent = b.dataset.was; } }, 4000);
  return false;
}
// La hoja de abajo: título, botón de atrás y qué hace «atrás».
function sheetFor(title, back) {
  if (!A.sheet.open) A.openSheet(title, "", "browsing cooking");
  A.sheet.className = "sheet browsing cooking";
  A.setTitle(title, !!back);
  comView(back);
}
const needLogin = () => !me?.nombre;
function errBox(el, e) { if (!el) return A.setStatus(e.message, true); if ($("aok")) $("aok").hidden = true; el.hidden = false; el.textContent = e instanceof ComError ? e.message : "Algo ha fallado. Prueba otra vez."; }

// ---------- Tu cuenta ----------
let acct = { back: null, then: null, mode: "entrar" };
// back: qué hace «atrás»; then: qué hacer al terminar de entrar (por defecto, volver).
export async function openCuenta(opt = {}) {
  acct = { back: opt.back ?? null, then: opt.then ?? opt.back ?? null, mode: opt.mode ?? acct.mode ?? "entrar", wanted: acct.wanted };
  sheetFor("Tu cuenta", acct.back);
  A.body().innerHTML = `<p class="note">Un momento…</p>`;
  await start();
  paintCuenta();
}
function paintCuenta(note = "") {
  const B = A.body();
  if (!me) {
    const crear = acct.mode === "crear";
    B.innerHTML = `<div class="plan acct">
      <div class="acct-hero"><span aria-hidden="true">👋</span><p>Con una cuenta puedes <b>valorar recetas</b>, <b>comentar</b>, subir fotos y <b>compartir tus recetas</b> con la comunidad. Tu lista sigue funcionando igual sin cuenta.</p></div>
      <div class="oauth" id="aoauth" hidden></div>
      <div class="seg" id="amode" role="group" aria-label="Entrar o crear cuenta">
        <button type="button" data-m="entrar" aria-pressed="${!crear}">Entrar</button><button type="button" data-m="crear" aria-pressed="${crear}">Crear cuenta</button></div>
      <form id="aform" class="acct-form" novalidate>
        ${crear ? `<label class="field">Tu nombre en la comunidad<input id="aname" maxlength="30" autocomplete="nickname" placeholder="Por ejemplo: Isi cocina"></label>` : ""}
        <label class="field">Correo<input id="amail" type="email" autocomplete="email" inputmode="email" autocapitalize="off" placeholder="tu@correo.com"></label>
        <label class="field">Contraseña<input id="apass" type="password" autocomplete="${crear ? "new-password" : "current-password"}" placeholder="${crear ? "Mínimo 6 letras o números" : ""}"></label>
        <p class="note warn" id="aerr" hidden></p><p class="note ok" id="aok"${note ? "" : " hidden"}>${esc(note)}</p>
        <button class="btn" type="submit" id="ago">${crear ? "Crear mi cuenta" : "Entrar"}</button>
        ${crear ? `<p class="fine">Al crear la cuenta aceptas las normas de la comunidad: respeto, nada de publicidad y solo fotos de comida. Lo que no las cumpla se borra.</p>`
          : `<button type="button" class="lnk" id="aforgot">He olvidado la contraseña</button>`}
      </form></div>`;
    $("amode").onclick = (e) => { const b = e.target.closest("[data-m]"); if (b) { acct.mode = b.dataset.m; paintCuenta(); } };
    $("aform").onsubmit = (e) => { e.preventDefault(); crear ? doSignUp() : doSignIn(); };
    if ($("aforgot")) $("aforgot").onclick = doForgot;
    paintProviders();
    return;
  }
  if (!me.nombre) {
    B.innerHTML = `<div class="plan acct">
      <div class="acct-hero"><span aria-hidden="true">🙂</span><p>Elige el nombre con el que te verán los demás. Puedes cambiarlo cuando quieras.</p></div>
      <form id="nform" class="acct-form"><label class="field">Tu nombre en la comunidad<input id="aname" maxlength="30" autocomplete="nickname" value="${esc(acct.wanted ?? "")}"></label>
      <p class="note warn" id="aerr" hidden></p><button class="btn" type="submit">Seguir</button></form>
      <button type="button" class="lnk" id="aout">Salir de la cuenta</button></div>`;
    $("nform").onsubmit = async (e) => {
      e.preventDefault();
      try { setMe({ ...(await call("com_perfil", { p_nombre: $("aname").value })), email: me.email }); done(); }
      catch (err) { errBox($("aerr"), err); }
    };
    $("aout").onclick = doSignOut;
    return;
  }
  B.innerHTML = `<div class="plan acct">
    <div class="acct-me">${avatar(me.nombre)}<div><b>${esc(me.nombre)}</b><small>${esc(me.email ?? "")}</small></div>${me.moderador ? `<span class="badge">🛡️ Moderador</span>` : ""}</div>
    ${me.bloqueado ? `<p class="note warn">Tu cuenta está bloqueada por no cumplir las normas: puedes leer, pero no publicar.</p>` : ""}
    <p class="note ok" id="aok"${note ? "" : " hidden"}>${esc(note)}</p>
    <form id="nform" class="acct-form"><label class="field">Tu nombre en la comunidad<input id="aname" maxlength="30" value="${esc(me.nombre)}"></label>
      <p class="note warn" id="aerr" hidden></p><button class="btn ghost small" type="submit">Guardar nombre</button></form>
    <button type="button" class="pantry-btn set-link" id="acom"><span><b>👥 Ir a la comunidad</b><small>Recetas de la gente y la charla</small></span><span class="lnk">›</span></button>
    <h3 class="cgroup">Normas de la comunidad</h3>
    <ul class="rules"><li>Trata bien a los demás: nada de insultos ni burlas.</li><li>Solo fotos de comida y recetas. Nada de publicidad.</li>
      <li>Si ves algo que no cumple las normas, toca «Denunciar». Con 3 denuncias se oculta solo.</li></ul>
    <div class="row acct-end"><button type="button" class="btn ghost small" id="aout">Salir de la cuenta</button>
      <button type="button" class="btn danger small" id="adel">Borrar mi cuenta</button></div></div>`;
  $("nform").onsubmit = async (e) => {
    e.preventDefault();
    try { setMe({ ...(await call("com_perfil", { p_nombre: $("aname").value })), email: me.email }); A.buzz(); paintCuenta("Nombre guardado."); }
    catch (err) { errBox($("aerr"), err); }
  };
  $("acom").onclick = () => openComunidad({ from: null });
  $("aout").onclick = doSignOut;
  $("adel").onclick = (e) => { if (sure(e.currentTarget, "Toca otra vez: se borra todo lo que has publicado")) doDelete(); };
}
function busy(on) { const b = $("ago"); if (b) { b.disabled = on; b.classList.toggle("loading", on); } }
async function doSignIn() {
  const email = $("amail").value.trim(), password = $("apass").value;
  if (!email || !password) return errBox($("aerr"), new ComError("Escribe tu correo y tu contraseña."));
  busy(true);
  try {
    const { error } = await (await sb()).auth.signInWithPassword({ email, password });
    if (error) throw new ComError(authMsg(error));
    await refreshMe();
    if (!me?.nombre) return paintCuenta();
    done();
  } catch (e) { errBox($("aerr"), e instanceof ComError ? e : new ComError(OFFLINE)); busy(false); }
}
async function doSignUp() {
  const nombre = $("aname").value.trim(), email = $("amail").value.trim(), password = $("apass").value;
  if (nombre.length < 2) return errBox($("aerr"), new ComError("Escribe tu nombre (mínimo 2 letras)."));
  if (!email.includes("@")) return errBox($("aerr"), new ComError("Escribe tu correo."));
  if (password.length < 6) return errBox($("aerr"), new ComError("La contraseña debe tener al menos 6 letras o números."));
  busy(true);
  acct.wanted = nombre;
  try {
    const c = await sb();
    const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw new ComError(authMsg(error));
    // Si Supabase pide confirmar el correo, aún no hay sesión.
    if (!data.session) { acct.mode = "entrar"; paintCuenta(`Te he enviado un correo a ${email}. Ábrelo, toca el enlace y después entra aquí con tu contraseña.`); return; }
    await refreshMe();
    try { setMe({ ...(await call("com_perfil", { p_nombre: nombre })), email }); }
    catch (e) { paintCuenta(); errBox($("aerr"), e); return; }
    done(true);
  } catch (e) { errBox($("aerr"), e instanceof ComError ? e : new ComError(OFFLINE)); busy(false); }
}
async function doForgot() {
  const email = $("amail").value.trim();
  if (!email.includes("@")) { errBox($("aerr"), new ComError("Escribe arriba tu correo y vuelve a tocar «He olvidado la contraseña».")); $("amail").focus(); return; }
  try {
    const { error } = await (await sb()).auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new ComError(authMsg(error));
    $("aerr").hidden = true; $("aok").hidden = false;
    $("aok").textContent = `Te he enviado un correo a ${email} para poner una contraseña nueva.`;
  } catch (e) { errBox($("aerr"), e); }
}
// Al abrir el enlace del correo de «nueva contraseña».
function newPassword() {
  sheetFor("Contraseña nueva", null);
  A.body().innerHTML = `<div class="plan acct"><form id="pform" class="acct-form">
    <label class="field">Escribe tu contraseña nueva<input id="apass" type="password" autocomplete="new-password" placeholder="Mínimo 6 letras o números"></label>
    <p class="note warn" id="aerr" hidden></p><button class="btn" type="submit">Guardar contraseña</button></form></div>`;
  $("pform").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await (await sb()).auth.updateUser({ password: $("apass").value }).catch(() => ({ error: { message: OFFLINE } }));
    if (error) return errBox($("aerr"), new ComError(authMsg(error)));
    await refreshMe(); acct = { back: null, then: null, mode: "entrar" }; paintCuenta("Contraseña cambiada.");
  };
}
async function doSignOut() {
  try { await (await sb()).auth.signOut({ scope: "local" }); } catch {}
  setMe(null); acct.mode = "entrar"; paintCuenta("Has salido de tu cuenta.");
}
async function doDelete() {
  try {
    const c = await sb();
    // Primero tus fotos (el servidor no puede borrarlas por ti), luego la cuenta con todo lo publicado.
    const { data } = await c.storage.from("fotos").list(me.id, { limit: 1000 });
    if (data?.length) await c.storage.from("fotos").remove(data.map((f) => `${me.id}/${f.name}`));
    await call("com_borrar_cuenta");
    for (const r of A.st.myR ?? []) { delete r.com; delete r.comFoto; delete r.comFotoK; }
    A.save();
    await c.auth.signOut({ scope: "local" }).catch(() => {});
    setMe(null); acct.mode = "entrar"; paintCuenta("Tu cuenta y todo lo que publicaste se han borrado.");
  } catch (e) { A.setStatus(e instanceof ComError ? e.message : OFFLINE, true); }
}
function done(nuevo = false) {
  A.buzz(20);
  A.setStatus(nuevo ? `¡Bienvenido a la comunidad, ${me.nombre}!` : `¡Hola, ${me.nombre}!`);
  if (acct.then) acct.then(); else paintCuenta();
}
// Si no tienes cuenta, te lleva a entrar y luego vuelve a donde estabas.
function withMe(back, then = back) {
  if (!needLogin()) return true;
  openCuenta({ back, then, mode: me ? "entrar" : "crear" });
  return false;
}

// ---------- Comunidad: recetas, charla y revisar ----------
export async function openComunidad(opt = {}) {
  if ("from" in opt) cm.from = opt.from;
  if (opt.tab) cm.tab = opt.tab;
  sheetFor("Comunidad", cm.from === "recipes" ? showRecipesList : null);
  const mod = me?.moderador;
  if (cm.tab === "revisar" && !mod) cm.tab = "recetas";
  const tabs = [["recetas", "🍲 Recetas"], ["charla", "💬 Charla"], ...(mod ? [["revisar", "🛡️ Revisar"]] : [])];
  A.body().innerHTML = `
    <div class="com-top"><div class="seg" id="ctabs" role="group" aria-label="Comunidad" style="grid-template-columns:repeat(${tabs.length},1fr)">
      ${tabs.map(([k, t]) => `<button type="button" data-t="${k}" aria-pressed="${cm.tab === k}">${t}</button>`).join("")}</div>
      <button type="button" class="me-chip" id="cme">${me?.nombre ? `${avatar(me.nombre)}<span>${esc(me.nombre)}</span>` : `<span aria-hidden="true">👤</span><span>Entrar</span>`}</button></div>
    <div id="cpane" class="com-pane"></div>`;
  $("ctabs").onclick = (e) => { const b = e.target.closest("[data-t]"); if (b && b.dataset.t !== cm.tab) { cm.tab = b.dataset.t; A.buzz(); openComunidad(); } };
  $("cme").onclick = () => openCuenta({ back: () => openComunidad() });
  clearInterval(cm.timer); cm.timer = null;
  start().then(() => { if (mod !== me?.moderador && $("ctabs")) openComunidad(); });
  if (cm.tab === "charla") return paneChat();
  if (cm.tab === "revisar") return paneReview();
  paneRecipes();
}

function recipeCard(x) {
  const d = x.datos ?? {}, img = fotoURL(x.foto);
  const nota = x.votos ? `★ ${num(x.media)} (${x.votos})` : "Sin votos aún";
  return `<div class="rcw"><button type="button" class="rc" data-cid="${esc(x.id)}">
    <span class="re" style="--h:${hue(d.n)}${img ? `;background-image:url('${esc(img)}')` : ""}">${img ? "" : esc(d.e ?? "🍲")}</span>
    <span class="ri"><span class="rn">${esc(d.n)}</span><span class="rm">de ${esc(x.autor)} · ${esc(d.t ?? "?")} min</span>
    <span class="rh com-meta"><span class="cstars">${nota}</span>${x.comentarios ? ` · 💬 ${x.comentarios}` : ""}${x.oculto ? ` · <b class="hid">Oculta</b>` : ""}</span></span></button></div>`;
}
async function paneRecipes(more = false) {
  const P = $("cpane");
  if (!more) {
    P.innerHTML = `<div class="seg" id="corden" role="group" aria-label="Orden">
        <button type="button" data-o="nuevas" aria-pressed="${cm.orden === "nuevas"}">Nuevas</button><button type="button" data-o="mejores" aria-pressed="${cm.orden === "mejores"}">Mejor valoradas</button></div>
      <div class="srow"><label class="vh" for="ccq">Buscar en la comunidad</label><input id="ccq" class="bsearch" type="search" placeholder="Busca en las recetas de la gente…" value="${esc(cm.q)}" enterkeyhint="search" autocomplete="off">
        <button type="button" class="round" id="cshare" title="Compartir una receta tuya" aria-label="Compartir una receta tuya"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button></div>
      <div class="clist" id="crows"><p class="note">Cargando recetas de la comunidad…</p></div>`;
    $("corden").onclick = (e) => { const b = e.target.closest("[data-o]"); if (b && b.dataset.o !== cm.orden) { cm.orden = b.dataset.o; A.buzz(); paneRecipes(); } };
    let t; $("ccq").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { cm.q = e.target.value.trim(); paneRecipes(); }, 300); };
    $("cshare").onclick = () => sharePicker();
    $("crows").onclick = (e) => {
      const b = e.target.closest("[data-cid]");
      if (b) return openRow(cm.rows.find((x) => x.id === b.dataset.cid));
      if (e.target.closest("#cmore")) paneRecipes(true);
      if (e.target.closest("[data-share]")) sharePicker();
    };
  }
  try {
    const got = await call("com_recetas", { p_orden: cm.orden, p_desde: more ? cm.rows.length : 0, p_buscar: cm.q });
    cm.rows = more ? [...cm.rows, ...got] : got; cm.more = got.length === 30;
  } catch (e) {
    if (!more && $("crows")) $("crows").innerHTML = `<p class="note warn">${esc(e.message)}</p>`;
    return;
  }
  const L = $("crows"); if (!L) return;
  L.innerHTML = cm.rows.length ? cm.rows.map(recipeCard).join("") + (cm.more ? `<button type="button" class="btn ghost" id="cmore" style="grid-column:1/-1">Ver más</button>` : "")
    : `<div class="empty"><span class="empty-art" aria-hidden="true">👩‍🍳</span><b>${cm.q ? "No hay recetas con eso" : "Aún no hay recetas de la gente"}</b>
      <span>${cm.q ? "Prueba con otra palabra." : "Comparte tu receta favorita y deja que los demás la valoren."}</span>
      <button class="btn" type="button" data-share>Compartir una receta</button></div>`;
}
async function openRow(x) {
  if (!x) return;
  await openShared({ ...x, fotoURL: fotoURL(x.foto) }, () => openComunidad());
}
// Abre una receta de la comunidad por su id (desde tu receta ya compartida).
async function openById(id, back) {
  try { const x = await call("com_receta", { p_id: id }); if (x) return openShared({ ...x, fotoURL: fotoURL(x.foto) }, back); A.setStatus("Esa receta ya no está en la comunidad.", true); }
  catch (e) { A.setStatus(e.message, true); }
}

// Elegir cuál de tus recetas compartir.
function sharePicker() {
  if (!withMe(() => openComunidad(), sharePicker)) return;
  sheetFor("Compartir una receta", () => openComunidad());
  const mine = A.st.myR ?? [];
  A.body().innerHTML = `<div class="plan">
    <p class="note">Elige una de tus recetas. Saldrá en la comunidad con tu nombre y la foto que le pusiste.</p>
    ${mine.length ? mine.map((m) => `<button type="button" class="pantry-btn set-link" data-uid="${esc(m.uid)}"><span><b>${esc(m.e ?? "🍲")} ${esc(m.n)}</b>
      <small>${m.com ? "Ya compartida · toca para verla" : `${m.i.length} ingredientes · ${m.t} min`}</small></span><span class="lnk">${m.com ? "Ver ›" : "Compartir"}</span></button>`).join("")
    : `<div class="empty"><span class="empty-art" aria-hidden="true">📝</span><b>Aún no tienes recetas tuyas</b><span>Escríbela o pega una de internet y luego la compartes.</span></div>`}
    <button class="btn ghost" type="button" id="snew">✏️ Escribir una receta nueva</button></div>`;
  A.body().querySelector(".plan").onclick = async (e) => {
    const b = e.target.closest("[data-uid]"); if (!b) return;
    const m = mine.find((x) => x.uid === b.dataset.uid); if (!m) return;
    if (m.com) return openById(m.com, sharePicker);
    b.disabled = true; b.querySelector(".lnk").textContent = "Subiendo…";
    try { const id = await publishMine(m); A.buzz(20); A.setStatus(`👥 Compartida en la comunidad: ${m.n}.`); openById(id, () => openComunidad({ tab: "recetas" })); }
    catch (err) { b.disabled = false; b.querySelector(".lnk").textContent = "Compartir"; A.setStatus(err.message, true); }
  };
  $("snew").onclick = () => newRecipe();
}
// Sube (o actualiza) una de tus recetas. Devuelve su id en la comunidad.
async function publishMine(m) {
  let foto = m.comFoto ?? null;
  const local = readPhoto(m.uid);
  const k = local ? `${local.length}:${local.slice(-40)}` : "";
  if (!local) foto = null;
  else if (local.startsWith("data:") && k !== m.comFotoK) {
    const blob = await (await fetch(local)).blob();
    const old = foto;
    foto = await upload(blob);
    if (old) dropFoto(old);
    m.comFotoK = k;
  } else if (!local.startsWith("data:")) foto = null; // foto de otra persona (receta guardada de la comunidad): no se vuelve a publicar
  const datos = { n: m.n, e: m.e, t: m.t, r: m.r, d: m.d, m: m.m, i: m.i, p: m.p, tags: (m.tags ?? []).filter((t) => t !== "Mis recetas") };
  let id;
  try { id = await call("com_publicar", { p_datos: datos, p_foto: foto, p_id: m.com ?? null }); }
  catch (e) {
    if (!m.com) throw e;
    id = await call("com_publicar", { p_datos: datos, p_foto: foto, p_id: null }); // la habían borrado: se publica de nuevo
  }
  m.com = id; m.comFoto = foto; A.save();
  return id;
}

// ---------- Opiniones dentro de una receta ----------
// el: hueco al final de la receta; r: la receta; back: volver a pintar la receta.
export async function mountSocial(el, r, back) {
  if (!comReady() || !el) return;
  if (r.mine) return mineBlock(el, r, back);
  const key = r.com ? `c:${r.com.id}` : `r:${r.n}`;
  el.innerHTML = `<h3 class="cgroup">Opiniones</h3><p class="note">Cargando opiniones…</p>`;
  await start();
  let nota, cmts;
  try { [nota, cmts] = await Promise.all([call("com_notas", { p_recetas: [key] }).then((x) => x?.[key] ?? {}), call("com_comentarios", { p_hilo: key })]); }
  catch (e) { if (el.isConnected) el.innerHTML = `<h3 class="cgroup">Opiniones</h3><p class="note">${esc(e.message)}</p>`; return; }
  if (!el.isConnected) return;
  const mia = r.com?.mia;
  const canMod = me?.moderador;
  el.innerHTML = `
    ${r.com ? `<div class="com-by">${avatar(r.com.autor)}<span>Receta de <b>${esc(r.com.autor)}</b> · ${esc(ago(r.com.creado))}</span></div>
      <div class="row"><button type="button" class="btn ghost small" id="xsave">📥 Guardar en mis recetas</button>
      ${mia || canMod ? `<button type="button" class="btn danger small" id="xdelr">Quitar de la comunidad</button>` : ""}
      ${!mia ? `<button type="button" class="lnk muted" id="xrepr">Denunciar receta</button>` : ""}</div>` : ""}
    <h3 class="cgroup">Opiniones</h3>
    <div class="rate">
      <div class="rate-avg">${nota.v ? `<b>${num(nota.m)}</b><span class="stars" aria-label="${num(nota.m)} de 5 estrellas">${starsTxt(+nota.m)}</span><small>${nota.v} ${nota.v === 1 ? "voto" : "votos"}</small>`
        : `<span class="stars dim">☆☆☆☆☆</span><small>Aún sin votos. ¡Sé el primero!</small>`}</div>
      ${mia ? "" : `<div class="rate-mine"><span>Tu nota</span><div class="stars-in" id="xstars" role="radiogroup" aria-label="Tu nota">${[1, 2, 3, 4, 5].map((s) =>
        `<button type="button" role="radio" data-s="${s}" aria-checked="${nota.mia === s}" aria-label="${s} ${s === 1 ? "estrella" : "estrellas"}" class="${(nota.mia ?? 0) >= s ? "on" : ""}">★</button>`).join("")}</div></div>`}
    </div>
    ${needLogin() ? `<button type="button" class="btn ghost" id="xlogin">Entra para valorar y comentar</button>`
      : me.bloqueado ? "" : composer("xf", "¿La has hecho? Cuenta qué tal te salió…")}
    <div class="cmts" id="xcmts">${cmts.length ? cmts.map((c) => commentHTML(c)).join("") : `<p class="note">Nadie ha comentado todavía.</p>`}</div>
    ${cmts.length === 40 ? `<button type="button" class="lnk" id="xolder">Ver comentarios anteriores</button>` : ""}`;
  const redo = () => back();
  if ($("xlogin")) $("xlogin").onclick = () => openCuenta({ back: redo, mode: "crear" });
  if ($("xstars")) $("xstars").onclick = async (e) => {
    const b = e.target.closest("[data-s]"); if (!b) return;
    if (!withMe(redo)) return;
    const s = +b.dataset.s === nota.mia ? 0 : +b.dataset.s; // tocar tu misma nota la quita
    A.buzz(15);
    for (const x of $("xstars").children) x.classList.toggle("on", +x.dataset.s <= s);
    try { await call("com_valorar", { p_receta: key, p_estrellas: s }); mountSocial(el, r, back); A.setStatus(s ? `Has puesto ${s} ${s === 1 ? "estrella" : "estrellas"} a ${r.n}.` : "Nota quitada."); }
    catch (err) { A.setStatus(err.message, true); mountSocial(el, r, back); }
  };
  wireComposer("xf", key, () => mountSocial(el, r, back));
  $("xcmts").onclick = (e) => onAction(e, () => mountSocial(el, r, back));
  if ($("xolder")) $("xolder").onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      const old = await call("com_comentarios", { p_hilo: key, p_antes: cmts.at(-1).creado });
      cmts.push(...old); $("xcmts").insertAdjacentHTML("beforeend", old.map((c) => commentHTML(c)).join(""));
      if (old.length < 40) e.currentTarget.remove(); else e.currentTarget.disabled = false;
    } catch (err) { A.setStatus(err.message, true); }
  };
  if ($("xsave")) $("xsave").onclick = (e) => {
    if (!saveCopy(r)) return A.setStatus("Ya la tienes en «Mis recetas».");
    A.buzz(20);
    e.currentTarget.textContent = "✓ Guardada en «Mis recetas»"; e.currentTarget.disabled = true;
    A.setStatus(`📥 Guardada en tus recetas: ${r.n}.`);
  };
  if ($("xdelr")) $("xdelr").onclick = async (e) => {
    if (!sure(e.currentTarget, "Toca otra vez para quitarla")) return;
    try {
      const res = await call("com_borrar", { p_tipo: "receta", p_id: r.com.id });
      if (res?.foto) dropFoto(res.foto);
      for (const m of A.st.myR ?? []) if (m.com === r.com.id) { delete m.com; delete m.comFoto; delete m.comFotoK; }
      A.save(); A.setStatus(`Quitada de la comunidad: ${r.n}.`); openComunidad({ tab: "recetas" });
    } catch (err) { A.setStatus(err.message, true); }
  };
  if ($("xrepr")) $("xrepr").onclick = async (e) => {
    if (!withMe(redo)) return;
    if (!sure(e.currentTarget, "¿Seguro? Toca otra vez para denunciarla")) return;
    try { await call("com_denunciar", { p_tipo: "receta", p_id: r.com.id, p_motivo: "receta" }); e.currentTarget.textContent = "Denunciada. Gracias por avisar."; e.currentTarget.disabled = true; }
    catch (err) { A.setStatus(err.message, true); }
  };
}
// Tus recetas: compartirlas o ver cómo va la que ya compartiste.
function mineBlock(el, r, back) {
  const m = (A.st.myR ?? []).find((x) => x.uid === r.uid); if (!m) return;
  el.innerHTML = `<div class="share com-share">${m.com
    ? `<p><b>👥 Compartida en la comunidad.</b> Los demás pueden verla, valorarla y comentarla.</p>
       <div class="row"><button type="button" class="btn ghost small" id="xsee">Ver opiniones</button><button type="button" class="btn ghost small" id="xup">Actualizar con mis cambios</button></div>`
    : `<p>👥 ¿Te sale buenísima? Compártela con la comunidad para que otros la prueben y la valoren.</p>
       <div class="row"><button type="button" class="btn ghost small" id="xpub">Compartir en la comunidad</button></div>`}</div>`;
  const pub = async (b, msg) => {
    if (!withMe(back)) return;
    b.disabled = true; const t = b.textContent; b.textContent = "Subiendo…";
    try { const id = await publishMine(m); A.buzz(20); A.setStatus(msg); if (!t.startsWith("Actualizar")) openById(id, back); else { b.textContent = "✓ Actualizada"; } }
    catch (err) { b.disabled = false; b.textContent = t; A.setStatus(err.message, true); }
  };
  if ($("xpub")) $("xpub").onclick = (e) => pub(e.currentTarget, `👥 Compartida en la comunidad: ${m.n}.`);
  if ($("xup")) $("xup").onclick = (e) => pub(e.currentTarget, `Actualizada en la comunidad: ${m.n}.`);
  if ($("xsee")) $("xsee").onclick = () => { start().then(() => openById(m.com, back)); };
}

// ---------- Comentarios (en recetas y en la charla) ----------
function commentHTML(c, chat = false) {
  const img = fotoURL(c.foto), canMod = me?.moderador;
  const acts = [
    c.mio || canMod ? `<button type="button" class="lnk" data-act="del" data-id="${esc(c.id)}">Borrar</button>` : "",
    !c.mio ? `<button type="button" class="lnk muted" data-act="rep" data-id="${esc(c.id)}">Denunciar</button>` : "",
    canMod && !c.mio ? `<button type="button" class="lnk muted" data-act="${c.oculto ? "show" : "hide"}" data-id="${esc(c.id)}">${c.oculto ? "Mostrar" : "Ocultar"}</button>` : "",
  ].join("");
  return `<article class="cmt${c.mio ? " mine" : ""}${chat ? " chat-msg" : ""}${c.oculto ? " is-hidden" : ""}" data-cmt="${esc(c.id)}">
    ${chat && c.mio ? "" : avatar(c.autor)}
    <div class="cmt-b"><p class="cmt-h"><b>${esc(c.mio ? "Tú" : c.autor)}</b><small>${esc(ago(c.creado))}${c.oculto ? " · oculto" : ""}</small></p>
      ${c.texto ? `<p class="cmt-t">${esc(c.texto)}</p>` : ""}
      ${img ? `<a class="cmt-img" href="${esc(img)}" target="_blank" rel="noopener"><img src="${esc(img)}" alt="Foto de ${esc(c.autor)}" loading="lazy"></a>` : ""}
      <p class="cmt-acts">${acts}</p></div></article>`;
}
async function onAction(e, redraw) {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const id = b.dataset.id, act = b.dataset.act;
  try {
    if (act === "del") {
      if (!sure(b, "¿Borrar? Toca otra vez")) return;
      const res = await call("com_borrar", { p_tipo: "comentario", p_id: id });
      if (res?.foto) dropFoto(res.foto);
      b.closest(".cmt")?.remove();
      return;
    }
    if (act === "rep") {
      if (!withMe(redraw)) return;
      if (!sure(b, "¿Denunciar? Toca otra vez")) return;
      await call("com_denunciar", { p_tipo: "comentario", p_id: id, p_motivo: "comentario" });
      b.textContent = "Denunciado. Gracias."; b.disabled = true;
      return;
    }
    if (act === "hide" || act === "show") { await call("com_moderar", { p_tipo: "comentario", p_id: id, p_accion: act === "hide" ? "ocultar" : "mostrar" }); redraw(); }
  } catch (err) { A.setStatus(err.message, true); }
}
function composer(id, ph) {
  return `<form class="cbox" id="${id}" autocomplete="off">
    <label class="vh" for="${id}t">Tu comentario</label><textarea id="${id}t" rows="2" maxlength="1000" placeholder="${esc(ph)}"></textarea>
    <div class="cbox-pv" id="${id}pv" hidden></div>
    <div class="cbox-row"><label class="btn ghost small cbox-photo">📷 Foto<input type="file" accept="image/*" id="${id}f" hidden></label>
      <p class="note warn" id="${id}e" hidden></p><button type="submit" class="btn small" id="${id}s">Publicar</button></div></form>`;
}
function wireComposer(id, hilo, after) {
  const f = $(id); if (!f) return;
  let blob = null;
  $(`${id}f`).onchange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    blob = await shrink(file);
    const pv = $(`${id}pv`);
    if (!blob) { pv.hidden = true; return; }
    pv.hidden = false;
    pv.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="Tu foto"><button type="button" class="round" aria-label="Quitar foto">✕</button>`;
    pv.querySelector("button").onclick = () => { blob = null; pv.hidden = true; pv.innerHTML = ""; $(`${id}f`).value = ""; };
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const t = $(`${id}t`).value.trim();
    if (!t && !blob) return;
    const s = $(`${id}s`); s.disabled = true; s.textContent = "Enviando…"; $(`${id}e`).hidden = true;
    let path = null;
    try {
      if (blob) path = await upload(blob);
      const c = await call("com_comentar", { p_hilo: hilo, p_texto: t, p_foto: path });
      A.buzz(15); ping(hilo);
      after(c);
    } catch (err) {
      if (path) dropFoto(path);
      errBox($(`${id}e`), err); s.disabled = false; s.textContent = "Publicar";
    }
  };
}

// ---------- Charla ----------
let chan = null, chanHilo = null;
async function listen(hilo, fn) {
  try {
    const c = await sb();
    if (chan) { c.removeChannel(chan); chan = null; }
    chanHilo = hilo;
    chan = c.channel(`com-${hilo}`, { config: { broadcast: { self: false } } });
    chan.on("broadcast", { event: "nuevo" }, () => fn());
    chan.subscribe();
  } catch {}
}
function ping(hilo) { if (chan && chanHilo === hilo) chan.send({ type: "broadcast", event: "nuevo", payload: {} })?.catch?.(() => {}); }

async function paneChat() {
  const P = $("cpane");
  P.innerHTML = `<div class="chat" id="chat"><p class="note">Cargando la charla…</p></div>
    ${needLogin() ? `<button type="button" class="btn" id="chatin">Entra para escribir en la charla</button>`
      : me.bloqueado ? `<p class="note warn">Tu cuenta está bloqueada: puedes leer, pero no escribir.</p>` : composer("chf", "Escribe a la comunidad: dudas, trucos, ofertas…")}`;
  if ($("chatin")) $("chatin").onclick = () => openCuenta({ back: () => openComunidad({ tab: "charla" }), mode: "crear" });
  wireComposer("chf", "charla", (c) => { $("chft").value = ""; $("chfpv").hidden = true; $("chfpv").innerHTML = ""; $("chfs").disabled = false; $("chfs").textContent = "Publicar"; cm.chat.unshift(c); drawChat(true); });
  $("chat").onclick = (e) => {
    if (e.target.closest("#chold")) return olderChat();
    onAction(e, () => loadChat());
  };
  await loadChat(true);
  listen("charla", () => loadChat());
  // Por si el aviso en tiempo real no llega.
  cm.timer = setInterval(() => { if (!$("chat") || !A.sheet.open) { clearInterval(cm.timer); cm.timer = null; return; } if (document.visibilityState === "visible") loadChat(); }, 15000);
}
async function loadChat(first = false) {
  try {
    const got = await call("com_comentarios", { p_hilo: "charla" });
    const old = cm.chat.filter((c) => !got.some((g) => g.id === c.id) && got.length && c.creado < got.at(-1).creado);
    cm.chat = [...got, ...old];
    if (first) cm.chatMore = got.length === 40;
    drawChat(first);
  } catch (e) { if (first && $("chat")) $("chat").innerHTML = `<p class="note warn">${esc(e.message)}</p>`; }
}
async function olderChat() {
  try {
    const got = await call("com_comentarios", { p_hilo: "charla", p_antes: cm.chat.at(-1).creado });
    cm.chat.push(...got); cm.chatMore = got.length === 40;
    const ch = $("chat"), h = ch.scrollHeight - ch.scrollTop;
    drawChat(false); ch.scrollTop = ch.scrollHeight - h;
  } catch (e) { A.setStatus(e.message, true); }
}
function drawChat(toEnd) {
  const ch = $("chat"); if (!ch) return;
  const atEnd = ch.scrollHeight - ch.scrollTop - ch.clientHeight < 80;
  ch.innerHTML = cm.chat.length
    ? (cm.chatMore ? `<button type="button" class="lnk" id="chold">Ver mensajes anteriores</button>` : "") + [...cm.chat].reverse().map((c) => commentHTML(c, true)).join("")
    : `<div class="empty"><span class="empty-art" aria-hidden="true">💬</span><b>La charla está tranquila</b><span>Pregunta una duda, comparte un truco o avisa de una buena oferta.</span></div>`;
  if (toEnd || atEnd) ch.scrollTop = ch.scrollHeight;
}

// ---------- Revisar denuncias (moderadores) ----------
async function paneReview() {
  const P = $("cpane");
  P.innerHTML = `<div class="plan" id="rev"><p class="note">Cargando denuncias…</p></div>`;
  let rows;
  try { rows = await call("com_pendientes"); } catch (e) { $("rev").innerHTML = `<p class="note warn">${esc(e.message)}</p>`; return; }
  const R = $("rev"); if (!R) return;
  R.innerHTML = rows.length ? `<p class="note">Lo denunciado 3 veces ya está oculto. Decide qué hacer con cada cosa.</p>` + rows.map((x) => {
    const c = x.cosa, rec = x.tipo === "receta";
    return `<article class="rev-it" data-tipo="${x.tipo}" data-id="${esc(x.id)}">
      <p class="rev-h"><b>${rec ? "🍲 Receta" : "💬 Comentario"}</b> de ${esc(c.autor)} · ${x.denuncias} ${x.denuncias === 1 ? "denuncia" : "denuncias"}${c.oculto ? " · <b class='hid'>Oculto</b>" : ""}</p>
      <p class="rev-t">${rec ? esc(c.datos?.n) : esc(c.texto)}</p>
      ${c.foto ? `<img class="rev-img" src="${esc(fotoURL(c.foto))}" alt="" loading="lazy">` : ""}
      <div class="row"><button type="button" class="btn ghost small" data-m="mostrar">Está bien</button><button type="button" class="btn ghost small" data-m="ocultar">Ocultar</button>
        <button type="button" class="btn danger small" data-m="borrar">Borrar</button><button type="button" class="btn danger small" data-m="bloquear">Bloquear a ${esc(c.autor)}</button></div></article>`;
  }).join("") : `<div class="empty"><span class="empty-art" aria-hidden="true">✅</span><b>No hay nada que revisar</b><span>Cuando alguien denuncie algo, aparecerá aquí.</span></div>`;
  R.onclick = async (e) => {
    const b = e.target.closest("[data-m]"); if (!b) return;
    const it = b.closest(".rev-it"), m = b.dataset.m;
    if ((m === "borrar" || m === "bloquear") && !sure(b, "Toca otra vez")) return;
    try {
      if (m === "borrar") { const res = await call("com_borrar", { p_tipo: it.dataset.tipo, p_id: it.dataset.id }); if (res?.foto) dropFoto(res.foto); }
      else await call("com_moderar", { p_tipo: it.dataset.tipo, p_id: it.dataset.id, p_accion: m });
      A.buzz(); it.remove();
      if (!R.querySelector(".rev-it")) paneReview();
    } catch (err) { A.setStatus(err.message, true); }
  };
}
