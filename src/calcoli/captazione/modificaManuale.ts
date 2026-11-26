/**
 * Modifica a mano della captazione in Edificio 3D: aste spostate, copiate, collegate; calata da un punto fino a terra
 * con supporti, connettore e dispersore; maglia su una copertura scelta con le sue calate; dispersore in un punto.
 * Funzioni pure: ricevono lo stato e restituiscono gli elementi da aggiungere.
 */
import type { Asta, Conduttore, Corpo, Punto2, Punto3 } from "@/calcoli/edificio/tipi";
import { puntoInPoligono } from "./sferaRotolante";
import { SUPPORTI_CALATA, captazioneFalde, magliaTettoPiano, proponiCalate, type CatalogoCaptazione } from "./proponiCaptazione";

export interface ComponenteNuovo { tipo: string; x: number; y: number; z: number; codiceOBO?: string }
export interface PicchettoNuovo { id: string; x: number; y: number; z: number; lunghezza: number; diametro: number; codiceOBO: string }
export interface Aggiunte { conduttori: Conduttore[]; supporti: ComponenteNuovo[]; morsetti: ComponenteNuovo[]; picchetti: PicchettoNuovo[] }

export const PICCHETTO_BP = { codice: "5000858", lunghezza: 1.5, diametro: 0.02 };
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);
const d3 = (a: Punto3, b: Punto3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Supporti lungo una polilinea, al massimo ogni `passo` m (il primo a metà del primo passo). */
export function supportiLungo(punti: Punto3[], passo: number, tipo: string, codice?: string): ComponenteNuovo[] {
  const out: ComponenteNuovo[] = [];
  for (let i = 1; i < punti.length; i++) {
    const a = punti[i - 1]!, b = punti[i]!, L = d3(a, b);
    const n = Math.max(1, Math.ceil(L / passo - 1e-9));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      out.push({ tipo, x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, ...(codice ? { codiceOBO: codice } : {}) });
    }
  }
  return out;
}

/** Corpo che contiene il punto in pianta (il più alto se più di uno), altrimenti il più vicino. */
export function corpoInPunto(corpi: Corpo[], x: number, y: number): Corpo | null {
  const dentro = corpi.filter((c) => puntoInPoligono(x, y, c.impronta));
  if (dentro.length) return dentro.sort((a, b) => ((b.quotaBase ?? 0) + b.altezzaGronda) - ((a.quotaBase ?? 0) + a.altezzaGronda))[0]!;
  let best: Corpo | null = null, dm = Infinity;
  for (const c of corpi) { const q = puntoPiuVicinoContorno(c.impronta, [x, y]); const dd = Math.hypot(q[0] - x, q[1] - y); if (dd < dm) { dm = dd; best = c; } }
  return best;
}

/** Punto più vicino sul contorno chiuso. */
export function puntoPiuVicinoContorno(poli: Punto2[], p: Punto2): Punto2 {
  let best: Punto2 = poli[0] ?? p, dm = Infinity;
  for (let i = 0; i < poli.length; i++) {
    const a = poli[i]!, b = poli[(i + 1) % poli.length]!, dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
    const q: Punto2 = [a[0] + dx * t, a[1] + dy * t], dd = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (dd < dm) { dm = dd; best = q; }
  }
  return best;
}

/** Punto più vicino su una polilinea 3D (con indice del tratto). */
export function puntoPiuVicinoLinea(punti: Punto3[], p: Punto3): { q: Punto3; d: number } {
  let best: Punto3 = punti[0] ?? p, dm = Infinity;
  for (let i = 1; i < punti.length; i++) {
    const a = punti[i - 1]!, b = punti[i]!, v: Punto3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1] + (p[2] - a[2]) * v[2]) / L2)) : 0;
    const q: Punto3 = [a[0] + v[0] * t, a[1] + v[1] * t, a[2] + v[2] * t], dd = d3(q, p);
    if (dd < dm) { dm = dd; best = q; }
  }
  return { q: best, d: dm };
}

/**
 * Calata da un punto (base di un'asta, punto della captazione): tratto sulla copertura fino al bordo più vicino,
 * calata verticale fino a terra, connettore all'attacco, supporti ogni 1 m, dispersore BP al piede.
 */
