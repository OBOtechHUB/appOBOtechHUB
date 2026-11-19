/**
 * Grafici e schemi della relazione tecnica, disegnati da zero (SVG) con i dati del progetto.
 * Nessuna figura della norma è riprodotta: sono rappresentazioni originali dei valori calcolati.
 * Logica pura: restituisce testo SVG (l'app lo converte in PNG per il file Word).
 */
import type { Conduttore, Asta, Corpo } from "@/calcoli/edificio/tipi";

const F = "font-family=\"Arial, Helvetica, sans-serif\"";
const ARANCIO = "#E5640F", BLU = "#2F5D8A", GRIGIO = "#8C8C8C", VERDE = "#2E7D32", ROSSO = "#C62828";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const n = (v: number, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toString();
const it = (v: number, d = 2) => v.toLocaleString("it-IT", { maximumFractionDigits: d });
const svg = (w: number, h: number, corpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#ffffff"/>${corpo}</svg>`;
const testo = (x: number, y: number, t: string, o: { size?: number; anchor?: "start" | "middle" | "end"; colore?: string; bold?: boolean; ruota?: number } = {}) =>
  `<text x="${n(x)}" y="${n(y)}" ${F} font-size="${o.size ?? 12}" text-anchor="${o.anchor ?? "start"}" fill="${o.colore ?? "#222"}"${o.bold ? ' font-weight="bold"' : ""}${o.ruota ? ` transform="rotate(${o.ruota} ${n(x)} ${n(y)})"` : ""}>${esc(t)}</text>`;
const apice = (e: number) => String(e).replace("-", "−");

export interface Serie { nome: string; colore?: string; valori: number[] }

/** Barre raggruppate su scala logaritmica, con linea della soglia (RT o FT). */
export function barreLog(o: { categorie: string[]; serie: Serie[]; soglia?: { valore: number; etichetta: string }; asseY: string; larghezza?: number; altezza?: number }): string {
  const W = o.larghezza ?? 900, H = o.altezza ?? 420, ml = 80, mr = 20, mt = 30, mb = 70;
  const tutti = [...o.serie.flatMap((s) => s.valori), o.soglia?.valore ?? 0].filter((v) => v > 0);
  const eMin = Math.floor(Math.log10(Math.min(...tutti, 1e-9))), eMax = Math.ceil(Math.log10(Math.max(...tutti, 1e-9)));
  const e0 = Math.max(eMin, eMax - 10), e1 = eMax === e0 ? e0 + 1 : eMax;
  const y = (v: number) => mt + (H - mt - mb) * (1 - (Math.log10(Math.max(v, 10 ** e0)) - e0) / (e1 - e0));
  const pw = W - ml - mr, gw = pw / o.categorie.length, bw = Math.min(36, (gw * 0.75) / o.serie.length);
  const colori = [GRIGIO, ARANCIO, BLU, VERDE];
  let c = "";
  for (let e = e0; e <= e1; e++) {
    const yy = y(10 ** e);
    c += `<line x1="${ml}" y1="${n(yy)}" x2="${W - mr}" y2="${n(yy)}" stroke="#e3e3e3"/>`;
    c += `<text x="${ml - 8}" y="${n(yy + 4)}" ${F} font-size="12" text-anchor="end" fill="#444">10<tspan dy="-6" font-size="9">${apice(e)}</tspan></text>`;
  }
  o.categorie.forEach((cat, i) => {
    const x0 = ml + i * gw + (gw - bw * o.serie.length) / 2;
    o.serie.forEach((s, k) => {
      const v = s.valori[i] ?? 0; if (!(v > 0)) return;
      const yy = y(v); c += `<rect x="${n(x0 + k * bw)}" y="${n(yy)}" width="${n(bw - 2)}" height="${n(H - mb - yy)}" fill="${s.colore ?? colori[k % colori.length]}"/>`;
    });
    c += testo(ml + i * gw + gw / 2, H - mb + 18, cat, { size: 12, anchor: "middle" });
  });
  if (o.soglia) {
    const yy = y(o.soglia.valore);
    c += `<line x1="${ml}" y1="${n(yy)}" x2="${W - mr}" y2="${n(yy)}" stroke="${ROSSO}" stroke-width="2" stroke-dasharray="8 5"/>` + testo(W - mr - 4, yy - 6, o.soglia.etichetta, { size: 12, anchor: "end", colore: ROSSO, bold: true });
  }
  c += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${H - mb}" stroke="#444"/><line x1="${ml}" y1="${H - mb}" x2="${W - mr}" y2="${H - mb}" stroke="#444"/>`;
  c += testo(18, (mt + H - mb) / 2, o.asseY, { size: 12, anchor: "middle", ruota: -90 });
  let lx = ml;
  o.serie.forEach((s, k) => { c += `<rect x="${lx}" y="${H - 28}" width="14" height="14" fill="${s.colore ?? colori[k % colori.length]}"/>` + testo(lx + 20, H - 16, s.nome, { size: 12 }); lx += 30 + s.nome.length * 7; });
  return svg(W, H, c);
}

/** Profondità di penetrazione della sfera p(d) e schema in sezione tra due captatori (disegno originale). */
export function graficoSfera(R: number, dProgetto: number | null): string {
  const W = 900, H = 400;
  // a sinistra: curva p(d)
  const ml = 70, mt = 30, gw = 400, gh = 300, dMax = Math.min(2 * R, 60);
  const pd = (d: number) => R - Math.sqrt(Math.max(0, R * R - (d / 2) ** 2));
  const pMax = Math.max(1, pd(dMax));
  const X = (d: number) => ml + (d / dMax) * gw, Y = (pp: number) => mt + gh - (pp / pMax) * gh;
  let c = "";
  for (let d = 0; d <= dMax + 0.01; d += 10) c += `<line x1="${n(X(d))}" y1="${mt}" x2="${n(X(d))}" y2="${mt + gh}" stroke="#eee"/>` + testo(X(d), mt + gh + 16, String(d), { size: 11, anchor: "middle" });
  const passoP = pMax > 8 ? 2 : pMax > 4 ? 1 : 0.5;
  for (let pp = 0; pp <= pMax + 1e-9; pp += passoP) c += `<line x1="${ml}" y1="${n(Y(pp))}" x2="${ml + gw}" y2="${n(Y(pp))}" stroke="#eee"/>` + testo(ml - 6, Y(pp) + 4, it(pp, 1), { size: 11, anchor: "end" });
  let path = ""; for (let i = 0; i <= 60; i++) { const d = (dMax * i) / 60; path += `${i ? "L" : "M"}${n(X(d))},${n(Y(pd(d)))}`; }
  c += `<path d="${path}" fill="none" stroke="${ARANCIO}" stroke-width="2.5"/>`;
  c += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + gh}" stroke="#444"/><line x1="${ml}" y1="${mt + gh}" x2="${ml + gw}" y2="${mt + gh}" stroke="#444"/>`;
  c += testo(ml + gw / 2, mt + gh + 36, "distanza tra i captatori d (m)", { size: 12, anchor: "middle" }) + testo(20, mt + gh / 2, "penetrazione p (m)", { size: 12, anchor: "middle", ruota: -90 });
  c += testo(ml + 8, mt + 14, `Sfera rotolante R = ${R} m`, { size: 12, bold: true });
  if (dProgetto && dProgetto > 0 && dProgetto <= dMax) {
    const xx = X(dProgetto), yy = Y(pd(dProgetto));
    c += `<line x1="${n(xx)}" y1="${n(yy)}" x2="${n(xx)}" y2="${mt + gh}" stroke="${BLU}" stroke-dasharray="4 3"/><circle cx="${n(xx)}" cy="${n(yy)}" r="5" fill="${BLU}"/>` + testo(xx + 8, yy - 8, `progetto: d = ${it(dProgetto, 1)} m, p = ${it(pd(dProgetto), 2)} m`, { size: 11, colore: BLU, bold: true });
  }
  // a destra: schema in sezione, non in scala (penetrazione esagerata per leggerla)
  const dS = dProgetto && dProgetto > 0 ? dProgetto : Math.min(15, R), pS = pd(dS);
  const terra = 330, xa = 560, xb = 820, cxm = (xa + xb) / 2, punta = 200, pv = 55;
  const rv = ((xb - xa) / 2) ** 2 / (2 * pv) + pv / 2, cyv = punta + pv - rv;
  c += `<rect x="520" y="${terra}" width="350" height="8" fill="#bdbdbd"/>` + testo(866, terra + 22, "copertura", { size: 11, anchor: "end", colore: "#555" });
  c += `<rect x="${xa - 3}" y="${punta}" width="6" height="${terra - punta}" fill="#222"/><rect x="${xb - 3}" y="${punta}" width="6" height="${terra - punta}" fill="#222"/>`;
  let arco = ""; for (let k = 0; k <= 40; k++) { const xx = xa - 35 + ((xb - xa + 70) * k) / 40, dy = rv * rv - (xx - cxm) ** 2; if (dy < 0) continue; arco += `${arco ? "L" : "M"}${n(xx)},${n(cyv + Math.sqrt(dy))}`; }
  c += `<path d="${arco}" fill="none" stroke="${ARANCIO}" stroke-width="2.5" stroke-dasharray="7 4"/>`;
  c += `<line x1="${xa}" y1="${punta}" x2="${xb}" y2="${punta}" stroke="#999" stroke-dasharray="3 3"/>`;
  c += `<line x1="${cxm}" y1="${punta}" x2="${cxm}" y2="${punta + pv}" stroke="${BLU}" stroke-width="2"/><line x1="${cxm - 8}" y1="${punta + pv}" x2="${cxm + 8}" y2="${punta + pv}" stroke="${BLU}" stroke-width="2"/>`;
  c += testo(cxm + 10, punta + pv / 2 + 5, `p = ${it(pS, 2)} m`, { size: 13, colore: BLU, bold: true });
  c += `<line x1="${cxm}" y1="${punta - 10}" x2="${cxm}" y2="80" stroke="${ARANCIO}" stroke-dasharray="3 3"/>` + testo(cxm, 72, `centro della sfera, R = ${R} m`, { size: 12, colore: ARANCIO, bold: true, anchor: "middle" });
  c += `<line x1="${xa}" y1="${terra + 24}" x2="${xb}" y2="${terra + 24}" stroke="#444"/><line x1="${xa}" y1="${terra + 18}" x2="${xa}" y2="${terra + 30}" stroke="#444"/><line x1="${xb}" y1="${terra + 18}" x2="${xb}" y2="${terra + 30}" stroke="#444"/>` + testo(cxm, terra + 44, `d = ${it(dS, 1)} m`, { size: 12, anchor: "middle" });
  c += testo(xa - 8, (punta + terra) / 2, "captatore", { size: 11, anchor: "end" }) + testo(700, 40, "Schema in sezione (non in scala)", { size: 12, anchor: "middle", bold: true });
  return svg(W, H, c);
}

/** Pianta schematica della copertura: corpi, conduttori di captazione, calate, aste. */
export function piantaCopertura(corpi: Corpo[], conduttori: Conduttore[], aste: Asta[]): string | null {
  const pts: [number, number][] = [...corpi.flatMap((c) => c.impronta), ...conduttori.flatMap((k) => k.punti.map((q) => [q[0], q[1]] as [number, number])), ...aste.map((a) => [a.x, a.y] as [number, number])];
  if (pts.length < 3) return null;
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const W = 900, H = Math.round(Math.min(620, Math.max(320, 900 * ((y1 - y0 || 1) / (x1 - x0 || 1)) + 120))), m = 50;
  const s = Math.min((W - 2 * m) / (x1 - x0 || 1), (H - 2 * m - 40) / (y1 - y0 || 1));
  const X = (x: number) => m + (x - x0) * s, Y = (y: number) => H - m - 30 - (y - y0) * s;
  let c = "";
  for (const k of corpi) c += `<polygon points="${k.impronta.map((q) => `${n(X(q[0]))},${n(Y(q[1]))}`).join(" ")}" fill="#f3f3f3" stroke="#555" stroke-width="1.5"/>` + (k.nome ? testo(X(k.impronta.reduce((a, q) => a + q[0], 0) / k.impronta.length), Y(k.impronta.reduce((a, q) => a + q[1], 0) / k.impronta.length), k.nome, { size: 11, anchor: "middle", colore: "#777" }) : "");
  for (const k of conduttori.filter((v) => v.tipo === "captazione")) c += `<polyline points="${k.punti.map((q) => `${n(X(q[0]))},${n(Y(q[1]))}`).join(" ")}" fill="none" stroke="${ARANCIO}" stroke-width="2"/>`;
  for (const k of conduttori.filter((v) => v.tipo === "terra")) c += `<polyline points="${k.punti.map((q) => `${n(X(q[0]))},${n(Y(q[1]))}`).join(" ")}" fill="none" stroke="${VERDE}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  const calate = conduttori.filter((v) => v.tipo === "calata");
  calate.forEach((k, i) => { const q = k.punti[0]!; c += `<rect x="${n(X(q[0]) - 5)}" y="${n(Y(q[1]) - 5)}" width="10" height="10" fill="${BLU}"/>` + testo(X(q[0]) + 7, Y(q[1]) - 7, `C${i + 1}`, { size: 10, colore: BLU }); });
  for (const a of aste) c += `<circle cx="${n(X(a.x))}" cy="${n(Y(a.y))}" r="5" fill="#fff" stroke="#111" stroke-width="2"/>`;
  // scala grafica
  const passo = [1, 2, 5, 10, 20, 50, 100].find((p) => p * s > 80) ?? 100;
  c += `<line x1="${m}" y1="${H - 22}" x2="${n(m + passo * s)}" y2="${H - 22}" stroke="#222" stroke-width="3"/>` + testo(m + (passo * s) / 2, H - 8, `${passo} m`, { size: 11, anchor: "middle" });
  // legenda
  let lx = m + passo * s + 40;
  const voce = (sim: string, t: string) => { c += sim.replace(/LX/g, String(lx)) + testo(lx + 22, H - 17, t, { size: 11 }); lx += 40 + t.length * 6.2; };
  if (conduttori.some((v) => v.tipo === "captazione")) voce(`<line x1="LX" y1="${H - 21}" x2="${lx + 16}" y2="${H - 21}" stroke="${ARANCIO}" stroke-width="2"/>`, "conduttore di captazione");
  if (aste.length) voce(`<circle cx="${lx + 8}" cy="${H - 21}" r="5" fill="#fff" stroke="#111" stroke-width="2"/>`, `asta (${aste.length})`);
  if (calate.length) voce(`<rect x="${lx + 3}" y="${H - 26}" width="10" height="10" fill="${BLU}"/>`, `calata (${calate.length})`);
  if (conduttori.some((v) => v.tipo === "terra")) voce(`<line x1="LX" y1="${H - 21}" x2="${lx + 16}" y2="${H - 21}" stroke="${VERDE}" stroke-dasharray="6 4"/>`, "dispersore");
  return svg(W, H, c);
}

/** Distanza di separazione richiesta s(l) in aria e in materiale solido, con i punti verificati. */
export function graficoSeparazione(ki: number, kc: number, kmSolido: number, punti: { l: number; d: number; conforme: boolean; nome: string }[]): string {
  const W = 900, H = 380, ml = 70, mr = 20, mt = 30, mb = 60;
  const lMax = Math.max(20, ...punti.map((q) => q.l * 1.15)), sMax = Math.max((ki * kc / kmSolido) * lMax, ...punti.map((q) => q.d * 1.15), 0.1);
  const X = (l: number) => ml + (l / lMax) * (W - ml - mr), Y = (v: number) => mt + (H - mt - mb) * (1 - v / sMax);
  let c = "";
  const passoL = lMax > 60 ? 20 : lMax > 30 ? 10 : 5;
  for (let l = 0; l <= lMax; l += passoL) c += `<line x1="${n(X(l))}" y1="${mt}" x2="${n(X(l))}" y2="${H - mb}" stroke="#eee"/>` + testo(X(l), H - mb + 16, String(l), { size: 11, anchor: "middle" });
  const passoS = sMax > 2 ? 0.5 : sMax > 1 ? 0.2 : 0.1;
  for (let v = 0; v <= sMax + 1e-9; v += passoS) c += `<line x1="${ml}" y1="${n(Y(v))}" x2="${W - mr}" y2="${n(Y(v))}" stroke="#eee"/>` + testo(ml - 6, Y(v) + 4, it(v, 1), { size: 11, anchor: "end" });
  c += `<line x1="${n(X(0))}" y1="${n(Y(0))}" x2="${n(X(lMax))}" y2="${n(Y(ki * kc * lMax))}" stroke="${ARANCIO}" stroke-width="2.5"/>`;
  c += `<line x1="${n(X(0))}" y1="${n(Y(0))}" x2="${n(X(lMax))}" y2="${n(Y((ki * kc / kmSolido) * lMax))}" stroke="${BLU}" stroke-width="2.5"/>`;
  for (const q of punti) c += `<circle cx="${n(X(q.l))}" cy="${n(Y(q.d))}" r="6" fill="${q.conforme ? VERDE : ROSSO}"/>` + testo(X(q.l) + 9, Y(q.d) + 4, q.nome, { size: 10 });
  c += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${H - mb}" stroke="#444"/><line x1="${ml}" y1="${H - mb}" x2="${W - mr}" y2="${H - mb}" stroke="#444"/>`;
  c += testo((ml + W - mr) / 2, H - mb + 36, "lunghezza l lungo l'LPS fino al collegamento equipotenziale (m)", { size: 12, anchor: "middle" }) + testo(20, (mt + H - mb) / 2, "distanza (m)", { size: 12, anchor: "middle", ruota: -90 });
  c += `<line x1="${ml + 10}" y1="${mt + 8}" x2="${ml + 30}" y2="${mt + 8}" stroke="${ARANCIO}" stroke-width="2.5"/>` + testo(ml + 36, mt + 12, `s richiesta in aria (km = 1)`, { size: 11 });
  c += `<line x1="${ml + 230}" y1="${mt + 8}" x2="${ml + 250}" y2="${mt + 8}" stroke="${BLU}" stroke-width="2.5"/>` + testo(ml + 256, mt + 12, `s richiesta in materiale solido (km = ${it(kmSolido)})`, { size: 11 });
  if (punti.length) c += `<circle cx="${ml + 545}" cy="${mt + 8}" r="5" fill="${VERDE}"/>` + testo(ml + 555, mt + 12, "distanza effettiva conforme", { size: 11 }) + `<circle cx="${ml + 735}" cy="${mt + 8}" r="5" fill="${ROSSO}"/>` + testo(ml + 745, mt + 12, "non conforme", { size: 11 });
  return svg(W, H, c);
}

/** Schema delle sorgenti di danno S1–S4 (disegno originale). */
export function schemaSorgenti(): string {
  const W = 900, H = 330;
  const fulmine = (x: number, y: number, s = 1) => `<path d="M${x},${y} l${-14 * s},${46 * s} l${14 * s},0 l${-12 * s},${44 * s} l${34 * s},${-58 * s} l${-16 * s},0 l${12 * s},${-32 * s} z" fill="#F6B400" stroke="#9a6a00" stroke-width="1"/>`;
  let c = `<line x1="20" y1="270" x2="880" y2="270" stroke="#6d6d6d" stroke-width="3"/>`;
  c += `<rect x="90" y="140" width="190" height="130" fill="#eef1f5" stroke="#333" stroke-width="2"/><polygon points="80,140 185,85 290,140" fill="#dfe4ea" stroke="#333" stroke-width="2"/>` + testo(185, 215, "struttura", { size: 13, anchor: "middle" });
  c += `<line x1="280" y1="230" x2="860" y2="230" stroke="#333" stroke-width="2"/>`;
  for (let x = 420; x <= 860; x += 220) c += `<line x1="${x}" y1="230" x2="${x}" y2="270" stroke="#333" stroke-width="3"/>`;
  c += testo(640, 222, "linea entrante (energia, telecomunicazioni)", { size: 12, anchor: "middle" });
  c += fulmine(195, 20) + testo(240, 50, "S1 – sulla struttura", { size: 13, bold: true });
  c += fulmine(345, 120, 0.9) + testo(330, 290, "S2 – vicino alla struttura", { size: 13, bold: true, anchor: "middle" });
  c += fulmine(560, 140, 0.9) + testo(560, 125, "S3 – sulla linea", { size: 13, bold: true, anchor: "middle" });
  c += fulmine(780, 150, 0.9) + testo(780, 300, "S4 – vicino alla linea", { size: 13, bold: true, anchor: "middle" });
  c += testo(450, 318, "D1 danno a esseri viventi · D2 danno materiale · D3 guasto degli impianti interni", { size: 12, anchor: "middle", colore: "#444" });
  return svg(W, H, c);
}

/** Probabilità P che il picco della corrente di fulmine superi I (valori numerici della CEI EN IEC 62305-1:2024, Tab. A.3). */
export const PROBABILITA_CORRENTE: [number, number][] = [[3, 0.99], [5, 0.95], [10, 0.91], [20, 0.8], [30, 0.6], [35, 0.5], [40, 0.4], [50, 0.3], [60, 0.2], [80, 0.1], [100, 0.05], [150, 0.02], [200, 0.01]];
export function curvaCorrente(lpl: string, iMin: number, iMax: number): string {
  const W = 900, H = 380, ml = 70, mr = 30, mt = 30, mb = 60;
  const lx = (i: number) => Math.log10(i), x0 = lx(2), x1 = lx(250);
  const X = (i: number) => ml + ((lx(i) - x0) / (x1 - x0)) * (W - ml - mr), Y = (pp: number) => mt + (H - mt - mb) * (1 - pp);
  let c = `<rect x="${n(X(iMin))}" y="${mt}" width="${n(X(iMax) - X(iMin))}" height="${H - mt - mb}" fill="#FCE9D9"/>`;
  for (const i of [2, 3, 5, 10, 20, 30, 50, 100, 200]) c += `<line x1="${n(X(i))}" y1="${mt}" x2="${n(X(i))}" y2="${H - mb}" stroke="#eee"/>` + testo(X(i), H - mb + 16, String(i), { size: 11, anchor: "middle" });
  for (let k = 0; k <= 10; k += 2) c += `<line x1="${ml}" y1="${n(Y(k / 10))}" x2="${W - mr}" y2="${n(Y(k / 10))}" stroke="#eee"/>` + testo(ml - 6, Y(k / 10) + 4, it(k / 10, 1), { size: 11, anchor: "end" });
  c += `<polyline points="${PROBABILITA_CORRENTE.map(([i, pp]) => `${n(X(i))},${n(Y(pp))}`).join(" ")}" fill="none" stroke="${BLU}" stroke-width="2.5"/>`;
  for (const [i, pp] of PROBABILITA_CORRENTE) c += `<circle cx="${n(X(i))}" cy="${n(Y(pp))}" r="3.5" fill="${BLU}"/>`;
  c += `<line x1="${n(X(iMin))}" y1="${mt}" x2="${n(X(iMin))}" y2="${H - mb}" stroke="${ARANCIO}" stroke-width="2"/><line x1="${n(X(iMax))}" y1="${mt}" x2="${n(X(iMax))}" y2="${H - mb}" stroke="${ARANCIO}" stroke-width="2"/>`;
  c += testo(X(iMin) + 5, mt + 16, `Imin = ${iMin} kA`, { size: 11, colore: ARANCIO, bold: true }) + testo(X(iMax) - 5, mt + 16, `Imax = ${iMax} kA`, { size: 11, colore: ARANCIO, bold: true, anchor: "end" });
  c += testo((X(iMin) + X(iMax)) / 2, H - mb - 10, `campo di progetto LPL ${lpl}`, { size: 11, anchor: "middle", colore: "#9a4a0a" });
  c += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${H - mb}" stroke="#444"/><line x1="${ml}" y1="${H - mb}" x2="${W - mr}" y2="${H - mb}" stroke="#444"/>`;
  c += testo((ml + W - mr) / 2, H - mb + 36, "valore di picco della corrente di fulmine I (kA, scala logaritmica)", { size: 12, anchor: "middle" }) + testo(20, (mt + H - mb) / 2, "probabilità P di superamento", { size: 12, anchor: "middle", ruota: -90 });
  return svg(W, H, c);
}
