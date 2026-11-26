/**
 * Calate isolate isCon da grande altezza (antenne su palo o traliccio, camini, edifici alti): dove fare i collegamenti
 * equipotenziali esterni al cavo.
 *
 * Metodo (CEI EN IEC 62305-3, 6.3; dati del costruttore OBO isCon):
 *  - la distanza di separazione s = ki · kc / km · l vale dal punto di captazione al primo collegamento equipotenziale
 *    (PAE) lungo il conduttore: l'isCon la garantisce se s ≤ se della versione, cioè l ≤ l max = se · km / (ki · kc);
 *  - il PAE principale si mette sotto l'apparato più basso da isolare (lasciando la zona x del costruttore libera)
 *    e non più in basso di (quota della punta − l max);
 *  - sotto il PAE: con struttura metallica o in calcestruzzo armato con ferri continui collegati a terra la corrente
 *    scende nella struttura (calata naturale) e non servono altri collegamenti intermedi; con struttura non conduttiva
 *    servono calate fino a terra e livelli equipotenziali intermedi con passo h ≤ d · km / (ki · kc), dove d è la
 *    distanza disponibile tra calata e impianti (con l'isCon fino a terra d = se, cioè h ≤ l max).
 * Testi scritti con parole nostre: valori e verifiche, nessun testo della norma o del costruttore copiato.
 */
import { KI, type Livello } from "./separazione";
import { ISCON, ammessaPerCorrente, lunghezzaMassima, verificaIscon, type VersioneIscon } from "./iscon";

export type StrutturaSostegno = "metallica" | "armata" | "isolante";
export const NOMI_STRUTTURA: Record<StrutturaSostegno, string> = {
  metallica: "Palo o traliccio metallico collegato a terra",
  armata: "Calcestruzzo armato con ferri continui collegati a terra",
  isolante: "Struttura non conduttiva (vetroresina, legno, muratura)",
};

export interface DatiCalateAltezza {
  lpl: Livello;
  ki?: number | null | undefined;
  /** quota della punta di captazione (m) */
  quotaPunta: number;
  /** quota del piano di riferimento: terreno o copertura con il suo LPS (m) */
  quotaBase: number;
  /** quota dell'apparato (antenna) più basso da tenere isolato; null = nessun apparato da isolare */
  quotaApparatoBasso: number | null;
  struttura: StrutturaSostegno;
  /** numero di calate fisso (1–4) o null = il minimo che basta */
  nCalate: number | null;
  versione: VersioneIscon | null;
  materiale: "aria" | "solido";
  /** con struttura non conduttiva: distanza disponibile tra calate nude e impianti interni o cavi (m) */
  distanzaImpianti: number;
  /** isCon continuo dalla punta fino a terra (il cavo non si taglia al PAE): con struttura non conduttiva sostituisce le calate nude */
  isconFinoATerra: boolean;
}

export interface LivelloEquipotenziale { quota: number; tipo: "principale" | "intermedio" | "base"; titolo: string; cosa: string[] }
export interface RisultatoCalateAltezza {
  fattibile: boolean; ki: number; km: number;
  n: number; kc: number; versione: VersioneIscon | null; lMax: number; zonaX: number;
  quotaPAE: number | null; l: number; s: number;
  /** passo massimo dei livelli intermedi sotto il PAE (solo struttura non conduttiva) */
  passoIntermedi: number | null;
  livelli: LivelloEquipotenziale[];
  materiali: { codice: string; descrizione: string; quantita: number; unita: string }[];
  avvisi: string[];
  /** se non fattibile: l massima possibile e quota minima del PAE con quella l */
  lMassimaPossibile: number; quotaPAEMinima: number;
  /** collegamenti al palo/anello: al PAE uno per calata, poi uno per calata a ogni livello intermedio */
  collegamentiPAE: number; livelliIntermedi: number; collegamentiTotali: number;
}

const kcDi = (n: number) => (n <= 1 ? 1 : n === 2 ? 0.66 : 0.44);
const f = (v: number, c = 2) => (Number.isFinite(v) ? v.toLocaleString("it-IT", { maximumFractionDigits: c }) : "—");

