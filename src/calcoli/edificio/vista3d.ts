/**
 * Calcoli della vista 3D (senza three.js, provati con i test): posizione del sole, viste predefinite della telecamera,
 * lunghezza della scala grafica, tasselli della foto satellitare, colore e diametro dei conduttori.
 * Coordinate di progetto: x verso est, y verso nord, z in alto. Nel 3D: [x, z, -y].
 */
import type { Corpo } from "./tipi";
import { puntoInPoligono } from "@/calcoli/captazione/sferaRotolante";

const RAD = Math.PI / 180;

/** Posizione del sole (formula semplificata, ora solare): azimut da nord in senso orario e altezza sull'orizzonte, in gradi. */
export function posizioneSole(lat: number, giornoAnno: number, oraSolare: number): { azimut: number; elevazione: number } {
  const decl = 23.44 * Math.sin(2 * Math.PI * (284 + giornoAnno) / 365) * RAD;
  const phi = lat * RAD, h = 15 * (oraSolare - 12) * RAD;
  const sinE = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(h);
  const e = Math.asin(Math.max(-1, Math.min(1, sinE)));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) / RAD + 180;
  return { azimut: ((az % 360) + 360) % 360, elevazione: e / RAD };
}

/** Direzione verso il sole nel 3D (x est, y alto, z sud). */
export function direzioneSole(azimut: number, elevazione: number): [number, number, number] {
  const a = azimut * RAD, e = Math.max(5, elevazione) * RAD;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
}

export function giornoDellAnno(d: Date): number {
  const inizio = Date.UTC(d.getFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - inizio) / 86400000);
}

export interface Limiti3D { minX: number; maxX: number; minY: number; maxY: number; H: number }
export type VistaPredefinita = "assonometria" | "pianta" | "nord" | "sud" | "est" | "ovest";

/** Posizione della telecamera e punto guardato (nel 3D) per una vista predefinita, inquadrando tutto l'edificio. */
export function vistaCamera(b: Limiti3D, vista: VistaPredefinita, fovGradi = 50): { posizione: [number, number, number]; obiettivo: [number, number, number] } {
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2, L = b.maxX - b.minX, W = b.maxY - b.minY;
  const E = Math.max(L, W, b.H, 10), d = (E / 2) / Math.tan((fovGradi / 2) * RAD) * 1.25;
  const t: [number, number, number] = [cx, b.H * 0.4, -cy];
  const pos: Record<VistaPredefinita, [number, number, number]> = {
    assonometria: [cx + d * 0.72, b.H * 0.4 + d * 0.62, -cy + d * 0.72],
    pianta: [cx, b.H + d * 1.15, -cy + 0.001],
    nord: [cx, b.H * 0.45, -cy - (W / 2 + d)],
    sud: [cx, b.H * 0.45, -cy + (W / 2 + d)],
    est: [cx + (L / 2 + d), b.H * 0.45, -cy],
    ovest: [cx - (L / 2 + d), b.H * 0.45, -cy],
  };
  return { posizione: pos[vista], obiettivo: vista === "pianta" ? [cx, 0, -cy] : t };
}

/** Lunghezza "tonda" della scala grafica che sta in circa `maxPx` pixel. */
export function lunghezzaScala(pxPerMetro: number, maxPx = 110): { metri: number; px: number } {
  if (!(pxPerMetro > 0)) return { metri: 0, px: 0 };
  const tonde = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  let m = tonde[0]!;
  for (const v of tonde) if (v * pxPerMetro <= maxPx) m = v;
  return { metri: m, px: m * pxPerMetro };
}

/** Pixel per metro sul punto guardato, per una telecamera prospettica. */
export function pixelPerMetro(distanza: number, fovGradi: number, altezzaPx: number): number {
  const h = 2 * distanza * Math.tan((fovGradi / 2) * RAD);
  return h > 0 ? altezzaPx / h : 0;
}

// ---------- foto satellitare (tasselli Web Mercator) ----------
const R_TERRA = 6378137;
export function latLonDaLocale(x: number, y: number, o: { lat: number; lon: number }): { lat: number; lon: number } {
  return { lat: o.lat + (y / R_TERRA) / RAD, lon: o.lon + (x / (R_TERRA * Math.cos(o.lat * RAD))) / RAD };
}
export function localeDaLatLon(lat: number, lon: number, o: { lat: number; lon: number }): [number, number] {
  return [(lon - o.lon) * RAD * R_TERRA * Math.cos(o.lat * RAD), (lat - o.lat) * RAD * R_TERRA];
}
const tileX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const tileY = (lat: number, z: number) => { const r = lat * RAD; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z; };
const lonDaTile = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const latDaTile = (y: number, z: number) => { const n = Math.PI - (2 * Math.PI * y) / 2 ** z; return Math.atan(Math.sinh(n)) / RAD; };

