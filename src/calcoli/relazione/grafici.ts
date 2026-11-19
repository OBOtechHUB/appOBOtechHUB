/**
 * Grafici e schemi della relazione tecnica, disegnati da zero (SVG) con i dati del progetto.
 * Nessuna figura della norma è riprodotta: sono rappresentazioni originali dei valori calcolati.
 * Logica pura: restituisce testo SVG (l'app lo converte in PNG per il file Word).
 */
import type { Conduttore, Asta, Corpo } from "@/calcoli/edificio/tipi";

// carattere OBO (Nimbus Sans) se installato sul PC, altrimenti Arial
const F = "font-family=\"NimbusSanL-Reg, 'Nimbus Sans L', 'Nimbus Sans', Arial, Helvetica, sans-serif\"";
// colori dello standard OBO (arancio d'accento e secondari); rosso solo per soglie e non conformità
const ARANCIO = "#F39B00", BLU = "#41525D", GRIGIO = "#7694A4", VERDE = "#5E8C53", ROSSO = "#C62828", SCURO = "#282A31";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const n = (v: number, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toString();
const it = (v: number, d = 2) => v.toLocaleString("it-IT", { maximumFractionDigits: d });
const svg = (w: number, h: number, corpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#ffffff"/>${corpo}</svg>`;
const testo = (x: number, y: number, t: string, o: { size?: number; anchor?: "start" | "middle" | "end"; colore?: string; bold?: boolean; ruota?: number } = {}) =>
  `<text x="${n(x)}" y="${n(y)}" ${F} font-size="${o.size ?? 12}" text-anchor="${o.anchor ?? "start"}" fill="${o.colore ?? SCURO}"${o.bold ? ' font-weight="bold"' : ""}${o.ruota ? ` transform="rotate(${o.ruota} ${n(x)} ${n(y)})"` : ""}>${esc(t)}</text>`;
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
    c += `<text x="${ml - 8}" y="${n(yy + 4)}" ${F} font-size="12" text-anchor="end" fill="#41525D">10<tspan dy="-6" font-size="9">${apice(e)}</tspan></text>`;
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
  c += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${H - mb}" stroke="#41525D"/><line x1="${ml}" y1="${H - mb}" x2="${W - mr}" y2="${H - mb}" stroke="#41525D"/>`;
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
  c += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + gh}" stroke="#41525D"/><line x1="${ml}" y1="${mt + gh}" x2="${ml + gw}" y2="${mt + gh}" stroke="#41525D"/>`;
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
  c += `<rect x="520" y="${terra}" width="350" height="8" fill="#C5D9DE"/>` + testo(866, terra + 22, "copertura", { size: 11, anchor: "end", colore: "#555" });
  c += `<rect x="${xa - 3}" y="${punta}" width="6" height="${terra - punta}" fill="#282A31"/><rect x="${xb - 3}" y="${punta}" width="6" height="${terra - punta}" fill="#282A31"/>`;
  let arco = ""; for (let k = 0; k <= 40; k++) { const xx = xa - 35 + ((xb - xa + 70) * k) / 40, dy = rv * rv - (xx - cxm) ** 2; if (dy < 0) continue; arco += `${arco ? "L" : "M"}${n(xx)},${n(cyv + Math.sqrt(dy))}`; }
  c += `<path d="${arco}" fill="none" stroke="${ARANCIO}" stroke-width="2.5" stroke-dasharray="7 4"/>`;
  c += `<line x1="${xa}" y1="${punta}" x2="${xb}" y2="${punta}" stroke="#7694A4" stroke-dasharray="3 3"/>`;
  c += `<line x1="${cxm}" y1="${punta}" x2="${cxm}" y2="${punta + pv}" stroke="${BLU}" stroke-width="2"/><line x1="${cxm - 8}" y1="${punta + pv}" x2="${cxm + 8}" y2="${punta + pv}" stroke="${BLU}" stroke-width="2"/>`;
  c += testo(cxm + 10, punta + pv / 2 + 5, `p = ${it(pS, 2)} m`, { size: 13, colore: BLU, bold: true });
  c += `<line x1="${cxm}" y1="${punta - 10}" x2="${cxm}" y2="80" stroke="${ARANCIO}" stroke-dasharray="3 3"/>` + testo(cxm, 72, `centro della sfera, R = ${R} m`, { size: 12, colore: ARANCIO, bold: true, anchor: "middle" });
  c += `<line x1="${xa}" y1="${terra + 24}" x2="${xb}" y2="${terra + 24}" stroke="#41525D"/><line x1="${xa}" y1="${terra + 18}" x2="${xa}" y2="${terra + 30}" stroke="#41525D"/><line x1="${xb}" y1="${terra + 18}" x2="${xb}" y2="${terra + 30}" stroke="#41525D"/>` + testo(cxm, terra + 44, `d = ${it(dS, 1)} m`, { size: 12, anchor: "middle" });
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
  for (const k of corpi) c += `<polygon points="${k.impronta.map((q) => `${n(X(q[0]))},${n(Y(q[1]))}`).join(" ")}" fill="#E4EBED" stroke="#41525D" stroke-width="1.5"/>` + (k.nome ? testo(X(k.impronta.reduce((a, q) => a + q[0], 0) / k.impronta.length), Y(k.impronta.reduce((a, q) => a + q[1], 0) / k.impronta.length), k.nome, { size: 11, anchor: "middle", colore: "#777" }) : "");
  for (const k of conduttori.filter((v) => v.tipo === "captazione")) c += `<polyline points="${k.punti.map((q) => `${n(X(q[0]))},${n(Y(q[1]))}`).join(" ")}" fill="none" stroke="${ARANCIO}" stroke-width="2"/>`;
  for (const k of conduttori.filter((v) => v.tipo === "terra")) c += `<polyline points="${k.punti.map((q) => `${n(X(q[0]))},${n(Y(q[1]))}`).join(" ")}" fill="none" stroke="${VERDE}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  const calate = conduttori.filter((v) => v.tipo === "calata");
  calate.forEach((k, i) => { const q = k.punti[0]!; c += `<rect x="${n(X(q[0]) - 5)}" y="${n(Y(q[1]) - 5)}" width="10" height="10" fill="${BLU}"/>` + testo(X(q[0]) + 7, Y(q[1]) - 7, `C${i + 1}`, { size: 10, colore: BLU }); });
  for (const a of aste) c += `<circle cx="${n(X(a.x))}" cy="${n(Y(a.y))}" r="5" fill="#fff" stroke="#111" stroke-width="2"/>`;
  // scala grafica
  const passo = [1, 2, 5, 10, 20, 50, 100].find((p) => p * s > 80) ?? 100;
  c += `<line x1="${m}" y1="${H - 22}" x2="${n(m + passo * s)}" y2="${H - 22}" stroke="#282A31" stroke-width="3"/>` + testo(m + (passo * s) / 2, H - 8, `${passo} m`, { size: 11, anchor: "middle" });
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
  c += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${H - mb}" stroke="#41525D"/><line x1="${ml}" y1="${H - mb}" x2="${W - mr}" y2="${H - mb}" stroke="#41525D"/>`;
  c += testo((ml + W - mr) / 2, H - mb + 36, "lunghezza l lungo l'LPS fino al collegamento equipotenziale (m)", { size: 12, anchor: "middle" }) + testo(20, (mt + H - mb) / 2, "distanza (m)", { size: 12, anchor: "middle", ruota: -90 });
  c += `<line x1="${ml + 10}" y1="${mt + 8}" x2="${ml + 30}" y2="${mt + 8}" stroke="${ARANCIO}" stroke-width="2.5"/>` + testo(ml + 36, mt + 12, `s richiesta in aria (km = 1)`, { size: 11 });
  c += `<line x1="${ml + 230}" y1="${mt + 8}" x2="${ml + 250}" y2="${mt + 8}" stroke="${BLU}" stroke-width="2.5"/>` + testo(ml + 256, mt + 12, `s richiesta in materiale solido (km = ${it(kmSolido)})`, { size: 11 });
  if (punti.length) c += `<circle cx="${ml + 545}" cy="${mt + 8}" r="5" fill="${VERDE}"/>` + testo(ml + 555, mt + 12, "distanza effettiva conforme", { size: 11 }) + `<circle cx="${ml + 735}" cy="${mt + 8}" r="5" fill="${ROSSO}"/>` + testo(ml + 745, mt + 12, "non conforme", { size: 11 });
  return svg(W, H, c);
}

