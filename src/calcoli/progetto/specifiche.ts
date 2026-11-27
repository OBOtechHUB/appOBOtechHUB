/**
 * Specifiche di calcolo dell'app: ogni voce è un aggiornamento che può cambiare i risultati di un progetto già salvato
 * (regole di calcolo, valori di norma, codici in distinta). Quando si apre un progetto calcolato con specifiche più
 * vecchie compare l'avviso «Vuoi ricalcolarlo?» (src/components/AvvisoSpecifiche.tsx).
 * AD OGNI MODIFICA DEI CALCOLI O DEI CODICI: aggiungere una voce IN FONDO (id = data + numero, mai cambiare quelli vecchi).
 */
export interface Specifica { id: string; data: string; titolo: string; cosa: string; riguarda: ("edificio" | "antenne")[] }

export const SPECIFICHE: Specifica[] = [
  { id: "2026-11-25-1", data: "25/11/2026", titolo: "Rischio secondo la Guida CEI 81-29", cosa: "Rischio per le persone e per i servizi verificati separatamente, valori di perdita della guida italiana.", riguarda: ["edificio"] },
  { id: "2026-11-26-1", data: "26/11/2026", titolo: "isCon con i dati OBO", cosa: "Distanze equivalenti, classi di corrente e regole di posa dal manuale OBO; fine del cavo e collegamenti al palo ricalcolati.", riguarda: ["edificio", "antenne"] },
  { id: "2026-11-27-1", data: "27/11/2026", titolo: "Antenne: nuove avvertenze di norma", cosa: "Fulmini laterali oltre 60 m, condizione di validità di kc con più calate, correzione per l'altitudine.", riguarda: ["antenne"] },
  { id: "2026-11-27-2", data: "27/11/2026", titolo: "Controllo del progetto", cosa: "Edifici oltre 60 m e dispersori aggiuntivi dell'anello di terra.", riguarda: ["edificio"] },
  { id: "2026-11-27-3", data: "27/11/2026", titolo: "Codici isCon in distinta", cosa: "Cavo al metro o in bobina, elemento di collegamento e supporto secondo la versione, Pro+ con il codice a catalogo.", riguarda: ["edificio", "antenne"] },
];

export const SPECIFICA_ATTUALE = SPECIFICHE[SPECIFICHE.length - 1]!.id;

/** Aggiornamenti arrivati dopo le specifiche indicate (id sconosciuto o vuoto = progetto precedente a tutte), per il tipo di progetto. */
export function specificheDopo(calcolato: string | undefined | null, tipologia?: "edificio" | "antenne"): Specifica[] {
  const i = SPECIFICHE.findIndex((s) => s.id === calcolato);
  return SPECIFICHE.slice(i + 1).filter((s) => !tipologia || s.riguarda.includes(tipologia));
}

/** true se all'apertura va chiesto se ricalcolare: ci sono aggiornamenti dopo quelli del progetto e non è già stato scelto «Lascia com'è» per l'ultimo. */
export function daChiedere(sp: { calcolato?: string; rimandato?: string } | undefined, tipologia?: "edificio" | "antenne"): boolean {
  if (sp?.calcolato === SPECIFICA_ATTUALE || sp?.rimandato === SPECIFICA_ATTUALE) return false;
  return specificheDopo(sp?.calcolato, tipologia).length > 0;
}
