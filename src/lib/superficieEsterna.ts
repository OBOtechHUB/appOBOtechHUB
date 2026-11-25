/**
 * Modelli 3D di edifici complessi (IFC con migliaia di elementi): si tiene quello che conta per la protezione
 * contro i fulmini, cioè la superficie esterna, e si ricava l'impronta reale.
 * Mappa delle altezze su una griglia in pianta: per ogni cella la quota più alta del modello.
 *  - priorità 1: triangoli che formano la superficie superiore (coperture, parapetti, volumi tecnici);
 *  - priorità 2: pareti e facce ripide che arrivano in cima alla colonna di celle che toccano (facciate, parapetti);
 *  - priorità 3: tutto il resto (solai interni, pilastri, impianti nascosti), tolto per primo.
 * L'impronta è il contorno esterno delle celle occupate (buchi interni riempiti), semplificato.
 */
type P2 = [number, number];

interface Griglia { x0: number; y0: number; c: number; nx: number; ny: number; zmax: Float32Array }

function limiti(tri: ArrayLike<number>) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < tri.length; i += 3) { const x = tri[i]!, y = tri[i + 1]!; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

/** Celle (indici) coperte dalla proiezione del triangolo, con la quota del triangolo al centro della cella (o la sua quota massima se è quasi verticale). */
function perCella(g: Griglia, tri: ArrayLike<number>, b: number, f: (cella: number, z: number, verticale: boolean) => void) {
  const ax = tri[b]!, ay = tri[b + 1]!, az = tri[b + 2]!, bx = tri[b + 3]!, by = tri[b + 4]!, bz = tri[b + 5]!, cx = tri[b + 6]!, cy = tri[b + 7]!, cz = tri[b + 8]!;
  const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - g.x0) / g.c)), i1 = Math.min(g.nx - 1, Math.floor((Math.max(ax, bx, cx) - g.x0) / g.c));
  const j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - g.y0) / g.c)), j1 = Math.min(g.ny - 1, Math.floor((Math.max(ay, by, cy) - g.y0) / g.c));
  const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  const area2 = Math.abs(den), lato = Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(cx - bx, cy - by), Math.hypot(ax - cx, ay - cy), 1e-9);
  const verticale = area2 < 0.15 * g.c * lato; // proiezione in pianta quasi nulla: parete
  if (verticale) {
    // parete: si segue in pianta il suo lato più lungo, cella per cella (non il rettangolo d'ingombro, sbagliato per le pareti oblique)
    const zt = Math.max(az, bz, cz), P = [[ax, ay], [bx, by], [cx, cy]] as const;
    let a = 0, b = 1, dmax = -1; for (const [u, v] of [[0, 1], [1, 2], [2, 0]] as const) { const d = Math.hypot(P[v][0] - P[u][0], P[v][1] - P[u][1]); if (d > dmax) { dmax = d; a = u; b = v; } }
    const passi = Math.max(1, Math.ceil(dmax / (g.c * 0.5))), visti = new Set<number>();
    for (let s2 = 0; s2 <= passi; s2++) { const tt = s2 / passi, x = P[a][0] + (P[b][0] - P[a][0]) * tt, y = P[a][1] + (P[b][1] - P[a][1]) * tt;
      const i = Math.min(g.nx - 1, Math.max(0, Math.floor((x - g.x0) / g.c))), j = Math.min(g.ny - 1, Math.max(0, Math.floor((y - g.y0) / g.c))), k = j * g.nx + i;
      if (!visti.has(k)) { visti.add(k); f(k, zt, true); } }
    return;
  }
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = g.x0 + (i + 0.5) * g.c, py = g.y0 + (j + 0.5) * g.c;
    const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, l3 = 1 - l1 - l2;
    const m = -0.5 * g.c / lato * 2; // piccola tolleranza: i triangoli sottili toccano comunque la loro cella
    if (l1 >= m && l2 >= m && l3 >= m) f(j * g.nx + i, l1 * az + l2 * bz + l3 * cz, false);
  }
  // triangolo più piccolo della cella: conta nella cella del baricentro
  if (i0 === i1 && j0 === j1) f(j0 * g.nx + i0, (az + bz + cz) / 3, false);
}

function creaGriglia(tri: ArrayLike<number>, celle = 250000): Griglia | null {
  const n = Math.floor(tri.length / 9); if (!n) return null;
  const { x0, y0, x1, y1 } = limiti(tri); const w = Math.max(x1 - x0, 1e-6), h = Math.max(y1 - y0, 1e-6);
  const c = Math.max(Math.sqrt((w * h) / celle), Math.max(w, h) / 1500);
  const nx = Math.max(1, Math.ceil(w / c) + 1), ny = Math.max(1, Math.ceil(h / c) + 1);
  const g: Griglia = { x0, y0, c, nx, ny, zmax: new Float32Array(nx * ny).fill(-Infinity) };
  for (let t = 0; t < n; t++) perCella(g, tri, t * 9, (k, z) => { if (z > g.zmax[k]!) g.zmax[k] = z; });
  return g;
}