/** Schema delle sorgenti di danno S1–S4 (disegno originale). */
export function schemaSorgenti(): string {
  const W = 900, H = 330;
  const fulmine = (x: number, y: number, s = 1) => `<path d="M${x},${y} l${-14 * s},${46 * s} l${14 * s},0 l${-12 * s},${44 * s} l${34 * s},${-58 * s} l${-16 * s},0 l${12 * s},${-32 * s} z" fill="#F39B00" stroke="#B26F00" stroke-width="1"/>`;
  let c = `<line x1="20" y1="270" x2="880" y2="270" stroke="#7694A4" stroke-width="3"/>`;
  c += `<rect x="90" y="140" width="190" height="130" fill="#E4EBED" stroke="#41525D" stroke-width="2"/><polygon points="80,140 185,85 290,140" fill="#C5D9DE" stroke="#41525D" stroke-width="2"/>` + testo(185, 215, "struttura", { size: 13, anchor: "middle" });
  c += `<line x1="280" y1="230" x2="860" y2="230" stroke="#41525D" stroke-width="2"/>`;
  for (let x = 420; x <= 860; x += 220) c += `<line x1="${x}" y1="230" x2="${x}" y2="270" stroke="#41525D" stroke-width="3"/>`;
  c += testo(640, 222, "linea entrante (energia, telecomunicazioni)", { size: 12, anchor: "middle" });
  c += fulmine(195, 20) + testo(240, 50, "S1 – sulla struttura", { size: 13, bold: true });
  c += fulmine(345, 120, 0.9) + testo(330, 290, "S2 – vicino alla struttura", { size: 13, bold: true, anchor: "middle" });
  c += fulmine(560, 140, 0.9) + testo(560, 125, "S3 – sulla linea", { size: 13, bold: true, anchor: "middle" });
  c += fulmine(780, 150, 0.9) + testo(780, 300, "S4 – vicino alla linea", { size: 13, bold: true, anchor: "middle" });
  c += testo(450, 318, "D1 danno a esseri viventi · D2 danno materiale · D3 guasto degli impianti interni", { size: 12, anchor: "middle", colore: "#41525D" });
  return svg(W, H, c);
}

