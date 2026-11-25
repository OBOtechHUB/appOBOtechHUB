/** Pacchetto «Istruzioni e download» creato nel browser dai file pubblicati, quindi sempre nell'ultima versione. */
import { risorsa } from "@/lib/base";
import { creaZip, type FileZip } from "@/lib/zip";
import { FILE_ISTRUZIONI, leggimiPacchetto, VERSIONE_PACCHETTO } from "@/calcoli/cad/versioni";

const CHIAVE = "lps-pacchetto-scaricato";
export function versioneScaricata(): string | null { try { return localStorage.getItem(CHIAVE); } catch { return null; } }
export function segnaScaricato() { try { localStorage.setItem(CHIAVE, VERSIONE_PACCHETTO); window.dispatchEvent(new Event("lps-pacchetto")); } catch { /* memoria del browser non disponibile */ } }
/** true se l'utente ha già scaricato una versione e ne è uscita una nuova. */
export function aggiornamentoDisponibile(): boolean { const v = versioneScaricata(); return !!v && v !== VERSIONE_PACCHETTO; }

async function scarica(percorso: string): Promise<Uint8Array> {
  const r = await fetch(risorsa(percorso), { cache: "no-cache" });
  if (!r.ok) throw new Error(`File non disponibile: ${percorso.split("/").pop()}. Riprova.`);
  return new Uint8Array(await r.arrayBuffer());
}

export async function creaPacchettoIstruzioni(avanzamento?: (n: number, tot: number) => void): Promise<Blob> {
  const elenco: { percorso: string; zip: string }[] = [
    ...FILE_ISTRUZIONI.map((f) => ({ percorso: f.file, zip: f.zip })),
    { percorso: "cad/LPS.lsp", zip: "3 - File per AutoCAD e ZWCAD/LPS.lsp" },
    { percorso: "cad/LPS.lsp", zip: "3 - File per AutoCAD e ZWCAD/Progetto di prova CRM-123_LPS/LPS.lsp" },
  ];
  const file: FileZip[] = [{ nome: "LEGGIMI.txt", dati: leggimiPacchetto() }];
  for (const [i, f] of elenco.entries()) { avanzamento?.(i, elenco.length); file.push({ nome: f.zip, dati: await scarica(f.percorso) }); }
  return new Blob([creaZip(file)], { type: "application/zip" });
}