/** Priorità di ogni triangolo (1 superficie superiore, 2 facciata esterna, 3 interno). */
export function prioritaTriangoli(tri: ArrayLike<number>, tolleranza = 0.3): Uint8Array {
  const n = Math.floor(tri.length / 9), pr = new Uint8Array(n).fill(3), g = creaGriglia(tri); if (!g) return pr;
  for (let t = 0; t < n; t++) {
    let p = 3;
    perCella(g, tri, t * 9, (k, z, vert) => { if (p === 1) return; if (vert ? z >= g.zmax[k]! - 0.08 : z >= g.zmax[k]! - tolleranza) p = vert ? Math.min(p, 2) : 1; });
    pr[t] = p;
  }
  // facciate: una parete è esterna anche se non arriva in cima, quando confina con celle vuote (fuori dall'edificio)
  for (let t = 0; t < n; t++) {
    if (pr[t] !== 3) continue;
    let esterna = false;
    perCella(g, tri, t * 9, (k, _z, vert) => {
      if (!vert || esterna) return; const i = k % g.nx, j = (k - i) / g.nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny || g.zmax[jj * g.nx + ii] === -Infinity) { esterna = true; return; } }
    });
    if (esterna) pr[t] = 2;
  }
  return pr;
}

/** Impronta reale (contorno esterno, buchi riempiti, semplificato) dai triangoli in pianta. */
export function improntaDaTriangoli(tri: ArrayLike<number>): P2[] {
  const g = creaGriglia(tri, 90000); if (!g) return [];
  const { nx, ny } = g, occ = new Uint8Array(nx * ny);
  for (let k = 0; k < occ.length; k++) occ[k] = g.zmax[k]! > -Infinity ? 1 : 0;
  // chiude piccoli varchi (giunti, pilastri isolati) con una dilatazione seguita da erosione di una cella
  const dil = new Uint8Array(occ); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (occ[j * nx + i]) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) dil[jj * nx + ii] = 1; }
  // esterno: riempimento dal bordo della griglia (allargata di una cella)
  const W = nx + 2, H = ny + 2, pieno = (i: number, j: number) => i >= 1 && j >= 1 && i <= nx && j <= ny && dil[(j - 1) * nx + (i - 1)] === 1;
  const fuori = new Uint8Array(W * H), coda: number[] = [0]; fuori[0] = 1;
  while (coda.length) { const k = coda.pop()!, i = k % W, j = (k - i) / W; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const q = jj * W + ii; if (fuori[q] || pieno(ii, jj)) continue; fuori[q] = 1; coda.push(q); } }
  const dentro = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && !fuori[j * W + i];
  // spigoli orientati del contorno (interno a sinistra), poi concatenati
  const succ = new Map<string, string[]>(), add = (a: string, b: string) => { const l = succ.get(a); if (l) l.push(b); else succ.set(a, [b]); };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!dentro(i, j)) continue;
    if (!dentro(i, j - 1)) add(`${i},${j}`, `${i + 1},${j}`);
    if (!dentro(i + 1, j)) add(`${i + 1},${j}`, `${i + 1},${j + 1}`);
    if (!dentro(i, j + 1)) add(`${i + 1},${j + 1}`, `${i},${j + 1}`);
    if (!dentro(i - 1, j)) add(`${i},${j + 1}`, `${i},${j}`);
  }
  let migliore: P2[] = [];
  while (succ.size) {
    const inizio = succ.keys().next().value as string; const anello: string[] = [inizio]; let cur = inizio;
    for (let guard = 0; guard < 4 * W * H; guard++) { const l = succ.get(cur); if (!l || !l.length) break; const nxt = l.pop()!; if (!l.length) succ.delete(cur); if (nxt === inizio) break; anello.push(nxt); cur = nxt; }
    if (anello.length > migliore.length) migliore = anello.map((s) => { const [a, b] = s.split(",").map(Number); return [g.x0 + (a! - 1) * g.c, g.y0 + (b! - 1) * g.c] as P2; });
  }
  return semplifica(migliore, Math.max(0.4, g.c * 1.5));
}

/** Douglas–Peucker su poligono chiuso. */
function semplifica(p: P2[], tol: number): P2[] {
  if (p.length < 4) return p;
  let far = 0, dm = 0; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i]![0] - p[0]![0], p[i]![1] - p[0]![1]); if (d > dm) { dm = d; far = i; } }
  const ring = [...p, p[0]!], keep = new Set<number>([0, far]);
  const dp = (a: number, b: number) => {
    let dmax = 0, k = -1; const [x1, y1] = ring[a]!, [x2, y2] = ring[b]!, L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((x2 - x1) * (y1 - ring[i]![1]) - (x1 - ring[i]![0]) * (y2 - y1)) / L; if (d > dmax) { dmax = d; k = i; } }
    if (dmax > tol && k > 0) { keep.add(k % p.length); dp(a, k); dp(k, b); }
  };
  dp(0, far); dp(far, p.length);
  return [...keep].sort((a, b) => a - b).map((i) => p[i]!);
}
