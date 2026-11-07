/**
 * Verifiche periodiche dell'LPS (CEI EN IEC 62305-3, allegato E – manutenzione e ispezione).
 * Logica pura: checklist, intervalli tra le verifiche, scadenze e riepilogo degli esiti.
 * Gli intervalli sono quelli tipici della tabella dell'allegato E e restano modificabili:
 * vanno confermati con l'edizione della norma in uso e con eventuali prescrizioni locali.
 */
import { z } from "zod";

export type Livello = "I" | "II" | "III" | "IV";
export type TipoVerifica = "visiva" | "completa" | "straordinaria";
export type Esito = "C" | "NC" | "NA" | "";

export interface Intervalli { visiva: number; completa: number; critica: number }
/** Anni tra le verifiche: visiva, completa, completa per sistemi critici. */
export const INTERVALLI_TIPICI: Record<Livello, Intervalli> = {
  I: { visiva: 1, completa: 2, critica: 1 },
  II: { visiva: 1, completa: 2, critica: 1 },
  III: { visiva: 2, completa: 4, critica: 1 },
  IV: { visiva: 2, completa: 4, critica: 1 },
};

export interface VoceChecklist { id: string; sezione: string; testo: string; soloCompleta?: boolean }
export const CHECKLIST: VoceChecklist[] = [
  { id: "doc-progetto", sezione: "Documentazione", testo: "Progetto, relazione e disegni dell'LPS disponibili e aggiornati" },
  { id: "doc-modifiche", sezione: "Documentazione", testo: "Nessuna modifica della struttura o degli impianti non riportata nel progetto" },
  { id: "doc-registro", sezione: "Documentazione", testo: "Registro delle verifiche precedenti disponibile" },
  { id: "capt-integrita", sezione: "Captazione", testo: "Aste, conduttori e maglia integri, senza danni meccanici o corrosione" },
  { id: "capt-fissaggi", sezione: "Captazione", testo: "Supporti e fissaggi saldi, distanze tra i supporti rispettate" },
  { id: "capt-nuovi", sezione: "Captazione", testo: "Nuovi impianti sul tetto (antenne, PV, clima) protetti o in zona protetta" },
  { id: "cal-percorso", sezione: "Calate", testo: "Calate integre, percorso il più possibile rettilineo e verticale" },
  { id: "cal-giunti", sezione: "Calate", testo: "Giunti di sezionamento accessibili, numerati e funzionanti" },
  { id: "cal-protezione", sezione: "Calate", testo: "Protezione meccanica e anticorrosione all'uscita dal terreno" },
  { id: "con-morsetti", sezione: "Connessioni", testo: "Morsetti e connessioni serrati, senza ossido o coppie galvaniche" },
  { id: "con-continuita", sezione: "Connessioni", testo: "Continuità elettrica di captazione e calate misurata", soloCompleta: true },
  { id: "terra-ispezione", sezione: "Impianto di terra", testo: "Parti ispezionabili del dispersore integre (pozzetti, collegamenti)" },
  { id: "terra-misura", sezione: "Impianto di terra", testo: "Resistenza di terra misurata e confrontata con le misure precedenti", soloCompleta: true },
  { id: "eq-collettore", sezione: "Equipotenzialità", testo: "Collettori equipotenziali e collegamenti delle masse estranee presenti" },
  { id: "eq-servizi", sezione: "Equipotenzialità", testo: "Servizi entranti (acqua, gas, linee) collegati all'equipotenziale" },
  { id: "spd-stato", sezione: "SPD", testo: "SPD installati, indicatori di stato a posto, nessun intervento" },
  { id: "dist-sicurezza", sezione: "Distanze", testo: "Distanze di sicurezza rispettate (nessun nuovo avvicinamento a parti metalliche o impianti)" },
];

export const verificaSchema = z.object({
  id: z.string().max(100),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo: z.enum(["visiva", "completa", "straordinaria"]),
  verificatore: z.string().max(200).default(""),
  esiti: z.record(z.string(), z.object({ esito: z.enum(["C", "NC", "NA", ""]), nota: z.string().max(1000).default("") })).default({}),
  resistenzaTerra: z.number().finite().nonnegative().nullable().default(null),
  continuitaMax: z.number().finite().nonnegative().nullable().default(null),
  note: z.string().max(5000).default(""),
});
export type Verifica = z.infer<typeof verificaSchema>;

export function vociPerTipo(tipo: TipoVerifica): VoceChecklist[] {
  return tipo === "visiva" ? CHECKLIST.filter((v) => !v.soloCompleta) : CHECKLIST;
}

export interface Riepilogo { conformi: number; nonConformi: number; nonApplicabili: number; daCompilare: number; esito: "conforme" | "non conforme" | "incompleta" }
export function riepilogo(v: Verifica): Riepilogo {
  const voci = vociPerTipo(v.tipo);
  let conformi = 0, nonConformi = 0, nonApplicabili = 0, daCompilare = 0;
  for (const voce of voci) {
    const e = v.esiti[voce.id]?.esito ?? "";
    if (e === "C") conformi++; else if (e === "NC") nonConformi++; else if (e === "NA") nonApplicabili++; else daCompilare++;
  }
  const esito = nonConformi > 0 ? "non conforme" : daCompilare > 0 ? "incompleta" : "conforme";
  return { conformi, nonConformi, nonApplicabili, daCompilare, esito };
}

/** Somma anni a una data ISO (AAAA-MM-GG), restando sull'ultimo giorno del mese se serve. */
export function aggiungiAnni(dataIso: string, anni: number): string {
  const [a, m, g] = dataIso.split("-").map(Number) as [number, number, number];
  const ultimo = new Date(Date.UTC(a + anni, m, 0)).getUTCDate();
  return `${a + anni}-${String(m).padStart(2, "0")}-${String(Math.min(g, ultimo)).padStart(2, "0")}`;
}

export interface Scadenze { visiva: string | null; completa: string | null }
/**
 * Prossime scadenze dall'ultima verifica utile: una verifica completa vale anche come visiva.
 * Con `critico` la verifica completa segue l'intervallo dei sistemi critici.
 */
export function prossimeScadenze(verifiche: Verifica[], intervalli: Intervalli, critico = false): Scadenze {
  const ordinate = [...verifiche].sort((x, y) => y.data.localeCompare(x.data));
  const ultimaCompleta = ordinate.find((v) => v.tipo === "completa");
  const ultimaQualsiasi = ordinate.find((v) => v.tipo === "completa" || v.tipo === "visiva");
  return {
    visiva: ultimaQualsiasi ? aggiungiAnni(ultimaQualsiasi.data, intervalli.visiva) : null,
    completa: ultimaCompleta ? aggiungiAnni(ultimaCompleta.data, critico ? intervalli.critica : intervalli.completa) : null,
  };
}

export function scaduta(dataIso: string | null, oggi: string): boolean {
  return dataIso !== null && dataIso < oggi;
}
