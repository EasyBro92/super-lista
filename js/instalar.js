// Ofrecer instalar Super Lista como app: en Android y en el ordenador con el aviso del navegador (beforeinstallprompt),
// y en iPhone/iPad con los pasos de «Añadir a pantalla de inicio», porque Safari no tiene botón de instalar.
let deferred = null; // el aviso de instalar que guarda Chrome/Edge/Samsung hasta que lo pidamos
let onChange = () => {};
const LATER = "superlista.instalar"; // cuándo tocaste «Ahora no»
const LATER_DAYS = 7;

const ua = navigator.userAgent;
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
// Navegadores metidos dentro de otras apps (Instagram, Facebook, TikTok…): desde ahí no se puede instalar.
const inApp = /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat|GSA\//i.test(ua);
export const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const canInstall = () => !installed() && (!!deferred || isIOS);

addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; onChange(); });
addEventListener("appinstalled", () => { deferred = null; try { localStorage.removeItem(LATER); } catch {} onChange(); });

export function initInstalar(cb) { onChange = cb; }

// El aviso de la pantalla de inicio sale si se puede instalar y no has dicho «Ahora no» hace poco.
export function showBanner() {
  if (!canInstall()) return false;
  let t = 0; try { t = +localStorage.getItem(LATER) || 0; } catch {}
  return Date.now() - t > LATER_DAYS * 864e5;
}
export function later() { try { localStorage.setItem(LATER, String(Date.now())); } catch {} onChange(); }

// Toca «Instalar»: en Android sale la ventana del sistema; en iPhone, los pasos.
export async function install(openSheet) {
  if (deferred) {
    const e = deferred; deferred = null;
    e.prompt();
    const r = await e.userChoice.catch(() => null);
    if (r?.outcome !== "accepted") later();
    onChange();
    return;
  }
  openSheet("Instalar Super Lista", iosSteps());
}

const SHARE = `<svg class="ins-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Compartir"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`;
const ADD = `<svg class="ins-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-label="Añadir"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>`;
function iosSteps() {
  if (inApp) return `<div class="ins"><p class="ins-lead">Estás viendo Super Lista dentro de otra app. Para instalarla, ábrela primero en <b>Safari</b>:</p>
    <ol class="ins-steps"><li>Toca los <b>tres puntos</b> o el botón de <b>compartir</b> de esta app.</li><li>Elige <b>«Abrir en Safari»</b> (o «Abrir en el navegador»).</li><li>En Safari, toca <b>Instalar</b> otra vez y sigue los pasos.</li></ol></div>`;
  const ipad = /iPad/.test(ua) || navigator.platform === "MacIntel";
  return `<div class="ins"><p class="ins-lead">Así tendrás Super Lista en tu pantalla de inicio, como cualquier app: se abre a pantalla completa, funciona sin cobertura y Safari no borra tus listas aunque pases días sin abrirla.</p>
    <ol class="ins-steps">
      <li>Toca el botón <b>Compartir</b> ${SHARE} ${ipad || /CriOS|FxiOS|EdgiOS/.test(ua) ? "arriba a la derecha, junto a la dirección" : "abajo, en la barra de Safari"}.</li>
      <li>Baja un poco y toca <b>«Añadir a pantalla de inicio»</b> ${ADD}.</li>
      <li>Toca <b>«Añadir»</b> arriba a la derecha. ¡Listo!</li></ol>
    <p class="note">Si no ves «Añadir a pantalla de inicio», toca «Editar acciones» al final de la lista y actívalo.</p></div>`;
}
