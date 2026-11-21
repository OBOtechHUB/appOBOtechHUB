/**
 * Standard CAD LPS OBO: layer, colori, tipi linea e libreria dei simboli 2D.
 * È la definizione unica usata dal DXF del sito e (copiata in LPS.lsp) dal comando LPS-IMPORTA.
 *
 * Colori: indice AutoCAD (ACI), pensati per la stampa con tabella colori (CTB):
 *   7 = nero 0,50 · 1 rosso 0,50 · 30 arancio 0,35 · 3 verde 0,35 · 4/5 ciano/blu 0,25 · 8/9 grigi 0,18 · 2 giallo 0,25
 * Simboli: disegnati in metri per la scala 1:100 (1 m = 10 mm di carta); in tavola si inseriscono con fattore scala/100.
 */

export type TipoLinea = "CONTINUOUS" | "LPS_TRATTEGGIO" | "LPS_TRATTOPUNTO" | "LPS_PUNTINATO";

export interface LayerLps { nome: string; colore: number; linea: TipoLinea; descrizione: string; stampa?: boolean }

export const LAYER_LPS = {
  edificio: { nome: "LPS-EDIF-CONT", colore: 8, linea: "CONTINUOUS", descrizione: "Contorno dell'edificio in pianta" },
  colmo: { nome: "LPS-EDIF-COLM", colore: 9, linea: "LPS_TRATTEGGIO", descrizione: "Colmi e linee di falda" },
  captazione: { nome: "LPS-CAPT-COND", colore: 1, linea: "CONTINUOUS", descrizione: "Conduttori di captazione (maglia)" },
  aste: { nome: "LPS-CAPT-ASTA", colore: 6, linea: "CONTINUOUS", descrizione: "Aste di captazione" },
  calate: { nome: "LPS-CALA", colore: 30, linea: "LPS_TRATTEGGIO", descrizione: "Calate (conduttori di discesa)" },
  calateNum: { nome: "LPS-CALA-NUM", colore: 30, linea: "CONTINUOUS", descrizione: "Numerazione delle calate" },
  terra: { nome: "LPS-TERR-ANEL", colore: 3, linea: "LPS_TRATTOPUNTO", descrizione: "Anello e conduttori di terra" },
  dispersori: { nome: "LPS-TERR-DISP", colore: 3, linea: "CONTINUOUS", descrizione: "Dispersori a picchetto e pozzetti" },
  supporti: { nome: "LPS-SUPP", colore: 4, linea: "CONTINUOUS", descrizione: "Supporti dei conduttori" },
  morsetti: { nome: "LPS-MORS", colore: 5, linea: "CONTINUOUS", descrizione: "Morsetti e connessioni" },
  compensatori: { nome: "LPS-COMP", colore: 5, linea: "CONTINUOUS", descrizione: "Compensatori di dilatazione" },
  particolari: { nome: "LPS-PART", colore: 2, linea: "CONTINUOUS", descrizione: "Richiami ai particolari costruttivi" },
  quote: { nome: "LPS-QUOT", colore: 9, linea: "CONTINUOUS", descrizione: "Quote" },
  testi: { nome: "LPS-TEST", colore: 7, linea: "CONTINUOUS", descrizione: "Testi e diciture" },
  legenda: { nome: "LPS-LEGE", colore: 7, linea: "CONTINUOUS", descrizione: "Legenda e distinta" },
  cartiglio: { nome: "LPS-CART", colore: 7, linea: "CONTINUOUS", descrizione: "Testalino e squadratura" },
  sfera2d: { nome: "LPS-SFERA", colore: 150, linea: "LPS_TRATTEGGIO", descrizione: "Inviluppo della sfera rotolante nei prospetti" },
  avvisi: { nome: "LPS-AVVISI", colore: 1, linea: "CONTINUOUS", descrizione: "Valori oltre i limiti (da verificare)" },
  edificio3d: { nome: "LPS-3D-EDIF", colore: 9, linea: "CONTINUOUS", descrizione: "Modello 3D: edificio", stampa: false },
  captazione3d: { nome: "LPS-3D-CAPT", colore: 1, linea: "CONTINUOUS", descrizione: "Modello 3D: captazione e aste", stampa: false },
  calate3d: { nome: "LPS-3D-CALA", colore: 30, linea: "CONTINUOUS", descrizione: "Modello 3D: calate", stampa: false },
  terra3d: { nome: "LPS-3D-TERR", colore: 3, linea: "CONTINUOUS", descrizione: "Modello 3D: impianto di terra", stampa: false },
  esposto3d: { nome: "LPS-3D-ESPO", colore: 1, linea: "CONTINUOUS", descrizione: "Modello 3D: zone esposte", stampa: false },
} satisfies Record<string, LayerLps>;

