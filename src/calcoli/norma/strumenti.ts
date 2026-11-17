/**
 * Strumenti di calcolo e verifiche della serie CEI EN IEC 62305:2024 che non hanno una pagina propria:
 * parametri del fulmine (parte 1), materiali e sezioni minime, schermo dei cavi entranti, tensioni di
 * contatto e di passo, strutture con rischio di esplosione (parte 3), schermatura magnetica, livello di
 * protezione effettivo degli SPD, tensione indotta e impianti fotovoltaici (parte 4).
 * Funzioni pure: valori dalle tabelle della norma, nessun testo copiato.
 */
export type Lpl = "I" | "II" | "III" | "IV";
export const LPL: Lpl[] = ["I", "II", "III", "IV"];

// ---------------------------------------------------------------- parte 1

/** Valori massimi dei parametri del fulmine (62305-1, Tab. 3) e minimi con raggio della sfera (Tab. 4). */
export interface ParametriFulmine {
  /** primo colpo positivo: picco kA, carica C, energia specifica MJ/Ω (10/350 µs) */
  primoPositivo: { I: number; Q: number; WR: number };
  /** primo colpo negativo: picco kA, pendenza media kA/µs (1/200 µs) */
  primoNegativo: { I: number; didt: number };
  /** colpo successivo: picco kA, pendenza media kA/µs (0,25/100 µs) */
  successivo: { I: number; didt: number };
  /** carica del colpo lungo (0,5 s) e del fulmine completo, C */
  QLungo: number; QFulmine: number;
  /** corrente minima di picco kA e raggio della sfera rotolante m */
  Imin: number; r: number;
}
export const PARAMETRI_FULMINE: Record<Lpl, ParametriFulmine> = {
  I: { primoPositivo: { I: 200, Q: 100, WR: 10 }, primoNegativo: { I: 100, didt: 100 }, successivo: { I: 50, didt: 200 }, QLungo: 200, QFulmine: 300, Imin: 3, r: 20 },
  II: { primoPositivo: { I: 150, Q: 75, WR: 5.6 }, primoNegativo: { I: 75, didt: 75 }, successivo: { I: 37.5, didt: 150 }, QLungo: 150, QFulmine: 225, Imin: 5, r: 30 },
  III: { primoPositivo: { I: 100, Q: 50, WR: 2.5 }, primoNegativo: { I: 50, didt: 50 }, successivo: { I: 25, didt: 100 }, QLungo: 100, QFulmine: 150, Imin: 10, r: 45 },
  IV: { primoPositivo: { I: 100, Q: 50, WR: 2.5 }, primoNegativo: { I: 50, didt: 50 }, successivo: { I: 25, didt: 100 }, QLungo: 100, QFulmine: 150, Imin: 16, r: 60 },
};
/** Raggio della sfera rotolante dalla corrente di picco (modello elettrogeometrico, 62305-1 A.4): r = 10 · I^0,65. */
export const raggioSfera = (IkA: number): number => 10 * Math.pow(Math.max(0, IkA), 0.65);

// ---------------------------------------------------------------- parte 3: materiali e sezioni

export type Materiale = "rame" | "alluminio" | "lega-al" | "lega-al-cu" | "acciaio-zincato" | "acciaio-rivestito-cu" | "acciaio-inox" | "acciaio" | "piombo" | "titanio" | "zinco";
export const NOMI_MATERIALI: Record<Materiale, string> = {
  rame: "Rame / rame stagnato", alluminio: "Alluminio", "lega-al": "Lega di alluminio", "lega-al-cu": "Lega di alluminio rivestita in rame",
  "acciaio-zincato": "Acciaio zincato a caldo", "acciaio-rivestito-cu": "Acciaio rivestito in rame", "acciaio-inox": "Acciaio inossidabile", acciaio: "Acciaio (nel calcestruzzo)",
  piombo: "Piombo", titanio: "Titanio", zinco: "Zinco",
};
export type Configurazione = "nastro" | "tondo" | "cordato" | "tondo-asta" | "asta-tubolare" | "piastra";
export const NOMI_CONFIGURAZIONI: Record<Configurazione, string> = {
  nastro: "Nastro massiccio", tondo: "Tondo massiccio", cordato: "Cordato", "tondo-asta": "Tondo massiccio per aste e picchetti", "asta-tubolare": "Asta tubolare", piastra: "Piastra",
};

