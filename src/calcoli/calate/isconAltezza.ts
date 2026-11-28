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
import { COMPONENTI_ISCON, ISCON, codiceIscon, ammessaPerCorrente, lunghezzaMassima, verificaIscon, type VersioneIscon } from "./iscon";

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
  /** non più usato: le istruzioni OBO non permettono di prolungare il conduttore isCon (resta per i progetti salvati) */
  isconFinoATerra: boolean;
  /** calate distanziate almeno 20 cm e su lati opposti (kc ridotto); false = affiancate (kc 1 per la distanza) */
  calateDistanziate?: boolean | undefined;
  /** "basso" (o assente, dal 28/11/2026) = cavo lungo quanto ammesso dalla soluzione scelta (fine il più in basso possibile);
   *  "antenne" = cavo corto, fine subito sotto l'antenna più bassa */
  obiettivo?: "antenne" | "basso" | undefined;
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

/** lunghezza in più del cavo per i collegamenti alle due estremità (m), compresa nella verifica della lunghezza ammessa */
const MARGINE = 0.5;
const kcDi = (n: number) => (n <= 1 ? 1 : n === 2 ? 0.66 : 0.44);
const f = (v: number, c = 2) => (Number.isFinite(v) ? v.toLocaleString("it-IT", { maximumFractionDigits: c }) : "—");