export function calataDaPunto(corpi: Corpo[], p: Punto3, cat: CatalogoCaptazione, parete: keyof typeof SUPPORTI_CALATA = "muratura", conDispersore = true): Aggiunte {
  const c = corpoInPunto(corpi, p[0], p[1]);
  const vuoto: Aggiunte = { conduttori: [], supporti: [], morsetti: [], picchetti: [] };
  if (!c) return vuoto;
  const zTetto = (c.quotaBase ?? 0) + c.altezzaGronda, bordo = puntoPiuVicinoContorno(c.impronta, [p[0], p[1]]);
  const testa: Punto3 = [bordo[0], bordo[1], zTetto], piede: Punto3 = [bordo[0], bordo[1], 0];
  const out: Aggiunte = { conduttori: [], supporti: [], morsetti: [], picchetti: [] };
  const base = { materiale: cat.conduttore.materiale, sezione: `Ø ${cat.conduttore.diametroMm} mm`, codiceOBO: cat.conduttore.codice, origine: "manuale" };
  if (Math.hypot(testa[0] - p[0], testa[1] - p[1]) > 0.05) {
    const tratto: Punto3[] = [[p[0], p[1], Math.max(p[2], zTetto)], testa];
    out.conduttori.push({ id: uid(), tipo: "captazione", punti: tratto, ...base });
    if (cat.supporto) out.supporti.push(...supportiLungo(tratto, cat.supporto.passoMax, "supporto", cat.supporto.codice));
  }
  const sc = SUPPORTI_CALATA[parete] ?? SUPPORTI_CALATA["muratura"]!;
  out.conduttori.push({ id: uid(), tipo: "calata", punti: [testa, piede], ...base });
  out.supporti.push(...supportiLungo([testa, [piede[0], piede[1], 0.5]], sc.passoMax ?? 1, "supporto calata", sc.codice));
  out.morsetti.push({ tipo: "connettore", x: testa[0], y: testa[1], z: testa[2], codiceOBO: cat.connettore.codice });
  if (conDispersore) out.picchetti.push({ id: uid(), x: piede[0], y: piede[1], z: 0, lunghezza: PICCHETTO_BP.lunghezza, diametro: PICCHETTO_BP.diametro, codiceOBO: PICCHETTO_BP.codice });
  return out;
}

/** Collega la base di un'asta al conduttore di captazione più vicino (per ridurre la distanza di separazione). */
export function collegaAsta(a: Asta, conduttori: Conduttore[], cat: CatalogoCaptazione): Aggiunte | null {
  const base: Punto3 = [a.x, a.y, a.z];
  let best: { q: Punto3; d: number } | null = null;
  for (const c of conduttori) { if (c.tipo === "terra") continue; const r = puntoPiuVicinoLinea(c.punti, base); if (!best || r.d < best.d) best = r; }
  if (!best || best.d < 0.05) return null;
  const tratto: Punto3[] = [base, best.q];
  return {
    conduttori: [{ id: uid(), tipo: "captazione", punti: tratto, materiale: cat.conduttore.materiale, sezione: `Ø ${cat.conduttore.diametroMm} mm`, codiceOBO: cat.conduttore.codice, origine: "manuale" }],
    supporti: cat.supporto ? supportiLungo(tratto, cat.supporto.passoMax, "supporto", cat.supporto.codice) : [],
    morsetti: [{ tipo: "connettore", x: best.q[0], y: best.q[1], z: best.q[2], codiceOBO: cat.connettore.codice }, { tipo: "connettore asta", x: a.x, y: a.y, z: a.z, codiceOBO: cat.connettore.codice }],
    picchetti: [],
  };
}

/** Maglia (e, se richiesto, calate) su una sola copertura scelta col clic. */
export function magliaSuCorpo(c: Corpo, lato: number, cat: CatalogoCaptazione, opz: { dz?: number; calate?: boolean; distanzaCalate?: number; parete?: keyof typeof SUPPORTI_CALATA } = {}): Aggiunte {
  const dz = opz.dz ?? 0, linee = c.tipoTetto === "falde" ? captazioneFalde(c, lato, dz) : magliaTettoPiano(c, lato, dz);
  const base = { materiale: cat.conduttore.materiale, sezione: `Ø ${cat.conduttore.diametroMm} mm`, codiceOBO: cat.conduttore.codice, origine: "manuale" };
  const out: Aggiunte = { conduttori: linee.map((punti) => ({ id: uid(), tipo: "captazione" as const, punti, ...base })), supporti: [], morsetti: [], picchetti: [] };
  if (cat.supporto) for (const l of linee) out.supporti.push(...supportiLungo(l, cat.supporto.passoMax, "supporto", cat.supporto.codice));
  // connettori agli estremi dei tratti interni (incroci con il perimetro e tra di loro)
  for (const l of linee.slice(1)) for (const q of [l[0]!, l[l.length - 1]!]) out.morsetti.push({ tipo: "connettore", x: q[0], y: q[1], z: q[2], codiceOBO: cat.connettore.codice });
  if (opz.calate) for (const k of proponiCalate([c], opz.distanzaCalate ?? 15)) {
    const add = calataDaPunto([c], [k.punto[0], k.punto[1], k.zTesta + dz], cat, opz.parete ?? "muratura");
    out.conduttori.push(...add.conduttori); out.supporti.push(...add.supporti); out.morsetti.push(...add.morsetti); out.picchetti.push(...add.picchetti);
  }
  return out;
}

