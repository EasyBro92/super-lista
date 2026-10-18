// Códigos de barras de las tarjetas de cliente, dibujados aquí mismo (funciona sin cobertura en la caja).
const C128 = ("212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 "
  + "223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 "
  + "132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 "
  + "331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 "
  + "241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 "
  + "131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112").split(" ");

// Code 128: números en parejas (C) cuando son todo cifras pares; si no, letras (B).
export function code128(text) {
  const vals = [];
  if (/^(\d\d)+$/.test(text)) { vals.push(105); for (let i = 0; i < text.length; i += 2) vals.push(+text.slice(i, i + 2)); }
  else { vals.push(104); for (const ch of text) { const c = ch.charCodeAt(0) - 32; if (c < 0 || c > 94) return null; vals.push(c); } }
  vals.push(vals.reduce((s, v, i) => s + v * (i || 1), 0) % 103, 106);
  return vals.map((v) => C128[v]).join("");
}
const EL = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EG = EL.map((p) => [...p].map((b) => (b === "0" ? "1" : "0")).reverse().join(""));
const ER = EL.map((p) => [...p].map((b) => (b === "0" ? "1" : "0")).join(""));
const PAR = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
export const eanOk = (t) => /^\d{13}$/.test(t) && (10 - ([...t.slice(0, 12)].reduce((s, d, i) => s + +d * (i % 2 ? 3 : 1), 0) % 10)) % 10 === +t[12];
// EAN-13 como módulos «1/0».
export function ean13(t) {
  if (!eanOk(t)) return null;
  const par = PAR[+t[0]];
  let bits = "101";
  for (let i = 1; i < 7; i++) bits += (par[i - 1] === "L" ? EL : EG)[+t[i]];
  bits += "01010";
  for (let i = 7; i < 13; i++) bits += ER[+t[i]];
  return bits + "101";
}
// Anchos de Code 128 → módulos «1/0».
const widthsToBits = (w) => [...w].map((n, i) => (i % 2 ? "0" : "1").repeat(+n)).join("");
export function barcodeSVG(text, fmt) {
  const bits = fmt === "ean13" ? ean13(text) : (() => { const w = code128(text); return w && widthsToBits(w); })();
  if (!bits) return "";
  const q = 10, W = bits.length + q * 2;
  let x = q, rects = "";
  for (const run of bits.match(/1+|0+/g)) { if (run[0] === "1") rects += `<rect x="${x}" y="0" width="${run.length}" height="60"/>`; x += run.length; }
  return `<svg class="bc" viewBox="0 0 ${W} 60" preserveAspectRatio="none" role="img" aria-label="Código de barras ${text}"><rect width="${W}" height="60" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
export const bestFormat = (t) => (eanOk(t) ? "ean13" : "code128");
