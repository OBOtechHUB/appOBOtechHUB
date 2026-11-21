/**
 * Tavole aggiuntive dell'impianto LPS, nello stesso DXF della pianta coperture (TAV. LPS-01):
 *  - TAV. LPS-02 Prospetti: i 4 prospetti con edifici (linee nascoste tolte), aste, calate, captazione,
 *    terra, quote delle altezze e inviluppo della sfera rotolante del livello di protezione;
 *  - TAV. LPS-03 Calate e impianto di terra: pianta con calate numerate, interassi tra calate verificati
 *    con la distanza tipica (Tab. 5, tolleranza 25 %), conduttori di terra, dispersori e tabella delle calate;
 *  - TAV. LPS-04 Particolari costruttivi: una scheda per particolare con richiamo, componenti OBO e quantità.
 * Le tavole stanno una sotto l'altra nello spazio modello, ognuna con squadratura e cartiglio.
 * Logica pura: nessuna dipendenza dal browser.
 */
import { COLONNA_MM, FORMATI, LAYER_LPS, SCALE_TAVOLA, nomeBlocco } from "./standard";
import type { ScrittoreDXF, P2, P3 } from "./dxf12";
import { codiciRichiamo, dentro, ordinaCalate, type DatiTavola, type RisultatoTavola } from "./tavolaDXF";

export interface Foglio { x: number; y: number; larghezza: number; altezza: number; formatoMm: [number, number]; scala: number; tav: string; titolo: string }
export interface ParticolareScheda { idParticolare: string; nome: string; punti: number; componenti: { codiceOBO: string; descrizione: string; quantita: number; unita: string }[]; note?: string | undefined; bloccoCAD?: string | undefined }
export interface OpzioniTavole { raggioSfera: number; distanzaCalate: { tipica: number }; particolari: ParticolareScheda[] }

const fmt = (v: number, d = 2) => v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
const quota = (v: number) => `${v >= 0 ? "+" : ""}${fmt(v)}`;

/** Foglio con squadratura, colonna destra e cartiglio. (x0, yAlto) = angolo in alto a sinistra nello spazio modello. */
export function nuovoFoglio(w: ScrittoreDXF, formatoMm: [number, number], scala: number, x0: number, yAlto: number) {
  const L = LAYER_LPS, k = scala / 1000, [W, H] = formatoMm;
  const sx = x0, sy = yAlto - H * k;
  const P = (xmm: number, ymm: number): P2 => [sx + xmm * k, sy + ymm * k];
  const hT = (mm: number) => mm * k;
  const colX = W - 10 - COLONNA_MM;
  w.poli(L.cartiglio.nome, [P(0, 0), P(W, 0), P(W, H), P(0, H)], true);
  w.poli(L.cartiglio.nome, [P(20, 10), P(W - 10, 10), P(W - 10, H - 10), P(20, H - 10)], true);
  w.linea(L.cartiglio.nome, P(colX, 10), P(colX, H - 10));
  return { P, hT, k, W, H, colX, sx, sy, area: { x0: 30, x1: colX - 10, y0: 20, y1: H - 20 } };
}
export type FoglioDisegno = ReturnType<typeof nuovoFoglio>;

/** Cartiglio in basso nella colonna destra (stesso schema della TAV. LPS-01). */
export function cartiglio(w: ScrittoreDXF, f: FoglioDisegno, d: DatiTavola, sottotitolo: string, tav: string, scalaTesto: string) {
  const L = LAYER_LPS, { P, hT, colX } = f, cy0 = 10, cy1 = 10 + 72, xr = colX + COLONNA_MM;
  w.poli(L.cartiglio.nome, [P(colX, cy0), P(xr, cy0), P(xr, cy1), P(colX, cy1)], true);
  const righe: [string, string][] = [
    ["Progetto", d.progetto.nome || "-"], ["Comune", d.progetto.comune || "-"], ["Codice", d.progetto.codice || "-"],
    ["Livello di protezione", `LPL ${d.progetto.lpl}`], ["Scala", scalaTesto], ["Data", d.progetto.data],
  ];
  w.testo(L.cartiglio.nome, P(colX + 4, cy1 - 7), hT(3.2), "IMPIANTO DI PROTEZIONE CONTRO I FULMINI (LPS)");
  w.testo(L.cartiglio.nome, P(colX + 4, cy1 - 12.5), hT(2.6), sottotitolo);
  w.linea(L.cartiglio.nome, P(colX, cy1 - 16), P(xr, cy1 - 16));
  righe.forEach(([e, v], i) => {
    const yy = cy1 - 21 - i * 6.2;
    w.testo(L.cartiglio.nome, P(colX + 4, yy), hT(2), e.toUpperCase());
    w.testo(L.cartiglio.nome, P(colX + 46, yy), hT(2.6), v.length > 44 ? `${v.slice(0, 43)}...` : v);
    w.linea(L.cartiglio.nome, P(colX, yy - 2), P(xr, yy - 2));
  });
  w.linea(L.cartiglio.nome, P(colX + 42, cy1 - 16), P(colX + 42, cy0 + 8.5));
  w.testo(L.cartiglio.nome, P(colX + 4, cy0 + 3), hT(1.8), "CEI EN IEC 62305 - Elaborato con Progettazione LPS (OBO Italia)");
  w.testo(L.cartiglio.nome, P(xr - 4, cy0 + 3), hT(2.6), tav, "destra");
}

