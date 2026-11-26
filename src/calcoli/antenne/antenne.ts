/**
 * Antenne radiomobili (5G, 4G, stazioni radio base): protezione delle antenne dalla fulminazione diretta con un'asta
 * di captazione sopra il palo, distanza di separazione dell'asta isolata e del conduttore di calata isolato.
 * Metodo della sfera rotolante (CEI EN IEC 62305-3) come per l'edificio; misure su SPD, schermi dei cavi e terra
 * secondo CEI EN IEC 62305-4, Allegato B.11 (apparecchiature installate all'esterno) e 62305-3, D.5.2.6.3.
 * Prima versione: sarà completata con i documenti tecnici che invierà Marco.
 */
import parametri from "@/dati/captazione/parametriLPL.json";
import { KI, distanzaSeparazione, type Livello } from "@/calcoli/calate/separazione";
import { ISCON, ORDINE_ISCON, ammessaPerCorrente, lunghezzaMassima, verificaIscon, type VersioneIscon } from "@/calcoli/calate/iscon";

export type TipoSito = "tetto" | "palo" | "traliccio";
export const NOMI_SITO: Record<TipoSito, string> = {
  tetto: "Palo con antenne sul tetto di un edificio",
  palo: "Palo (monopalo) a terra",
  traliccio: "Traliccio in acciaio a terra",
};

export function raggioSfera(lpl: Livello): number { return parametri[lpl].raggio; }

/**
 * Punto protetto da un'asta verticale con la punta ad altezza H sopra il piano di riferimento (tetto o terreno):
 * il punto è a distanza orizzontale a dall'asse dell'asta e ad altezza z sullo stesso piano.
 * La sfera più pericolosa tocca la punta e il piano (H ≤ r) oppure la punta e l'asse dell'asta sotto la punta (H > r).
 */
export function puntoProtetto(H: number, a: number, z: number, r: number): boolean {
  if (!(H > 0) || !(r > 0) || z > H + 1e-9) return false;
  const zc = Math.max(r, H), c = Math.sqrt(Math.max(0, r * r - (zc - H) ** 2));
  if (a > c + 1e-9) return false;
  return (c - a) ** 2 + (zc - z) ** 2 >= r * r - 1e-9;
}

/** Altezza minima della punta dell'asta (m sul piano) che protegge il bordo più esterno delle antenne. */
export function altezzaAstaMinima(aBordo: number, zSommita: number, r: number): number {
  let lo = zSommita, hi = zSommita + 2 * r + aBordo + 1;
  if (!puntoProtetto(hi, aBordo, zSommita, r)) return NaN;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (puntoProtetto(m, aBordo, zSommita, r)) hi = m; else lo = m; }
  return hi;
}

export interface DatiAntenne {
  tipo: TipoSito; lpl: Livello;
  /** quota del piano di riferimento: tetto per "tetto", 0 per palo/traliccio */
  quotaPiano: number;
  /** altezza della sommità delle antenne sul piano (m) */
  sommita: number;
  /** distanza orizzontale del bordo esterno delle antenne dall'asse dell'asta (m) */
  sbraccio: number;
  /** altezza proposta per la punta dell'asta sul piano (m); null = calcolata */
  astaPunta: number | null;
  /** distanza minima reale tra asta/supporto isolato e antenne o parti metalliche (m) */
  distanzaReale: number;
  /** lunghezza del conduttore di calata dalla punta al collegamento equipotenziale (m) */
  lunghezzaCalata: number;
  numeroCalate: number;
  /** true (o assente) = l'app sceglie il numero di calate da 1 a 4 */
  calateAuto?: boolean | undefined;
  /** versione isCon scelta dal progettista (null o assente = la più semplice che basta) */
  versione?: VersioneIscon | null | undefined;
  ki: number | null;
  /** linee che arrivano agli apparati */
  cavi: { coassiali: boolean; fibraMetallica: boolean; fibraDielettrica: boolean; alimentazione: boolean };
  lpsEdificio: boolean;
  note?: string | undefined;
}

export const DATI_INIZIALI: DatiAntenne = {
  tipo: "tetto", lpl: "III", quotaPiano: 0, sommita: 6, sbraccio: 0.6, astaPunta: null, distanzaReale: 1, lunghezzaCalata: 12, numeroCalate: 1, ki: null,
  cavi: { coassiali: false, fibraMetallica: false, fibraDielettrica: true, alimentazione: true }, lpsEdificio: false,
};

