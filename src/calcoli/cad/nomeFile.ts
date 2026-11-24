/**
 * Nome dei file CAD del progetto, codificato con il codice CRM e la revisione:
 *   P-2026-0142_LPS_RevA          progetto emesso in Rev. A
 *   P-2026-0142_LPS_RevB_bozza    modifiche dopo la Rev. A (prossima revisione B, non ancora emessa)
 * Senza codice si usa il nome del progetto. Logica pura.
 */
import { revSuccessiva } from "../progetto/revisioni";

export interface StatoRevisione { emissione: { stato: "bozza" | "emesso"; rev: string | null }; revisioni: { rev: string }[] }

export function revisioneFile(s: StatoRevisione): { rev: string; bozza: boolean } {
  if (s.emissione.stato === "emesso" && s.emissione.rev) return { rev: s.emissione.rev, bozza: false };
  return { rev: revSuccessiva(s.revisioni.at(-1)?.rev), bozza: true };
}

export function baseFile(codice: string | undefined, nome: string | undefined): string {
  const t = (codice?.trim() || nome?.trim() || "progetto").normalize("NFD").replace(/[̀-ͯ]/g, "");
  return t.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^[_.]+|[_.]+$/g, "").slice(0, 60) || "progetto";
}

export function nomeFileProgetto(codice: string | undefined, nome: string | undefined, s: StatoRevisione): string {
  const r = revisioneFile(s);
  return `${baseFile(codice, nome)}_LPS_Rev${r.rev}${r.bozza ? "_bozza" : ""}`;
}
