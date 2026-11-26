/**
 * Distanza di separazione con la ripartizione reale della corrente sulla rete di conduttori (potenziali ai nodi).
 * CEI EN IEC 62305-3:2026-10, 6.3.1 e Allegato B: s = ki / km × Σ (kc,i × li), con kc,i la quota di corrente che
 * percorre il tratto i nel percorso fino al collegamento equipotenziale (terra). Modello: ogni tratto ha impedenza
 * proporzionale alla sua lunghezza (come nell'Allegato B); con una corrente unitaria immessa nel punto colpito, il
 * potenziale del punto vale Σ kc,i × li (in metri), quindi s = ki / km × V. Per ogni nodo si considera il fulmine
 * proprio su quel nodo (caso peggiore per quel punto): V = resistenza equivalente tra il nodo e terra.
 */
import type { Asta, Conduttore, Corpo, Punto3 } from "@/calcoli/edificio/tipi";
import { puntoInPoligono } from "@/calcoli/captazione/sferaRotolante";

export interface NodoRete { id: number; p: Punto3; terra: boolean; punta: boolean; V: number; sAria: number; sSolido: number }
export interface TrattoRete { a: number; b: number; l: number; origine: string; kc: number }
export interface ViolazioneImpianto { nome: string; corpoId: string; d: number; s: number; punto: Punto3 }
export interface RisultatoSeparazioneNodi {
  nodi: NodoRete[]; tratti: TrattoRete[]; ki: number; kmSolido: number;
  peggiore: NodoRete | null; nonCollegate: string[]; violazioni: ViolazioneImpianto[]; collegati: string[]; avvisi: string[];
}

const TOL = 0.05;
const chiave = (p: Punto3) => `${Math.round(p[0] / TOL)}|${Math.round(p[1] / TOL)}|${Math.round(p[2] / TOL)}`;

type Seg = { a: Punto3; b: Punto3; origine: string; punta?: boolean };

/** Divide i segmenti agli incroci (stessa quota) e dove un estremo di un altro segmento cade sul tratto. */
function spezza(segs: Seg[]): Seg[] {
  const tagli: number[][] = segs.map(() => []);
  const estremi: Punto3[] = segs.flatMap((s) => [s.a, s.b]);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!, v: Punto3 = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]], L2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
    if (L2 < 1e-6) continue;
    for (const e of estremi) {
      const t = ((e[0] - s.a[0]) * v[0] + (e[1] - s.a[1]) * v[1] + (e[2] - s.a[2]) * v[2]) / L2;
      if (t <= 1e-3 || t >= 1 - 1e-3) continue;
      const q: Punto3 = [s.a[0] + v[0] * t, s.a[1] + v[1] * t, s.a[2] + v[2] * t];
      if (Math.hypot(q[0] - e[0], q[1] - e[1], q[2] - e[2]) < TOL) tagli[i]!.push(t);
    }
    // incroci in pianta tra tratti orizzontali alla stessa quota
    if (Math.abs(v[2]) > TOL) continue;
    for (let j = i + 1; j < segs.length; j++) {
      const r = segs[j]!, w: Punto3 = [r.b[0] - r.a[0], r.b[1] - r.a[1], r.b[2] - r.a[2]];
      if (Math.abs(w[2]) > TOL || Math.abs(r.a[2] - s.a[2]) > TOL) continue;
      const den = v[0] * w[1] - v[1] * w[0];
      if (Math.abs(den) < 1e-9) continue;
      const dx = r.a[0] - s.a[0], dy = r.a[1] - s.a[1];
      const t = (dx * w[1] - dy * w[0]) / den, u = (dx * v[1] - dy * v[0]) / den;
      if (t > 1e-3 && t < 1 - 1e-3 && u > -1e-3 && u < 1 + 1e-3) tagli[i]!.push(t);
      if (u > 1e-3 && u < 1 - 1e-3 && t > -1e-3 && t < 1 + 1e-3) tagli[j]!.push(u);
    }
  }
  const out: Seg[] = [];
  segs.forEach((s, i) => {
    const ts = [0, ...tagli[i]!.sort((x, y) => x - y), 1];
    const P = (t: number): Punto3 => [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t, s.a[2] + (s.b[2] - s.a[2]) * t];
    for (let k = 1; k < ts.length; k++) if (ts[k]! - ts[k - 1]! > 1e-4) out.push({ a: P(ts[k - 1]!), b: P(ts[k]!), origine: s.origine, ...(s.punta && k === ts.length - 1 ? { punta: true } : {}) });
  });
  return out;
}

