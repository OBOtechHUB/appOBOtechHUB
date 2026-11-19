/**
 * Listino prezzi OBO in Supabase (`supabase/listino.sql`): l'admin carica il file METEL, gli utenti leggono
 * i prezzi degli articoli del computo. Ogni caricamento è una versione nuova; le precedenti restano.
 */
import { db } from "@/lib/accesso";
import { leggiListino, versioneDaFile, type VoceListino } from "@/lib/listinoMetel";

export interface VersioneListino { versione: string; nome_file: string; righe: number; caricato_il: string }

export async function ultimaVersioneListino(): Promise<VersioneListino | null> {
  const { data, error } = await db().from("listino_versioni").select("versione,nome_file,righe,caricato_il").order("caricato_il", { ascending: false }).limit(1);
  if (error) return null;
  return (data?.[0] as VersioneListino | undefined) ?? null;
}

export async function versioniListino(): Promise<VersioneListino[]> {
  const { data, error } = await db().from("listino_versioni").select("versione,nome_file,righe,caricato_il").order("caricato_il", { ascending: false }).limit(50);
  if (error) throw new Error("Listino non disponibile: eseguire supabase/listino.sql in Supabase.");
  return (data ?? []) as VersioneListino[];
}

type RigaDb = { codice: string; descrizione: string; prezzo: number; prezzo_pubblico: number; moltiplicatore: number; unita: string; confezione: number; famiglia_sconto: string; stato: number; ean: string; variazione: string };
const daDb = (r: RigaDb): VoceListino => ({ codice: r.codice, ean: r.ean, descrizione: r.descrizione, prezzo: Number(r.prezzo), prezzoPubblico: Number(r.prezzo_pubblico), moltiplicatore: r.moltiplicatore, unita: r.unita, confezione: r.confezione, famigliaSconto: r.famiglia_sconto, stato: r.stato, variazione: r.variazione });

/** Voci del listino (ultima versione) per i codici indicati. */
export async function prezziListino(codici: string[]): Promise<{ versione: VersioneListino | null; voci: Map<string, VoceListino> }> {
  const versione = await ultimaVersioneListino();
  const voci = new Map<string, VoceListino>();
  if (!versione) return { versione, voci };
  const unici = [...new Set(codici.map((c) => c.trim()).filter(Boolean))];
  for (let i = 0; i < unici.length; i += 200) {
    const { data, error } = await db().from("listino_obo").select("codice,descrizione,prezzo,prezzo_pubblico,moltiplicatore,unita,confezione,famiglia_sconto,stato,ean,variazione").eq("versione", versione.versione).in("codice", unici.slice(i, i + 200));
    if (error) throw new Error("Prezzi non letti dal listino.");
    for (const r of (data ?? []) as RigaDb[]) voci.set(r.codice, daDb(r));
  }
  return { versione, voci };
}

/** Carica un file METEL come nuova versione del listino (solo admin). */
export async function caricaListino(file: File, avanzamento?: (fatte: number, totale: number) => void): Promise<{ versione: string; righe: number; scartate: number }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const foglio = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!foglio) throw new Error("Il file non contiene fogli.");
  const { voci, scartate } = leggiListino(XLSX.utils.sheet_to_json<unknown[]>(foglio, { header: 1, raw: true, defval: "" }));
  if (!voci.length) throw new Error("Nessun articolo trovato nel file.");
  const ora = new Date();
  const versione = `${versioneDaFile(file.name)} · ${ora.toISOString().slice(0, 16).replace("T", " ")}`;
  for (let i = 0; i < voci.length; i += 1000) {
    const blocco = voci.slice(i, i + 1000).map((v) => ({ versione, codice: v.codice, ean: v.ean, descrizione: v.descrizione, prezzo: v.prezzo, prezzo_pubblico: v.prezzoPubblico, moltiplicatore: v.moltiplicatore, unita: v.unita, confezione: v.confezione, famiglia_sconto: v.famigliaSconto, stato: v.stato, variazione: v.variazione }));
    const { error: e } = await db().from("listino_obo").insert(blocco);
    if (e) throw new Error(e.message.includes("relation") ? "Eseguire prima supabase/listino.sql in Supabase." : `Caricamento interrotto alla riga ${i + 1}: ${e.message}`);
    avanzamento?.(Math.min(voci.length, i + 1000), voci.length);
  }
  // la versione diventa visibile solo ora, a caricamento completo
  const { error } = await db().from("listino_versioni").insert({ versione, nome_file: file.name.slice(0, 200), righe: voci.length });
  if (error) throw new Error(`Versione non registrata: ${error.message}`);
  return { versione, righe: voci.length, scartate };
}