export const kcCalate = (n: number) => (n <= 1 ? 1 : n === 2 ? 0.66 : 0.44);
export interface OpzioneCalate { n: number; kc: number; s: number; versione: VersioneIscon | null; lMax: number | null }
export interface SoluzioneIscon { opzioni: OpzioneCalate[]; scelta: OpzioneCalate | null; lMassima: number; versioneLMassima: VersioneIscon; quotaCollegamentoMinima: number | null }
/**
 * Soluzione con calate isolate isCon (da 1 a 4): per ogni numero di calate la s richiesta (s = ki · kc · l) e la versione
 * più semplice che basta (se ≥ s e corrente ammessa: LPL I con una calata solo Premium). Se il numero di calate è
 * fisso si usa quello, altrimenti il minimo che basta. Se nessuna combinazione basta, la l massima possibile
 * (4 calate, la versione con se più alta) e la quota minima del collegamento equipotenziale per stare sotto quella l.
 */
export function soluzioneIscon(ki: number, l: number, lpl: Livello, nFisso: number | null, versione: VersioneIscon | null, quotaPunta: number): SoluzioneIscon {
  const opzioni: OpzioneCalate[] = [1, 2, 3, 4].map((n) => {
    const kc = kcCalate(n), s = ki * kc * Math.max(0, l);
    const ok = (v: VersioneIscon) => verificaIscon(v, s).conforme && ammessaPerCorrente(v, lpl, n);
    const v = versione ? (ok(versione) ? versione : null) : (["basic", "proplus", "premium"] as VersioneIscon[]).find(ok) ?? null;
    return { n, kc, s, versione: v, lMax: v ? lunghezzaMassima(v, ki, kc) : null };
  });
  const scelta = nFisso ? opzioni.find((o) => o.n === Math.min(4, Math.max(1, nFisso))) ?? null : opzioni.find((o) => o.versione) ?? null;
  const vMax: VersioneIscon = versione ?? "premium";
  const lMassima = lunghezzaMassima(vMax, ki, kcCalate(nFisso ? Math.min(4, nFisso) : 4));
  const quotaCollegamentoMinima = Number.isFinite(quotaPunta) && l > lMassima ? Math.max(0, quotaPunta - lMassima) : null;
  return { opzioni, scelta, lMassima, versioneLMassima: vMax, quotaCollegamentoMinima };
}
void ORDINE_ISCON;

export interface RisultatoAntenne {
  r: number; astaMinima: number; asta: number; protette: boolean; sopraAntenne: number;
  ki: number; kc: number; s: number; separazioneOk: boolean;
  isconConsigliato: VersioneIscon | null;
  soluzione: SoluzioneIscon; nCalate: number;
  misure: { testo: string; rif: string; obbligatoria: boolean }[];
}

