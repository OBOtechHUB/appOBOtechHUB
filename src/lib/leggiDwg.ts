/**
 * Lettura dei DWG nel browser con LibreDWG (@mlightcad/libredwg-web, WebAssembly, licenza GPL-3.0):
 * la libreria si carica solo quando si apre un DWG. Dal disegno si prendono le polilinee chiuse
 * (impronte dei corpi), i layer e l'unità dichiarata ($INSUNITS), come per il DXF.
 */
import { risorsa } from "@/lib/base";
import { corpoSchema, type Corpo } from "@/calcoli/edificio/tipi";
import { unitaDaInsunits, type Unita } from "@/calcoli/importazione/scala";

import { polilineeChiuse, type PoliCad, type TestoCad } from "@/calcoli/importazione/analisiPianta";
export type { PoliCad, TestoCad } from "@/calcoli/importazione/analisiPianta";

/** Struttura comune alla lettura di DXF e DWG: unità, ingombro, layer e corpi da un layer. */
export interface LetturaCad {
  unita: Unita | null;
  dimensioni: number[];
  ingombro: (layer?: string) => number[];
  layers: string[];
  corpi: (layer: string) => Corpo[];
  /** polilinee chiuse di tutti i layer (per l'analisi della pianta) */
  poligoni: PoliCad[];
  /** testi del disegno (per leggere altezze e nomi) */
  testi: TestoCad[];
}

/** Polilinee chiuse (flag "chiusa" oppure ultimo vertice uguale al primo) → lettura comune. */
export function letturaDaPolilinee(poli: PoliCad[], unita: Unita | null, prefisso = "DXF", testi: TestoCad[] = []): LetturaCad {
  const chiuse = polilineeChiuse(poli);
  const ingombro = (layer?: string) => {
    const sel = chiuse.filter((p) => !layer || p.layer === layer);
    const xs = sel.flatMap((p) => p.punti.map((q) => q[0])), ys = sel.flatMap((p) => p.punti.map((q) => q[1]));
    return xs.length ? [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)] : [0, 0];
  };
  // prima i layer con polilinee chiuse (dove di solito c'è l'impronta), poi gli altri
  const conChiuse = [...new Set(chiuse.map((p) => p.layer))];
  const layers = [...conChiuse, ...[...new Set(poli.map((p) => p.layer))].filter((l) => !conChiuse.includes(l))];
  return {
    unita, dimensioni: ingombro(), ingombro, layers, poligoni: chiuse, testi,
    corpi: (layer: string) => chiuse.filter((p) => p.layer === layer).map((p, i) => corpoSchema.parse({ id: crypto.randomUUID(), nome: `${prefisso} ${i + 1}`, impronta: p.punti, quotaBase: 0, altezzaGronda: 0, tipoTetto: "piano", altezzaColmo: 0 })),
  };
}

type Vertice = { x?: unknown; y?: unknown; point?: { x?: unknown; y?: unknown } };
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Polilinee (LWPOLYLINE e POLYLINE2D) dello spazio modello di un DWG convertito da LibreDWG. */
export function polilineeDaDatabase(db: { entities?: unknown[] }): PoliCad[] {
  const out: PoliCad[] = [];
  for (const raw of db.entities ?? []) {
    const e = raw as { type?: string; layer?: string; flag?: number; isInPaperSpace?: boolean; vertices?: Vertice[] };
    if (e.isInPaperSpace || (e.type !== "LWPOLYLINE" && e.type !== "POLYLINE2D") || !Array.isArray(e.vertices)) continue;
    const punti: [number, number][] = [];
    for (const v of e.vertices) {
      const x = numero(v.x) ?? numero(v.point?.x), y = numero(v.y) ?? numero(v.point?.y);
      if (x !== null && y !== null) punti.push([x, y]);
    }
    if (punti.length >= 2) out.push({ layer: e.layer || "0", punti, chiusa: ((e.flag ?? 0) & 1) === 1 });
  }
  return out;
}

/** Testi (TEXT e MTEXT) dello spazio modello di un DWG convertito da LibreDWG. */
export function testiDaDatabase(db: { entities?: unknown[] }): TestoCad[] {
  const out: TestoCad[] = [];
  for (const raw of db.entities ?? []) {
    const e = raw as { type?: string; layer?: string; isInPaperSpace?: boolean; text?: unknown; startPoint?: Vertice["point"]; insertionPoint?: Vertice["point"]; position?: Vertice["point"] };
    if (e.isInPaperSpace || (e.type !== "TEXT" && e.type !== "MTEXT") || typeof e.text !== "string") continue;
    const p = e.insertionPoint ?? e.startPoint ?? e.position, x = numero(p?.x), y = numero(p?.y);
    if (x !== null && y !== null) out.push({ layer: e.layer || "0", x, y, testo: e.text });
  }
  return out;
}

type Libreria = { dwg_read_data: (c: ArrayBuffer, t: number) => number | undefined; convert: (p: number) => { entities?: unknown[]; header?: { INSUNITS?: number } }; dwg_free: (p: number) => void };
let libreria: Promise<{ lib: Libreria; tipoDwg: number }> | null = null;

async function caricaLibreria(cartellaWasm?: string) {
  if (!libreria) {
    libreria = (async () => {
      const m = await import("@mlightcad/libredwg-web");
      // cartella senza barra finale: la libreria aggiunge "/libredwg-web.wasm"
      const cartella = (cartellaWasm ?? (typeof window !== "undefined" ? new URL(risorsa("wasm"), window.location.origin).href : "./node_modules/@mlightcad/libredwg-web/wasm")).replace(/\/+$/, "");
      const lib = (await m.LibreDwg.create(cartella)) as unknown as Libreria;
      return { lib, tipoDwg: Number(m.Dwg_File_Type.DWG) };
    })();
    libreria.catch(() => { libreria = null; });
  }
  return libreria;
}

/** Legge un DWG (AutoCAD R14–2018 e successivi supportati da LibreDWG). */
export async function leggiDWG(file: File, cartellaWasm?: string): Promise<LetturaCad> {
  if (file.size > 80_000_000) throw new Error("DWG oltre 80 MB.");
  let lettore: { lib: Libreria; tipoDwg: number };
  try { lettore = await caricaLibreria(cartellaWasm); } catch { throw new Error("Lettore DWG non disponibile in questo momento: riprova, oppure salva il disegno come DXF."); }
  const ptr = lettore.lib.dwg_read_data(await file.arrayBuffer(), lettore.tipoDwg);
  if (ptr === undefined || ptr === 0) throw new Error("DWG non leggibile (versione non supportata o file danneggiato): salvalo come DXF dal CAD.");
  try {
    const db = lettore.lib.convert(ptr);
    const poli = polilineeDaDatabase(db);
    if (!poli.length) throw new Error("Nel DWG non ci sono polilinee: l'impronta dell'edificio va disegnata con polilinee chiuse.");
    return letturaDaPolilinee(poli, unitaDaInsunits(db.header?.INSUNITS), "DWG", testiDaDatabase(db));
  } finally {
    try { lettore.lib.dwg_free(ptr); } catch { /* memoria già liberata */ }
  }
}
