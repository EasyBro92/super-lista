// Gestos al estilo del iPhone: vibración suave, deslizar para borrar, arrastrar hojas y tirar para actualizar.

// ---------- Vibración suave ----------
// Android usa navigator.vibrate. El iPhone no lo tiene, pero Safari (iOS 18 o más) da un toque
// háptico al pulsar un interruptor <input switch>: se pulsa uno invisible.
let hapticEl = null;
export function haptic(ms = 12) {
  try {
    if (navigator.vibrate) { navigator.vibrate(ms); return; }
    if (!/iP(hone|ad|od)/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))) return;
    if (!hapticEl) {
      hapticEl = document.createElement("label");
      hapticEl.setAttribute("aria-hidden", "true");
      hapticEl.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9px;top:-9px";
      hapticEl.innerHTML = '<input type="checkbox" switch tabindex="-1">';
    }
    // Dentro de una hoja abierta, lo de fuera está bloqueado: el interruptor va con la hoja.
    const host = document.querySelector("dialog[open]") ?? document.body;
    if (hapticEl.parentNode !== host) host.append(hapticEl);
    hapticEl.click();
  } catch {}
}

// ---------- Deslizar a la izquierda para borrar ----------
// Marcado: <div class="sw" data-sw="…"><div class="sw-act"><button class="sw-del">Borrar</button></div><div class="sw-in">…</div></div>
// Un poco: se queda abierto el botón rojo. Hasta el fondo: se borra sin más.
const OPEN = 92;
export function swipeRows(root, onDelete) {
  let g = null, open = null;
  const close = (row, anim = true) => { if (!row) return; const i = row.querySelector(".sw-in"); i.style.transition = anim ? "" : "none"; i.style.transform = ""; row.classList.remove("open", "armed"); if (open === row) open = null; };
  const del = (row) => {
    haptic(20);
    row.classList.add("gone");
    row.querySelector(".sw-in").style.transform = "translateX(-110%)";
    const h = row.offsetHeight; row.style.height = `${h}px`;
    requestAnimationFrame(() => { row.style.height = "0px"; });
    setTimeout(() => onDelete(row.dataset.sw, row), 260);
  };
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".sw-del");
    if (b && root.contains(b)) { e.preventDefault(); e.stopPropagation(); return del(b.closest(".sw")); }
    if (open && !e.target.closest(".sw.open")) { close(open); e.stopPropagation(); e.preventDefault(); }
  }, true);
  root.addEventListener("touchstart", (e) => {
    const row = e.target.closest(".sw"); if (!row || e.touches.length > 1 || e.target.closest(".sw-del")) return;
    if (open && open !== row) close(open);
    const t = e.touches[0];
    g = { row, inn: row.querySelector(".sw-in"), x: t.clientX, y: t.clientY, base: row.classList.contains("open") ? -OPEN : 0, mode: null, dx: 0, w: row.offsetWidth, armed: false };
  }, { passive: true });
  root.addEventListener("touchmove", (e) => {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }
      if (Math.abs(dx) < 8) return;
      g.mode = "x"; g.inn.style.transition = "none";
    }
    e.preventDefault();
    let x = Math.min(0, g.base + dx);
    if (x > 0) x = 0;
    g.dx = x;
    g.inn.style.transform = `translateX(${x}px)`;
    const armed = -x > g.w * 0.55;
    if (armed !== g.armed) { g.armed = armed; g.row.classList.toggle("armed", armed); haptic(); }
  }, { passive: false });
  const end = () => {
    if (!g) return;
    const { row, inn, dx, mode, armed } = g; g = null;
    if (mode !== "x") return;
    inn.style.transition = "";
    if (armed) return del(row);
    if (-dx > OPEN / 2) { inn.style.transform = `translateX(${-OPEN}px)`; row.classList.add("open"); open = row; }
    else close(row);
  };
  root.addEventListener("touchend", end);
  root.addEventListener("touchcancel", end);
}

