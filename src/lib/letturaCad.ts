/** Lettura comune di DXF e DWG: polilinee chiuse, layer, unità dichiarata e testi. Logica senza dipendenze dal browser. */
import { massimo, minimo } from "@/lib/estremi";
import { corpoSchema, type Corpo } from "@/calcoli/edificio/tipi";
import type { Unita } from "@/calcoli/importazione/scala";
import { type PoliCad, type TestoCad } from "@/calcoli/importazione/analisiPianta";
import { contorniDaTratti } from "@/calcoli/importazione/contorni";

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
  /** nessun contorno chiuso nel disegno: i poligoni sono i contorni esterni dei layer, da controllare */
  approssimato?: boolean;
}

/**
 * Tratti del disegno → lettura comune: polilinee chiuse, tratti (linee, archi, polilinee aperte) uniti in contorni chiusi;
 * se non si chiude niente, il contorno esterno di ogni layer (approssimato).
 */
export function letturaDaPolilinee(poli: PoliCad[], unita: Unita | null, prefisso = "DXF", testi: TestoCad[] = []): LetturaCad {
  const { chiusi, approssimati } = contorniDaTratti(poli);
  const approssimato = !chiusi.length && approssimati.length > 0;
  const chiuse = approssimato ? approssimati : chiusi;
  const ingombro = (layer?: string) => {
    const sel = chiuse.filter((p) => !layer || p.layer === layer);
    const xs = sel.flatMap((p) => p.punti.map((q) => q[0])), ys = sel.flatMap((p) => p.punti.map((q) => q[1]));
    return xs.length ? [massimo(xs) - minimo(xs), massimo(ys) - minimo(ys)] : [0, 0];
  };
  // prima i layer con polilinee chiuse (dove di solito c'è l'impronta), poi gli altri
  const conChiuse = [...new Set(chiuse.map((p) => p.layer))];
  const layers = [...conChiuse, ...[...new Set(poli.map((p) => p.layer))].filter((l) => !conChiuse.includes(l))];
  return {
    unita, dimensioni: ingombro(), ingombro, layers, poligoni: chiuse, testi, approssimato,
    corpi: (layer: string) => chiuse.filter((p) => p.layer === layer).map((p, i) => corpoSchema.parse({ id: crypto.randomUUID(), nome: `${prefisso} ${i + 1}`, impronta: p.punti, quotaBase: 0, altezzaGronda: 0, tipoTetto: "piano", altezzaColmo: 0 })),
  };
}

