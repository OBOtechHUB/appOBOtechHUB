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

async function utenteId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Accesso richiesto.");
  return data.user.id;
}

export async function elencaProgetti({ data }: { data: { pagina?: number } }) {
  const { pagina } = z.object({ pagina: z.number().int().nonnegative().default(0) }).parse(data);
  const utente = await utenteId();
  // solo i propri progetti (l'amministratore vede quelli degli altri nella sezione Admin)
  const { data: righe, error, count } = await supabase.from("progetti").select("id,codice,nome,comune,data_creazione,data_modifica", { count: "exact" }).eq("utente", utente).order("data_modifica", { ascending: false }).range(pagina * 20, pagina * 20 + 19);
  if (error) throw new Error("Impossibile leggere i progetti.");
  return { righe: righe ?? [], count: count ?? 0 };
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
  const utente = await utenteId();
  if (JSON.stringify(valori.dati).length > LIMITE) throw new Error("Progetto troppo grande.");
  const { data: progetto, error } = await supabase.from("progetti").update({ ...valori, dati: valori.dati as Json }).eq("id", id).eq("utente", utente).select("id,data_modifica").single();
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