/** Dispersore BP nel punto (a terra), collegato al piede della calata più vicina entro 6 m. */
export function dispersoreInPunto(p: Punto3, conduttori: Conduttore[]): Aggiunte {
  const out: Aggiunte = { conduttori: [], supporti: [], morsetti: [], picchetti: [{ id: uid(), x: p[0], y: p[1], z: 0, lunghezza: PICCHETTO_BP.lunghezza, diametro: PICCHETTO_BP.diametro, codiceOBO: PICCHETTO_BP.codice }] };
  let best: Punto3 | null = null, dm = 6;
  for (const c of conduttori) if (c.tipo === "calata") { const piede = c.punti.reduce((m, q) => (q[2] < m[2] ? q : m), c.punti[0]!); const dd = Math.hypot(piede[0] - p[0], piede[1] - p[1]); if (dd < dm) { dm = dd; best = piede; } }
  if (best && dm > 0.05) {
    out.conduttori.push({ id: uid(), tipo: "terra", sottotipo: "terra", punti: [[best[0], best[1], -0.5], [p[0], p[1], -0.5]], materiale: "V4A", sezione: "30 × 3,5 mm", codiceOBO: "5018706", origine: "manuale" });
    out.morsetti.push({ tipo: "morsetto a croce", x: p[0], y: p[1], z: -0.5 });
  }
  return out;
}

/** Copia di un'asta spostata di `dx` m in pianta. */
export function copiaAsta(a: Asta, dx = 1): Asta { return { ...a, id: uid(), x: a.x + dx, origine: "manuale" }; }

// ---------- spostamento dei blocchi (corpi) ----------
interface PuntoZ { x: number; y: number; z: number }
export interface StatoSpostamento<S extends PuntoZ, P extends PuntoZ> { corpi: Corpo[]; aste: Asta[]; conduttori: Conduttore[]; supporti: S[]; morsetti: S[]; compensatori: S[]; picchetti: P[] }

function vicinoAlContorno(poli: Punto2[], x: number, y: number, tol: number): boolean {
  const q = puntoPiuVicinoContorno(poli, [x, y]);
  return Math.hypot(q[0] - x, q[1] - y) <= tol;
}
const sulCorpo = (c: Corpo, x: number, y: number, tol = 0.05) => puntoInPoligono(x, y, c.impronta) || vicinoAlContorno(c.impronta, x, y, tol);

/** Limiti in pianta di un corpo. */
function rettangolo(c: Corpo) { const xs = c.impronta.map((p) => p[0]), ys = c.impronta.map((p) => p[1]); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; }

/**
 * Aggancio durante il trascinamento: arrotonda a `passo` m e, se un lato del blocco arriva entro `tol` m dal lato
 * di un altro blocco (o dal suo prolungamento), lo allinea esattamente.
 */
export function agganciaSpostamento(c: Corpo, altri: Corpo[], dx: number, dy: number, passo = 0.1, tol = 0.4): [number, number] {
  let ax = Math.round(dx / passo) * passo, ay = Math.round(dy / passo) * passo;
  const r = rettangolo(c);
  let bx = tol, by = tol;
  for (const o of altri) {
    if (o.id === c.id) continue;
    const s = rettangolo(o);
    for (const mio of [r.minX + dx, r.maxX + dx]) for (const suo of [s.minX, s.maxX]) { const d = suo - mio; if (Math.abs(d) < bx) { bx = Math.abs(d); ax = dx + d; } }
    for (const mio of [r.minY + dy, r.maxY + dy]) for (const suo of [s.minY, s.maxY]) { const d = suo - mio; if (Math.abs(d) < by) { by = Math.abs(d); ay = dy + d; } }
  }
  const mm = (v: number) => Math.round(v * 1000) / 1000 + 0;
  return [mm(ax), mm(ay)];
}

