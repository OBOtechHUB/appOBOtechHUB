/// <reference lib="webworker" />
/**
 * Web Worker del motore della sfera rotolante: il calcolo non blocca l'interfaccia.
 * Messaggi in ingresso: { id, tipo: "calcola" | "confronta" | "suggerisci" | "proponi", ... }
 * Messaggi in uscita:   { id, ok: true, dati } oppure { id, ok: false, errore }
 */
import {
  calcolaSferaRotolante,
  confrontaLivelli,
  suggerisciAste,
  inviluppoSuGriglia,
  type InputSfera,
  type Conduttore,
  type Corpo,
} from "./sferaRotolante";
import { verificaMaglia, verificaCombinata, type ParametriMaglia } from "./verificaMaglia";
import { proponiCaptazione, type ParametriProposta } from "./proponiCaptazione";

export type RichiestaSfera =
  | { id: number; tipo: "calcola"; input: InputSfera; passoInviluppo?: number | undefined; maglia?: ParametriMaglia | null | undefined }
  | { id: number; tipo: "confronta"; base: Omit<InputSfera, "raggio">; raggi: Record<string, number | null> }
  | { id: number; tipo: "suggerisci"; input: InputSfera; altezzaAsta: number; asteMax?: number | undefined }
  | { id: number; tipo: "proponi"; corpi: Corpo[]; parametri: ParametriProposta };

self.onmessage = (ev: MessageEvent<RichiestaSfera>) => {
  const msg = ev.data;
  try {
    let dati: unknown;
    if (msg.tipo === "calcola") {
      const risultato = calcolaSferaRotolante(msg.input);
      const inviluppo = msg.passoInviluppo ? inviluppoSuGriglia(risultato, msg.passoInviluppo) : undefined;
      // metodo della maglia sugli stessi conduttori, poi verifica combinata
      const conduttori: Conduttore[] = msg.input.conduttori ?? [];
      const maglia = msg.maglia && conduttori.length ? verificaMaglia(risultato, conduttori, msg.maglia) : null;
      const combinata = verificaCombinata(risultato, maglia);
      dati = { risultato, inviluppo, maglia, combinata };
    } else if (msg.tipo === "confronta") {
      dati = confrontaLivelli(msg.base, msg.raggi);
    } else if (msg.tipo === "proponi") {
      dati = proponiCaptazione(msg.corpi, msg.parametri);
    } else {
      dati = suggerisciAste(msg.input, msg.altezzaAsta, { asteMax: msg.asteMax });
    }
    (self as unknown as Worker).postMessage({ id: msg.id, ok: true, dati });
  } catch (e) {
    (self as unknown as Worker).postMessage({ id: msg.id, ok: false, errore: e instanceof Error ? e.message : String(e) });
  }
};