/** Testo a capo per larghezza (in caratteri). */
function aCapo(t: string, max: number): string[] {
  const out: string[] = []; let r = "";
  for (const p of t.split(/\s+/)) { if ((r + " " + p).trim().length > max && r) { out.push(r); r = p; } else r = (r + " " + p).trim(); }
  if (r) out.push(r);
  return out;
}

/* ------------------------------------------------------------------ */
/* Prospetti                                                            */
/* ------------------------------------------------------------------ */

interface Vista { nome: string; da: string; u: (x: number, y: number) => number; prof: (x: number, y: number) => number }
export function viste(nordInAlto: boolean): Vista[] {
  const n = (a: string, b: string) => (nordInAlto ? a : b);
  return [
    { nome: n("PROSPETTO SUD", "PROSPETTO A"), da: n("visto da sud", "lato inferiore della pianta"), u: (x) => x, prof: (_x, y) => -y },
    { nome: n("PROSPETTO EST", "PROSPETTO B"), da: n("visto da est", "lato destro della pianta"), u: (_x, y) => y, prof: (x) => x },
    { nome: n("PROSPETTO NORD", "PROSPETTO C"), da: n("visto da nord", "lato superiore della pianta"), u: (x) => -x, prof: (_x, y) => y },
    { nome: n("PROSPETTO OVEST", "PROSPETTO D"), da: n("visto da ovest", "lato sinistro della pianta"), u: (_x, y) => -y, prof: (x) => -x },
  ];
}

/** Sagoma di un corpo in prospetto (u, z) con la profondità della faccia più vicina e le linee interne (gronda). */
export function sagomaCorpo(c: DatiTavola["corpi"][number], v: Vista): { poli: P2[]; vicino: number; interne: [P2, P2][] } {
  const us = c.impronta.map((p) => v.u(p[0], p[1])), u0 = Math.min(...us), u1 = Math.max(...us);
  const zb = c.quotaBase, zg = zb + c.altezzaGronda, zc = zb + (c.tipoTetto === "falde" ? Math.max(c.altezzaColmo, c.altezzaGronda) : c.altezzaGronda);
  const vicino = Math.max(...c.impronta.map((p) => v.prof(p[0], p[1])));
  if (c.tipoTetto !== "falde" || zc <= zg + 1e-6) return { poli: [[u0, zb], [u1, zb], [u1, zg], [u0, zg]], vicino, interne: [] };
  // colmo parallelo all'asse x, a metà della larghezza in y (come nel modello 3D)
  const guardaX = Math.abs(v.u(1, 0) - v.u(0, 0)) > 0.5; // la u varia con x: si vede il lato lungo con la falda
  if (guardaX) return { poli: [[u0, zb], [u1, zb], [u1, zc], [u0, zc]], vicino, interne: [[[u0, zg], [u1, zg]]] };
  const ys = c.impronta.map((p) => p[1]), ym = (Math.min(...ys) + Math.max(...ys)) / 2, um = v.u(0, ym);
  return { poli: [[u0, zb], [u1, zb], [u1, zg], [um, zc], [u0, zg]], vicino, interne: [] };
}

/** Inviluppo della sfera rotolante su un profilo (u, z): punti del profilo e terreno a quota 0. */
export function inviluppoSfera(punti: P2[], R: number, passo?: number): P2[] {
  if (!punti.length) return [];
  const umin = Math.min(...punti.map((p) => p[0])) - R, umax = Math.max(...punti.map((p) => p[0])) + R;
  const du = passo ?? Math.max(0.05, R / 120), n = Math.ceil((umax - umin) / du) + 1;
  const ord = [...punti].sort((a, b) => a[0] - b[0]);
  // altezza del centro della sfera appoggiata sopra ogni ascissa
  const centro = new Float64Array(n);
  let i0 = 0;
  for (let i = 0; i < n; i++) {
    const u = umin + i * du; let c = R; // appoggiata al terreno
    while (i0 < ord.length && ord[i0]![0] < u - R) i0++;
    for (let j = i0; j < ord.length && ord[j]![0] <= u + R; j++) { const dx = ord[j]![0] - u; c = Math.max(c, ord[j]![1] + Math.sqrt(R * R - dx * dx)); }
    centro[i] = c;
  }
  // superficie più bassa raggiunta dalla sfera
  const out: P2[] = [], m = Math.ceil(R / du);
  for (let i = 0; i < n; i++) {
    let e = Infinity;
    for (let j = Math.max(0, i - m); j <= Math.min(n - 1, i + m); j++) { const dx = (j - i) * du; if (Math.abs(dx) > R) continue; e = Math.min(e, centro[j]! - Math.sqrt(R * R - dx * dx)); }
    out.push([umin + i * du, Math.max(0, e)]);
  }
  return out;
}