export function calateIsconAltezza(d: DatiCalateAltezza): RisultatoCalateAltezza {
  const ki = d.ki ?? KI[d.lpl], km = d.materiale === "solido" ? 0.5 : 1;
  const top = d.quotaPunta, base = Math.min(d.quotaBase, top);
  const ordine: VersioneIscon[] = d.versione ? [d.versione] : ["basic", "proplus", "premium"];
  const numeri = d.nCalate ? [Math.min(4, Math.max(1, d.nCalate))] : [1, 2, 3, 4];
  type Cand = { n: number; v: VersioneIscon; lMax: number; x: number; pae: number };
  let scelta: Cand | null = null;
  for (const n of numeri) {
    for (const v of ordine) {
      if (!ammessaPerCorrente(v, d.lpl, n)) continue;
      const lMax = lunghezzaMassima(v, ki, kcDi(n), km), x = ISCON[v].zonaPotenziale;
      const minimo = Math.max(base, top - lMax);
      // con apparati da isolare il PAE sta subito sotto il più basso (zona x libera), così l è la più corta possibile
      const pae = d.quotaApparatoBasso != null ? d.quotaApparatoBasso - x : minimo;
      if (pae >= minimo - 1e-9 && pae < top) { scelta = { n, v, lMax, x, pae }; break; }
    }
    if (scelta) break;
  }
  const vMax: VersioneIscon = d.versione ?? "premium", nMax = d.nCalate ? Math.min(4, d.nCalate) : 4;
  const lMassimaPossibile = lunghezzaMassima(vMax, ki, kcDi(nMax), km);
  const quotaPAEMinima = top - lMassimaPossibile;
  const avvisi: string[] = [];
  if (!scelta) {
    const n = nMax, kc = kcDi(n), x = ISCON[vMax].zonaPotenziale;
    const serve = d.quotaApparatoBasso != null ? top - (d.quotaApparatoBasso - x) : top - base;
    avvisi.push(`Nessuna combinazione basta: con ${n} ${n === 1 ? "calata" : "calate"} ${ISCON[vMax].nome} la l massima è ${f(lMassimaPossibile, 1)} m, ma ${d.quotaApparatoBasso != null ? "per isolare l'apparato più basso" : "fino al piano di riferimento"} servono ${f(serve, 1)} m.`);
    if (d.quotaApparatoBasso != null) avvisi.push(`Soluzioni: isolare solo gli apparati sopra ${f(quotaPAEMinima + x, 1)} m (PAE ad almeno ${f(quotaPAEMinima, 1)} m e apparati più bassi collegati alla struttura, con schermi dei cavi collegati e SPD di tipo 1 dove i cavi entrano), oppure avvicinare la punta agli apparati.`);
    return { collegamentiPAE: 0, livelliIntermedi: 0, collegamentiTotali: 0, fattibile: false, ki, km, n, kc, versione: null, lMax: lMassimaPossibile, zonaX: x, quotaPAE: null, l: serve, s: (ki * kc * serve) / km, passoIntermedi: null, livelli: [], materiali: [], avvisi, lMassimaPossibile, quotaPAEMinima };
  }
  const { n, v, lMax, x } = scelta;
  const kc = kcDi(n), pae = scelta.pae, l = top - pae, s = (ki * kc * l) / km;
  const D = ISCON[v];
  const livelli: LivelloEquipotenziale[] = [];
  livelli.push({ quota: pae, tipo: "principale", titolo: "Collegamento equipotenziale principale (PAE)", cosa: [
    `Conduttore interno di ogni isCon collegato a ${d.struttura === "isolante" ? "l'anello equipotenziale (o la barra) di questa quota" : "la struttura metallica"} con l'elemento di collegamento isCon (piastra per 1 o 2 conduttori).`,
    D.equipotenziale.palo ? `Guaina esterna collegata all'equipotenziale qui e all'altro capo (${D.nome}).` : `${D.nome}: nessun collegamento della guaina al palo; all'altro capo morsetto PAE oppure distanza x = ${f(x)} m tra elemento di collegamento e ultimo distanziatore isolato.`,
    `Zona x = ${f(x)} m sopra il PAE senza parti conduttrici entro s = ${f(s, 3)} m dal conduttore.`,
    "Alla stessa quota: supporti metallici degli apparati, schermi dei cavi coassiali e altre parti metalliche collegati allo stesso punto.",
    `Sopra il PAE: nessuna parte metallica entro s = ${f(s, 3)} m dalle parti nude della captazione (asta, punta, morsetti).`,
  ] });
  let passo: number | null = null;
  const sotto = pae - base;
  if (sotto > 0.1) {
    if (d.struttura === "isolante") {
      passo = d.isconFinoATerra ? lMax : (Math.max(0.01, d.distanzaImpianti) * km) / (ki * kc);
      const nLiv = Math.max(0, Math.ceil(sotto / passo - 1e-9) - 1), h = sotto / (nLiv + 1);
      for (let i = 1; i <= nLiv; i++) livelli.push({ quota: pae - i * h, tipo: "intermedio", titolo: `Livello equipotenziale intermedio ${i}`, cosa: [
        d.isconFinoATerra ? "Conduttore interno degli isCon collegato all'anello o alla barra equipotenziale di questa quota (come al PAE)." : "Calate collegate all'anello o alla barra equipotenziale di questa quota.",
        "Schermi dei cavi e parti metalliche della stessa quota collegati allo stesso anello.",
        `Tra due livelli al massimo ${f(passo, 1)} m (s = ${f((ki * kc * h) / km, 3)} m ≤ ${d.isconFinoATerra ? `${f(D.sAria * (km < 1 ? 2 : 1))} m dell'isCon` : `${f(d.distanzaImpianti)} m disponibili`}).`,
      ] });
    } else if (d.isconFinoATerra) {
      avvisi.push(`Il cavo isCon non si taglia: prosegue intero dalla punta fino al dispersore (${f(top - base, 1)} m), fissato ${d.struttura === "metallica" ? "al palo o traliccio" : "alla struttura"}. Al PAE il conduttore interno si collega ${d.struttura === "metallica" ? "al palo" : "ai ferri"}: da lì in giù cavo e struttura portano insieme la corrente, quindi non servono altri collegamenti intermedi né altre verifiche della distanza.`);
      avvisi.push(`La verifica vale solo per i ${f(l, 1)} m sopra il PAE: senza il collegamento al PAE il tratto isolato sarebbe lungo ${f(top - base, 1)} m e nessun isCon basterebbe (s = ${f((ki * kc * (top - base)) / km, 2)} m).`);
    } else {
      avvisi.push(d.struttura === "metallica"
        ? "Sotto il PAE la corrente scende nel palo o traliccio (calata naturale): continuità dei giunti e collegamento a terra alla base, senza altri collegamenti intermedi."
        : "Sotto il PAE la corrente scende nei ferri d'armatura: verifica la continuità elettrica dei ferri (misura) e collegali a terra alla base.");
    }
  }
  if (d.struttura !== "isolante" && sotto > 0.1) {
    avvisi.push(`Perché basta un solo livello di PAE (${n} ${n === 1 ? "collegamento" : "collegamenti"}, uno per calata): la distanza di separazione si calcola fino al collegamento equipotenziale più vicino. Sotto il PAE cavo isCon e ${d.struttura === "metallica" ? "palo" : "ferri"} sono collegati tra loro in alto (PAE) e in basso (terra) e portano la corrente insieme: tra i due non serve distanza. Vale solo se ${d.struttura === "metallica" ? "il palo è metallico, con giunti elettricamente continui per tutta l'altezza" : "i ferri sono continui per tutta l'altezza (verificato con misura)"} e collegato a terra alla base; se non è così scegli «Struttura non conduttiva» e l'app aggiunge i livelli intermedi.`);
    avvisi.push("Schermi dei cavi d'antenna collegati al palo al PAE e alla base (ingresso del locale apparati); per discese lunghe è buona pratica collegarli al palo anche a quote intermedie, con i kit di messa a terra dei cavi.");
  }
  livelli.push({ quota: base, tipo: "base", titolo: base > 0.05 ? "Piano di riferimento (copertura con LPS)" : "Base: collegamento a terra", cosa: [
    d.struttura === "isolante" ? `Calate (${n}) collegate all'impianto di terra con punto di sezionamento per le misure.` : `Struttura collegata all'impianto di terra in almeno ${Math.max(2, n)} punti.`,
    "Barra equipotenziale principale: schermi dei cavi collegati all'ingresso del locale apparati, SPD di tipo 1 sulle linee che entrano.",
  ] });
  if (v === "proplus") avvisi.push("Con Pro+ 75 GR (grigio) la protezione dalle tensioni di contatto vale al massimo per 5 m, con la guaina collegata dopo 0,5 m dal collegamento superiore.");
  if (d.lpl === "I" && n === 1) avvisi.push("LPL I con una sola calata isolata: serve la classe H2 (200 kA), cioè Premium 90.");
  if (!verificaIscon(v, s, d.materiale).conforme) avvisi.push("Controllo: s supera la distanza equivalente dell'isCon.");
  const metriIsconPerCalata = l + (d.isconFinoATerra ? sotto : 0) + 1;
  const materiali: RisultatoCalateAltezza["materiali"] = [
    { codice: D.codici[0]!.codice, descrizione: `${D.nome} – ${n} ${n === 1 ? "calata" : "calate"} (l ${f(l, 1)} m${d.isconFinoATerra ? ` + ${f(sotto, 1)} m fino a terra, senza tagli` : ""} + 1 m di riserva per calata)`, quantita: Math.ceil(metriIsconPerCalata * n), unita: "m" },
    n >= 2 ? { codice: "5408028", descrizione: "Piastra di collegamento per due conduttori isCon (al PAE)", quantita: Math.ceil(n / 2) * (1 + livelli.filter((x) => x.tipo === "intermedio").length * (d.isconFinoATerra ? 1 : 0)), unita: "pz" }
      : { codice: "5408026", descrizione: "Piastra di collegamento per un conduttore isCon (al PAE)", quantita: 1 + livelli.filter((x) => x.tipo === "intermedio").length * (d.isconFinoATerra ? 1 : 0), unita: "pz" },
    { codice: "", descrizione: "Supporti per isCon lungo il percorso, al massimo ogni 1 m", quantita: Math.ceil(metriIsconPerCalata) * n, unita: "pz" },
    { codice: "5408058", descrizione: "Cartello informativo isCon", quantita: 1, unita: "pz" },
  ];
  const livelliIntermedi = livelli.filter((x) => x.tipo === "intermedio").length;
  return { collegamentiPAE: n, livelliIntermedi, collegamentiTotali: n * (1 + livelliIntermedi), fattibile: true, ki, km, n, kc, versione: v, lMax, zonaX: x, quotaPAE: pae, l, s, passoIntermedi: passo, livelli, materiali, avvisi, lMassimaPossibile, quotaPAEMinima };
}