/** Sezioni minime di captatori, aste e calate in mm² (62305-3, Tab. 7). */
export const SEZIONI_CAPTATORI_CALATE: { materiale: Materiale; configurazione: Configurazione; sezione: number }[] = [
  { materiale: "rame", configurazione: "nastro", sezione: 50 }, { materiale: "rame", configurazione: "tondo", sezione: 50 }, { materiale: "rame", configurazione: "cordato", sezione: 50 }, { materiale: "rame", configurazione: "tondo-asta", sezione: 176 },
  { materiale: "alluminio", configurazione: "nastro", sezione: 70 }, { materiale: "alluminio", configurazione: "tondo", sezione: 50 }, { materiale: "alluminio", configurazione: "cordato", sezione: 50 },
  { materiale: "lega-al", configurazione: "nastro", sezione: 50 }, { materiale: "lega-al", configurazione: "tondo", sezione: 50 }, { materiale: "lega-al", configurazione: "cordato", sezione: 50 }, { materiale: "lega-al", configurazione: "tondo-asta", sezione: 176 },
  { materiale: "lega-al-cu", configurazione: "tondo", sezione: 50 },
  { materiale: "acciaio-zincato", configurazione: "nastro", sezione: 50 }, { materiale: "acciaio-zincato", configurazione: "tondo", sezione: 50 }, { materiale: "acciaio-zincato", configurazione: "cordato", sezione: 50 }, { materiale: "acciaio-zincato", configurazione: "tondo-asta", sezione: 176 },
  { materiale: "acciaio-rivestito-cu", configurazione: "tondo", sezione: 50 }, { materiale: "acciaio-rivestito-cu", configurazione: "nastro", sezione: 50 }, { materiale: "acciaio-rivestito-cu", configurazione: "tondo-asta", sezione: 176 },
  { materiale: "acciaio-inox", configurazione: "nastro", sezione: 50 }, { materiale: "acciaio-inox", configurazione: "tondo", sezione: 50 }, { materiale: "acciaio-inox", configurazione: "cordato", sezione: 70 }, { materiale: "acciaio-inox", configurazione: "tondo-asta", sezione: 176 },
];

/** Dimensioni minime del dispersore (62305-3, Tab. 8): diametro dell'asta mm, sezione del conduttore mm², piastra mm. */
export const DIMENSIONI_DISPERSORI: { materiale: Materiale; configurazione: Configurazione; diametro?: number; sezione?: number; piastra?: string }[] = [
  { materiale: "rame", configurazione: "cordato", sezione: 50 }, { materiale: "rame", configurazione: "tondo", diametro: 15, sezione: 50 }, { materiale: "rame", configurazione: "nastro", sezione: 50 },
  { materiale: "rame", configurazione: "asta-tubolare", diametro: 20 }, { materiale: "rame", configurazione: "piastra", piastra: "500 × 500 (reticolare 600 × 600)" },
  { materiale: "acciaio-zincato", configurazione: "tondo", diametro: 14, sezione: 78 }, { materiale: "acciaio-zincato", configurazione: "asta-tubolare", diametro: 25 }, { materiale: "acciaio-zincato", configurazione: "nastro", sezione: 90 },
  { materiale: "acciaio-zincato", configurazione: "piastra", piastra: "500 × 500 (reticolare 600 × 600)" },
  { materiale: "acciaio", configurazione: "cordato", sezione: 70 }, { materiale: "acciaio", configurazione: "tondo", sezione: 78 }, { materiale: "acciaio", configurazione: "nastro", sezione: 75 },
  { materiale: "acciaio-rivestito-cu", configurazione: "tondo", diametro: 14, sezione: 50 }, { materiale: "acciaio-rivestito-cu", configurazione: "nastro", sezione: 90 },
  { materiale: "acciaio-inox", configurazione: "tondo", diametro: 15, sezione: 78 }, { materiale: "acciaio-inox", configurazione: "nastro", sezione: 100 },
];

/** Spessore minimo delle lastre e tubazioni usate come captatori naturali in mm (62305-3, Tab. 3): t contro la perforazione, t' altrimenti. */
export const SPESSORI_LASTRE: { materiale: Materiale; t: number | null; t1: number }[] = [
  { materiale: "piombo", t: null, t1: 2 }, { materiale: "acciaio-zincato", t: 4, t1: 0.5 }, { materiale: "acciaio-inox", t: 4, t1: 0.5 }, { materiale: "titanio", t: 4, t1: 0.5 },
  { materiale: "rame", t: 5, t1: 0.5 }, { materiale: "alluminio", t: 7, t1: 0.65 }, { materiale: "zinco", t: null, t1: 0.7 },
];