export function calcolaAntenne(d: DatiAntenne): RisultatoAntenne {
  const r = raggioSfera(d.lpl), astaMinima = altezzaAstaMinima(d.sbraccio, d.sommita, r);
  const asta = d.astaPunta ?? Math.ceil(astaMinima * 10) / 10;
  const protette = puntoProtetto(asta, d.sbraccio, d.sommita, r);
  const ki = d.ki ?? KI[d.lpl];
  const auto = d.calateAuto !== false;
  const soluzione = soluzioneIscon(ki, d.lunghezzaCalata, d.lpl, auto ? null : d.numeroCalate, d.versione ?? null, d.quotaPiano + asta);
  // numero di calate usato: quello della soluzione (automatico) oppure quello scelto; senza soluzione 4 (il caso migliore)
  const nCalate = auto ? soluzione.scelta?.n ?? 4 : Math.min(50, Math.max(1, d.numeroCalate));
  const kc = kcCalate(nCalate);
  // separazione tra l'asta isolata e le antenne: la lunghezza è quella dal punto vicino alle antenne al collegamento equipotenziale
  const s = distanzaSeparazione(ki, kc, 1, Math.max(0, d.lunghezzaCalata));
  const misure: RisultatoAntenne["misure"] = [];
  const add = (testo: string, rif: string, obbligatoria = true) => misure.push({ testo, rif, obbligatoria });
  const sol = soluzione.scelta;
  if (sol?.versione) add(`Soluzione: ${sol.n} ${sol.n === 1 ? "calata isolata" : "calate isolate"} ${ISCON[sol.versione].nome} (s richiesta ${fm(sol.s, 3)} m in aria ≤ ${fm(ISCON[sol.versione].sAria)} m; l massima ${fm(sol.lMax ?? NaN, 1)} m con l = ${fm(d.lunghezzaCalata, 1)} m).`, "62305-3, 6.3; dati OBO isCon");
  else add(`Con l = ${fm(d.lunghezzaCalata, 1)} m nessun isCon basta${auto ? " neanche con 4 calate" : ` con ${nCalate} calate`}: la l massima è ${fm(soluzione.lMassima, 1)} m (${ISCON[soluzione.versioneLMassima].nome}${auto ? ", 4 calate" : ""}). Porta il collegamento equipotenziale più in alto${soluzione.quotaCollegamentoMinima != null ? `, almeno a ${fm(soluzione.quotaCollegamentoMinima, 1)} m da ${d.tipo === "tetto" ? "tetto" : "terra"}` : ""} (sul palo metallico collegato a terra, sotto l'antenna più bassa), così l si accorcia.`, "62305-3, 6.3; dati OBO isCon");
  add(protette ? `Asta di captazione con la punta a ${fm(asta)} m sul piano: le antenne restano dentro il volume protetto (sfera r = ${r} m).` : `Asta troppo bassa: servono almeno ${fm(astaMinima)} m sul piano perché le antenne non siano colpite.`, "62305-3, sfera rotolante; 62305-4, B.11.2");
  add(s <= d.distanzaReale ? `Asta isolata dalle antenne: distanza reale ${fm(d.distanzaReale)} m ≥ s = ${fm(s, 3)} m.` : `Distanza reale ${fm(d.distanzaReale)} m minore di s = ${fm(s, 3)} m: allontana l'asta (supporti isolati più lunghi) oppure collega il palo delle antenne all'LPS.`, "62305-3, distanza di separazione s = ki · kc / km · l");
  const ver = soluzione.scelta?.versione ?? null;
  if (d.tipo === "tetto") add(d.lpsEdificio ? "I supporti delle antenne vanno collegati all'LPS dell'edificio se non si rispetta la distanza di separazione." : "Edificio senza LPS: valuta il rischio dell'edificio con le antenne installate (altezza e linee nuove aumentano le fulminazioni).", "62305-4, B.11.2; 62305-2");
  if (d.cavi.coassiali) add("Schermo dei cavi coassiali collegato al palo in alto e all'ingresso nel locale apparati; SPD per antenne nel punto d'ingresso.", "62305-4, B.11 (Fig. B.5)");
  if (d.cavi.fibraMetallica) add("Fibra con parti metalliche (armatura, barriera, tirante): collega le parti metalliche alla barra equipotenziale all'ingresso.", "62305-4, B.12.3");
  if (d.cavi.fibraDielettrica) add("Fibra completamente dielettrica: nessuna protezione aggiuntiva sulla linea.", "62305-4, B.12.2", false);
  if (d.cavi.alimentazione) add("Linea di alimentazione degli apparati: SPD di classe adatta al confine LPZ 0/1 (in genere tipo 1) e coordinamento con gli SPD a valle.", "62305-4; CEI EN 61643-12");
  if (d.tipo === "traliccio") add("Cavi lungo il traliccio negli spigoli interni dei montanti a L o in passerelle collegate, uscita da un solo punto.", "62305-4, B.11.4 (Fig. B.8)");
  if (d.tipo !== "tetto") add("Un solo impianto di terra integrato per palo/traliccio, locale apparati e recinzione, con anello e collegamenti tra le strutture.", "62305-4, 5.2; 62305-3");
  add("Cavi fuori dal palo in canali o tubi metallici collegati a entrambe le estremità per ridurre le tensioni indotte.", "62305-4, B.11.4", false);
  return { r, astaMinima, asta, protette, sopraAntenne: asta - d.sommita, ki, kc, s, separazioneOk: s <= d.distanzaReale, isconConsigliato: ver, soluzione, nCalate, misure };
}

const fm = (v: number, c = 2) => Number.isFinite(v) ? v.toLocaleString("it-IT", { maximumFractionDigits: c }) : "—";
