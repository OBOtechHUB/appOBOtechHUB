/**
 * Contorni chiusi da disegni CAD fatti "come capita": linee singole, archi, polilinee aperte, blocchi.
 * - i tratti (LINE, ARC, polilinee aperte…) si uniscono quando gli estremi coincidono (entro una tolleranza)
 *   e diventano poligoni chiusi;
 * - se in un layer non si chiude niente, si propone il contorno esterno (involucro convesso) di tutto il layer,
 *   segnato come "approssimato", così il disegno si importa comunque e si corregge l'impronta dopo.
 */
import type { PoliCad } from "./analisiPianta";
type P2 = [number, number];

/** Arco o cerchio in polilinea (angoli in radianti, verso antiorario). */
export function arcoInPunti(cx: number, cy: number, r: number, a0: number, a1: number, cerchio = false): P2[] {
  let fine = a1; if (cerchio) fine = a0 + 2 * Math.PI; else while (fine <= a0) fine += 2 * Math.PI;
  const n = Math.max(cerchio ? 24 : 2, Math.ceil(((fine - a0) / (2 * Math.PI)) * 48));
  const out: P2[] = [];
  for (let i = 0; i <= n - (cerchio ? 1 : 0); i++) { const a = a0 + ((fine - a0) * i) / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}

/** Unisce i tratti aperti di ogni layer in poligoni chiusi (estremi entro `tol`, nelle unità del disegno). */
export function unisciTratti(tratti: PoliCad[], tol: number): PoliCad[] {
  const out: PoliCad[] = [];
  const perLayer = new Map<string, P2[][]>();
  for (const t of tratti) if (!t.chiusa && t.punti.length >= 2) { const l = perLayer.get(t.layer) ?? []; l.push(t.punti); perLayer.set(t.layer, l); }
  const vicini = (a: P2, b: P2) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;
  for (const [layer, lista] of perLayer) {
    if (lista.length > 20000) continue; // disegni enormi: si usa il contorno del layer
    const cella = Math.max(tol * 2, 1e-9), chiave = (p: P2) => `${Math.round(p[0] / cella)},${Math.round(p[1] / cella)}`;
    const indice = new Map<string, number[]>();
    lista.forEach((t, i) => { for (const p of [t[0]!, t[t.length - 1]!]) { const k = chiave(p); const v = indice.get(k) ?? []; v.push(i); indice.set(k, v); } });
    const usato = new Array<boolean>(lista.length).fill(false);
    const trova = (p: P2): { i: number; inverti: boolean } | null => {
      const [gx, gy] = [Math.round(p[0] / cella), Math.round(p[1] / cella)];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const i of indice.get(`${gx + dx},${gy + dy}`) ?? []) {
        if (usato[i]) continue; const t = lista[i]!;
        if (vicini(t[0]!, p)) return { i, inverti: false };
        if (vicini(t[t.length - 1]!, p)) return { i, inverti: true };
      }
      return null;
    };
    for (let s = 0; s < lista.length; s++) {
      if (usato[s]) continue; usato[s] = true;
      const catena: P2[] = [...lista[s]!];
      for (let passi = 0; passi < 100000; passi++) {
        if (catena.length > 2 && vicini(catena[0]!, catena[catena.length - 1]!)) break;
        const f = trova(catena[catena.length - 1]!); if (!f) break;
        usato[f.i] = true; const t = f.inverti ? [...lista[f.i]!].reverse() : lista[f.i]!; catena.push(...t.slice(1));
      }
      if (catena.length > 3 && vicini(catena[0]!, catena[catena.length - 1]!)) out.push({ layer, punti: catena.slice(0, -1), chiusa: true });
    }
  }
  return out;
}

