/** Mattoni comuni dei documenti Word in stile OBO (relazione, dichiarazione, verbali, offerta). */
import { OBO, type Blocco, type Run, type Testo } from "@/lib/docx";

export const it = (v: number, dec = 2) => v.toLocaleString("it-IT", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
export const euro = (v: number) => v.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dc = (t: string): Run => ({ t: `[DA COMPLETARE: ${t}]`, daCompletare: true });
/** testo o, se vuoto, segnaposto giallo */
export const oDc = (v: string | null | undefined, cosa: string): Run[] => (v && v.trim() ? [{ t: v.trim() }] : [dc(cosa)]);
export const p = (testo: Testo, extra: Partial<Extract<Blocco, { tipo: "par" }>> = {}): Blocco => ({ tipo: "par", testo, ...extra });
export const h1 = (testo: string): Blocco => ({ tipo: "titolo", livello: 1, testo });
export const h2 = (testo: string): Blocco => ({ tipo: "titolo", livello: 2, testo });
export const h3 = (testo: string): Blocco => ({ tipo: "titolo", livello: 3, testo });
export const el = (...voci: Testo[]): Blocco => ({ tipo: "elenco", voci });
export const eln = (...voci: Testo[]): Blocco => ({ tipo: "elenco", voci, numerato: true });
export const tab = (intestazione: Testo[], righe: Testo[][], larghezze?: number[], extra: Partial<Extract<Blocco, { tipo: "tabella" }>> = {}): Blocco => ({ tipo: "tabella", intestazione, righe, ...(larghezze ? { larghezze } : {}), ...extra });

const MESI = { it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"], en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] };
export const dataLunga = (d: Date, l: "it" | "en" = "it") => (l === "it" ? `${d.getDate()} ${MESI.it[d.getMonth()]} ${d.getFullYear()}` : `${d.getDate()} ${MESI.en[d.getMonth()]} ${d.getFullYear()}`);
export const dataIt = (iso: string) => { const [a, m, g] = iso.split("-"); return a && m && g ? `${g}/${m}/${a}` : iso; };

/** Piè di pagina con i dati societari OBO. */
export const PIEDE_OBO: Testo[] = [
  [{ t: "OBO Bettermann S.r.l.", b: true }, { t: " a socio unico · Via Ferrero 16 – 10098 Cascine Vica Rivoli (TO) · Tel. +39 011 9548 811 · Fax +39 011 9548 899" }],
  "R.E.A. n° 1035379 – Registro Imprese n° 09227890010 Trib. di Torino – Cap. Soc. € 300.000 i.v. – C.Fisc./P.IVA 09227890010",
  "Società soggetta all'attività di direzione e coordinamento di Arvigrat Holding AG",
];

/** Intestazione breve di documento: logo (o scritta), fascia scura con titolo, barra arancio. */
export function testataObo(titolo: string, sottotitolo: string, logo?: Blocco): Blocco[] {
  return [
    logo ?? p([{ t: "OBO BETTERMANN", b: true, colore: OBO.arancio }], { dimensione: 16 }),
    { tipo: "fascia", colore: OBO.sec1, altezza: 2.6, righe: [
      { testo: [{ t: titolo.toUpperCase(), carattere: "condensato" }], dimensione: 16, grassetto: true },
      { testo: [{ t: sottotitolo, carattere: "condensatoLeggero" }], dimensione: 11, colore: OBO.sec4 },
    ] },
    { tipo: "fascia", colore: OBO.arancio, righe: [], altezza: 0.12 },
    p("", { spazioDopo: 6 }),
  ];
}

/** Riga di firma: luogo e data a sinistra, ruolo e nome a destra. */
export function firma(luogoData: string, ruolo: string, nome: Run[]): Blocco[] {
  return [
    p(luogoData, { spazioPrima: 18 }),
    p([{ t: ruolo, b: true }], { allinea: "destra", spazioPrima: 6, spazioDopo: 2 }),
    p(nome, { allinea: "destra", spazioDopo: 26 }),
    p("______________________________", { allinea: "destra" }),
  ];
}

/** Casella da spuntare a mano nel documento stampato. */
export const casella = "□";