/** Spezza una polilinea (u, z) togliendo i tratti nascosti dietro sagome più vicine. */
function visibili(pts: { u: number; z: number; p: number }[], sagome: { poli: P2[]; vicino: number }[], passo: number): P2[][] {
  const out: P2[][] = []; let cur: P2[] = [];
  const nascosto = (u: number, z: number, p: number) => sagome.some((s) => s.vicino > p + 0.1 && dentroRidotto([u, z], s.poli));
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!, l = Math.hypot(b.u - a.u, b.z - a.z), n = Math.max(1, Math.ceil(l / passo));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, tm = (t0 + t1) / 2;
      const q0: P2 = [a.u + (b.u - a.u) * t0, a.z + (b.z - a.z) * t0], q1: P2 = [a.u + (b.u - a.u) * t1, a.z + (b.z - a.z) * t1];
      if (nascosto(a.u + (b.u - a.u) * tm, a.z + (b.z - a.z) * tm, a.p + (b.p - a.p) * tm)) { if (cur.length > 1) out.push(cur); cur = []; continue; }
      if (!cur.length) cur.push(q0);
      cur.push(q1);
    }
  }
  if (cur.length > 1) out.push(cur);
  // unisce i punti allineati
  return out.map((l) => l.filter((q, i) => i === 0 || i === l.length - 1 || Math.abs((q[0] - l[i - 1]![0]) * (l[i + 1]![1] - q[1]) - (q[1] - l[i - 1]![1]) * (l[i + 1]![0] - q[0])) > 1e-9));
}
/** Punto dentro il poligono, con un piccolo margine (i bordi non nascondono). */
function dentroRidotto(p: P2, poli: P2[]): boolean {
  if (!dentro(p, poli)) return false;
  for (let i = 0; i < poli.length; i++) {
    const a = poli[i]!, b = poli[(i + 1) % poli.length]!, dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) < 0.05) return false;
  }
  return true;
}

