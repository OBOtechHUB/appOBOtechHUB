/**
 * Copie dei documenti creati per una revisione emessa (supabase/documenti-revisioni.sql):
 * relazione, dichiarazione, verbali, offerta, pacchetto CAD. Solo aggiunta: nulla si sovrascrive o cancella.
 */
import { leggiAttivo, leggiEsteso } from "@/lib/statoProgetto";

const BUCKET = "revisioni-documenti";
export interface DocumentoArchiviato { nome: string; percorso: string; data: string; dimensione: number }

/** Copia il documento nella cartella della revisione emessa; restituisce la revisione o null se il progetto non è emesso o l'archivio non è attivo. */
export async function archiviaDocumento(blob: Blob, nome: string): Promise<string | null> {
  try {
    const a = leggiAttivo(), e = leggiEsteso().emissione;
    if (!a || e.stato !== "emesso" || !e.rev) return null;
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser(); if (!data.user) return null;
    const ora = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const percorso = `${data.user.id}/${a.id}/Rev${e.rev}/${ora}_${nome.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await supabase.storage.from(BUCKET).upload(percorso, blob, { upsert: false, contentType: blob.type || "application/octet-stream" });
    return error ? null : e.rev;
  } catch { return null; }
}

export async function documentiRevisione(utente: string, progetto: string, rev: string): Promise<DocumentoArchiviato[]> {
  const { supabase } = await import("@/integrations/supabase/client");
  const cartella = `${utente}/${progetto}/Rev${rev}`;
  const { data, error } = await supabase.storage.from(BUCKET).list(cartella, { limit: 200, sortBy: { column: "name", order: "desc" } });
  if (error || !data) return [];
  return data.filter((f) => f.id).map((f) => ({ nome: f.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_/, ""), percorso: `${cartella}/${f.name}`, data: f.created_at ?? "", dimensione: Number((f.metadata as { size?: number } | null)?.size ?? 0) }));
}

export async function linkDocumento(percorso: string): Promise<string | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(percorso, 600);
  return error ? null : data.signedUrl;
}