// ---------- Hojas: arrastrar hacia abajo para cerrar y desde el borde izquierdo para volver ----------
const scroller = (el, stop) => {
  for (; el && el !== stop.parentNode; el = el.parentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return el;
  }
  return null;
};
export function sheetGestures(sheet, { close, back }) {
  let g = null;
  const reset = () => { sheet.style.transition = ""; sheet.style.transform = ""; sheet.style.removeProperty("--dim"); };
  sheet.addEventListener("touchstart", (e) => {
    if (e.touches.length > 1 || e.target.closest("input, textarea, .sw, .hcards, .btabs, .mtypes, .moments, .favs, .gal, .pchart")) return;
    const t = e.touches[0], sc = scroller(e.target, sheet);
    g = { x: t.clientX, y: t.clientY, t: Date.now(), sc, top: !sc || sc.scrollTop <= 0, edge: t.clientX < 28, mode: null, d: 0 };
  }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (g.edge && dx > 0 && Math.abs(dx) > Math.abs(dy)) g.mode = "back";
      else if (g.top && dy > 0 && Math.abs(dy) > Math.abs(dx)) g.mode = "down";
      else { g = null; return; }
      sheet.style.transition = "none";
    }
    e.preventDefault();
    if (g.mode === "down") { g.d = Math.max(0, dy); sheet.style.transform = `translateY(${g.d}px)`; }
    else { g.d = Math.max(0, dx); sheet.style.transform = `translateX(${g.d * 0.6}px)`; }
  }, { passive: false });
  const end = () => {
    if (!g) return;
    const { mode, d, t } = g; g = null;
    if (!mode) return;
    const fast = d / Math.max(1, Date.now() - t) > 0.6;
    sheet.style.transition = "";
    if (mode === "down" && (d > 110 || (fast && d > 40))) {
      sheet.style.transform = "translateY(100%)";
      haptic();
      setTimeout(() => { close(); reset(); }, 200);
    } else if (mode === "back" && (d > 90 || (fast && d > 40))) {
      haptic(); reset(); back();
    } else reset();
  };
  sheet.addEventListener("touchend", end);
  sheet.addEventListener("touchcancel", end);
  // Con ratón: arrastrar desde la cabecera.
  let y0 = null, dy = 0;
  sheet.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.target.closest(".sheet-head, .grab")) { y0 = e.clientY; dy = 0; sheet.style.transition = "none"; } });
  sheet.addEventListener("pointermove", (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
  const mend = () => { if (y0 == null) return; y0 = null; sheet.style.transition = ""; if (dy > 80) { sheet.style.transform = "translateY(100%)"; setTimeout(() => { close(); reset(); }, 200); } else reset(); };
  sheet.addEventListener("pointerup", mend);
  sheet.addEventListener("pointercancel", mend);
}

// ---------- Tirar hacia abajo para actualizar (en Inicio y en la lista) ----------
export function pullToRefresh(onRefresh) {
  const pill = document.createElement("div");
  pill.className = "ptr"; pill.setAttribute("aria-hidden", "true");
  pill.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>';
  document.body.append(pill);
  let g = null, busy = false;
  const set = (d) => { pill.style.transform = `translate(-50%, ${Math.min(d, 90) - 50}px) rotate(${d * 3}deg)`; pill.style.opacity = Math.min(1, d / 60); };
  addEventListener("touchstart", (e) => {
    if (busy || scrollY > 0 || document.querySelector("dialog[open]") || e.target.closest(".dock, input, textarea, .sw, li.item, li.gt")) return;
    g = { y: e.touches[0].clientY, x: e.touches[0].clientX, d: 0, on: false, armed: false };
  }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (!g) return;
    const dy = e.touches[0].clientY - g.y, dx = e.touches[0].clientX - g.x;
    if (!g.on) { if (dy < 10 || Math.abs(dx) > dy) { if (Math.abs(dx) > 10 || dy < -5) g = null; return; } g.on = true; pill.style.transition = "none"; }
    g.d = dy * 0.5; set(g.d);
    const armed = g.d > 70;
    if (armed !== g.armed) { g.armed = armed; pill.classList.toggle("armed", armed); if (armed) haptic(); }
  }, { passive: true });
  addEventListener("touchend", async () => {
    if (!g) return;
    const { armed, on } = g; g = null;
    if (!on) return;
    pill.style.transition = "";
    if (!armed) { pill.style.transform = ""; pill.style.opacity = 0; return; }
    busy = true; pill.classList.add("spin"); set(70);
    try { await onRefresh(); } catch {}
    pill.classList.remove("spin", "armed"); pill.style.transform = ""; pill.style.opacity = 0; busy = false;
  });
}