export function calateIsconAltezza(d: DatiCalateAltezza): RisultatoCalateAltezza {
  const ki = d.ki ?? KI[d.lpl], km = d.materiale === "solido" ? 0.5 : 1;
  const top = d.quotaPunta, base = Math.min(d.quotaBase, top);
  // calate affiancate: la corrente si divide ma il kc della distanza non si riduce (istruzioni OBO isCon)
  const kcS = (n: number) => (d.calateDistanziate === false ? 1 : kcDi(n));
  const ordine: VersioneIscon[] = d.versione ? [d.versione] : ["basic", "proplus", "premium"];
  const numeri = d.nCalate ? [Math.min(4, Math.max(1, d.nCalate))] : [1, 2, 3, 4];
  type Cand = { n: number; v: VersioneIscon; lMax: number; x: number; pae: number };
  // quota della fine del cavo: subito sotto l'antenna più bassa lasciando il tratto x = 2·s (terminale PAE della guaina);
  // x dipende da s, che dipende dalla lunghezza: pae = A − 2·s(pae) → pae = (A − c·top) / (1 − c) con c = 2·ki·kc/km
  const basso = d.obiettivo !== "antenne";
  const posizione = (n: number, lMax: number): { pae: number; x: number } => {
    const minimo = Math.max(base, top - (lMax - MARGINE));
    if (d.quotaApparatoBasso == null || basso) { const sx = (ki * kcS(n) * (top - minimo)) / km; return { pae: minimo, x: sx < 0.2 ? 0 : 2 * sx }; }
    const c = (2 * ki * kcS(n)) / km, A = d.quotaApparatoBasso;
    let pae = (A - c * top) / (1 - c);
    let sx = (ki * kcS(n) * (top - pae)) / km;
    if (sx < 0.2) { pae = A - 0.3; sx = (ki * kcS(n) * (top - pae)) / km; }
    return { pae, x: sx < 0.2 ? 0 : 2 * sx };
  };
  let scelta: Cand | null = null;
  // 1) soluzione: il minimo numero di calate e la versione più semplice che isolano l'antenna più bassa (cavo corto sotto l'antenna)
  const posAntenne = (n: number, lMax: number) => {
    const minimo = Math.max(base, top - (lMax - MARGINE));
    if (d.quotaApparatoBasso == null) { const sx = (ki * kcS(n) * (top - minimo)) / km; return { pae: minimo, x: sx < 0.2 ? 0 : 2 * sx }; }
    const c = (2 * ki * kcS(n)) / km, A = d.quotaApparatoBasso;
    let pae = (A - c * top) / (1 - c), sx = (ki * kcS(n) * (top - pae)) / km;
    if (sx < 0.2) { pae = A - 0.3; sx = (ki * kcS(n) * (top - pae)) / km; }
    return { pae, x: sx < 0.2 ? 0 : 2 * sx };
  };
  const validaA = (pae: number, lMax: number) => pae >= Math.max(base, top - (lMax - MARGINE)) - 1e-9 && pae < top;
  for (const n of numeri) {
    for (const v of ordine) {
      if (!ammessaPerCorrente(v, d.lpl, n)) continue;
      const lMax = lunghezzaMassima(v, ki, kcS(n), km), { pae, x } = posAntenne(n, lMax);
      if (validaA(pae, lMax)) { scelta = { n, v, lMax, x, pae }; break; }
    }
    if (scelta) break;
  }
  // 2) con la soluzione scelta il cavo si usa per tutta la lunghezza ammessa: la fine scende il più possibile
  //    (le antenne restano sopra il tratto x della fine del cavo); se non si può, resta la posizione sotto l'antenna
  if (scelta && basso) {
    const p = posizione(scelta.n, scelta.lMax);
    if (d.quotaApparatoBasso == null || p.pae + p.x <= d.quotaApparatoBasso + 1e-9) scelta = { ...scelta, pae: p.pae, x: p.x };
  }
  const vMax: VersioneIscon = d.versione ?? "premium", nMax = d.nCalate ? Math.min(4, d.nCalate) : 4;
  const lMassimaPossibile = lunghezzaMassima(vMax, ki, kcS(nMax), km);
  const quotaPAEMinima = top - lMassimaPossibile;
  const avvisi: string[] = [];
  if (!scelta) {
    const n = nMax, kc = kcS(n), x = 2 * ISCON[vMax].sAria;
    const serve = d.quotaApparatoBasso != null ? top - (d.quotaApparatoBasso - x) : top - base;
    avvisi.push(`Nessuna combinazione basta: con ${n} ${n === 1 ? "calata" : "calate"} ${ISCON[vMax].nome} il cavo può essere lungo al massimo ${f(lMassimaPossibile, 1)} m, ma ${d.quotaApparatoBasso != null ? "per isolare l'antenna più bassa" : "fino al piano di riferimento"} servono ${f(serve, 1)} m.`);
    if (d.quotaApparatoBasso != null) avvisi.push(`Soluzioni: isolare solo le antenne sopra ${f(quotaPAEMinima + x, 1)} m (fine del cavo e collegamento al palo ad almeno ${f(quotaPAEMinima, 1)} m, antenne più basse collegate al palo, con schermi dei cavi collegati e SPD di tipo 1 dove i cavi entrano), avvicinare la punta alle antenne, oppure un palo di captazione separato.`);
    if (d.calateDistanziate === false) avvisi.push("Con le calate distanziate (almeno 20 cm, su lati opposti del palo) il kc si riduce e la lunghezza ammessa aumenta.");
    return { collegamentiPAE: 0, livelliIntermedi: 0, collegamentiTotali: 0, fattibile: false, ki, km, n, kc, versione: null, lMax: lMassimaPossibile, zonaX: x, quotaPAE: null, l: serve, s: (ki * kc * serve) / km, passoIntermedi: null, livelli: [], materiali: [], avvisi, lMassimaPossibile, quotaPAEMinima };
  }
  const { n, v, lMax, x } = scelta;
  const kc = kcS(n), pae = scelta.pae, l = top - pae, s = (ki * kc * l) / km;
  const D = ISCON[v], C = COMPONENTI_ISCON[v], metallica = d.struttura !== "isolante";
  const conPAE = s >= 0.2;
  const livelli: LivelloEquipotenziale[] = [];
  livelli.push({ quota: top, tipo: "principale", titolo: "Collegamento superiore all'asta", cosa: [
    `Elemento di collegamento isCon sull'asta: ${C.collegamento} (${C.collegamentoNota})${v === "proplus" || v === "premium" ? "; in alternativa il set ASE 5408080 se si vuole la prova di isolamento" : ""}; sull'asta la piastra AP1-16 VA o AP2-16 VA, oppure la piastra di contatto del set isCon HM (5408090) sull'asta di captazione.`,
    `Tratto di 1,5 m sotto il collegamento (asta centrale in vetroresina isFang) senza parti conduttrici entro s = ${f(s, 3)} m; poi il potenziale della guaina si collega con l'elemento interno dell'asta o con la molletta 927 2 6-K.`,
    `Antenne e parti metalliche ad almeno s = ${f(s, 3)} m dalle parti nude (punta, asta, collegamento superiore).`,
  ] });
  livelli.push({ quota: pae, tipo: "principale", titolo: "Fine del cavo isCon e collegamento al palo", cosa: [
    `Conduttore interno collegato ${metallica ? "al palo" : "all'anello o alla barra equipotenziale"} con l'elemento di collegamento isCon inferiore (stessa famiglia del superiore): qui il cavo finisce, non si prolunga.`,
    conPAE ? `Terminale isCon PAE 5408036 sulla guaina a x = 2 · s = ${f(x, 2)} m sopra la fine del cavo, collegato all'equipotenziale con un conduttore in rame di almeno 6 mm².` : `s = ${f(s, 3)} m < 0,20 m: non serve il terminale PAE prima della fine del cavo.`,
    conPAE ? `Tra il terminale PAE e la fine del cavo nessuna parte conduttrice entro s = ${f(s, 3)} m: in quel tratto il cavo resta staccato dal palo (distanziatore isCon DH 5408043).` : "Fissaggio fino al collegamento con i supporti isCon.",
    "Alla stessa quota: supporti metallici delle antenne, schermi dei cavi coassiali e altre parti metalliche collegati al palo.",
  ] });
  let passo: number | null = null;
  const sotto = pae - base;
  if (sotto > 0.1) {
    if (!metallica) {
      passo = (Math.max(0.01, d.distanzaImpianti) * km) / (ki * kc);
      const nLiv = Math.max(0, Math.ceil(sotto / passo - 1e-9) - 1), h = sotto / (nLiv + 1);
      for (let i = 1; i <= nLiv; i++) livelli.push({ quota: pae - i * h, tipo: "intermedio", titolo: `Livello equipotenziale intermedio ${i}`, cosa: [
        "Calate (conduttori nudi sotto la fine dell'isCon) collegate all'anello o alla barra equipotenziale di questa quota.",
        "Schermi dei cavi e parti metalliche della stessa quota collegati allo stesso anello.",
        `Tra due livelli al massimo ${f(passo, 1)} m (s = ${f((ki * kc * h) / km, 3)} m ≤ ${f(d.distanzaImpianti)} m disponibili).`,
      ] });
    } else {
      avvisi.push(`Il conduttore isCon non si può prolungare (istruzioni OBO): ogni calata è un pezzo unico dalla punta alla fine del cavo, lungo al massimo ${f(lMax, 1)} m. Sotto la fine del cavo la corrente scende nel ${d.struttura === "metallica" ? "palo o traliccio" : "calcestruzzo armato (ferri)"} fino a terra.`);
      avvisi.push(`Perché basta un solo collegamento al palo (${n} ${n === 1 ? "collegamento" : "collegamenti"}, uno per calata): la distanza di separazione si calcola fino al collegamento equipotenziale più vicino. Vale solo se ${d.struttura === "metallica" ? "il palo è metallico, con giunti elettricamente continui per tutta l'altezza" : "i ferri sono continui per tutta l'altezza (verificato con misura)"} e collegato a terra alla base; se non è così scegli «Struttura non conduttiva».`);
      avvisi.push("Il palo sotto la fine del cavo porta la corrente di fulmine: schermi dei cavi d'antenna collegati al palo in alto e alla base, SPD di tipo 1 all'ingresso del locale apparati; per discese lunghe è buona pratica collegare gli schermi al palo anche a quote intermedie.");
    }
  }
  if (basso) avvisi.push(`Cavo usato per tutta la lunghezza ammessa (${f(lMax, 1)} m con ${n} ${n === 1 ? "calata" : "calate in parallelo"} ${D.nome}): fine del cavo il più in basso possibile: tutto quello che sta sul palo sopra ${f(pae + x, 1)} m (antenne e apparecchi a bordo) resta su un tratto che non porta corrente di fulmine; tra ${f(pae, 1)} e ${f(pae + x, 1)} m (tratto x) nessun apparecchio entro s = ${f(s, 3)} m dal cavo. Sotto ${f(pae, 1)} m il palo porta la corrente.`);
  avvisi.push(`Lungo il ${metallica ? "palo metallico" : "percorso"}: supporti al massimo ogni 1 m${metallica && C.supportoMetallico ? "; i supporti metallici isCon H VA 5408056 avvitati al palo collegano anche la guaina alle parti a terra, come chiedono le istruzioni OBO" : `; supporto ${C.supporto} (${C.supportoNota})`}. Raggio minimo di curvatura ${D.raggioCurvatura.nero} mm.`);
  if (n > 1) avvisi.push(d.calateDistanziate === false
    ? `Calate affiancate: la corrente si divide (${n} cavi) ma il kc della distanza resta 1 (istruzioni OBO).`
    : "Calate in parallelo: almeno 20 cm tra loro e il più possibile distanti (lati opposti del palo); se corrono affiancate il kc non si riduce. I valori di kc valgono con dispersore di tipo B, o di tipo A con resistenze di terra simili (entro un fattore 2).");
  livelli.push({ quota: base, tipo: "base", titolo: base > 0.05 ? "Piano di riferimento (copertura con LPS)" : "Base: collegamento a terra", cosa: [
    !metallica ? `Calate (${n}) collegate all'impianto di terra con punto di sezionamento per le misure.` : `Struttura collegata all'impianto di terra in almeno ${Math.max(2, n)} punti.`,
    "Barra equipotenziale principale: schermi dei cavi collegati all'ingresso del locale apparati, SPD di tipo 1 sulle linee che entrano.",
  ] });
  if (v === "proplus") avvisi.push("Con Pro+ 75 GR (grigio) la protezione dalle tensioni di contatto vale al massimo per 5 m, con il primo supporto 0,5 m sotto il collegamento.");
  if (d.lpl === "I" && n === 1) avvisi.push("LPL I con una sola calata isolata: serve la classe H2 (200 kA), cioè Premium 90.");
  if (!verificaIscon(v, s, d.materiale).conforme) avvisi.push("Controllo: s supera la distanza equivalente dell'isCon.");
  const cavo = Math.ceil(l + MARGINE);
  avvisi.push(`Cavo a misura: ${f(l + MARGINE, 2)} m per calata (l più ${f(MARGINE, 1)} m per i collegamenti) ≤ ${f(lMax, 2)} m ammessi; non si giunta.`);
  const ordineCavo = codiceIscon(v, cavo * n);
  const materiali: RisultatoCalateAltezza["materiali"] = [
    { codice: ordineCavo.codice, descrizione: `${D.nome} – ${n} ${n === 1 ? "calata" : "calate"}: un pezzo unico per calata tagliato a ${f(l + MARGINE, 2)} m (massimo ${f(lMax, 2)} m)${ordineCavo.nota ? `; ${ordineCavo.nota}` : ""}`, quantita: ordineCavo.quantita, unita: "m" },
    { codice: C.collegamento, descrizione: `Elemento di collegamento isCon (${C.collegamentoNota}): uno in alto all'asta e uno alla fine del cavo ${metallica ? "sul palo" : "sull'anello"}, per ogni calata`, quantita: 2 * n, unita: "pz" },
    n >= 2 ? { codice: "5408028", descrizione: "Piastra di collegamento AP2-16 VA per due conduttori, all'asta (per quattro due piastre)", quantita: Math.ceil(n / 2), unita: "pz" }
      : { codice: "5408026", descrizione: "Piastra di collegamento AP1-16 VA per un conduttore, all'asta", quantita: 1, unita: "pz" },
    ...(conPAE ? [{ codice: "5408036", descrizione: `Terminale isCon PAE sulla guaina, a ${f(x, 2)} m dalla fine del cavo`, quantita: n, unita: "pz" },
      { codice: "5408043", descrizione: "Distanziatore isCon DH per il tratto tra terminale PAE e fine del cavo", quantita: n * Math.max(1, Math.ceil(x)), unita: "pz" },
      { codice: "", descrizione: "Conduttore di collegamento in rame ≥ 6 mm² per i terminali PAE", quantita: n, unita: "m" }] : []),
    { codice: C.supporto, descrizione: C.supportoMetallico ? `Supporto in acciaio inox isCon H VA per Pro+ e Premium${metallica ? " (sul palo, collega anche la guaina)" : ""}, al massimo ogni 1 m` : "Supporto in poliammide con fascetta per cavo isCon (montaggio su tubo), al massimo ogni 1 m", quantita: Math.ceil(l) * n, unita: "pz" },
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
    out.push({ n, versione: v, fattibile: r.fattibile, quotaPAE: r.quotaPAE, l: r.l, lMax: lunghezzaMassima(v, r.ki, d.calateDistanziate === false ? 1 : kcDi(n), r.km), s: r.s, metriIscon: metri, collegamenti: r.collegamentiTotali, livelliIntermedi: r.livelliIntermedi, correntePerCalata: CORRENTE[d.lpl] * kcDi(n) });
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

export interface RigaPiuCavi { n: number; kc: number; lMax: number; quotaFine: number | null; s: number; corrente: number; metri: number; fattibile: boolean }
/** Quanto si scende con 1, 2, 3, 4 cavi della stessa versione (fine del cavo il più in basso possibile). */
export function scendiConPiuCavi(d: DatiCalateAltezza, v: VersioneIscon): RigaPiuCavi[] {
  return [1, 2, 3, 4].map((n) => {
    const r = calateIsconAltezza({ ...d, obiettivo: "basso", nCalate: n, versione: v });
    const kc = d.calateDistanziate === false ? 1 : kcDi(n);
    return { n, kc, lMax: lunghezzaMassima(v, r.ki, kc, r.km), quotaFine: r.quotaPAE, s: r.s, corrente: CORRENTE[d.lpl] * kcDi(n), metri: r.materiali.find((m) => m.unita === "m")?.quantita ?? 0, fattibile: r.fattibile };
  });
}
