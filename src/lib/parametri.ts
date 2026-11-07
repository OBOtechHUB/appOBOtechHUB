import { useSyncExternalStore } from "react";
import { z } from "zod";
import base from "@/dati/captazione/parametriLPL.json";

/**
 * Parametri normativi personali di captazione (metodo della maglia, CEI EN IEC 62305-3:2024).
 * I valori predefiniti arrivano da src/dati/captazione/parametriLPL.json; l'utente può
 * impostare la pendenza massima in "Dati normativi". Salvati in locale e nella libreria Cloud.
 */
export type ParametriCaptazione = { pendenzaMassimaMaglia: number | null };

const KEY = "lps-parametri-captazione";
const schema = z.object({ pendenzaMassimaMaglia: z.number().finite().positive().nullable() });

export const parametriIniziali: ParametriCaptazione = {
  pendenzaMassimaMaglia: base.pendenzaMassimaMaglia.valore,
};

let stato = parametriIniziali;
let caricato = false;
const ascoltatori = new Set<() => void>();

function carica() {
  if (caricato || typeof window === "undefined") return;
  caricato = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = schema.safeParse({ ...parametriIniziali, ...JSON.parse(raw) });
      if (parsed.success) stato = parsed.data;
    }
  } catch { /* ignora */ }
}

export function aggiornaParametriCaptazione(parz: Partial<ParametriCaptazione>) {
  stato = schema.parse({ ...stato, ...parz });
  try { localStorage.setItem(KEY, JSON.stringify(stato)); } catch { /* ignora */ }
  ascoltatori.forEach((f) => f());
}

/** Sostituisce i parametri (es. al caricamento della libreria Cloud). */
export function sostituisciParametriCaptazione(valore: unknown) {
  const parsed = schema.safeParse(valore);
  if (!parsed.success) return;
  stato = parsed.data;
  try { localStorage.setItem(KEY, JSON.stringify(stato)); } catch { /* ignora */ }
  ascoltatori.forEach((f) => f());
}

export function leggiParametriCaptazione(): ParametriCaptazione {
  return stato;
}

export function useParametriCaptazione() {
  return useSyncExternalStore(
    (f) => {
      ascoltatori.add(f);
      if (!caricato) { carica(); f(); }
      return () => ascoltatori.delete(f);
    },
    () => stato,
    () => parametriIniziali,
  );
}
