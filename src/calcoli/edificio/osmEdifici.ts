/**
 * Edifici da OpenStreetMap (Overpass, "out geom"): contorni, parti dell'edificio (building:part, Simple 3D
 * Buildings) e altezze dai tag (height, min_height, building:levels, roof:shape/roof:height).
 * Logica pura: nessun accesso a rete.
 */
import { locale } from "./geometria";
import type { Corpo } from "./tipi";

type LL = [number, number];
interface ElementoOSM { type: string; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[]; members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[] }
export interface EdificioOSM {
  id: string; nome: string; punti: LL[]; parte: boolean;
  altezza: number | null; quotaBase: number; tetto: "piano" | "falde"; altezzaTetto: number; stimata: boolean;
  /** parti (building:part) dentro il contorno */
  parti: EdificioOSM[];
}

/** numero da un tag OSM: "12", "12.5", "12,5 m", "40 ft" */
export function numeroTag(v: string | undefined): number | null {
  if (!v) return null;
  const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return /ft|'/.test(v) ? n * 0.3048 : n;
}

function anello(el: ElementoOSM): LL[] | null {
  if (el.geometry?.length) return el.geometry.map((p) => [p.lat, p.lon]);
  const tratti = (el.members ?? []).filter((m) => m.type === "way" && m.role !== "inner" && m.geometry?.length).map((m) => m.geometry!.map((p) => [p.lat, p.lon] as LL));
  if (!tratti.length) return null;
  // unisce i tratti del contorno esterno per estremi in comune
  const uguale = (a: LL, b: LL) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  let anelloOut = tratti.shift()!;
  let giri = 0;
  while (tratti.length && giri++ < 1000) {
    const fine = anelloOut[anelloOut.length - 1]!;
    const i = tratti.findIndex((t) => uguale(t[0]!, fine) || uguale(t[t.length - 1]!, fine));
    if (i < 0) break;
    const t = tratti.splice(i, 1)[0]!;
    anelloOut = anelloOut.concat((uguale(t[0]!, fine) ? t : [...t].reverse()).slice(1));
  }
  return anelloOut;
}

export function puntoDentro(p: LL, poli: LL[]): boolean {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [yi, xi] = poli[i]!, [yj, xj] = poli[j]!;
    if ((yi > p[0]) !== (yj > p[0]) && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
const centro = (pts: LL[]): LL => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

export function edificiDaOverpass(json: { elements?: ElementoOSM[] }): EdificioOSM[] {
  const tutti: EdificioOSM[] = [];
  for (const el of json.elements ?? []) {
    const t = el.tags ?? {}, parte = !!t["building:part"] && !t["building"];
    if (!t["building"] && !t["building:part"]) continue;
    let pts = anello(el); if (!pts || pts.length < 4) continue;
    const a = pts[0]!, b = pts[pts.length - 1]!; if (a[0] === b[0] && a[1] === b[1]) pts = pts.slice(0, -1);
    if (pts.length < 3) continue;
    const livelli = numeroTag(t["building:levels"]), hTetto = numeroTag(t["roof:height"]) ?? (numeroTag(t["roof:levels"]) ?? 0) * 3;
    let h = numeroTag(t["height"]), stimata = false;
    if (h == null && livelli != null) { h = livelli * 3 + hTetto; stimata = true; }
    const base = numeroTag(t["min_height"]) ?? (numeroTag(t["building:min_level"]) ?? 0) * 3;
    const forma = (t["roof:shape"] ?? "").toLowerCase();
    tutti.push({ id: `${el.type}/${el.id}`, nome: t["name"] || (parte ? "Parte di edificio" : "Edificio OSM"), punti: pts, parte, altezza: h, quotaBase: base, tetto: /gabled|hipped|pitched|mansard/.test(forma) && hTetto > 0 ? "falde" : "piano", altezzaTetto: hTetto, stimata, parti: [] });
  }
  const contorni = tutti.filter((e) => !e.parte), parti = tutti.filter((e) => e.parte);
  for (const p of parti) { const c = centro(p.punti), padre = contorni.find((e) => puntoDentro(c, e.punti)); if (padre) padre.parti.push(p); else contorni.push(p); }
  return contorni;
}

/** Corpi da edifici scelti: le parti (se ci sono) al posto del contorno; altezza mancante = altezzaDefault */
export function corpiDaOsm(scelti: EdificioOSM[], origine: { lat: number; lon: number }, altezzaDefault: number): Corpo[] {
  const out: Corpo[] = [];
  for (const e of scelti) for (const x of e.parti.length ? e.parti : [e]) {
    const top = x.altezza ?? (x === e ? altezzaDefault : e.altezza ?? altezzaDefault);
    const base = Math.min(x.quotaBase, Math.max(top - 0.5, 0));
    const tot = Math.max(top - base, 0.5);
    const falde = x.tetto === "falde" && x.altezzaTetto > 0 && x.altezzaTetto < tot;
    const gronda = falde ? tot - x.altezzaTetto : tot;
    out.push({ id: crypto.randomUUID(), nome: x.nome, impronta: x.punti.map(([lat, lon]) => locale(lat, lon, origine)), quotaBase: Math.round(base * 100) / 100, altezzaGronda: Math.round(gronda * 100) / 100, tipoTetto: falde ? "falde" : "piano", altezzaColmo: Math.round(tot * 100) / 100 });
  }
  return out;
}

export const queryOverpass = (s: number, w: number, n: number, e: number) =>
  `[out:json][timeout:25];(way["building"](${s},${w},${n},${e});way["building:part"](${s},${w},${n},${e});relation["building"]["type"="multipolygon"](${s},${w},${n},${e});relation["building:part"](${s},${w},${n},${e}););out geom;`;