/**
 * Sposta un blocco di (dx, dy) m in pianta. Con `conImpianto` sposta anche quello che gli sta sopra o lungo le pareti:
 * aste e componenti sulla copertura, conduttori con tutti i punti sul blocco (captazione e calate), picchetti al piede
 * delle calate spostate. I conduttori di terra e quello che sta su altri blocchi restano dove sono.
 */
export function spostaCorpo<S extends PuntoZ, P extends PuntoZ>(st: StatoSpostamento<S, P>, id: string, dx: number, dy: number, conImpianto = true): StatoSpostamento<S, P> {
  const c = st.corpi.find((k) => k.id === id);
  if (!c || (!dx && !dy)) return st;
  const zTetto = (c.quotaBase ?? 0) + c.altezzaGronda;
  const trasla = (k: Corpo): Corpo => ({ ...k, impronta: k.impronta.map((p) => [p[0] + dx, p[1] + dy] as Punto2), ...(k.mesh ? { mesh: { ...k.mesh, posizioni: k.mesh.posizioni.map((v, i) => (i % 3 === 0 ? v + dx : i % 3 === 1 ? v + dy : v)) } } : {}) });
  // blocchi appoggiati sulla copertura (impianti, lucernari): seguono il blocco se si sposta l'impianto
  const centro = (k: Corpo) => { let x = 0, y = 0; for (const p of k.impronta) { x += p[0]; y += p[1]; } return [x / k.impronta.length, y / k.impronta.length] as Punto2; };
  const appoggiati = new Set(conImpianto ? st.corpi.filter((k) => k.id !== id && (k.quotaBase ?? 0) >= zTetto - 0.5 && puntoInPoligono(centro(k)[0], centro(k)[1], c.impronta)).map((k) => k.id) : []);
  const corpi = st.corpi.map((k) => (k.id === id ? trasla(k) : appoggiati.has(k.id) ? trasla(k) : k));
  if (!conImpianto) return { ...st, corpi };
  const sopra = (p: PuntoZ) => p.z >= zTetto - 0.5 && sulCorpo(c, p.x, p.y);
  const muovi = <T extends PuntoZ>(p: T): T => (sopra(p) ? { ...p, x: p.x + dx, y: p.y + dy } : p);
  const piediSpostati: Punto2[] = [], lineeSpostate: Punto3[][] = [];
  const conduttori = st.conduttori.map((k) => {
    if (k.tipo === "terra" || !k.punti.every((q) => q[2] >= -0.01 && sulCorpo(c, q[0], q[1], 0.1))) return k;
    if (!k.punti.some((q) => q[2] >= zTetto - 0.5)) return k;
    if (k.tipo === "calata") { const piede = k.punti.reduce((m, q) => (q[2] < m[2] ? q : m), k.punti[0]!); piediSpostati.push([piede[0], piede[1]]); }
    lineeSpostate.push(k.punti);
    return { ...k, punti: k.punti.map((q) => [q[0] + dx, q[1] + dy, q[2]] as Punto3) };
  });
  const suConduttore = (p: PuntoZ) => lineeSpostate.some((l) => puntoPiuVicinoLinea(l, [p.x, p.y, p.z]).d <= 0.15);
  const calataSpostata = (p: PuntoZ) => p.z <= 0.6 && piediSpostati.some((q) => Math.hypot(q[0] - p.x, q[1] - p.y) <= 0.3);
  const muoviPiede = <T extends PuntoZ>(p: T): T => (calataSpostata(p) || (!sopra(p) && suConduttore(p)) ? { ...p, x: p.x + dx, y: p.y + dy } : muovi(p));
  return {
    corpi, conduttori,
    aste: st.aste.map((a) => muovi(a)),
    supporti: st.supporti.map((p) => muoviPiede(p)), morsetti: st.morsetti.map((p) => muoviPiede(p)), compensatori: st.compensatori.map((p) => muovi(p)),
    picchetti: st.picchetti.map((p) => (calataSpostata({ ...p, z: Math.min(p.z, 0) }) ? { ...p, x: p.x + dx, y: p.y + dy } : p)),
  };
}