function tavolaProspetti(w: ScrittoreDXF, d: DatiTavola, formatoMm: [number, number], x0: number, yAlto: number, R: number): Foglio {
  const L = LAYER_LPS, vs = viste(!!d.nordInAlto);
  // ingombri delle viste (m)
  const box = vs.map((v) => {
    const us: number[] = [], zs: number[] = [0];
    d.corpi.forEach((c) => c.impronta.forEach((p) => us.push(v.u(p[0], p[1]))));
    d.corpi.forEach((c) => zs.push(c.quotaBase + Math.max(c.altezzaGronda, c.tipoTetto === "falde" ? c.altezzaColmo : 0)));
    d.aste.forEach((a) => { us.push(v.u(a.x, a.y)); zs.push((a.z ?? 0) + a.altezza); });
    if (!us.length) us.push(0, 10);
    return { u0: Math.min(...us), u1: Math.max(...us), z1: Math.max(...zs) };
  });
  // ingombro di una vista sulla carta (mm) alla scala s: disegno + quote a destra (30 mm) + titoli sotto e margine (30 mm)
  const largM = Math.max(...box.map((b) => b.u1 - b.u0)) + 8, altM = Math.max(...box.map((b) => b.z1)) + 1;
  const [W, H] = formatoMm, areaL = W - 30 - COLONNA_MM - 20, areaH = H - 40;
  // 2 x 2 oppure i 4 prospetti uno sotto l'altro: si sceglie quello con la scala più grande
  const scalaPer = (c: number, r: number) => SCALE_TAVOLA.find((s) => c * (largM * 1000 / s + 34) <= areaL && r * (altM * 1000 / s + 30) <= areaH) ?? 1000;
  const [cols, righe] = scalaPer(1, 4) < scalaPer(2, 2) ? [1, 4] : [2, 2];
  const scala = scalaPer(cols, righe);
  const f = nuovoFoglio(w, formatoMm, scala, x0, yAlto), { P, hT, k } = f;
  const cellaL = (f.area.x1 - f.area.x0) / cols, cellaH = (f.area.y1 - f.area.y0) / righe;
  vs.forEach((v, i) => {
    const b = box[i]!, col = i % cols, riga = righe - 1 - Math.floor(i / cols);
    const altMm = b.z1 / k + 30;
    const cxmm = f.area.x0 + cellaL * (col + 0.5), y0mm = f.area.y0 + cellaH * riga + Math.max(16, (cellaH - altMm) / 2 + 16);
    const o = P(cxmm, y0mm), du = o[0] - (b.u0 + b.u1) / 2;
    const Q = (u: number, z: number): P2 => [u + du, o[1] + z];
    // terreno
    w.linea(L.edificio.nome, Q(b.u0 - 4, 0), Q(b.u1 + 4, 0));
    for (let u = b.u0 - 4; u < b.u1 + 4; u += hT(3)) w.linea(L.quote.nome, Q(u, 0), Q(u - hT(1.5), -hT(1.5)));
    // edifici dal più vicino al più lontano, senza linee nascoste
    const sag = d.corpi.filter((c) => c.impronta.length >= 3).map((c) => ({ c, ...sagomaCorpo(c, v) })).sort((a, b) => b.vicino - a.vicino);
    sag.forEach((s, j) => {
      const davanti = sag.slice(0, j);
      const chiuso = [...s.poli, s.poli[0]!].map((q) => ({ u: q[0], z: q[1], p: s.vicino }));
      visibili(chiuso, davanti, 0.2).forEach((l) => w.poli(L.edificio.nome, l.map((q) => Q(q[0], q[1])), false));
      s.interne.forEach(([a, bq]) => visibili([{ u: a[0], z: a[1], p: s.vicino }, { u: bq[0], z: bq[1], p: s.vicino }], davanti, 0.2).forEach((l) => w.poli(L.colmo.nome, l.map((q) => Q(q[0], q[1])), false)));
    });
    // conduttori
    for (const c of d.conduttori) {
      const layer = c.tipo === "calata" ? L.calate.nome : c.tipo === "terra" ? L.terra.nome : L.captazione.nome;
      const pts = c.punti.map((q) => ({ u: v.u(q[0], q[1]), z: c.tipo === "terra" ? Math.min(q[2], -0.5) : q[2], p: v.prof(q[0], q[1]) }));
      if (pts.length < 2) continue;
      visibili(pts, sag, 0.15).forEach((l) => w.poli(layer, l.map((q) => Q(q[0], q[1])), false));
    }
    // aste: palo, base e punta
    for (const a of d.aste) {
      const u = v.u(a.x, a.y), z0 = a.z ?? 0, z1 = z0 + a.altezza, pr = v.prof(a.x, a.y);
      visibili([{ u, z: z0, p: pr }, { u, z: z1, p: pr }], sag, 0.1).forEach((l) => w.poli(L.aste.nome, l.map((q) => Q(q[0], q[1])), false));
      if (!sag.some((s) => s.vicino > pr + 0.1 && dentroRidotto([u, z1 - 0.05], s.poli))) {
        w.pieno(L.aste.nome, [Q(u - hT(0.8), z1 - hT(2)), Q(u + hT(0.8), z1 - hT(2)), Q(u, z1)]);
        w.linea(L.aste.nome, Q(u - hT(2), z0), Q(u + hT(2), z0));
      }
    }
    // sfera rotolante sul profilo (spigoli degli edifici, punte delle aste, conduttori di captazione)
    const prof: P2[] = [];
    sag.forEach((s) => { const ps = [...s.poli, s.poli[0]!]; for (let j = 0; j + 1 < ps.length; j++) { const a = ps[j]!, bq = ps[j + 1]!, n = Math.max(1, Math.ceil(Math.hypot(bq[0] - a[0], bq[1] - a[1]) / 0.25)); for (let t = 0; t <= n; t++) prof.push([a[0] + (bq[0] - a[0]) * t / n, a[1] + (bq[1] - a[1]) * t / n]); } });
    d.aste.forEach((a) => prof.push([v.u(a.x, a.y), (a.z ?? 0) + a.altezza]));
    d.conduttori.filter((c) => c.tipo !== "terra" && c.tipo !== "calata").forEach((c) => c.punti.forEach((q) => prof.push([v.u(q[0], q[1]), q[2]])));
    const env = inviluppoSfera(prof, R).filter((q) => q[0] >= b.u0 - R * 0.6 && q[0] <= b.u1 + R * 0.6);
    let tratto: P2[] = [];
    const chiudi = () => { if (tratto.length > 1) w.poli(L.sfera2d.nome, tratto.map((q) => Q(q[0], q[1])), false); tratto = []; };
    env.forEach((q) => { if (q[1] > 0.05 && q[0] >= b.u0 - 4 && q[0] <= b.u1 + 4) tratto.push(q); else chiudi(); });
    chiudi();
    // quote delle altezze a destra
    const alt = new Map<string, number>(); alt.set(quota(0), 0);
    sag.forEach((s) => { const zg = s.c.quotaBase + s.c.altezzaGronda; alt.set(quota(zg), zg); if (s.c.tipoTetto === "falde" && s.c.altezzaColmo > s.c.altezzaGronda) alt.set(quota(s.c.quotaBase + s.c.altezzaColmo), s.c.quotaBase + s.c.altezzaColmo); });
    const zMaxAsta = d.aste.length ? Math.max(...d.aste.map((a) => (a.z ?? 0) + a.altezza)) : null;
    if (zMaxAsta !== null) alt.set(quota(zMaxAsta), zMaxAsta);
    const uq = b.u1 + 5, quote = [...alt.values()].sort((a, c) => a - c).filter((z, j, arr) => j === 0 || z - arr[j - 1]! > hT(3));
    w.linea(L.quote.nome, Q(uq, quote[0]!), Q(uq, quote[quote.length - 1]!));
    quote.forEach((z) => {
      w.linea(L.quote.nome, Q(uq - hT(1.5), z), Q(uq + hT(1.5), z));
      w.pieno(L.quote.nome, [Q(uq, z), Q(uq + hT(1.2), z + hT(1.6)), Q(uq - hT(1.2), z + hT(1.6))]);
      w.testo(L.quote.nome, Q(uq + hT(2.5), z + hT(0.6)), hT(2), quota(z));
    });
    // larghezza
    const yq = -hT(7);
    w.linea(L.quote.nome, Q(b.u0, yq), Q(b.u1, yq));
    [b.u0, b.u1].forEach((u) => { w.linea(L.quote.nome, Q(u, yq - hT(1.5)), Q(u, yq + hT(1.5))); w.linea(L.quote.nome, Q(u - hT(1), yq - hT(1)), Q(u + hT(1), yq + hT(1))); });
    w.testo(L.quote.nome, Q((b.u0 + b.u1) / 2, yq + hT(1)), hT(2.2), fmt(b.u1 - b.u0), "centro");
    // titolo della vista
    w.testo(L.testi.nome, Q((b.u0 + b.u1) / 2, -hT(13)), hT(3.2), v.nome, "centro");
    w.testo(L.testi.nome, Q((b.u0 + b.u1) / 2, -hT(17.5)), hT(2.2), `${v.da} - scala 1:${scala}`, "centro");
  });
  // colonna: legenda e note
  const x0c = f.colX + 4; let y = f.H - 18;
  w.testo(L.legenda.nome, P(x0c, y), hT(4), "LEGENDA"); y -= 8;
  const voci: [string, string][] = [[L.edificio.nome, "Edificio (linee nascoste tolte)"], [L.captazione.nome, "Conduttori di captazione"], [L.aste.nome, "Aste di captazione"], [L.calate.nome, "Calate"], [L.terra.nome, "Conduttori di terra"], [L.sfera2d.nome, `Inviluppo della sfera rotolante R = ${fmt(R, 0)} m`]];
  voci.forEach(([layer, t]) => { w.poli(layer, [P(x0c, y + 1.2), P(x0c + 14, y + 1.2)], false); w.testo(L.legenda.nome, P(x0c + 18, y), hT(2.4), t); y -= 5.2; });
  y -= 4;
  w.testo(L.legenda.nome, P(x0c, y), hT(3.2), "NOTE"); y -= 6.5;
  for (const r of [
    `Sfera rotolante del livello di protezione LPL ${d.progetto.lpl}: raggio ${fmt(R, 0)} m (CEI EN IEC 62305-3).`,
    "L'inviluppo e' calcolato sul profilo di ogni prospetto: tutto quello che sta sotto la linea tratteggiata e' protetto nel piano del prospetto.",
    "La verifica completa nello spazio e' quella del modello 3D (Edificio 3D).",
    "Quote altimetriche in metri rispetto al piano campagna (+0,00).",
  ]) for (const riga of aCapo(r, 70)) { w.testo(L.legenda.nome, P(x0c, y), hT(2.2), riga); y -= 4.4; }
  cartiglio(w, f, d, "PROSPETTI - ASTE, CALATE E SFERA ROTOLANTE", "TAV. LPS-02", `1:${scala}`);
  return { x: f.sx, y: f.sy, larghezza: f.W * k, altezza: f.H * k, formatoMm, scala, tav: "TAV. LPS-02", titolo: "Prospetti" };
}

