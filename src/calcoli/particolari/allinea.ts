/**
 * Collegamento automatico codici ↔ particolari costruttivi.
 *
 * Proposte (captazione, calate, terra) e computo indicano per ogni articolo il particolare OBO da cui viene
 * (riferimento) e il suo ruolo (conduttore, supporto, connettore…). Il codice usato è sempre quello del
 * particolare nella libreria attiva: se un particolare cambia codice o articolo, proposte e computo lo seguono
 * senza modifiche al programma. I codici scritti nel programma restano solo come riserva quando il particolare
 * non c'è.
 * Logica pura: nessun accesso a stato, DOM o rete.
 */

export type Ruolo = "conduttore" | "supporto" | "connettore" | "compensatore" | "picchetto" | "punta" | "sezionamento" | "targhetta" | "anticorrosione" | "asta" | "accessorio";

export interface ComponenteLib { codiceOBO: string | null; descrizione: string; unitaQuantita?: string | undefined; quantita?: number | null | undefined }
export interface ParticolareLib { id: string; nome?: string | undefined; categoria?: string | undefined; condizioni?: { elemento?: string; tipo?: string; applicazione?: string } | undefined; componenti: ComponenteLib[] }

const T = (d: string) => d.toLowerCase();

/** Ruolo di un articolo dalla sua descrizione (tipo OBO e testo). */
/** Serie OBO per tipo, per le descrizioni con il solo tipo articolo (es. "157 F VA 230"). */
const SERIE: [RegExp, Ruolo][] = [
  [/^(113|132|133|156|157|159|165|177)\b/, "supporto"],
  [/^(245|247|249|250|252|256|259|262|264|270|272|287|288|1814|5001|5002|5004|5010)\b/, "connettore"],
  [/^(172|175|1807)\b/, "compensatore"],
  [/^(223|233)\b/, "sezionamento"],
  [/^219\b/, "picchetto"],
];

export function ruoloDi(descrizione: string): Ruolo {
  const d = T(descrizione);
  if (!/ – /.test(descrizione)) { const s = SERIE.find(([re]) => re.test(d)); if (s) return s[1]; }
  if (/morsetto[^–]*picchetto/.test(d)) return "connettore";
  if (/rondella|distanziale|manicotto|supporto asta|terminale|base fangfix|blocco cls|f-fix/.test(d)) return "accessorio";
  if (/sezionamento/.test(d)) return "sezionamento";
  if (/compensatore|dilatazione/.test(d)) return "compensatore";
  if (/targhetta/.test(d)) return "targhetta";
  if (/anticorros/.test(d)) return "anticorrosione";
  if (/punta di infissione|^1819|punta per|le spitze/.test(d)) return "punta";
  if (/picchetto|erder/.test(d)) return "picchetto";
  if (/\basta\b|captatore a fungo|punta di captazione/.test(d)) return "asta";
  if (/supporto|staffa|traversa|morsetto per aggraffatura|morsetto kalzip|fascetta pluviale|clip|adattatore/.test(d)) return "supporto";
  if (/tassello|vite|barra filettata|rondella|bullon|testa di battuta|inserto/.test(d)) return "accessorio";
  if (/connettore|morsetto|giunto|elemento di collegamento|cavallotto/.test(d)) return "connettore";
  if (/^(rd |5052 |iscon)|conduttore|tondo|piatto/.test(d)) return "conduttore";
  return "accessorio";
}

/** Libreria attiva: quella del progetto se presente, altrimenti quella di base. */
export function libreriaAttiva<P extends ParticolareLib>(progetto: readonly P[] | null | undefined, base: readonly P[]): readonly P[] {
  return progetto && progetto.length ? progetto : base;
}

export interface VoceCodice { codice: string; descrizione: string }
export interface EsitoAllineamento extends VoceCodice { riferimento: string | null; dalParticolare: boolean; cambiato: boolean }

/**
 * Codice e descrizione dal particolare `riferimento` per il ruolo dell'articolo `riserva`.
 * - il particolare contiene ancora lo stesso codice → resta com'è;
 * - il codice è cambiato → si prende l'articolo con lo stesso ruolo (l'n-esimo, se ce ne sono più di uno);
 * - particolare assente o senza quel ruolo → resta la riserva.
 */
export function allinea(riserva: VoceCodice, riferimento: string | null | undefined, libreria: readonly ParticolareLib[], n = 0, ruolo?: Ruolo): EsitoAllineamento {
  const p = riferimento ? libreria.find((x) => x.id === riferimento) : undefined;
  if (!p) return { ...riserva, riferimento: riferimento ?? null, dalParticolare: false, cambiato: false };
  const stesso = riserva.codice ? p.componenti.find((c) => c.codiceOBO === riserva.codice) : undefined;
  if (stesso) return { codice: riserva.codice, descrizione: riserva.descrizione || stesso.descrizione, riferimento: p.id, dalParticolare: true, cambiato: false };
  const r = ruolo ?? ruoloDi(riserva.descrizione);
  const candidati = p.componenti.filter((c) => c.codiceOBO && ruoloDi(c.descrizione) === r);
  const scelto = candidati[Math.min(n, candidati.length - 1)];
  if (!scelto || !scelto.codiceOBO) return { ...riserva, riferimento: p.id, dalParticolare: false, cambiato: false };
  return { codice: scelto.codiceOBO, descrizione: scelto.descrizione, riferimento: p.id, dalParticolare: true, cambiato: scelto.codiceOBO !== riserva.codice };
}

/** Primo articolo di un ruolo nel primo particolare che soddisfa le condizioni (riserva se nessuno). */
export function articoloPer(libreria: readonly ParticolareLib[], filtro: (p: ParticolareLib) => boolean, ruolo: Ruolo, riserva: VoceCodice & { riferimento?: string | undefined }): EsitoAllineamento {
  for (const p of libreria.filter(filtro)) {
    const c = p.componenti.find((x) => x.codiceOBO && ruoloDi(x.descrizione) === ruolo);
    if (c?.codiceOBO) return { codice: c.codiceOBO, descrizione: c.descrizione, riferimento: p.id, dalParticolare: true, cambiato: c.codiceOBO !== riserva.codice };
  }
  return { codice: riserva.codice, descrizione: riserva.descrizione, riferimento: riserva.riferimento ?? null, dalParticolare: false, cambiato: false };
}