/** Una riga del confronto: una combinazione di numero di calate e versione isCon. */
export interface CellaConfronto { n: number; versione: VersioneIscon; fattibile: boolean; quotaPAE: number | null; l: number; lMax: number; s: number; metriIscon: number; collegamenti: number; livelliIntermedi: number; correntePerCalata: number }
const CORRENTE: Record<Livello, number> = { I: 200, II: 150, III: 100, IV: 100 };
/** Tutte le combinazioni 1–4 calate × Basic / Pro+ / Premium, per scegliere e vedere cosa cambia. */
export function confrontoCalate(d: DatiCalateAltezza, versioni: VersioneIscon[] = ["basic", "proplus", "premium"]): CellaConfronto[] {
  const out: CellaConfronto[] = [];
  for (const n of [1, 2, 3, 4]) for (const v of versioni) {
    const r = calateIsconAltezza({ ...d, nCalate: n, versione: v });
    const metri = r.materiali.find((m) => m.unita === "m")?.quantita ?? 0;
    out.push({ n, versione: v, fattibile: r.fattibile, quotaPAE: r.quotaPAE, l: r.l, lMax: lunghezzaMassima(v, r.ki, kcDi(n), r.km), s: r.s, metriIscon: metri, collegamenti: r.collegamentiTotali, livelliIntermedi: r.livelliIntermedi, correntePerCalata: CORRENTE[d.lpl] * kcDi(n) });
  }
  return out;
}