export const LAYER_SFERA = (lpl: string): LayerLps => ({ nome: `LPS-3D-SFER-${lpl}`, colore: ({ I: 140, II: 150, III: 160, IV: 170 } as Record<string, number>)[lpl] ?? 150, linea: "CONTINUOUS", descrizione: `Modello 3D: inviluppo della sfera rotolante LPL ${lpl}`, stampa: false });

/** Tipi linea: tratti in metri alla scala 1:100 (positivo = tratto, negativo = spazio, 0 = punto). */
export const TIPI_LINEA: Record<Exclude<TipoLinea, "CONTINUOUS">, { descrizione: string; schema: number[] }> = {
  LPS_TRATTEGGIO: { descrizione: "Tratteggio __ __ __", schema: [0.6, -0.3] },
  LPS_TRATTOPUNTO: { descrizione: "Tratto punto __ . __ .", schema: [1.0, -0.25, 0, -0.25] },
  LPS_PUNTINATO: { descrizione: "Puntinato . . . .", schema: [0, -0.2] },
};

/* ------------------------------------------------------------------ */
/* Libreria simboli 2D                                                  */
/* ------------------------------------------------------------------ */

export type TipoSimbolo = "asta" | "supporto" | "morsetto" | "compensatore" | "picchetto" | "calata" | "richiamo" | "nord";

/** Primitive dei simboli, in metri a scala 1:100, centrate sul punto di inserimento. */
export type Primitiva =
  | { t: "cerchio"; c: [number, number]; r: number }
  | { t: "linea"; a: [number, number]; b: [number, number] }
  | { t: "poli"; p: [number, number][]; chiusa: boolean }
  | { t: "pieno"; p: [number, number][] };

const quadrato = (l: number): [number, number][] => [[-l, -l], [l, -l], [l, l], [-l, l]];

export const SIMBOLI: Record<TipoSimbolo, { nome: string; descrizione: string; primitive: Primitiva[] }> = {
  asta: { nome: "Asta di captazione", descrizione: "cerchio con croce", primitive: [
    { t: "cerchio", c: [0, 0], r: 0.3 }, { t: "cerchio", c: [0, 0], r: 0.1 },
    { t: "linea", a: [-0.45, 0], b: [0.45, 0] }, { t: "linea", a: [0, -0.45], b: [0, 0.45] }] },
  supporto: { nome: "Supporto conduttore", descrizione: "quadratino", primitive: [{ t: "poli", p: quadrato(0.09), chiusa: true }] },
  morsetto: { nome: "Morsetto / connessione", descrizione: "rombo pieno", primitive: [{ t: "pieno", p: [[0, -0.14], [0.14, 0], [0, 0.14], [-0.14, 0]] }] },
  compensatore: { nome: "Compensatore di dilatazione", descrizione: "ansa", primitive: [
    { t: "poli", p: [[-0.25, 0], [-0.12, 0], [-0.12, 0.18], [0.12, 0.18], [0.12, 0], [0.25, 0]], chiusa: false }] },
  picchetto: { nome: "Dispersore a picchetto / pozzetto", descrizione: "quadrato con picchetto", primitive: [
    { t: "poli", p: quadrato(0.3), chiusa: true }, { t: "cerchio", c: [0, 0], r: 0.12 },
    { t: "linea", a: [-0.3, -0.3], b: [0.3, 0.3] }, { t: "linea", a: [-0.3, 0.3], b: [0.3, -0.3] }] },
  calata: { nome: "Calata (punto di discesa)", descrizione: "cerchio con freccia verso il basso", primitive: [
    { t: "cerchio", c: [0, 0], r: 0.25 }, { t: "pieno", p: [[-0.12, 0.06], [0.12, 0.06], [0, -0.14]] }] },
  richiamo: { nome: "Richiamo particolare costruttivo", descrizione: "cerchio con numero", primitive: [
    { t: "cerchio", c: [0, 0], r: 0.45 }, { t: "linea", a: [-0.45, 0], b: [0.45, 0] }] },
  nord: { nome: "Nord", descrizione: "freccia del nord", primitive: [
    { t: "cerchio", c: [0, 0], r: 0.8 }, { t: "pieno", p: [[0, 0.8], [0.3, -0.5], [0, -0.25]] }, { t: "poli", p: [[0, 0.8], [-0.3, -0.5], [0, -0.25]], chiusa: true }] },
};