/** Probabilità P che il picco della corrente di fulmine superi I (valori numerici della CEI EN IEC 62305-1:2026-10, Tab. A.3). */
export const PROBABILITA_CORRENTE: [number, number][] = [[3, 0.99], [5, 0.95], [10, 0.91], [20, 0.8], [30, 0.6], [35, 0.5], [40, 0.4], [50, 0.3], [60, 0.2], [80, 0.1], [100, 0.05], [150, 0.02], [200, 0.01]];
export function curvaCorrente(lpl: string, iMin: number, iMax: number): string {
  const W = 900, H = 380, ml = 70, mr = 30, mt = 30, mb = 60;
  const lx = (i: number) => Math.log10(i), x0 = lx(2), x1 = lx(250);
  const X = (i: number) => ml + ((lx(i) - x0) / (x1 - x0)) * (W - ml - mr), Y = (pp: number) => mt + (H - mt - mb) * (1 - pp);
  let c = `<rect x="${n(X(iMin))}" y="${mt}" width="${n(X(iMax) - X(iMin))}" height="${H - mt - mb}" fill="#E4EBED"/>`;
  for (const i of [2, 3, 5, 10, 20, 30, 50, 100, 200]) c += `<line x1="${n(X(i))}" y1="${mt}" x2="${n(X(i))}" y2="${H - mb}" stroke="#eee"/>` + testo(X(i), H - mb + 16, String(i), { size: 11, anchor: "middle" });
  for (let k = 0; k <= 10; k += 2) c += `<line x1="${ml}" y1="${n(Y(k / 10))}" x2="${W - mr}" y2="${n(Y(k / 10))}" stroke="#eee"/>` + testo(ml - 6, Y(k / 10) + 4, it(k / 10, 1), { size: 11, anchor: "end" });
  c += `<polyline points="${PROBABILITA_CORRENTE.map(([i, pp]) => `${n(X(i))},${n(Y(pp))}`).join(" ")}" fill="none" stroke="${BLU}" stroke-width="2.5"/>`;
  for (const [i, pp] of PROBABILITA_CORRENTE) c += `<circle cx="${n(X(i))}" cy="${n(Y(pp))}" r="3.5" fill="${BLU}"/>`;
  c += `<line x1="${n(X(iMin))}" y1="${mt}" x2="${n(X(iMin))}" y2="${H - mb}" stroke="${ARANCIO}" stroke-width="2"/><line x1="${n(X(iMax))}" y1="${mt}" x2="${n(X(iMax))}" y2="${H - mb}" stroke="${ARANCIO}" stroke-width="2"/>`;
  c += testo(X(iMin) + 5, mt + 16, `Imin = ${iMin} kA`, { size: 11, colore: ARANCIO, bold: true }) + testo(X(iMax) - 5, mt + 16, `Imax = ${iMax} kA`, { size: 11, colore: ARANCIO, bold: true, anchor: "end" });
  c += testo((X(iMin) + X(iMax)) / 2, H - mb - 10, `campo di progetto LPL ${lpl}`, { size: 11, anchor: "middle", colore: BLU });
  c += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${H - mb}" stroke="#41525D"/><line x1="${ml}" y1="${H - mb}" x2="${W - mr}" y2="${H - mb}" stroke="#41525D"/>`;
  c += testo((ml + W - mr) / 2, H - mb + 36, "valore di picco della corrente di fulmine I (kA, scala logaritmica)", { size: 12, anchor: "middle" }) + testo(20, (mt + H - mb) / 2, "probabilità P di superamento", { size: 12, anchor: "middle", ruota: -90 });
  return svg(W, H, c);
}