/** Inversa (diagonale) e soluzione con Cholesky su matrice SPD densa n×n (Float64Array, riga per riga). */
function cholesky(A: Float64Array, n: number): Float64Array | null {
  const L = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    let s = A[j * n + j]!;
    for (let k = 0; k < j; k++) s -= L[j * n + k]! ** 2;
    if (s <= 1e-12) return null;
    const d = Math.sqrt(s); L[j * n + j] = d;
    for (let i = j + 1; i < n; i++) { let t = A[i * n + j]!; for (let k = 0; k < j; k++) t -= L[i * n + k]! * L[j * n + k]!; L[i * n + j] = t / d; }
  }
  return L;
}
function risolvi(L: Float64Array, n: number, b: Float64Array): Float64Array {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = b[i]!; for (let k = 0; k < i; k++) s -= L[i * n + k]! * y[k]!; y[i] = s / L[i * n + i]!; }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = y[i]!; for (let k = i + 1; k < n; k++) s -= L[k * n + i]! * x[k]!; x[i] = s / L[i * n + i]!; }
  return x;
}
/** Diagonale dell'inversa: (A⁻¹)jj = Σk (L⁻¹)kj². */
function diagonaleInversa(L: Float64Array, n: number): Float64Array {
  const diag = new Float64Array(n), col = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    col.fill(0);
    for (let i = j; i < n; i++) { let s = i === j ? 1 : 0; for (let k = j; k < i; k++) s -= L[i * n + k]! * col[k]!; col[i] = s / L[i * n + i]!; }
    let t = 0; for (let i = j; i < n; i++) t += col[i]! ** 2; diag[j] = t;
  }
  return diag;
}

export const MAX_NODI = 1500;