/** Nome del blocco: OBO_<codice> se c'è il codice articolo (come i blocchi ufficiali OBO), altrimenti LPS_<TIPO>. */
export function nomeBlocco(tipo: TipoSimbolo, codiceOBO?: string | null): string {
  const c = String(codiceOBO ?? "").normalize("NFD").replace(/[^A-Za-z0-9]+/g, "").toUpperCase().slice(0, 40); // solo lettere e cifre, come LPS.lsp
  return c ? `OBO_${c}` : `LPS_${tipo.toUpperCase()}`;
}

/** Tipo di simbolo per un componente del progetto (dal campo tipo dei supporti/morsetti). */
export function tipoSimbolo(gruppo: "aste" | "supporti" | "morsetti" | "compensatori" | "picchetti"): TipoSimbolo {
  return gruppo === "aste" ? "asta" : gruppo === "supporti" ? "supporto" : gruppo === "morsetti" ? "morsetto" : gruppo === "compensatori" ? "compensatore" : "picchetto";
}

/* ------------------------------------------------------------------ */
/* Formati e scale della tavola                                         */
/* ------------------------------------------------------------------ */

export const FORMATI: { nome: string; mm: [number, number] }[] = [
  { nome: "A3", mm: [420, 297] }, { nome: "A2", mm: [594, 420] }, { nome: "A1", mm: [841, 594] }, { nome: "A0", mm: [1189, 841] },
];
export const SCALE_TAVOLA = [100, 200, 250, 500, 1000];
/** Larghezza della colonna a destra (legenda, particolari, cartiglio) in mm di carta. */
export const COLONNA_MM = 175;

/** Sceglie formato (fino ad A1) e scala più grande in cui la pianta (in metri) entra nell'area di disegno. */
export function scegliTavola(larghezzaM: number, altezzaM: number): { formato: (typeof FORMATI)[number]; scala: number } {
  const entra = (formato: (typeof FORMATI)[number], scala: number) => {
    const areaL = (formato.mm[0] - 30 - COLONNA_MM - 20) * scala / 1000, areaH = (formato.mm[1] - 20 - 20) * scala / 1000;
    return larghezzaM * 1.15 <= areaL && altezzaM * 1.15 <= areaH;
  };
  // fogli maneggevoli (fino ad A1) con la scala più grande possibile; l'A0 solo se non c'è altro modo
  for (const scala of SCALE_TAVOLA) for (const formato of FORMATI.slice(0, 3)) if (entra(formato, scala)) return { formato, scala };
  for (const scala of SCALE_TAVOLA) if (entra(FORMATI[3] as (typeof FORMATI)[number], scala)) return { formato: FORMATI[3] as (typeof FORMATI)[number], scala };
  return { formato: FORMATI[3] as (typeof FORMATI)[number], scala: 2000 };
}