/* ------------------------------------------------------------------ */
/* Calate e impianto di terra                                           */
/* ------------------------------------------------------------------ */

const lung3 = (p: P3[]) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1]![0], q[1] - p[i - 1]![1], q[2] - p[i - 1]![2]) : 0), 0);

/** Posizione di un punto sul perimetro di un poligono: distanza dal bordo e ascissa curvilinea. */
function suPerimetro(p: P2, poli: P2[]): { d: number; s: number; perimetro: number } {
  let best = { d: Infinity, s: 0 }, acc = 0;
  for (let i = 0; i < poli.length; i++) {
    const a = poli[i]!, b = poli[(i + 1) % poli.length]!, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (l * l)));
    const d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    if (d < best.d) best = { d, s: acc + t * l };
    acc += l;
  }
  return { ...best, perimetro: acc };
}

/** Punto sul perimetro del poligono all'ascissa curvilinea s. */
function puntoPerimetro(poli: P2[], s: number): P2 {
  let acc = 0;
  for (let i = 0; i < poli.length; i++) {
    const a = poli[i]!, b = poli[(i + 1) % poli.length]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + l >= s) { const t = l ? (s - acc) / l : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    acc += l;
  }
  return poli[0] ?? [0, 0];
}

/**
 * Calate in ordine C1, C2… (come la TAV. LPS-01) con lunghezza, altezza e interasse con la calata successiva
 * misurato lungo il perimetro del corpo su cui sta (ogni calata va sul corpo con il bordo più vicino).
 */
