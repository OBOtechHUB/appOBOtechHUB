/**
 * Revisioni del progetto: bozza → emesso (Rev. A, B, C…), con impronta del contenuto emesso.
 * Un progetto emesso non si modifica: le modifiche aprono la revisione successiva.
 * Logica pura: nessun accesso a stato, DOM o rete.
 */
export interface Revisione { rev: string; data: string; autore: string; descrizione: string; impronta: string; archiviata: boolean }
export interface Emissione { stato: "bozza" | "emesso"; rev: string | null; impronta: string | null }

/** Rev. successiva: A, B, …, Z, AA, AB… */
export function revSuccessiva(ultima: string | null | undefined): string {
  if (!ultima) return "A";
  const s = ultima.toUpperCase().replace(/[^A-Z]/g, "") || "A";
  const c = s.split("").map((x) => x.charCodeAt(0) - 64);
  let i = c.length - 1;
  while (i >= 0) { if (c[i]! < 26) { c[i]! += 1; break; } c[i] = 1; i--; }
  if (i < 0) c.unshift(1);
  return c.map((n) => String.fromCharCode(64 + n)).join("");
}

/** Impronta (FNV-1a a 64 bit, esadecimale) del contenuto del progetto, escluse revisioni ed emissione. */
export function impronta(contenuto: unknown): string {
  const testo = JSON.stringify(contenuto, (k, v) => (k === "revisioni" || k === "emissione" || k === "relazione" || k === "offerta" || k === "sopralluogo" || k === "vento" || k === "documentazione" || k === "specifiche" || k === "tipologia" ? undefined : v));
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < testo.length; i++) {
    const c = testo.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** Emette la revisione successiva: restituisce le nuove revisioni e lo stato di emissione. */
export function emetti(revisioni: Revisione[], contenuto: unknown, dati: { autore: string; descrizione: string; data?: string | undefined }): { revisioni: Revisione[]; emissione: Emissione; revisione: Revisione } {
  const rev = revSuccessiva(revisioni.at(-1)?.rev);
  const imp = impronta(contenuto);
  const revisione: Revisione = { rev, data: dati.data ?? new Date().toISOString(), autore: dati.autore.trim() || "—", descrizione: dati.descrizione.trim() || (rev === "A" ? "Prima emissione" : "Revisione"), impronta: imp, archiviata: false };
  return { revisioni: [...revisioni, revisione], emissione: { stato: "emesso", rev, impronta: imp }, revisione };
}

/** Riapre il progetto in bozza per preparare la revisione successiva (lo storico resta). */
export function apriRevisione(e: Emissione): Emissione { return { stato: "bozza", rev: e.rev, impronta: null }; }

/** Progetto emesso ma con contenuto diverso da quello emesso. */
export function modificatoDopoEmissione(e: Emissione | null | undefined, contenuto: unknown): boolean {
  return !!e && e.stato === "emesso" && !!e.impronta && impronta(contenuto) !== e.impronta;
}
