/**
 * Modello 3D del progetto LPS per AutoCAD e ZWCAD (DXF con 3DFACE, si ruota e si ombreggia anche in LT):
 * edificio (reale da IFC/3D se c'è, altrimenti estruso dalla pianta, con falde), aste e picchetti a cilindro,
 * conduttori a tubo con il diametro dalla sezione, supporti, morsetti e compensatori a grandezza reale.
 * Coordinate in metri, Z in alto. Logica pura.
 */
import type { Mesh3D } from "../modelli3d/dxf3d";

type P3 = [number, number, number];
export interface CorpoM { id?: string; nome?: string | undefined; impronta: [number, number][]; quotaBase?: number | undefined; altezzaGronda: number; tipoTetto?: string | undefined; altezzaColmo?: number | undefined; mesh?: { posizioni: ArrayLike<number>; indici?: ArrayLike<number> | undefined } | undefined }
export interface Ingresso3D {
  corpi: CorpoM[];
  aste?: { x: number; y: number; z?: number | null | undefined; altezza: number; diametro?: number | null | undefined }[];
  conduttori?: { tipo: string; sezione?: number | null | undefined; punti: P3[] }[];
  supporti?: { x: number; y: number; z: number; tipo?: string | undefined; rotazione?: number | undefined }[];
  morsetti?: { x: number; y: number; z: number; tipo?: string | undefined; rotazione?: number | undefined }[];
  picchetti?: { x: number; y: number; z?: number | null | undefined; lunghezza: number; diametro?: number | null | undefined }[];
}

class Raccolta { p: number[] = []; tri(a: P3, b: P3, c: P3) { this.p.push(...a, ...b, ...c); } quad(a: P3, b: P3, c: P3, d: P3) { this.tri(a, b, c); this.tri(a, c, d); } }
const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: P3, k: number): P3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: P3): P3 => { const l = Math.hypot(...a); return l > 1e-12 ? mul(a, 1 / l) : a; };

/** cilindro (o tubo) da a a b, raggio r, n lati, tappi opzionali */
export function cilindro(R: Raccolta, a: P3, b: P3, r: number, n = 10, tappi = true) {
  const asse = sub(b, a); if (Math.hypot(...asse) < 1e-9) return;
  const u = norm(asse), v = norm(cross(u, Math.abs(u[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), w = cross(u, v);
  const anello = (c: P3) => Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n; return add(c, add(mul(v, r * Math.cos(t)), mul(w, r * Math.sin(t)))); });
  const A = anello(a), B = anello(b);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; R.quad(A[i]!, A[j]!, B[j]!, B[i]!); if (tappi) { R.tri(a, A[j]!, A[i]!); R.tri(b, B[i]!, B[j]!); } }
}
/** scatola con base centrata in c, ruotata di rot gradi intorno a Z */
export function scatola(R: Raccolta, c: P3, dx: number, dy: number, dz: number, rot = 0) {
  const a = (rot * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
  const p = (x: number, y: number, z: number): P3 => [c[0] + x * co - y * si, c[1] + x * si + y * co, c[2] + z];
  const X = dx / 2, Y = dy / 2;
  const v = [p(-X, -Y, 0), p(X, -Y, 0), p(X, Y, 0), p(-X, Y, 0), p(-X, -Y, dz), p(X, -Y, dz), p(X, Y, dz), p(-X, Y, dz)] as P3[];
  for (const [i, j, k, l] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] as const) R.quad(v[i]!, v[j]!, v[k]!, v[l]!);
}

/** triangolazione a orecchie di un poligono semplice (indici) */
export function triangola(pts: [number, number][]): [number, number, number][] {
  const n = pts.length; if (n < 3) return [];
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i]!, b = pts[(i + 1) % n]!; area += a[0] * b[1] - b[0] * a[1]; }
  const idx = Array.from({ length: n }, (_, i) => i); if (area < 0) idx.reverse();
  const out: [number, number, number][] = [];
  const dentro = (p: [number, number], a: [number, number], b: [number, number], c: [number, number]) => {
    const d = (p1: [number, number], p2: [number, number], p3: [number, number]) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
    const d1 = d(p, a, b), d2 = d(p, b, c), d3 = d(p, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  let guardia = 0;
  while (idx.length > 3 && guardia++ < n * n) {
    let fatto = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length]!, ib = idx[i]!, ic = idx[(i + 1) % idx.length]!;
      const a = pts[ia]!, b = pts[ib]!, c = pts[ic]!;
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 1e-12) continue;
      if (idx.some((k) => k !== ia && k !== ib && k !== ic && dentro(pts[k]!, a, b, c))) continue;
      out.push([ia, ib, ic]); idx.splice(i, 1); fatto = true; break;
    }
    if (!fatto) break;
  }
  if (idx.length === 3) out.push([idx[0]!, idx[1]!, idx[2]!]);
  else for (let i = 1; i + 1 < idx.length; i++) out.push([idx[0]!, idx[i]!, idx[i + 1]!]); // poligono difficile: ventaglio
  return out;
}