/** Sezioni minime dei conduttori equipotenziali in mm²: tra le barre o verso i dispersori (Tab. 9) e verso i corpi metallici interni (Tab. 10). */
export const SEZIONI_EQUIPOTENZIALI: Record<"rame" | "alluminio" | "acciaio", { traBarre: number; corpiInterni: number }> = {
  rame: { traBarre: 16, corpiInterni: 6 }, alluminio: { traBarre: 25, corpiInterni: 10 }, acciaio: { traBarre: 50, corpiInterni: 16 },
};

export type UsoConduttore = "captatore-calata" | "dispersore" | "equipotenziale-barre" | "equipotenziale-interno";
/** Sezione minima richiesta per un conduttore (null se la combinazione non è prevista dalla norma). */
export function sezioneMinima(uso: UsoConduttore, materiale: Materiale, configurazione: Configurazione): number | null {
  if (uso === "captatore-calata") return SEZIONI_CAPTATORI_CALATE.find((x) => x.materiale === materiale && x.configurazione === configurazione)?.sezione ?? null;
  if (uso === "dispersore") return DIMENSIONI_DISPERSORI.find((x) => x.materiale === materiale && x.configurazione === configurazione)?.sezione ?? null;
  const m = materiale === "rame" ? "rame" : materiale === "alluminio" || materiale === "lega-al" ? "alluminio" : materiale.startsWith("acciaio") ? "acciaio" : null;
  if (!m) return null;
  return uso === "equipotenziale-barre" ? SEZIONI_EQUIPOTENZIALI[m].traBarre : SEZIONI_EQUIPOTENZIALI[m].corpiInterni;
}
/** Sezione di un tondo dal diametro (mm → mm²). */
export const sezioneTondo = (dmm: number): number => (Math.PI * dmm * dmm) / 4;

/** Uso dei materiali (Tab. 6, in sintesi): dove si possono posare e con cosa fanno coppia galvanica. */
export const USO_MATERIALI: { materiale: Materiale; aperto: string; suolo: string; calcestruzzo: string; galvanica: string }[] = [
  { materiale: "rame", aperto: "sì", suolo: "sì", calcestruzzo: "sì", galvanica: "—" },
  { materiale: "acciaio-zincato", aperto: "sì", suolo: "sì (non cordato)", calcestruzzo: "sì", galvanica: "rame" },
  { materiale: "acciaio-rivestito-cu", aperto: "sì", suolo: "sì", calcestruzzo: "sì", galvanica: "—" },
  { materiale: "acciaio-inox", aperto: "sì", suolo: "sì", calcestruzzo: "sì", galvanica: "—" },
  { materiale: "alluminio", aperto: "sì", suolo: "no", calcestruzzo: "no", galvanica: "rame" },
  { materiale: "piombo", aperto: "sì", suolo: "sì (spesso vietato)", calcestruzzo: "no", galvanica: "rame, acciaio inox" },
];

// ---------------------------------------------------------------- parte 3: schermo dei cavi entranti (Allegato A)

/**
 * Sezione minima dello schermo di un cavo entrante per evitare scariche pericolose (62305-3, A.1):
 * SCmin = IF · ρC · LC · 10⁶ / Uw  [mm²], con IF in kA, ρC in Ω·m, LC in m, Uw in kV.
 */
export function sezioneMinimaSchermo(IFkA: number, rhoC: number, LC: number, UwkV: number): number {
  if (!(UwkV > 0)) return Infinity;
  return (IFkA * rhoC * LC * 1e6) / UwkV;
}
/** Lunghezza da considerare (Tab. A.1): nel suolo LC ≤ 8·√ρ; in aria è la distanza dal punto di dispersione più vicino. */
export const lunghezzaCavoSuolo = (rhoSuolo: number): number => 8 * Math.sqrt(Math.max(0, rhoSuolo));
/** Corrente massima sullo schermo in rame per non surriscaldare l'isolamento: IF = 8 · SC (kA, mm²). */
export const correnteMaxSchermoRame = (SCmm2: number): number => 8 * SCmm2;
/** Resistività tipiche degli schermi (Ω·m). */
export const RESISTIVITA_SCHERMI: { id: string; nome: string; rho: number }[] = [
  { id: "rame", nome: "Rame", rho: 17.24e-9 }, { id: "alluminio", nome: "Alluminio", rho: 28.264e-9 }, { id: "piombo", nome: "Piombo", rho: 214e-9 }, { id: "acciaio", nome: "Acciaio", rho: 138e-9 },
];

