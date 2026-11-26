/**
 * Impianti su palo (antenne radio/TV, telecamere, illuminazione, impianti in copertura): asta di captazione isolata
 * in cima al palo con calate isolate OBO isCon fino al punto di collegamento equipotenziale; sotto quel punto la
 * corrente scende lungo il palo (se metallico e collegato a terra) o lungo una calata.
 *
 * Metodo (CEI EN IEC 62305-3:2026-10, 6.3 e Allegato B; dati del costruttore OBO isCon):
 *  - l = quota della punta − quota del collegamento equipotenziale;
 *  - s richiesta = ki · kc / km · l, con kc = 1 / 0,66 / 0,44 per 1 / 2 / 3 o più conduttori;
 *  - versione isCon con distanza equivalente se ≥ s (l ≤ l max = se · km / (ki · kc), come la tabella OBO);
 *  - corrente: con LPL I e un solo conduttore serve la classe H2 (Premium 90);
 *  - apparati: protetti dalla sfera rotolante e alla distanza d ≥ s dalle parti nude della captazione;
 *  - posa: supporti ogni 1 m, set HM SET per fino a 4 conduttori, estensione per pali isolati oltre 6 m.
 */
import { KI, type Livello } from "@/calcoli/calate/separazione";
import { ISCON, ammessaPerCorrente, lunghezzaMassima, scegliIscon, verificaIscon, type EsigenzeIscon, type VersioneIscon } from "@/calcoli/calate/iscon";
import { puntoProtetto, raggioSfera } from "@/calcoli/antenne/antenne";

export interface ApparatoPalo { id: string; nome: string; quota: number; sbraccio: number; distanza: number }
export interface DatiPalo {
  lpl: Livello;
  /** quota della punta dell'asta di captazione da terra (m) */
  quotaPunta: number;
  /** quota del collegamento equipotenziale delle calate isolate (m da terra) */
  quotaCollegamento: number;
  /** lunghezza del palo isolato isFang su cui corrono i conduttori (m): serve per i supporti */
  mastoIsolato: number;
  materiale: "aria" | "solido";
  apparati: ApparatoPalo[];
  esigenze: Omit<EsigenzeIscon, "sAria">;
  /** numero di conduttori deciso dall'utente (null = il minimo che basta) */
  conduttori: number | null;
  /** versione isCon scelta dall'utente (null = la più semplice che basta) */
  versione?: VersioneIscon | null | undefined;
  ki: number | null;
}

export const DATI_PALO: DatiPalo = {
  lpl: "IV", quotaPunta: 36, quotaCollegamento: 27, mastoIsolato: 6, materiale: "aria",
  apparati: [
    { id: "a1", nome: "Antenne di settore", quota: 33, sbraccio: 0.6, distanza: 0.8 },
    { id: "a2", nome: "Parabole", quota: 29.7, sbraccio: 0.5, distanza: 1 },
  ],
  esigenze: {}, conduttori: null, ki: null,
};

export const CORRENTE_LPL: Record<Livello, number> = { I: 200, II: 150, III: 100, IV: 100 };
export const kcConduttori = (n: number): number => (n <= 1 ? 1 : n === 2 ? 0.66 : 0.44);

export interface OpzioneConduttori { n: number; kc: number; s: number; versione: VersioneIscon | null; correntePerConduttore: number; lMax: number | null }
export interface RisultatoPalo {
  ki: number; km: number; l: number; r: number;
  opzioni: OpzioneConduttori[];
  scelta: OpzioneConduttori | null;
  apparati: (ApparatoPalo & { protetto: boolean; sNuda: number; distanzaOk: boolean })[];
  materiali: { codice: string; descrizione: string; quantita: number; unita: string }[];
  avvisi: string[];
}

/** Versione per n conduttori: la più semplice che basta per s e corrente e che rispetta le esigenze di posa. */
function versionePer(n: number, s: number, d: DatiPalo): VersioneIscon | null {
  if (d.versione) return verificaIscon(d.versione, s, d.materiale).conforme && ammessaPerCorrente(d.versione, d.lpl, n) ? d.versione : null;
  const sAria = d.materiale === "solido" ? s / 2 : s;
  const g = scegliIscon({ sAria, ...d.esigenze });
  const ordine: VersioneIscon[] = g ? [g.versione, ...(["basic", "pro", "proplus", "premium"] as VersioneIscon[]).filter((v) => v !== g.versione)] : ["premium"];
  const vuoleProplus = !!(d.esigenze.verniciabile || d.esigenze.atex || d.esigenze.protezioneMeccanica || d.esigenze.tensioniContatto);
  for (const v of ordine) {
    if (vuoleProplus && v !== "proplus" && v !== "premium") continue;
    if (verificaIscon(v, s, d.materiale).conforme && ammessaPerCorrente(v, d.lpl, n)) return v;
  }
  return null;
}