/** Involucro convesso (catena monotona). */
export function involucroConvesso(punti: P2[]): P2[] {
  const p = [...punti].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const x = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P2[] = [], hi: P2[] = [];
  for (const q of p) { while (lo.length >= 2 && x(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]!; while (hi.length >= 2 && x(hi[hi.length - 2]!, hi[hi.length - 1]!, q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/**
 * Da tutti i tratti di un disegno: polilinee già chiuse + tratti uniti in contorni chiusi; per i layer dove non si chiude
 * niente, il contorno esterno di tutto il layer (`approssimati`).
 */
export function contorniDaTratti(tratti: PoliCad[]): { chiusi: PoliCad[]; approssimati: PoliCad[] } {
  const xs = tratti.flatMap((t) => t.punti.map((p) => p[0])), ys = tratti.flatMap((t) => t.punti.map((p) => p[1]));
  const lato = xs.length ? Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) : 1;
  const tol = Math.max(lato * 2e-4, 1e-6);
  const gia = tratti.filter((t) => t.chiusa || (t.punti.length > 3 && Math.abs(t.punti[0]![0] - t.punti.at(-1)![0]) <= tol && Math.abs(t.punti[0]![1] - t.punti.at(-1)![1]) <= tol));
  const uniti = unisciTratti(tratti.filter((t) => !gia.includes(t)), tol);
  const pulisci = (p: P2[]) => { let q = p.filter((v, i) => i === 0 || Math.abs(v[0] - p[i - 1]![0]) > tol || Math.abs(v[1] - p[i - 1]![1]) > tol); if (q.length > 3 && Math.abs(q[0]![0] - q.at(-1)![0]) <= tol && Math.abs(q[0]![1] - q.at(-1)![1]) <= tol) q = q.slice(0, -1); return q; };
  const chiusi = [...gia.map((t) => ({ ...t, punti: pulisci(t.punti), chiusa: true })).filter((t) => t.punti.length >= 3), ...uniti];
  const conChiusi = new Set(chiusi.map((c) => c.layer));
  const approssimati: PoliCad[] = [];
  const perLayer = new Map<string, P2[]>();
  for (const t of tratti) if (!conChiusi.has(t.layer)) { const l = perLayer.get(t.layer) ?? []; l.push(...t.punti); perLayer.set(t.layer, l); }
  for (const [layer, pts] of perLayer) { const h = involucroConvesso(pts); if (h.length >= 3) approssimati.push({ layer, punti: h, chiusa: true }); }
  return { chiusi, approssimati };
}

// ---------------------------------------------------------------- entità CAD (dxf-parser e LibreDWG) → tratti
type Pt = { x?: unknown; y?: unknown; point?: { x?: unknown; y?: unknown } | undefined } | undefined;
export interface EntitaCad {
  type?: string | undefined; layer?: string | undefined; isInPaperSpace?: boolean | undefined; inPaperSpace?: boolean | undefined; paperSpace?: boolean | undefined;
  vertices?: Pt[] | undefined; shape?: boolean | undefined; flag?: number | undefined; closed?: boolean | undefined;
  startPoint?: Pt | undefined; endPoint?: Pt | undefined; center?: Pt | undefined; centre?: Pt | undefined; radius?: number | undefined; startAngle?: number | undefined; endAngle?: number | undefined;
  controlPoints?: Pt[] | undefined; fitPoints?: Pt[] | undefined; majorAxisEndPoint?: Pt | undefined; axisRatio?: number | undefined;
  name?: string | undefined; blockName?: string | undefined; position?: Pt | undefined; insertionPoint?: Pt | undefined; xScale?: number | undefined; yScale?: number | undefined; rotation?: number | undefined;
}
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const xy = (p: Pt): P2 | null => { const x = n(p?.x) ?? n(p?.point?.x), y = n(p?.y) ?? n(p?.point?.y); return x !== null && y !== null ? [x, y] : null; };
/** Angolo in radianti: alcuni lettori danno i gradi. */
const rad = (a: number | undefined, gradi: boolean) => (a == null ? 0 : gradi ? (a * Math.PI) / 180 : a);

/**
 * Tratti 2D di un elenco di entità: polilinee (aperte e chiuse), linee, archi, cerchi, ellissi, spline e blocchi (INSERT,
 * esplosi con posizione, scala e rotazione, fino a 6 livelli). Lo spazio carta è escluso.
 */
export function trattiDaEntita(entita: EntitaCad[], blocchi: Record<string, EntitaCad[]> = {}, opz: { angoliInGradi?: boolean | "auto"; rotazioneInGradi?: boolean | "auto" } = {}): PoliCad[] {
  const out: PoliCad[] = [];
  const auto = opz.angoliInGradi ?? "auto";
  const visita = (lista: EntitaCad[], tr: (p: P2) => P2, livello: number, layerBlocco?: string) => {
    for (const e of lista) {
      if (e.isInPaperSpace || e.inPaperSpace || e.paperSpace) continue;
      const layer = (e.layer && e.layer !== "0") || !layerBlocco ? e.layer || "0" : layerBlocco;
      const push = (pts: (P2 | null)[], chiusa: boolean) => { const p = pts.filter((q): q is P2 => !!q).map(tr); if (p.length >= 2) out.push({ layer, punti: p, chiusa }); };
      const t = (e.type ?? "").toUpperCase();
      const gradi = auto === "auto" ? Math.abs(e.startAngle ?? 0) > 6.3 || Math.abs(e.endAngle ?? 0) > 6.3 : auto;
      if (t === "LWPOLYLINE" || t === "POLYLINE" || t === "POLYLINE2D" || t === "POLYLINE3D") push((e.vertices ?? []).map(xy), !!e.shape || !!e.closed || ((e.flag ?? 0) & 1) === 1);
      else if (t === "LINE") push(e.vertices?.length ? e.vertices.map(xy) : [xy(e.startPoint), xy(e.endPoint)], false);
      else if (t === "ARC" || t === "CIRCLE") {
        const c = xy(e.center ?? e.centre), r = n(e.radius);
        if (c && r && r > 0) push(arcoInPunti(c[0], c[1], r, t === "CIRCLE" ? 0 : rad(e.startAngle, gradi), t === "CIRCLE" ? 0 : rad(e.endAngle, gradi), t === "CIRCLE"), t === "CIRCLE");
      } else if (t === "ELLIPSE") {
        const c = xy(e.center ?? e.centre), m = xy(e.majorAxisEndPoint), k = n(e.axisRatio) ?? 1;
        if (c && m) {
          const a0 = n(e.startAngle) ?? 0, a1 = n(e.endAngle) ?? 2 * Math.PI, ang = Math.atan2(m[1], m[0]), A = Math.hypot(m[0], m[1]), B = A * k;
          const intera = Math.abs(a1 - a0) >= 2 * Math.PI - 1e-6 || (a0 === 0 && a1 === 0);
          const pts = arcoInPunti(0, 0, 1, a0, intera ? a0 : a1, intera).map(([u, v]) => [c[0] + A * u * Math.cos(ang) - B * v * Math.sin(ang), c[1] + A * u * Math.sin(ang) + B * v * Math.cos(ang)] as P2);
          push(pts, intera);
        }
      } else if (t === "SPLINE") push((e.fitPoints?.length ? e.fitPoints : e.controlPoints ?? []).map(xy), !!e.closed || ((e.flag ?? 0) & 1) === 1);
      else if (t === "INSERT" && livello < 6) {
        const nome = e.name ?? e.blockName ?? "", def = blocchi[nome]; if (!def) continue;
        const p0 = xy(e.position ?? e.insertionPoint) ?? [0, 0], sx = n(e.xScale) ?? 1, sy = n(e.yScale) ?? sx;
        const rotG = opz.rotazioneInGradi ?? "auto", rot = rad(e.rotation, rotG === "auto" ? Math.abs(e.rotation ?? 0) > 6.3 : rotG);
        const cs = Math.cos(rot), sn = Math.sin(rot);
        visita(def, (p) => tr([p0[0] + (p[0] * sx) * cs - (p[1] * sy) * sn, p0[1] + (p[0] * sx) * sn + (p[1] * sy) * cs]), livello + 1, layer);
      }
    }
  };
  visita(entita, (p) => p, 0);
  return out;
}

/** Entità spostata di (dx, dy): serve per riportare i blocchi al loro punto base. */
export function spostaEntita(e: EntitaCad, dx: number, dy: number): EntitaCad {
  const m = (p: Pt): Pt => (p && typeof p.x === "number" && typeof p.y === "number" ? { ...p, x: p.x + dx, y: p.y + dy } : p);
  return { ...e, vertices: e.vertices?.map(m), startPoint: m(e.startPoint), endPoint: m(e.endPoint), center: m(e.center), position: m(e.position), insertionPoint: m(e.insertionPoint), controlPoints: e.controlPoints?.map(m), fitPoints: e.fitPoints?.map(m) };
}
