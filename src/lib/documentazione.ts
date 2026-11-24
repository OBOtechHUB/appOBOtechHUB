/**
 * Documentazione del progetto nello storage privato "documentazione-progetti" (supabase/documentazione-progetti.sql):
 * <utente>/<progetto>/<data>_<nome>. Solo aggiunta: nulla si sovrascrive o si cancella sul server.
 */
import { categoriaDocumento } from "@/calcoli/progetto/documentazione";
import type { DocumentoProgetto } from "@/lib/statoProgetto";

const BUCKET = "documentazione-progetti";
export const LIMITE_DOCUMENTO = 50 * 1024 * 1024;
async function client() { return (await import("@/integrations/supabase/client")).supabase; }

export async function caricaDocumento(progetto: string, file: File): Promise<DocumentoProgetto> {
  if (file.size > LIMITE_DOCUMENTO) throw new Error(`${file.name}: supera 50 MB.`);
  const sb = await client();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new Error("Accesso scaduto: rientra in OBO Hub.");
  const ora = new Date().toISOString();
  const pulito = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-150);
  const percorso = `${data.user.id}/${progetto}/${ora.replace(/[:.]/g, "-").slice(0, 19)}_${Math.random().toString(36).slice(2, 6)}_${pulito}`;
  const { error } = await sb.storage.from(BUCKET).upload(percorso, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(/not found|bucket/i.test(error.message) ? "Archivio documenti non ancora attivo: eseguire supabase/documentazione-progetti.sql (SQL 16) in Supabase." : `${file.name}: ${error.message}`);
  return { id: `doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, nome: file.name.slice(0, 260), percorso, categoria: categoriaDocumento(file.name, file.type), dimensione: file.size, data: ora, autore: data.user.email ?? "", nota: "", nascosto: false };
}

export async function linkDocumentoProgetto(percorso: string): Promise<string | null> {
  const { data, error } = await (await client()).storage.from(BUCKET).createSignedUrl(percorso, 600);
  return error ? null : data.signedUrl;
}

export async function fileDocumento(d: DocumentoProgetto): Promise<File | null> {
  const { data, error } = await (await client()).storage.from(BUCKET).download(d.percorso);
  return error || !data ? null : new File([data], d.nome, { type: data.type });
}