export function separazioneNodi(x: { conduttori: Conduttore[]; aste: Asta[]; corpi?: Corpo[]; ki: number; kmSolido?: number }): RisultatoSeparazioneNodi {
  const ki = x.ki, kmS = x.kmSolido ?? 0.5, avvisi: string[] = [];
  const segs0: Seg[] = [];
  for (const c of x.conduttori) {
    if (c.tipo === "terra") continue;
    for (let i = 1; i < c.punti.length; i++) segs0.push({ a: c.punti[i - 1]!, b: c.punti[i]!, origine: c.id });
  }
  for (const a of x.aste) segs0.push({ a: [a.x, a.y, a.z], b: [a.x, a.y, a.z + a.altezza], origine: `asta:${a.id}`, punta: true });
  const segs = spezza(segs0.filter((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]) > 1e-3));
  // nodi
  const idx = new Map<string, number>(), P: Punto3[] = [], punta = new Set<number>();
  const nodo = (p: Punto3) => { const k = chiave(p); let i = idx.get(k); if (i == null) { i = P.length; idx.set(k, i); P.push(p); } return i; };
  const tratti: TrattoRete[] = [];
  for (const s of segs) { const a = nodo(s.a), b = nodo(s.b); if (a === b) continue; tratti.push({ a, b, l: Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]), origine: s.origine, kc: 0 }); if (s.punta) punta.add(b); }
  const n = P.length;
  const vuoto: RisultatoSeparazioneNodi = { nodi: [], tratti: [], ki, kmSolido: kmS, peggiore: null, nonCollegate: [], violazioni: [], collegati: [], avvisi };
  if (!n) { avvisi.push("Nessun conduttore o asta nel progetto."); return vuoto; }
  if (n > MAX_NODI) { avvisi.push(`Rete troppo grande per il calcolo ai nodi (${n} nodi, massimo ${MAX_NODI}): usa il metodo semplificato.`); return vuoto; }
  // terra: piedi delle calate (quota ≤ 0,6 m); se non ce ne sono, i nodi più bassi
  const zMin = Math.min(...P.map((p) => p[2]));
  let terra = P.map((p) => p[2] <= 0.6);
  if (!terra.some(Boolean)) { terra = P.map((p) => p[2] <= zMin + 0.3); avvisi.push("Nessuna calata arriva a terra: come collegamento equipotenziale sono presi i punti più bassi della rete."); }
  // componenti connesse senza terra
  const adj: number[][] = P.map(() => []);
  for (const t of tratti) { adj[t.a]!.push(t.b); adj[t.b]!.push(t.a); }
  const comp = new Int32Array(n).fill(-1); let nc = 0; const conTerra: boolean[] = [];
  for (let i = 0; i < n; i++) if (comp[i]! < 0) { const st = [i]; comp[i] = nc; let ha = false; while (st.length) { const u = st.pop()!; if (terra[u]) ha = true; for (const v of adj[u]!) if (comp[v]! < 0) { comp[v] = nc; st.push(v); } } conTerra.push(ha); nc++; }
  const nonCollegate = [...new Set(tratti.filter((t) => !conTerra[comp[t.a]!]).map((t) => t.origine))];
  // sistema ridotto: incognite = nodi non a terra delle componenti con terra
  const inc: number[] = [], pos = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (!terra[i] && conTerra[comp[i]!]) { pos[i] = inc.length; inc.push(i); }
  const m = inc.length, A = new Float64Array(m * m);
  for (const t of tratti) {
    const g = 1 / Math.max(t.l, 0.01), pa = pos[t.a]!, pb = pos[t.b]!;
    const agg = (k: number, v: number) => { A[k] = (A[k] ?? 0) + v; };
    if (pa >= 0) agg(pa * m + pa, g);
    if (pb >= 0) agg(pb * m + pb, g);
    if (pa >= 0 && pb >= 0) { agg(pa * m + pb, -g); agg(pb * m + pa, -g); }
  }
  const V = new Float64Array(n).fill(NaN);
  for (let i = 0; i < n; i++) if (terra[i] && conTerra[comp[i]!]) V[i] = 0;
  let peggioreIdx = -1;
  if (m) {
    const L = cholesky(A, m);
    if (!L) { avvisi.push("Calcolo ai nodi non riuscito (rete non risolvibile)."); return { ...vuoto, nonCollegate }; }
    const dg = diagonaleInversa(L, m);
    inc.forEach((i, k) => { V[i] = dg[k]!; });
    // fulmine sul nodo peggiore: correnti nei tratti (kc)
    let vm = -1; inc.forEach((i, k) => { if (dg[k]! > vm) { vm = dg[k]!; peggioreIdx = i; } });
    const b = new Float64Array(m); b[pos[peggioreIdx]!] = 1;
    const pot = risolvi(L, m, b), Vp = (i: number) => (pos[i]! >= 0 ? pot[pos[i]!]! : 0);
    for (const t of tratti) if (conTerra[comp[t.a]!]) t.kc = Math.abs(Vp(t.a) - Vp(t.b)) / Math.max(t.l, 0.01);
  }
  const nodi: NodoRete[] = P.map((p, i) => ({ id: i, p, terra: !!terra[i], punta: punta.has(i), V: V[i]!, sAria: ki * V[i]!, sSolido: (ki / kmS) * V[i]! }));
  const peggiore = peggioreIdx >= 0 ? nodi[peggioreIdx]! : null;
  // impianti sul tetto (corpi appoggiati su altre coperture): distanza dalla rete e s nel punto più vicino
  const violazioni: ViolazioneImpianto[] = [], collegati: string[] = [];
  const corpi = x.corpi ?? [];
  for (const c of corpi) {
    if ((c.quotaBase ?? 0) < 0.1 || !corpi.some((o) => o.id !== c.id && c.impronta.every(([px, py]) => puntoInPoligono(px, py, o.impronta)))) continue;
    const zt = (c.quotaBase ?? 0) + c.altezzaGronda, campioni: Punto3[] = [];
    c.impronta.forEach((q, i) => { const r = c.impronta[(i + 1) % c.impronta.length]!; for (const z of [zt, c.quotaBase ?? 0]) { campioni.push([q[0], q[1], z]); campioni.push([(q[0] + r[0]) / 2, (q[1] + r[1]) / 2, z]); } });
    let best: { d: number; s: number; q: Punto3 } | null = null;
    for (const t of tratti) {
      if (!Number.isFinite(V[t.a]!) || !Number.isFinite(V[t.b]!)) continue;
      const a = P[t.a]!, bb = P[t.b]!, v: Punto3 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]], L2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
      for (const q of campioni) {
        const tt = L2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * v[0] + (q[1] - a[1]) * v[1] + (q[2] - a[2]) * v[2]) / L2)) : 0;
        const pq: Punto3 = [a[0] + v[0] * tt, a[1] + v[1] * tt, a[2] + v[2] * tt], d = Math.hypot(pq[0] - q[0], pq[1] - q[1], pq[2] - q[2]);
        const s = ki * (V[t.a]! + (V[t.b]! - V[t.a]!) * tt);
        if (!best || d - s < best.d - best.s) best = { d, s, q: pq };
      }
    }
    if (!best) continue;
    if (best.d <= 0.02) collegati.push(c.nome || c.id);
    else if (best.d < best.s) violazioni.push({ nome: c.nome || c.id, corpoId: c.id, d: best.d, s: best.s, punto: best.q });
  }
  if (nonCollegate.some((o) => o.startsWith("asta:"))) avvisi.push("Ci sono aste non collegate alla rete: senza collegamento a terra la corrente non ha un percorso definito. Collegale alla captazione più vicina.");
  return { nodi, tratti, ki, kmSolido: kmS, peggiore, nonCollegate, violazioni, collegati, avvisi };
}

/** Colore da verde (s piccola) a rosso (s massima) per la vista. */
export function coloreS(s: number, sMax: number): string {
  const t = sMax > 0 ? Math.max(0, Math.min(1, s / sMax)) : 0;
  const h = 120 - 120 * t; return `hsl(${h.toFixed(0)} 75% 42%)`;
}
