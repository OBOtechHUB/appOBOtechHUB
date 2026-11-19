/**
 * Listino prezzi OBO in formato METEL (file Excel scaricato da obo.it → Mediateca → Downloads).
 * Logica pura: lettura delle righe del foglio e prezzo unitario. Il caricamento in Supabase è in `listino.ts`.
 */
export const PAGINA_LISTINO = "https://www.obo.it/it-it/risorse/mediateca/downloads";

export interface VoceListino {
  codice: string; ean: string; descrizione: string;
  /** prezzo al rivenditore per `moltiplicatore` unità (convenzione METEL) */
  prezzo: number; prezzoPubblico: number; moltiplicatore: number;
  unita: string; confezione: number; famigliaSconto: string; stato: number; variazione: string;
}

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z]+/g, " ").trim();
const num = (v: unknown) => { const x = typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(x) ? x : NaN; };

/** Colonne riconosciute dall'intestazione (l'ordine nel file può cambiare). */
const COLONNE: Record<keyof VoceListino, string[]> = {
  codice: ["CODICE ARTICOLO"], ean: ["CODICE EAN"], descrizione: ["DESCRIZIONE PRODOTTO", "DESCRIZIONE"],
  prezzo: ["PREZZO AL RIVENDITORE"], prezzoPubblico: ["PREZZO AL PUBBLICO"], moltiplicatore: ["MOLTIPLICATORE PREZZO", "MOLTIPLICATORE"],
  unita: ["UNITA MISURA"], confezione: ["QUANTITA CARTONE"], famigliaSconto: ["FAMIGLIA SCONTO"], stato: ["STATO DEL PRODOTTO"], variazione: ["DATA ULTIMA VARIAZIONE"],
};

/** Righe del foglio (prima riga = intestazione) → voci del listino. Righe senza codice o prezzo vengono saltate. */
export function leggiListino(righe: unknown[][]): { voci: VoceListino[]; scartate: number } {
  const testa = (righe[0] ?? []).map(norm);
  const idx = Object.fromEntries(Object.entries(COLONNE).map(([k, nomi]) => [k, testa.findIndex((h) => nomi.includes(h))])) as Record<keyof VoceListino, number>;
  if (idx.codice < 0 || idx.prezzo < 0) throw new Error("Il file non sembra un listino METEL: mancano le colonne «CODICE ARTICOLO» o «PREZZO AL RIVENDITORE».");
  const voci: VoceListino[] = []; let scartate = 0; const visti = new Set<string>();
  const cella = (r: unknown[], k: keyof VoceListino) => (idx[k] >= 0 ? r[idx[k]] : undefined);
  for (const r of righe.slice(1)) {
    const codice = String(cella(r, "codice") ?? "").trim();
    const prezzo = num(cella(r, "prezzo"));
    if (!codice || !Number.isFinite(prezzo) || prezzo < 0 || visti.has(codice)) { if (r.some((v) => v != null && v !== "")) scartate++; continue; }
    visti.add(codice);
    const molt = num(cella(r, "moltiplicatore")), pp = num(cella(r, "prezzoPubblico")), conf = num(cella(r, "confezione")), st = num(cella(r, "stato"));
    voci.push({
      codice: codice.slice(0, 40), ean: String(cella(r, "ean") ?? "").trim().slice(0, 20), descrizione: String(cella(r, "descrizione") ?? "").trim().slice(0, 300),
      prezzo, prezzoPubblico: Number.isFinite(pp) ? pp : prezzo, moltiplicatore: Number.isFinite(molt) && molt > 0 ? Math.round(molt) : 1,
      unita: String(cella(r, "unita") ?? "PCE").trim().slice(0, 10) || "PCE", confezione: Number.isFinite(conf) && conf > 0 ? Math.round(conf) : 1,
      famigliaSconto: String(cella(r, "famigliaSconto") ?? "").trim().slice(0, 20), stato: Number.isFinite(st) ? Math.round(st) : 0,
      variazione: String(cella(r, "variazione") ?? "").trim().slice(0, 10),
    });
  }
  return { voci, scartate };
}

/** Prezzo di listino per un'unità (pezzo o metro). */
export const prezzoUnitario = (v: Pick<VoceListino, "prezzo" | "moltiplicatore">) => v.prezzo / Math.max(1, v.moltiplicatore);

/** Nome della versione dal nome del file: "OBO_LISTINO_METEL_2026-1__OBOLSP021.xlsx" → "2026-1". */
export function versioneDaFile(nome: string): string {
  const m = nome.match(/(20\d{2})[-_ ]?(\d{1,2})?/);
  return m ? (m[2] ? `${m[1]}-${m[2]}` : m[1]!) : nome.replace(/\.[^.]+$/, "").slice(0, 60);
}