export function tabellaCalate(d: DatiTavola) {
  const calate = d.conduttori.filter((c) => c.tipo === "calata" && c.punti.length >= 2);
  const alti = calate.map((c) => c.punti.reduce((a, b) => (b[2] > a[2] ? b : a), c.punti[0]!));
  const corpi = d.corpi.filter((c) => c.impronta.length >= 3);
  const centri = corpi.map((c) => [c.impronta.reduce((s, p) => s + p[0], 0) / c.impronta.length, c.impronta.reduce((s, p) => s + p[1], 0) / c.impronta.length] as P2);
  const centro: P2 = centri.length ? [centri.reduce((s, p) => s + p[0], 0) / centri.length, centri.reduce((s, p) => s + p[1], 0) / centri.length] : [0, 0];
  const ordine = ordinaCalate(alti.map((p) => [p[0], p[1]] as P2), centro);
  const nome = new Map(ordine.map((idx, n) => [idx, `C${n + 1}`]));
  // corpo e ascissa sul perimetro di ogni calata
  const pos = alti.map((a) => { let m = { corpo: -1, d: Infinity, s: 0, perimetro: 0 }; corpi.forEach((c, j) => { const q = suPerimetro([a[0], a[1]], c.impronta); if (q.d < m.d) m = { corpo: j, ...q }; }); return m; });
  const prossima = new Map<number, { idx: number; dist: number; medio: P2 }>();
  corpi.forEach((_, j) => {
    const lista = pos.map((p, i) => ({ i, ...p })).filter((p) => p.corpo === j).sort((a, b) => a.s - b.s);
    if (lista.length < 2) return;
    lista.forEach((p, k) => { const n = lista[(k + 1) % lista.length]!; let dist = n.s - p.s; if (dist <= 0) dist += p.perimetro; prossima.set(p.i, { idx: n.i, dist, medio: puntoPerimetro(corpi[j]!.impronta, (p.s + dist / 2) % p.perimetro) }); });
  });
  return ordine.map((idx) => {
    const c = calate[idx]!, a = alti[idx]!, nx = prossima.get(idx);
    const zmin = Math.min(...c.punti.map((q) => q[2]));
    return { nome: nome.get(idx)!, x: a[0], y: a[1], altezza: a[2] - zmin, lunghezza: lung3(c.punti), distanzaSuccessiva: nx?.dist ?? 0, prossima: nx ? nome.get(nx.idx)! : "", medio: nx?.medio ?? null, materiale: [c.materiale, c.sezione ? `${c.sezione} mm2` : ""].filter(Boolean).join(" ") };
  });
}