function edificio(R: Raccolta, c: CorpoM) {
  const zb = c.quotaBase ?? 0, zg = zb + c.altezzaGronda;
  if (c.mesh && c.mesh.posizioni.length >= 9) { // edificio reale
    const p = c.mesh.posizioni, ix = c.mesh.indici;
    const v = (i: number): P3 => [p[i * 3] ?? 0, p[i * 3 + 1] ?? 0, (p[i * 3 + 2] ?? 0) + zb];
    const n = ix ? Math.floor(ix.length / 3) : Math.floor(p.length / 9);
    for (let k = 0; k < n; k++) ix ? R.tri(v(ix[k * 3]!), v(ix[k * 3 + 1]!), v(ix[k * 3 + 2]!)) : R.tri(v(k * 3), v(k * 3 + 1), v(k * 3 + 2));
    return;
  }
  const pts = c.impronta, n = pts.length;
  for (let i = 0; i < n; i++) { const a = pts[i]!, b = pts[(i + 1) % n]!; R.quad([a[0], a[1], zb], [b[0], b[1], zb], [b[0], b[1], zg], [a[0], a[1], zg]); }
  const t = triangola(pts);
  for (const [i, j, k] of t) R.tri([pts[k]![0], pts[k]![1], zb], [pts[j]![0], pts[j]![1], zb], [pts[i]![0], pts[i]![1], zb]);
  const colmo = c.tipoTetto === "falde" && (c.altezzaColmo ?? 0) > c.altezzaGronda ? zb + c.altezzaColmo! : null;
  if (colmo != null && n === 4) { // falde sul lato lungo
    const [a, b, cc, d] = pts as [[number, number], [number, number], [number, number], [number, number]];
    const lungoAB = Math.hypot(b[0] - a[0], b[1] - a[1]) >= Math.hypot(cc[0] - b[0], cc[1] - b[1]);
    const m = (p: [number, number], q: [number, number]): P3 => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, colmo];
    const g = (p: [number, number]): P3 => [p[0], p[1], zg];
    if (lungoAB) { const m1 = m(a, d), m2 = m(b, cc); R.quad(g(a), g(b), m2, m1); R.quad(g(cc), g(d), m1, m2); R.tri(g(d), g(a), m1); R.tri(g(b), g(cc), m2); }
    else { const m1 = m(a, b), m2 = m(d, cc); R.quad(g(b), g(cc), m2, m1); R.quad(g(d), g(a), m1, m2); R.tri(g(a), g(b), m1); R.tri(g(cc), g(d), m2); }
  } else for (const [i, j, k] of t) R.tri([pts[i]![0], pts[i]![1], zg], [pts[j]![0], pts[j]![1], zg], [pts[k]![0], pts[k]![1], zg]);
}

function componente(R: Raccolta, s: { x: number; y: number; z: number; tipo?: string | undefined; rotazione?: number | undefined }, morsetto: boolean) {
  const t = (s.tipo ?? "").toUpperCase(), c: P3 = [s.x, s.y, s.z], rot = s.rotazione ?? 0;
  if (/COMPENS/.test(t)) return scatola(R, c, 0.12, 0.03, 0.04, rot);
  if (morsetto) return scatola(R, c, 0.05, 0.04, 0.025, rot);
  if (/PARETE|MURO|FACCIATA|GRONDA/.test(t)) return scatola(R, c, 0.035, 0.03, 0.06, rot);
  if (/CLS|CEMENTO|BASE|PIANO|FB|TETTO/.test(t)) { cilindro(R, c, [c[0], c[1], c[2] + 0.07], 0.075, 12); cilindro(R, [c[0], c[1], c[2] + 0.07], [c[0], c[1], c[2] + 0.1], 0.012, 8); return; }
  cilindro(R, c, [c[0], c[1], c[2] + 0.05], 0.05, 10);
}

/** Meshes del modello 3D, una per layer (LPS-3D-…), con i colori dello standard */
export function modello3D(m: Ingresso3D): Mesh3D[] {
  const L: Record<string, { R: Raccolta; colore: [number, number, number] }> = {};
  const lay = (nome: string, colore: [number, number, number]) => (L[nome] ??= { R: new Raccolta(), colore }).R;
  for (const c of m.corpi) edificio(lay("LPS-3D-EDIFICIO", [0.75, 0.75, 0.75]), c);
  for (const a of m.aste ?? []) { const z = a.z ?? 0; cilindro(lay("LPS-3D-ASTE", [1, 0, 0]), [a.x, a.y, z], [a.x, a.y, z + a.altezza], Math.max((a.diametro ?? 0.016) / 2, 0.004), 10); }
  for (const c of m.conduttori ?? []) {
    const r = c.sezione && c.sezione > 0 ? Math.sqrt(c.sezione / Math.PI) / 1000 : 0.004;
    const nome = c.tipo === "calata" ? "LPS-3D-CALATE" : /terra|anello|dispersore|uscita/.test(c.tipo) ? "LPS-3D-TERRA" : "LPS-3D-CAPTAZIONE";
    const R = lay(nome, nome === "LPS-3D-CALATE" ? [0, 0, 1] : nome === "LPS-3D-TERRA" ? [0, 0.6, 0] : [1, 0.5, 0]);
    for (let i = 1; i < c.punti.length; i++) cilindro(R, c.punti[i - 1]!, c.punti[i]!, r, 8, false);
  }
  for (const s of m.supporti ?? []) componente(lay("LPS-3D-SUPPORTI", [0, 1, 1]), s, false);
  for (const s of m.morsetti ?? []) componente(lay("LPS-3D-MORSETTI", [1, 0, 1]), s, true);
  for (const q of m.picchetti ?? []) { const z = q.z ?? 0; cilindro(lay("LPS-3D-TERRA", [0, 0.6, 0]), [q.x, q.y, z - q.lunghezza], [q.x, q.y, z], Math.max((q.diametro ?? 0.02) / 2, 0.005), 10); }
  return Object.entries(L).filter(([, v]) => v.R.p.length).map(([nome, v]) => ({ nome, posizioni: v.R.p, colore: v.colore }));
}
