/** Lettura comune di DXF e DWG: polilinee chiuse, layer, unità dichiarata e testi. Logica senza dipendenze dal browser. */
import { corpoSchema, type Corpo } from "@/calcoli/edificio/tipi";
import type { Unita } from "@/calcoli/importazione/scala";
import { polilineeChiuse, type PoliCad, type TestoCad } from "@/calcoli/importazione/analisiPianta";

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