/** Cosa migliora passando da n−1 a n calate (stessa versione): l massima, s e corrente per calata; cosa costa in più. */
export function cosaMigliora(n: number, v: VersioneIscon, ki: number, lpl: Livello, km = 1): string {
  const lm = (k: number) => lunghezzaMassima(v, ki, kcDi(k), km);
  const corr = (k: number) => CORRENTE[lpl] * kcDi(k);
  if (n <= 1) return `Una sola calata: soluzione più semplice e meno cavo; l massima ${f(lm(1), 1)} m, tutta la corrente (${f(corr(1), 0)} kA) in un conduttore${lpl === "I" ? " (con LPL I serve Premium)" : ""}.`;
  if (n >= 4) return `4 calate: come 3 per la norma (kc 0,44), quindi l massima uguale (${f(lm(4), 1)} m); in più ripartisce meglio la corrente sul palo e dà ridondanza, ma costa un cavo e un collegamento in più.`;
  const prima = lm(n - 1), dopo = lm(n);
  return `Da ${n - 1} a ${n} calate: kc da ${f(kcDi(n - 1), 2)} a ${f(kcDi(n), 2)}, l massima da ${f(prima, 1)} a ${f(dopo, 1)} m (+${f(((dopo / prima) - 1) * 100, 0)} %), s più bassa a parità di l, corrente per calata da ${f(corr(n - 1), 0)} a ${f(corr(n), 0)} kA; in più un cavo isCon e un collegamento al PAE.`;
}
