/**
 * Lettore dei documenti del progetto: dal testo di relazioni, capitolati, verbali, tavole (PDF, Word)
 * ricava i dati utili all'LPS, con la frase da cui vengono, da approvare uno per uno. Logica pura.
 */
export type CampoDato = "comune" | "provincia" | "indirizzo" | "committente" | "altezza" | "lunghezza" | "larghezza" | "piani" | "copertura" | "struttura" | "destinazione" | "atex" | "fotovoltaico" | "codice";
export interface DatoTrovato { campo: CampoDato; valore: string; numero?: number; frase: string; documento: string }

const NOMI: Record<CampoDato, string> = {
  comune: "Comune", provincia: "Provincia", indirizzo: "Indirizzo", committente: "Committente", altezza: "Altezza dell'edificio (m)",
  lunghezza: "Lunghezza (m)", larghezza: "Larghezza (m)", piani: "Numero di piani", copertura: "Copertura", struttura: "Struttura",
  destinazione: "Destinazione d'uso", atex: "Zone ATEX", fotovoltaico: "Impianto fotovoltaico", codice: "Numero progetto / commessa",
};
export const nomeCampo = (c: CampoDato) => NOMI[c];

const num = (s: string) => parseFloat(s.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
const pulisci = (s: string) => s.replace(/\s+/g, " ").trim();
const frase = (t: string, i: number) => pulisci(t.slice(Math.max(0, i - 60), Math.min(t.length, i + 120)));
const maiuscola = (s: string) => s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

export function estraiDati(testo: string, documento: string): DatoTrovato[] {
  const t = testo.replace(/ /g, " ");
  const out: DatoTrovato[] = [];
  const add = (campo: CampoDato, valore: string, i: number, numero?: number) => {
    const v = pulisci(valore).replace(/[.,;:]+$/, "");
    if (!v || out.some((d) => d.campo === campo && d.valore.toLowerCase() === v.toLowerCase())) return;
    out.push({ campo, valore: v, frase: frase(t, i), documento, ...(numero != null ? { numero } : {}) });
  };
  let m: RegExpExecArray | null;
  const re = (r: RegExp, f: (m: RegExpExecArray) => void) => { r.lastIndex = 0; while ((m = r.exec(t))) f(m); };

  re(/\bComune\s+di\s+([A-ZÀ-Ý][\p{L}'’ -]{1,40}?)(?=\s*(?:\(|[-–,.;:]|\s(?:Provincia|Prov\.|Città|Regione|in\b|via\b)|\n|$))/gu, (m) => add("comune", maiuscola(m[1]!), m.index));
  re(/\((?:Prov\.?\s*)?([A-Z]{2})\)/g, (m) => { if (!/^(CA|EN|IT|UE|LT|BT|MT|AT)$/.test(m[1]!)) add("provincia", m[1]!, m.index); });
  re(/\b((?:Via|Viale|Corso|C\.so|Piazza|P\.zza|Largo|Strada|Str\.|Località|Loc\.|Vicolo)\s+[\p{L}'’. ]{2,50}?,?\s*(?:n\.?\s*)?\d{1,4}[A-Za-z]?)\b/gu, (m) => add("indirizzo", m[1]!, m.index));
  re(/\bCommittente\s*[:\-–]?\s*([^\n;]{3,80}?)(?=\s{2,}|\n|;|\.\s|$)/gi, (m) => add("committente", m[1]!, m.index));
  re(/\b(?:altezza(?:\s+(?:massima|in\s+gronda|di\s+gronda|al\s+colmo|fuori\s+terra|dell['’]edificio|totale))?|H\s*max|Hmax|H)\s*(?:[:=]|è\s+(?:pari\s+a|di)|di|pari\s+a)?\s*(?:circa\s*)?(\d{1,3}(?:[.,]\d{1,2})?)\s*m\b/gi, (m) => { const v = num(m[1]!); if (v >= 2 && v <= 300) add("altezza", String(v).replace(".", ","), m.index, v); });
  re(/\b(?:dimensioni\s+(?:in\s+pianta\s+)?(?:di\s+)?(?:circa\s+)?)(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:m\s*)?[x×]\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*m\b/gi, (m) => { const a = num(m[1]!), b = num(m[2]!); add("lunghezza", String(Math.max(a, b)).replace(".", ","), m.index, Math.max(a, b)); add("larghezza", String(Math.min(a, b)).replace(".", ","), m.index, Math.min(a, b)); });
  re(/\b(\d{1,2}|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s+piani\s+fuori\s+terra\b/gi, (m) => { const p = ["uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci"].indexOf(m[1]!.toLowerCase()); const v = p >= 0 ? p + 1 : parseInt(m[1]!, 10); add("piani", String(v), m.index, v); });
  re(/\bcopertura\s+(?:in|a|piana|con)?\s*([\p{L} ]{0,12}(?:lamiera|pannelli\s+sandwich|tegole|coppi|guaina|calcestruzzo|legno|piana|a\s+falde|vetro|policarbonato)[\p{L} ]{0,20})/giu, (m) => add("copertura", m[1]!, m.index));
  re(/\b(struttura\s+(?:portante\s+)?in\s+(?:cemento\s+armato|c\.a\.|calcestruzzo|acciaio|carpenteria\s+metallica|legno|muratura)(?:\s+prefabbricat[oa])?)/gi, (m) => add("struttura", m[1]!, m.index));
  re(/\b(?:destinazione\s+d['’]uso|uso)\s*[:\-–]?\s*(residenziale|abitativ[oa]|ricettiv[oa]|alberghier[oa]|promiscu[oa]|industriale|commerciale|uffici|scolastic[oa]|ospedalier[oa]|sanitari[oa]|produttiv[oa]|artigianale)/gi, (m) => add("destinazione", m[1]!.toLowerCase(), m.index));
  re(/\b(zon[ae]\s*(?:ATEX\s*)?(?:0|1|2|20|21|22)\b(?:\s*(?:,|e)\s*(?:0|1|2|20|21|22)\b)*|ATEX)/gi, (m) => add("atex", m[1]!.toUpperCase().startsWith("ATEX") ? "presenti (citate nel documento)" : m[1]!.toLowerCase(), m.index));
  re(/\b(impianto\s+fotovoltaico[^.;\n]{0,60}?(?:\d+(?:[.,]\d+)?\s*kWp)?)/gi, (m) => add("fotovoltaico", m[1]!, m.index));
  re(/\b(?:commessa|n\.\s*progetto|numero\s+progetto|rif\.\s*CRM|CRM)\s*[:\-–#]?\s*([A-Z]{0,4}[-_ ]?\d{2,4}[-_/]\d{2,6})\b/gi, (m) => add("codice", m[1]!, m.index));
  return out;
}

/** per ogni campo il valore più frequente (a parità il primo) */
export function migliori(dati: DatoTrovato[]): DatoTrovato[] {
  const per = new Map<CampoDato, Map<string, { d: DatoTrovato; n: number }>>();
  for (const d of dati) { const m = per.get(d.campo) ?? new Map(); const k = d.valore.toLowerCase(); const o = m.get(k); m.set(k, { d: o?.d ?? d, n: (o?.n ?? 0) + 1 }); per.set(d.campo, m); }
  return [...per.values()].map((m) => [...m.values()].sort((a, b) => b.n - a.n)[0]!.d);
}
