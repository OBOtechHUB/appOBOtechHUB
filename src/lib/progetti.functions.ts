/**
 * Progetti salvati: chiamate dirette a Supabase dal browser.
 * La sicurezza è garantita dalle regole RLS della tabella "progetti"
 * (ogni utente vede e modifica solo le proprie righe).
 * Le funzioni mantengono la firma ({ data }) delle vecchie funzioni server.
 */
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { snapshotSchema } from "./statoProgetto";

const payload = z.object({ codice: z.string().max(100), nome: z.string().min(1).max(200), comune: z.string().max(200), dati: snapshotSchema });
const LIMITE = 20000000;

export async function utenteId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Accesso richiesto.");
  return data.user.id;
}

export async function elencaProgetti({ data }: { data: { pagina?: number; cerca?: string } }) {
  const { pagina, cerca } = z.object({ pagina: z.number().int().nonnegative().default(0), cerca: z.string().max(80).default("") }).parse(data);
  const utente = await utenteId();
  // solo i propri progetti (l'amministratore vede quelli degli altri nella sezione Admin)
  let q = supabase.from("progetti").select("id,codice,nome,comune,data_creazione,data_modifica", { count: "exact" }).eq("utente", utente);
  // ricerca per numero CRM, nome o comune (come in tutte le app di OBO Hub)
  const t = cerca.replace(/[,()%*\\]/g, " ").trim();
  if (t) q = q.or(`codice.ilike.%${t}%,nome.ilike.%${t}%,comune.ilike.%${t}%`);
  const { data: righe, error, count } = await q.order("data_modifica", { ascending: false }).range(pagina * 20, pagina * 20 + 19);
  if (error) throw new Error("Impossibile leggere i progetti.");
  return { righe: righe ?? [], count: count ?? 0 };
}

// ---------- condivisione e passaggio (supabase/condivisione-progetti.sql) ----------
const rpc = (nome: string, args?: Record<string, unknown>) => (supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(nome, args);
const mancaSql = (m: string) => (/Could not find|does not exist/.test(m) ? "Condivisione non ancora attiva: eseguire supabase/condivisione-progetti.sql (SQL 15) in Supabase." : m);
export interface ProgettoCondiviso { id: string; codice: string; nome: string; comune: string; data_creazione: string; data_modifica: string; proprietario_email: string; proprietario_nome: string }
/** Progetti che altri hanno condiviso con me (vuoto se la funzione non è ancora installata). */
export async function progettiCondivisi(): Promise<ProgettoCondiviso[]> {
  const { data, error } = await rpc("progetti_condivisi_con_me");
  return error ? [] : ((data ?? []) as ProgettoCondiviso[]);
}
export interface Condivisione { utente: string; email: string; nome: string; attiva: boolean; aggiunta_il: string; proprietario: boolean }
export async function condivisioni(progetto: string): Promise<Condivisione[]> {
  const { data, error } = await rpc("condivisioni_progetto", { p_progetto: progetto });
  if (error) throw new Error(mancaSql(error.message));
  return (data ?? []) as Condivisione[];
}
export async function condividi(progetto: string, email: string): Promise<void> {
  const { error } = await rpc("condividi_progetto", { p_progetto: progetto, p_email: email });
  if (error) throw new Error(mancaSql(error.message));
}
export async function togliCondivisione(progetto: string, utente: string): Promise<void> {
  const { error } = await rpc("togli_condivisione", { p_progetto: progetto, p_utente: utente });
  if (error) throw new Error(mancaSql(error.message));
}
export async function trasferisci(progetto: string, email: string): Promise<void> {
  const { error } = await rpc("trasferisci_progetto", { p_progetto: progetto, p_email: email });
  if (error) throw new Error(mancaSql(error.message));
}

export async function leggiProgetto({ data }: { data: { id: string } }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(data);
  await utenteId();
  const { data: progetto, error } = await supabase.from("progetti").select("*").eq("id", id).single();
  if (error) throw new Error("Progetto non disponibile.");
  return progetto;
}

export async function creaProgetto({ data }: { data: z.input<typeof payload> }) {
  const valori = payload.parse(data);
  const utente = await utenteId();
  if (JSON.stringify(valori.dati).length > LIMITE) throw new Error("Progetto troppo grande: usa file mesh separati.");
  const { data: progetto, error } = await supabase.from("progetti").insert({ ...valori, dati: valori.dati as Json, utente }).select().single();
  if (error) throw new Error("Creazione non riuscita.");
  return progetto;
}

export async function salvaProgetto({ data }: { data: z.input<typeof payload> & { id: string } }) {
  const { id, ...valori } = payload.extend({ id: z.string().uuid() }).parse(data);
  await utenteId();
  if (JSON.stringify(valori.dati).length > LIMITE) throw new Error("Progetto troppo grande.");
  const { data: progetto, error } = await supabase.from("progetti").update({ ...valori, dati: valori.dati as Json }).eq("id", id).select("id,data_modifica").single(); // proprietario o condivisione attiva (RLS)
  if (error) throw new Error("Salvataggio non riuscito.");
  return progetto;
}

export async function eliminaProgetto({ data }: { data: { id: string } }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(data);
  const utente = await utenteId();
  const { error } = await supabase.from("progetti").delete().eq("id", id).eq("utente", utente);
  if (error) throw new Error("Eliminazione non riuscita.");
  return { ok: true };
}

// ---------- archivio delle revisioni emesse (supabase/revisioni.sql) ----------
/** Copia della revisione emessa nell'archivio. Restituisce false se l'archivio non è ancora attivo. */
export async function archiviaRevisione(r: { progetto: string; rev: string; autore: string; descrizione: string; impronta: string; dati: unknown }): Promise<boolean> {
  const { error } = await supabase.from("progetti_revisioni").insert({ progetto: r.progetto, rev: r.rev, autore: r.autore, descrizione: r.descrizione, impronta: r.impronta, dati: r.dati as Json });
  if (!error) return true;
  if (error.code === "23505") return true; // già archiviata
  return false;
}
/** Copia archiviata di una revisione (null se assente o archivio non attivo). */
export async function leggiRevisione(progetto: string, rev: string): Promise<{ dati: unknown; data: string } | null> {
  const { data, error } = await supabase.from("progetti_revisioni").select("dati,data").eq("progetto", progetto).eq("rev", rev).maybeSingle();
  if (error || !data) return null;
  return { dati: data.dati, data: data.data };
}