/** Schema a blocchi della procedura di valutazione del rischio (disegno originale). */
export function flussoValutazione(): string {
  const W = 900, H = 520;
  const box = (x: number, y: number, w: number, h: number, righe: string[], fill = "#E4EBED", bordo = "#41525D") =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${bordo}" stroke-width="1.5"/>` + righe.map((r, i) => testo(x + w / 2, y + h / 2 + (i - (righe.length - 1) / 2) * 16 + 4, r, { size: 12, anchor: "middle" })).join("");
  const freccia = (x1: number, y1: number, x2: number, y2: number, et = "") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#41525D" stroke-width="1.6" marker-end="url(#p)"/>` + (et ? testo((x1 + x2) / 2 + 6, (y1 + y2) / 2 - 4, et, { size: 11, bold: true }) : "");
  let c = `<defs><marker id="p" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#41525D"/></marker></defs>`;
  const cx = 300, bw = 400;
  c += box(cx - bw / 2, 15, bw, 44, ["Individuare la struttura, le sue zone ZS,", "le linee entranti e gli impianti interni"]);
  c += freccia(cx, 59, cx, 82);
  c += box(cx - bw / 2, 82, bw, 44, ["Calcolare N (Allegato A), P (Allegato B)", "e L (Allegato C) per ogni zona"]);
  c += freccia(cx, 126, cx, 149);
  c += box(cx - bw / 2, 149, bw, 44, ["Calcolare le componenti RA … RZ,", "R = RL1 + RL2 e la frequenza F"]);
  c += freccia(cx, 193, cx, 222);
  c += `<polygon points="${cx},222 ${cx + 150},287 ${cx},352 ${cx - 150},287" fill="#FDEBCC" stroke="${ARANCIO}" stroke-width="1.8"/>` + testo(cx, 283, "R ≤ RT e F ≤ FT", { size: 13, anchor: "middle", bold: true }) + testo(cx, 301, "in ogni zona?", { size: 12, anchor: "middle" });
  c += freccia(cx, 352, cx, 392, "SÌ");
  c += box(cx - bw / 2, 392, bw, 50, ["Struttura autoprotetta (senza misure)", "o protetta (con le misure adottate)"], "#E9F1E6", VERDE);
  c += freccia(cx + 150, 287, 640, 287, "NO");
  c += box(640, 247, 240, 80, ["Scegliere le misure di protezione:", "LPS, SPD, antincendio,", "misure contro contatto e passo"], "#FDEBCC", ARANCIO);
  c += `<polyline points="760,247 760,171 ${cx + bw / 2 + 10},171" fill="none" stroke="#41525D" stroke-width="1.6" marker-end="url(#p)"/>` + testo(768, 210, "ricalcolare", { size: 11 });
  c += testo(450, 500, "Procedura di valutazione secondo la CEI EN IEC 62305-2:2026-10 (schema riassuntivo)", { size: 11, anchor: "middle", colore: "#555" });
  return svg(W, H, c);
}

/**
 * Schema a blocchi dell'edificio (pianta): ogni corpo numerato con dimensioni, altezza di gronda e altezza da
 * proteggere in copertura; aste colorate per tipo. Il colore dei corpi va dal più basso (chiaro) al più alto (scuro).
 */