// ---------------------------------------------------------------- parte 3: tensioni di contatto e di passo (8.1, 8.2)

export interface CondizioniContatto {
  /** nessuna persona entro 3 m dalle calate in condizioni normali */
  nessunoEntro3m: boolean;
  /** calate naturali: almeno 10 colonne o pilastri metallici interconnessi */
  calateNaturali10: boolean;
  /** resistenza di contatto del suolo entro 3 m ≥ 100 kΩ (es. 5 cm di asfalto) */
  suoloIsolante: boolean;
}
export function verificaContattoPasso(c: CondizioniContatto): { tollerabile: boolean; motivo: string; misureContatto: string[]; misurePasso: string[] } {
  const motivo = c.nessunoEntro3m ? "nessuna persona entro 3 m dalle calate" : c.calateNaturali10 ? "almeno 10 calate naturali interconnesse" : c.suoloIsolante ? "suolo con resistenza di contatto ≥ 100 kΩ entro 3 m" : "";
  return {
    tollerabile: motivo !== "", motivo,
    misureContatto: ["Isolare le calate esposte con tenuta all'impulso 100 kV (1,2/50 µs), es. polietilene reticolato ≥ 3 mm, in condizioni di umidità", "Barriere o cartelli (ISO 3864-1) per ridurre la probabilità di toccare la calata"],
    misurePasso: ["Equipotenzializzare il suolo con un dispersore a maglia", "Barriere o cartelli (ISO 3864-1) che impediscano l'accesso entro 3 m dalla calata"],
  };
}

// ---------------------------------------------------------------- parte 3: strutture con rischio di esplosione (Allegato C)

export type ZonaAtex = "0-20" | "1-21" | "2-22" | "esplosivi-solidi";
/** Requisiti aggiuntivi in sintesi (62305-3, Allegato C) per il tipo di area pericolosa. */
export function requisitiEsplosione(z: ZonaAtex): string[] {
  const comuni = [
    "Disegni con aree pericolose classificate (IEC 60079-10-1 e 10-2) e locali con esplosivi forniti a progettista e installatore",
    "Dispersore di tipo B preferibile; resistenza di terra la più bassa possibile e comunque ≤ 10 Ω",
    "Nessuna fusione o scintilla tranne nel punto d'impatto; temperatura delle calate nelle aree pericolose sotto quella di accensione",
    "SPD fuori dalla zona pericolosa quando possibile, altrimenti adatti alla zona (IEC 60079-14)",
    "Collegamenti equipotenziali con materiali e sezioni delle Tab. 8 e 9; tubazioni fuori terra a terra almeno ogni 30 m, connessioni senza scintille (saldature, flange imbullonate)",
    "Spinterometri di collegamento provati secondo IEC 62561-3; collegamenti con altri impianti concordati con il gestore",
  ];
  if (z === "esplosivi-solidi") return [...comuni, "LPS esterno isolato raccomandato", "Involucro metallico continuo ≥ 4 mm acciaio (7 mm alluminio) vale come captatore naturale", "Verificare la sovratemperatura sulla superficie interna nel punto d'impatto (Tab. 4)", "Per materiali sensibili ai campi impulsivi: collegamenti equipotenziali o schermature aggiuntive"];
  const z2 = ["Elementi metallici che sono componenti naturali (5.2.5, 5.3.5): non servono captatori né calate, ma vanno messi a terra", "La necessità di proteggere le zone 2 e 22 dipende dalla valutazione del rischio"];
  const z1 = ["Punti di captazione ad almeno 1 m dalle zone 1 e 21; resto dell'LPS esterno possibilmente ad almeno 1 m", "Conduttori nelle zone pericolose senza giunzioni o con connessioni secondo 5.5.3; fissaggi non metallici; allentamenti impediti", "Giunti isolanti nelle tubazioni: valutare spinterometri di separazione adatti alla zona"];
  const z0 = ["Contenitori metallici chiusi con zone interne 0/20: pareti di spessore secondo la Tab. 3 nei punti d'impatto e sovratemperatura interna non pericolosa (Tab. 4), altrimenti captatori", "Serbatoi con pareti continue ≥ 5 mm acciaio o 7 mm alluminio e senza spinterometri sono autoprotetti"];
  return z === "2-22" ? [...comuni, ...z2] : z === "1-21" ? [...comuni, ...z2, ...z1] : [...comuni, ...z2, ...z1, ...z0];
}