export interface Tassello { z: number; x: number; y: number; url: string; minX: number; maxX: number; minY: number; maxY: number }
/**
 * Tasselli che coprono un quadrato di lato `lato` m attorno al centro (cx, cy) del modello, al livello di zoom
 * con circa `n` tasselli per lato (zoom fra 14 e 19, al massimo 36 tasselli).
 */
export function tasselliSatellite(o: { lat: number; lon: number }, cx: number, cy: number, lato: number, n = 4): Tassello[] {
  const c = latLonDaLocale(cx, cy, o);
  const mTassello0 = 40075016.686 * Math.cos(c.lat * RAD);
  let z = Math.round(Math.log2(mTassello0 / Math.max(20, lato / n)));
  z = Math.max(14, Math.min(19, z));
  const a = latLonDaLocale(cx - lato / 2, cy + lato / 2, o), b = latLonDaLocale(cx + lato / 2, cy - lato / 2, o);
  let x0 = Math.floor(tileX(a.lon, z)), x1 = Math.floor(tileX(b.lon, z)), y0 = Math.floor(tileY(a.lat, z)), y1 = Math.floor(tileY(b.lat, z));
  while ((x1 - x0 + 1) * (y1 - y0 + 1) > 36 && z > 14) { z--; x0 = Math.floor(tileX(a.lon, z)); x1 = Math.floor(tileX(b.lon, z)); y0 = Math.floor(tileY(a.lat, z)); y1 = Math.floor(tileY(b.lat, z)); }
  const out: Tassello[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const [ax, ay] = localeDaLatLon(latDaTile(y, z), lonDaTile(x, z), o), [bx, by] = localeDaLatLon(latDaTile(y + 1, z), lonDaTile(x + 1, z), o);
    out.push({ z, x, y, url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, minX: ax, maxX: bx, minY: by, maxY: ay });
  }
  return out;
}

// ---------- conduttori ----------
/** Colore del conduttore secondo il materiale (alluminio, rame, acciaio zincato, inox, isolato isCon). */
export function coloreMateriale(materiale: string, tipo?: string): string {
  const m = materiale.toLowerCase();
  if (/iscon|isolat|insulat/.test(m)) return "#2a2d31";
  if (/rame|cu\b|copper/.test(m)) return "#c27a3e";
  if (/v4a|inox|1\.4404|1\.4571|stainless/.test(m)) return "#b9c0c6";
  if (/allumin|\bal\b|almgsi|alu/.test(m)) return "#d0d5da";
  if (/fezn|zinc|acciaio|st\/tzn|steel/.test(m)) return "#8e979e";
  return tipo === "terra" ? "#9b7650" : "#c7ccd1";
}

/** Raggio in metri di un conduttore dalla sezione scritta ("Ø 8 mm", "30 × 3,5 mm", "50 mm²"). */
export function raggioConduttore(sezione: string): number {
  const s = sezione.replace(",", ".");
  const d = /[Øø∅]\s*(\d+(?:\.\d+)?)/.exec(s);
  if (d) return Number(d[1]) / 2000;
  const piatto = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i.exec(s);
  if (piatto) return Math.sqrt((Number(piatto[1]) * Number(piatto[2])) / Math.PI) / 1000;
  const mm2 = /(\d+(?:\.\d+)?)\s*mm(?:²|2)/i.exec(s);
  if (mm2) return Math.sqrt(Number(mm2[1]) / Math.PI) / 1000;
  return 0.004;
}

// ---------- corpi ----------
/** Corpi che stanno sopra un altro corpo (impianti in copertura, lucernari): colorati a parte. */
export function corpiInCopertura(corpi: Corpo[]): Set<string> {
  const out = new Set<string>();
  for (const c of corpi) {
    if ((c.quotaBase ?? 0) < 0.1 || c.impronta.length < 3) continue;
    let sx = 0, sy = 0; for (const p of c.impronta) { sx += p[0]; sy += p[1]; }
    const x = sx / c.impronta.length, y = sy / c.impronta.length;
    if (corpi.some((o) => o.id !== c.id && (o.quotaBase ?? 0) < (c.quotaBase ?? 0) && puntoInPoligono(x, y, o.impronta))) out.add(c.id);
  }
  return out;
}

/** Punto dell'etichetta di un corpo (centro dell'impronta, sopra la copertura) e testo "nome · H m". */
export function etichettaCorpo(c: Corpo): { p: [number, number, number]; testo: string } {
  let sx = 0, sy = 0; for (const p of c.impronta) { sx += p[0]; sy += p[1]; }
  const n = Math.max(1, c.impronta.length), top = (c.quotaBase ?? 0) + Math.max(c.altezzaGronda, c.tipoTetto === "falde" ? c.altezzaColmo : 0);
  return { p: [sx / n, sy / n, top], testo: `${c.nome || "Corpo"} · H ${top.toLocaleString("it-IT", { maximumFractionDigits: 2 })} m` };
}