export function schemaBlocchi(blocchi: { corpo: Corpo; numero: number; daProteggere: number | null }[], aste: { x: number; y: number; tipo: string }[], nomiTipo: Record<string, string>): string | null {
  const pts = blocchi.flatMap((b) => b.corpo.impronta);
  if (pts.length < 3) return null;
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const W = 900, lg = 90, H = Math.round(Math.min(680, Math.max(360, 820 * ((y1 - y0 || 1) / (x1 - x0 || 1)) + 140))), m = 40;
  const s = Math.min((W - 2 * m) / (x1 - x0 || 1), (H - 2 * m - lg) / (y1 - y0 || 1));
  const X = (x: number) => m + (x - x0) * s, Y = (y: number) => H - m - lg - (y - y0) * s;
  const hs = blocchi.map((b) => b.corpo.quotaBase + b.corpo.altezzaGronda), hMin = Math.min(...hs), hMax = Math.max(...hs);
  const SCALA = ["#E4EBED", "#C5D9DE", "#7694A4", "#41525D"];
  const fill = (h: number) => SCALA[hMax - hMin < 0.01 ? 1 : Math.min(3, Math.floor(((h - hMin) / (hMax - hMin)) * 3.999))]!;
  let c = "";
  const ord = [...blocchi].sort((a, b) => (a.corpo.quotaBase + a.corpo.altezzaGronda) - (b.corpo.quotaBase + b.corpo.altezzaGronda));
  for (const b of ord) {
    const h = b.corpo.quotaBase + b.corpo.altezzaGronda, f = fill(h);
    c += `<polygon points="${b.corpo.impronta.map((q) => `${n(X(q[0]))},${n(Y(q[1]))}`).join(" ")}" fill="${f}" stroke="#282A31" stroke-width="1.5"/>`;
  }
  for (const b of blocchi) {
    const im = b.corpo.impronta, cx = im.reduce((a, q) => a + q[0], 0) / im.length, cy = im.reduce((a, q) => a + q[1], 0) / im.length;
    const bx = im.map((q) => q[0]), by = im.map((q) => q[1]);
    const dimA = Math.max(...bx) - Math.min(...bx), dimB = Math.max(...by) - Math.min(...by);
    const h = b.corpo.quotaBase + b.corpo.altezzaGronda, scuro = fill(h) === "#41525D" || fill(h) === "#7694A4";
    const col = scuro ? "#FFFFFF" : SCURO;
    c += `<circle cx="${n(X(cx))}" cy="${n(Y(cy) - 26)}" r="15" fill="${ARANCIO}"/>` + testo(X(cx), Y(cy) - 21, String(b.numero), { size: 14, anchor: "middle", colore: "#FFFFFF", bold: true });
    c += testo(X(cx), Y(cy) + 4, `${it(dimA, 1)} × ${it(dimB, 1)} m · H ${it(h, 1)} m`, { size: 11, anchor: "middle", colore: col, bold: true });
    if (b.daProteggere != null) c += testo(X(cx), Y(cy) + 20, `da proteggere: ${it(b.daProteggere, 1)} m`, { size: 11, anchor: "middle", colore: col });
  }
  const COL: Record<string, string> = { isolata: "#2E7D32", treppiede: ARANCIO, basamento: "#7694A4", fissa: "#C62828" };
  for (const a of aste) c += `<circle cx="${n(X(a.x))}" cy="${n(Y(a.y))}" r="4.5" fill="${COL[a.tipo] ?? SCURO}" stroke="#fff" stroke-width="1"/>`;
  // legenda
  let ly = H - lg + 14;
  c += testo(m, ly, "Corpi (numero, dimensioni, altezza di gronda):", { size: 11, bold: true });
  const passo = [1, 2, 5, 10, 20, 50, 100].find((p) => p * s > 70) ?? 100;
  c += `<line x1="${W - m - passo * s}" y1="${ly - 4}" x2="${W - m}" y2="${ly - 4}" stroke="${SCURO}" stroke-width="3"/>` + testo(W - m - (passo * s) / 2, ly + 12, `${passo} m`, { size: 11, anchor: "middle" });
  ly += 18;
  let lx = m;
  SCALA.forEach((col, i) => { const h = hMin + ((hMax - hMin) * (i + 0.5)) / 4; c += `<rect x="${lx}" y="${ly - 10}" width="14" height="12" fill="${col}" stroke="#282A31"/>` + testo(lx + 18, ly, hMax - hMin < 0.01 ? `H ${it(hMin, 1)} m` : `≈ ${it(h, 0)} m`, { size: 10 }); lx += 78; });
  ly += 20; lx = m;
  const tipiPresenti = [...new Set(aste.map((a) => a.tipo))];
  for (const t of tipiPresenti) { c += `<circle cx="${lx + 6}" cy="${ly - 4}" r="5" fill="${COL[t] ?? SCURO}"/>` + testo(lx + 16, ly, `${nomiTipo[t] ?? t} (${aste.filter((a) => a.tipo === t).length})`, { size: 10 }); lx += 26 + (nomiTipo[t] ?? t).length * 5.6 + 24; }
  return svg(W, H, c);
}