function tavolaCalate(w: ScrittoreDXF, d: DatiTavola, base: RisultatoTavola, formatoMm: [number, number], x0: number, yAlto: number, o: OpzioniTavole): Foglio {
  const L = LAYER_LPS, scala = base.scala, f = nuovoFoglio(w, formatoMm, scala, x0, yAlto), { P, hT, k } = f, ins = scala / 100;
  // stessa inquadratura della pianta coperture
  const dx = f.sx - base.foglio.x, dy = f.sy - base.foglio.y;
  const T = (x: number, y: number): P2 => [x + dx, y + dy];
  for (const c of d.corpi) if (c.impronta.length >= 3) w.poli(L.edificio.nome, c.impronta.map((p) => T(p[0], p[1])), true);
  for (const c of d.conduttori) {
    if (c.tipo === "terra" && c.punti.length > 1) w.poli(L.terra.nome, c.punti.map((q) => T(q[0], q[1])), false);
  }
  const tab = tabellaCalate(d), lim = o.distanzaCalate.tipica * 1.25;
  const centro: P2 = tab.length ? [tab.reduce((s, c) => s + c.x, 0) / tab.length, tab.reduce((s, c) => s + c.y, 0) / tab.length] : [0, 0];
  tab.forEach((c, i) => {
    const p = T(c.x, c.y);
    if (w.haBlocco("LPS_CALATA")) w.inserisci(L.calate.nome, "LPS_CALATA", p, ins, 0, []); else w.cerchio(L.calate.nome, p, 0.25 * ins);
    const ux = c.x - centro[0], uy = c.y - centro[1], l = Math.hypot(ux, uy) || 1;
    w.testo(L.calateNum.nome, [p[0] + (ux / l) * hT(6), p[1] + (uy / l) * hT(6)], hT(3), c.nome, "centro-medio");
    // interasse con la successiva lungo il perimetro: scritto a metà tra le due calate, verso l'esterno
    if (c.medio) {
      const m: P2 = c.medio, vx = m[0] - centro[0], vy = m[1] - centro[1], lv = Math.hypot(vx, vy) || 1;
      const q = T(m[0] + (vx / lv) * hT(4), m[1] + (vy / lv) * hT(4));
      const ok = c.distanzaSuccessiva <= lim + 1e-6;
      w.testo(ok ? L.quote.nome : L.avvisi.nome, q, hT(2.2), `${fmt(c.distanzaSuccessiva)} m${ok ? "" : " !"}`, "centro-medio");
    }
    void i;
  });
  for (const q of d.picchetti) {
    const nome = nomeBlocco("picchetto", q.codiceOBO);
    if (w.haBlocco(nome)) w.inserisci(L.dispersori.nome, nome, T(q.x, q.y), ins, 0, []); else w.cerchio(L.dispersori.nome, T(q.x, q.y), 0.3 * ins);
  }
  // colonna: tabella delle calate
  const x0c = f.colX + 4, xr = f.colX + COLONNA_MM - 4; let y = f.H - 18;
  w.testo(L.legenda.nome, P(x0c, y), hT(4), "CALATE"); y -= 7;
  const colonne: [string, number, "sinistra" | "destra"][] = [["N.", x0c, "sinistra"], ["H (m)", x0c + 34, "destra"], ["LUNGH. (m)", x0c + 62, "destra"], ["INTERASSE (m)", x0c + 100, "destra"], ["ESITO", xr, "destra"]];
  colonne.forEach(([t, x, a]) => w.testo(L.legenda.nome, P(x, y), hT(2), t, a));
  y -= 1.5; w.linea(L.legenda.nome, P(x0c, y), P(xr, y)); y -= 4.2;
  const maxRighe = Math.max(0, Math.floor((y - 10 - 72 - 60) / 4.6));
  tab.slice(0, maxRighe).forEach((c) => {
    const ok = !c.prossima || c.distanzaSuccessiva <= lim + 1e-6;
    w.testo(L.legenda.nome, P(x0c, y), hT(2.2), c.prossima ? `${c.nome}-${c.prossima}` : c.nome);
    w.testo(L.legenda.nome, P(x0c + 34, y), hT(2.2), fmt(c.altezza), "destra");
    w.testo(L.legenda.nome, P(x0c + 62, y), hT(2.2), fmt(c.lunghezza), "destra");
    w.testo(L.legenda.nome, P(x0c + 100, y), hT(2.2), c.prossima ? fmt(c.distanzaSuccessiva) : "-", "destra");
    w.testo(ok ? L.legenda.nome : L.avvisi.nome, P(xr, y), hT(2.2), c.prossima ? (ok ? "OK" : "OLTRE") : "-", "destra");
    y -= 4.6;
  });
  if (tab.length > maxRighe) { w.testo(L.legenda.nome, P(x0c, y), hT(2), `... altre ${tab.length - maxRighe} calate`); y -= 4.6; }
  y -= 3;
  const totale = tab.reduce((s, c) => s + c.lunghezza, 0);
  w.testo(L.legenda.nome, P(x0c, y), hT(2.4), `Calate: ${tab.length} - lunghezza totale ${fmt(totale)} m`); y -= 5;
  w.testo(L.legenda.nome, P(x0c, y), hT(2.4), `Dispersori a picchetto: ${d.picchetti.length}${d.picchetti.length ? ` - ${fmt(d.picchetti.reduce((s, q) => s + q.lunghezza, 0))} m` : ""}`); y -= 5;
  const terra = d.conduttori.filter((c) => c.tipo === "terra").reduce((s, c) => s + lung3(c.punti), 0);
  w.testo(L.legenda.nome, P(x0c, y), hT(2.4), `Conduttori di terra: ${fmt(terra)} m`); y -= 8;
  for (const r of [
    `Interasse tra calate: distanza tipica ${fmt(o.distanzaCalate.tipica, 0)} m per LPL ${d.progetto.lpl} (CEI EN IEC 62305-3, Tab. 5), ammessa una tolleranza del 25 % (fino a ${fmt(lim, 1)} m).`,
    "Interasse misurato lungo il perimetro del corpo tra calate consecutive. Ogni calata ha il giunto di sezionamento per le misure.",
    "Calate numerate in senso orario partendo da ovest, come nella TAV. LPS-01.",
  ]) for (const riga of aCapo(r, 70)) { w.testo(L.legenda.nome, P(x0c, y), hT(2.2), riga); y -= 4.4; }
  cartiglio(w, f, d, "CALATE E IMPIANTO DI TERRA", "TAV. LPS-03", `1:${scala}`);
  return { x: f.sx, y: f.sy, larghezza: f.W * k, altezza: f.H * k, formatoMm, scala, tav: "TAV. LPS-03", titolo: "Calate e impianto di terra" };
}

/* ------------------------------------------------------------------ */
/* Particolari costruttivi                                              */
/* ------------------------------------------------------------------ */

