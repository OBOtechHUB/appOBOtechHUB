/**
 * Salvataggio dei progetti di staffaggio: sempre sul dispositivo (bozza corrente) e, per chi ha l'account,
 * nella tabella staffaggi_progetti (supabase/staffaggi.sql). Niente si cancella: un progetto si archivia.
 */
import { db } from "@/lib/accesso";
import { progettoStaffaggiSchema, type ProgettoStaffaggi } from "@/calcoli/staffaggi/tipi";

const CHIAVE = "staffaggi-bozza";
export interface RigaProgetto { id: string; codice: string; nome: string; cliente: string; modificato_il: string; archiviato: boolean }

export function leggiBozza(): { id: string | null; progetto: ProgettoStaffaggi } {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) ?? "null") as { id?: string | null; progetto?: unknown } | null;
    if (v?.progetto) return { id: v.id ?? null, progetto: progettoStaffaggiSchema.parse(v.progetto) };
  } catch { /* bozza illeggibile: si riparte */ }
  return { id: null, progetto: progettoStaffaggiSchema.parse({}) };
}
export function salvaBozza(id: string | null, progetto: ProgettoStaffaggi) {
  try { localStorage.setItem(CHIAVE, JSON.stringify({ id, progetto })); } catch { /* spazio pieno o modalità privata */ }
}

/** Errore leggibile: tabella mancante = SQL non ancora eseguito. */
function messaggio(e: { message?: string; code?: string } | null): string {
  if (!e) return "";
  if (e.code === "42P01" || /staffaggi_progetti/.test(e.message ?? "")) return "Salvataggio nel cloud non ancora attivo: l'amministratore deve eseguire supabase/staffaggi.sql.";
  return e.message ?? "Errore di salvataggio";
}

export async function elencoProgetti(archiviati = false): Promise<RigaProgetto[]> {
  const { data, error } = await db().from("staffaggi_progetti").select("id,codice,nome,cliente,modificato_il,archiviato").eq("archiviato", archiviati).order("modificato_il", { ascending: false }).limit(300);
  if (error) throw new Error(messaggio(error));
  return (data ?? []) as RigaProgetto[];
}
export async function apriProgetto(id: string): Promise<ProgettoStaffaggi> {
  const { data, error } = await db().from("staffaggi_progetti").select("dati").eq("id", id).single();
  if (error) throw new Error(messaggio(error));
  return progettoStaffaggiSchema.parse((data as { dati: unknown }).dati);
}
/** Salva: crea il progetto se `id` è null e restituisce l'id. */
export async function salvaProgetto(id: string | null, p: ProgettoStaffaggi): Promise<string> {
  const riga = { codice: p.codice, nome: p.nome || "Progetto staffaggi", cliente: p.cliente, dati: p };
  if (id) {
    const { error } = await db().from("staffaggi_progetti").update(riga).eq("id", id);
    if (error) throw new Error(messaggio(error));
    return id;
  }
  const { data, error } = await db().from("staffaggi_progetti").insert(riga).select("id").single();
  if (error) throw new Error(messaggio(error));
  return (data as { id: string }).id;
}
export async function archiviaProgetto(id: string, archiviato = true) {
  const { error } = await db().from("staffaggi_progetti").update({ archiviato }).eq("id", id);
  if (error) throw new Error(messaggio(error));
}