// ---------------------------------------------------------------- parte 4: schermatura magnetica (Allegato A)

/** Campo nella LPZ 1 per fulmine diretto sullo schermo a maglia (A.1): H1 = kh · I0 · wm / (dw · √dr); dimezzato con rete equipotenziale magliata. */
export function campoFulmineDiretto(I0A: number, wm: number, dw: number, dr: number, reteMagliata = false, kh = 0.01): { H1: number; dDF: number } {
  const H1 = dw > 0 && dr > 0 ? (kh * I0A * wm) / (dw * Math.sqrt(dr)) : Infinity;
  return { H1: reteMagliata ? H1 / 2 : H1, dDF: wm };
}
/** Fattore di schermatura SF in dB di uno schermo a maglia (Tab. A.4): 25 kHz primo colpo positivo, 1 MHz/250 kHz colpi successivi e primo negativo. */
export function fattoreSchermatura(materiale: "rame-alluminio" | "acciaio", wm: number, raggioAsta: number, frequenza: "25kHz" | "1MHz", reteMagliata = false): number {
  if (!(wm > 0)) return 0;
  let sf = 20 * Math.log10(8.5 / wm);
  if (materiale === "acciaio" && frequenza === "25kHz") sf = 20 * Math.log10((8.5 / wm) / Math.sqrt(1 + 18e-6 / (raggioAsta * raggioAsta)));
  sf = Math.max(0, sf);
  return reteMagliata ? sf + 6 : sf;
}
/** Distanza tra il punto d'impatto e il centro del volume schermato (A.16, A.17). */
export function distanzaImpatto(r: number, h: number, l: number): number {
  return h < r ? Math.sqrt(2 * r * h - h * h) + l / 2 : r + l / 2;
}
/** Fulmine nelle vicinanze: H0 = I0/(2π·sa), H1 = H0/10^(SF/20), distanza di sicurezza dSF (A.6–A.15). */
export function campoFulmineVicino(I0A: number, sa: number, SF: number, wm: number): { H0: number; H1: number; dSF: number } {
  const H0 = sa > 0 ? I0A / (2 * Math.PI * sa) : Infinity;
  return { H0, H1: H0 / Math.pow(10, SF / 20), dSF: SF >= 10 ? (wm * SF) / 10 : wm };
}

// ---------------------------------------------------------------- parte 4: SPD, livello di protezione effettivo (Allegato C)

/** Caduta di tensione nei collegamenti dell'SPD: ΔU ≈ 0,1 kV/m per kA · lunghezza (C.4). */
export const cadutaCollegamenti = (IspdkA: number, lunghezzaM: number): number => 0.1 * IspdkA * lunghezzaM;
/** Up/f: SPD limitatore Up + ΔU (C.2), a commutazione max(Up, ΔU) (C.3). */
export function livelloEffettivo(UpkV: number, DUkV: number, tipo: "limitatore" | "commutazione"): number {
  return tipo === "limitatore" ? UpkV + DUkV : Math.max(UpkV, DUkV);
}
/** Regola n. 2 (C.1): Up/f ammesso = (Uw − Ui)/kr, kr da 1 a 2 (2 se non noto, con circuiti lunghi o aperti). */
export function verificaSpdDettagliata(UpfkV: number, UwkV: number, UikV: number, kr = 2): { ammesso: number; ok: boolean } {
  const ammesso = (UwkV - UikV) / kr;
  return { ammesso, ok: UpfkV <= ammesso };
}

// ---------------------------------------------------------------- parte 4: tensione indotta nel circuito protetto (Allegato H)