export function calcolaPalo(d: DatiPalo): RisultatoPalo {
  const ki = d.ki ?? KI[d.lpl], km = 1, l = Math.max(0, d.quotaPunta - d.quotaCollegamento), r = raggioSfera(d.lpl);
  const opzioni: OpzioneConduttori[] = [1, 2, 3, 4].map((n) => {
    const kc = kcConduttori(n), s = (ki * kc / km) * l, versione = versionePer(n, s, d);
    return { n, kc, s, versione, correntePerConduttore: CORRENTE_LPL[d.lpl] * kc, lMax: versione ? lunghezzaMassima(versione, ki, kc, d.materiale === "solido" ? 0.5 : 1) : null };
  });
  const scelta = d.conduttori ? opzioni.find((o) => o.n === Math.min(4, Math.max(1, d.conduttori!))) ?? null : opzioni.find((o) => o.versione) ?? null;
  const kcS = scelta?.kc ?? 1;
  const apparati = d.apparati.map((a) => {
    // parti nude della captazione: dalla punta in giù fino all'inizio del tratto isolato (caso peggiore: l intera)
    const sNuda = (ki * kcS / km) * l;
    return { ...a, protetto: puntoProtetto(d.quotaPunta, a.sbraccio, a.quota, r), sNuda, distanzaOk: a.distanza >= sNuda - 1e-9 };
  });
  const avvisi: string[] = [];
  if (!(l > 0)) avvisi.push("Il collegamento equipotenziale deve stare sotto la punta dell'asta.");
  const sopra = d.apparati.filter((a) => a.quota < d.quotaCollegamento);
  if (sopra.length) avvisi.push(`${sopra.map((a) => a.nome).join(", ")}: sotto il collegamento equipotenziale; di solito il collegamento si mette sotto l'apparato più basso, così tutti gli apparati restano lungo il tratto isolato.`);
  if (scelta && !scelta.versione) avvisi.push(d.versione ? `Con ${scelta.n} conduttor${scelta.n === 1 ? "e" : "i"} ${ISCON[d.versione].nome} non basta: aumenta i conduttori, scegli una versione con distanza equivalente maggiore o alza il collegamento equipotenziale.` : `Con ${scelta.n} conduttor${scelta.n === 1 ? "e" : "i"} nessun isCon basta: aumenta i conduttori o alza il collegamento equipotenziale.`);
  if (d.versione && (d.versione === "basic" || d.versione === "pro") && (d.esigenze.verniciabile || d.esigenze.atex || d.esigenze.protezioneMeccanica || d.esigenze.tensioniContatto)) avvisi.push(`Le esigenze di posa indicate (verniciabile, ATEX, protezione meccanica o tensioni di contatto) richiedono isCon Pro+ 75 secondo la guida OBO.`);
  if (!opzioni.some((o) => o.versione)) avvisi.push("Nessuna combinazione fino a 4 conduttori basta: alza il collegamento equipotenziale (l più corta) o valuta un livello diverso.");
  if (apparati.some((a) => !a.protetto)) avvisi.push("Alcuni apparati non sono protetti dalla sfera rotolante: alza la punta dell'asta o avvicinala.");
  if (d.esigenze.tensioniContatto && scelta?.versione === "proplus" && l > 5) avvisi.push("Protezione dalle tensioni di contatto con Pro+ 75 GR: al massimo 5 m di tratto.");

  const materiali: RisultatoPalo["materiali"] = [];
  if (scelta?.versione) {
    const D = ISCON[scelta.versione], gr = !!d.esigenze.tensioniContatto && scelta.versione === "proplus";
    const cod = gr ? "5407995" : D.codici[0]!.codice;
    materiali.push({ codice: cod, descrizione: `${D.nome}${gr ? " GR" : ""} – conduttore isolato (l + 1 m di riserva per conduttore)`, quantita: Math.ceil((l + 1) * scelta.n), unita: "m" });
    materiali.push({ codice: "5408090", descrizione: "isCon HM SET – supporti al palo per fino a 4 conduttori", quantita: Math.ceil(scelta.n / 4), unita: "pz" });
    if (d.mastoIsolato > 6) materiali.push({ codice: "5408094", descrizione: "isCon HM ERW – estensione per pali oltre 6 m", quantita: Math.ceil(scelta.n / 4), unita: "pz" });
    materiali.push({ codice: "5408058", descrizione: "Cartello informativo isCon", quantita: 1, unita: "pz" });
  }
  return { ki, km, l, r, opzioni, scelta, apparati, materiali, avvisi };
}