function tavolaParticolari(w: ScrittoreDXF, d: DatiTavola, formatoMm: [number, number], x0: number, yAlto: number, schede: ParticolareScheda[], scalaModello: number): Foglio {
  const L = LAYER_LPS, f = nuovoFoglio(w, formatoMm, scalaModello, x0, yAlto), { P, hT, k } = f;
  const codici = codiciRichiamo(d.particolari.usati);
  const cols = formatoMm[0] >= 800 ? 3 : 2, cellaL = (f.area.x1 - f.area.x0 + 10) / cols, cellaH = 62;
  const righeMax = Math.floor((f.area.y1 - f.area.y0 + 10) / cellaH), maxSchede = cols * righeMax;
  schede.slice(0, maxSchede).forEach((s, i) => {
    const c = i % cols, r = Math.floor(i / cols), xa = f.area.x0 - 5 + c * cellaL + 2, yt = f.area.y1 + 5 - r * cellaH - 2, xb = xa + cellaL - 4, yb = yt - cellaH + 4;
    w.poli(L.legenda.nome, [P(xa, yb), P(xb, yb), P(xb, yt), P(xa, yt)], true);
    const cod = codici.get(s.idParticolare) ?? "P";
    if (w.haBlocco("LPS_RICHIAMO")) w.inserisci(L.particolari.nome, "LPS_RICHIAMO", P(xa + 7, yt - 7), (scalaModello / 100) * 0.9, 0, [{ tag: "NUMERO", valore: cod, visibile: true, altezza: 0.25, pos: [0, 0.12] }, { tag: "PARTICOLARE", valore: s.nome }]);
    else w.testo(L.particolari.nome, P(xa + 7, yt - 7), hT(3), cod, "centro-medio");
    let y = yt - 6;
    aCapo(s.nome, Math.floor((cellaL - 22) / 2.1)).slice(0, 2).forEach((t) => { w.testo(L.testi.nome, P(xa + 14, y), hT(2.6), t); y -= 4.4; });
    w.testo(L.testi.nome, P(xa + 14, y), hT(1.9), `${s.idParticolare}${s.punti ? ` - ${s.punti} ${s.punti === 1 ? "punto" : "punti"} in pianta` : ""}`); y -= 6;
    w.linea(L.legenda.nome, P(xa + 3, y + 3), P(xb - 3, y + 3));
    w.testo(L.legenda.nome, P(xa + 3, y), hT(1.9), "CODICE OBO"); w.testo(L.legenda.nome, P(xa + 24, y), hT(1.9), "DESCRIZIONE"); w.testo(L.legenda.nome, P(xb - 3, y), hT(1.9), "Q.TA'", "destra"); y -= 4.2;
    const maxC = Math.max(1, Math.floor((y - yb - 12) / 4));
    s.componenti.slice(0, maxC).forEach((cp) => {
      w.testo(L.legenda.nome, P(xa + 3, y), hT(2), cp.codiceOBO || "-");
      const lim = Math.floor((xb - xa - 40) / 1.15);
      w.testo(L.legenda.nome, P(xa + 24, y), hT(2), cp.descrizione.length > lim ? `${cp.descrizione.slice(0, lim - 1)}...` : cp.descrizione);
      w.testo(L.legenda.nome, P(xb - 3, y), hT(2), `${cp.quantita} ${cp.unita}`, "destra"); y -= 4;
    });
    if (s.componenti.length > maxC) { w.testo(L.legenda.nome, P(xa + 3, y), hT(1.8), `... altri ${s.componenti.length - maxC} componenti`); y -= 4; }
    const nota = [s.note, s.bloccoCAD ? `Blocco CAD: ${s.bloccoCAD}` : ""].filter(Boolean).join(" - ");
    aCapo(nota, Math.floor((cellaL - 8) / 1.05)).slice(0, 2).forEach((t, j) => w.testo(L.testi.nome, P(xa + 3, yb + 7 - j * 3.6), hT(1.8), t));
  });
  const x0c = f.colX + 4; let y = f.H - 18;
  w.testo(L.legenda.nome, P(x0c, y), hT(4), "PARTICOLARI COSTRUTTIVI"); y -= 8;
  for (const r of [
    `${schede.length} particolari usati nel progetto, numerati come i richiami della TAV. LPS-01.`,
    "Quantita' per punto di posa o per metro, come nelle schede OBO. Le quantita' totali sono nella distinta dei materiali.",
    "Disegni di dettaglio: schede PDF e blocchi CAD OBO dei particolari (archivio di Progettazione LPS).",
    ...(schede.length > maxSchede ? [`Nel foglio entrano ${maxSchede} schede: le altre ${schede.length - maxSchede} sono nelle schede PDF.`] : []),
  ]) for (const riga of aCapo(r, 70)) { w.testo(L.legenda.nome, P(x0c, y), hT(2.2), riga); y -= 4.4; }
  cartiglio(w, f, d, "PARTICOLARI COSTRUTTIVI - COMPONENTI OBO", "TAV. LPS-04", "-");
  return { x: f.sx, y: f.sy, larghezza: f.W * k, altezza: f.H * k, formatoMm, scala: scalaModello, tav: "TAV. LPS-04", titolo: "Particolari costruttivi" };
}

/** Aggiunge le tavole 02-04 sotto la TAV. LPS-01 e restituisce l'elenco di tutti i fogli. */
export function aggiungiTavole(w: ScrittoreDXF, d: DatiTavola, base: RisultatoTavola, o: OpzioniTavole): Foglio[] {
  const formatoMm = (FORMATI.find((f) => f.nome === base.formato)?.mm ?? [841, 594]) as [number, number];
  const fogli: Foglio[] = [{ x: base.foglio.x, y: base.foglio.y, larghezza: base.foglio.larghezza, altezza: base.foglio.altezza, formatoMm, scala: base.scala, tav: "TAV. LPS-01", titolo: "Pianta coperture" }];
  const sotto = () => { const u = fogli[fogli.length - 1]!; return u.y - u.altezza * 0.08; };
  const x0 = base.foglio.x;
  if (d.corpi.some((c) => c.impronta.length >= 3)) fogli.push(tavolaProspetti(w, d, formatoMm, x0, sotto(), o.raggioSfera));
  if (d.conduttori.some((c) => c.tipo === "calata" || c.tipo === "terra") || d.picchetti.length) fogli.push(tavolaCalate(w, d, base, formatoMm, x0, sotto(), o));
  if (o.particolari.length) fogli.push(tavolaParticolari(w, d, formatoMm, x0, sotto(), o.particolari, base.scala));
  return fogli;
}
