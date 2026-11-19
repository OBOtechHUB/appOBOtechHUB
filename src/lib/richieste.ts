/** Richieste all'ufficio tecnico (supabase/richieste.sql): condivise tra Progettazione LPS e Mappa carichi. */
import { db } from "@/lib/accesso";

export const TIPI_RICHIESTA = { "progetto-lps": "Progetto LPS", verifica: "Verifica impianto", offerta: "Offerta", consulenza: "Consulenza tecnica", altro: "Altro" } as const;
export const STATI_RICHIESTA = { nuova: "Nuova", "in-carico": "Presa in carico", "in-lavorazione": "In lavorazione", completata: "Completata", annullata: "Annullata" } as const;
export type TipoRichiesta = keyof typeof TIPI_RICHIESTA;
export type StatoRichiesta = keyof typeof STATI_RICHIESTA;
export interface Richiesta {
  id: string; creata_il: string; creata_da: string | null; richiedente: string; cliente: string; comune: string; tipo: TipoRichiesta; descrizione: string;
  priorita: "Alta" | "Media" | "Bassa"; scadenza: string | null; ore_stimate: number | null; stato: StatoRichiesta; tecnico: string;
  progetto: string | null; progetto_mappa: string | null; aggiornata_il: string;
}
export type NuovaRichiesta = Pick<Richiesta, "richiedente" | "cliente" | "comune" | "tipo" | "descrizione" | "priorita" | "scadenza" | "ore_stimate">;

const NON_ATTIVO = "Richieste non ancora attive: l'amministratore deve eseguire supabase/richieste.sql in Supabase.";
const errore = (e: { message?: string; code?: string } | null, testo: string) => new Error(e && /relation|does not exist|schema cache/i.test(e.message ?? "") ? NON_ATTIVO : `${testo}${e?.message ? `: ${e.message}` : ""}`);

export async function elencaRichieste(): Promise<Richiesta[]> {
  const { data, error } = await db().from("richieste_tecniche").select("*").order("creata_il", { ascending: false }).limit(500);
  if (error) throw errore(error, "Richieste non lette");
  return (data ?? []) as Richiesta[];
}
export async function nuovaRichiesta(r: NuovaRichiesta): Promise<Richiesta> {
  const { data: u } = await db().auth.getUser();
  const { data, error } = await db().from("richieste_tecniche").insert({ ...r, creata_da: u.user?.id }).select().single();
  if (error) throw errore(error, "Richiesta non salvata");
  return data as Richiesta;
}
export async function aggiornaRichiesta(id: string, p: Partial<Pick<Richiesta, "stato" | "tecnico" | "progetto" | "ore_stimate" | "scadenza" | "priorita" | "descrizione">>): Promise<void> {
  const { error } = await db().from("richieste_tecniche").update(p).eq("id", id);
  if (error) throw errore(error, "Richiesta non aggiornata");
}