/** Tensione per metro parallela alla calata: h = 0,8 · ln((d + w)/d) · I  [kV/m], I in kA. */
export const tensionePerMetro = (d: number, w: number, IkA: number): number => (d > 0 ? 0.8 * Math.log((d + w) / d) * IkA : Infinity);
/** Lunghezza verticale equivalente del tratto orizzontale l'o (H.2). */
export function lunghezzaEquivalente(lo: number, w: number, d: number): number {
  if (!(lo > 0) || !(d > 0) || !(w > 0)) return 0;
  return (lo * w * Math.log((d + lo) / d)) / (lo * Math.log((d + w) / d));
}
/** ks = 1 senza schermo, 0,12·w per schermo a maglia, 10⁻⁴ pieno ≥ 1 mm (Tab. H.3). */
export const ksSchermo = (tipo: "nessuno" | "maglia" | "pieno", w = 0): number => (tipo === "nessuno" ? 1 : tipo === "pieno" ? 1e-4 : Math.min(1, 0.12 * w));
/** q in V/m² per fulmini vicini (Tab. H.1). */
export const Q_INDOTTA: Record<Lpl, number> = { I: 10, II: 7.5, III: 5, IV: 5 };
export interface DatiIndotta { lpl: Lpl; d: number; w: number; lp: number; lo: number; kc: number; ks1: number; ks2: number; Ce?: number }
/** Ui1 fulmine sulla struttura (H.1), Ui2 fulmine vicino (H.2), Ui3 fulmine sul servizio (H.3), in kV (Ui2 in V convertito). */
export function tensioneIndotta(x: DatiIndotta): { h: number; leq: number; Ui1: number; Ui2: number; Ui3: number } {
  const I = PARAMETRI_FULMINE[x.lpl].successivo.I;
  const h = tensionePerMetro(x.d, x.w, I);
  const leq = x.lp + lunghezzaEquivalente(x.lo, x.w, x.d);
  const S = (x.lp + x.lo) * x.w;
  return {
    h, leq,
    Ui1: 0.7 * h * x.kc * x.ks2 * leq,
    Ui2: (x.ks1 * x.ks2 * S * Q_INDOTTA[x.lpl] * (x.Ce ?? 1)) / 1000,
    Ui3: 0.7 * x.ks1 * x.ks2 * h * leq,
  };
}

// ---------------------------------------------------------------- parte 4: impianti fotovoltaici sul tetto (Allegato F)

/** Corrente di fulmine in ciascun conduttore CC senza distanza di separazione: Idc = ILPL · kc / (2 · n') (F.1), kA. */
export function correnteConduttoriCC(lpl: Lpl, kc: number, nConduttori: number): number {
  const ILPL = PARAMETRI_FULMINE[lpl].primoPositivo.I;
  return nConduttori > 0 ? (ILPL * kc) / (2 * nConduttori) : Infinity;
}
/** Valori semplificati per SPD limitatori sul lato CC (Tab. F.1): Iimp 10/350 / In 8/20 in kA per I1 = I2 e per I1 + I2 = Itot. */
export function spdFotovoltaico(lpl: Lpl, calate: number): { singolo: { Iimp: number; In: number }; totale: { Iimp: number; In: number } } {
  const t: Record<"I" | "II" | "III", [number, number, number, number][]> = {
    // [In singolo, Iimp singolo, In totale, Iimp totale] per < 4 calate e ≥ 4 calate
    I: [[17, 10, 34, 20], [10, 5, 20, 10]],
    II: [[12.5, 7.5, 25, 15], [7.5, 3.75, 15, 7.5]],
    III: [[8.5, 5, 17, 10], [5, 2.5, 10, 5]],
  };
  const r = t[lpl === "IV" ? "III" : lpl][calate >= 4 ? 1 : 0]!;
  return { singolo: { In: r[0], Iimp: r[1] }, totale: { In: r[2], Iimp: r[3] } };
}
/** Valori semplificati per SPD a commutazione sul lato CC (Tab. F.2): Iimp 10/350 in kA per I1 = I2 e per I1 + I2 = Itot. */
export function spdFotovoltaicoCommutazione(lpl: Lpl, calate: number): { singolo: number; totale: number } {
  const t: Record<"I" | "II" | "III", [number, number, number, number]> = { I: [25, 50, 12.5, 25], II: [18.5, 37.5, 9, 18], III: [12.5, 25, 6.25, 12.5] };
  const r = t[lpl === "IV" ? "III" : lpl];
  return calate >= 4 ? { singolo: r[2], totale: r[3] } : { singolo: r[0], totale: r[1] };
}
