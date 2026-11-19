/**
 * Traduzione in inglese di un documento Word dell'app (relazione tecnica): frasi del dizionario
 * (numeri come #, convertiti nel formato inglese), più alcune regole per le parti con nomi e livelli.
 * Il testo non riconosciuto (nomi, descrizioni degli articoli, testi dell'utente) resta com'è.
 */
import type { Blocco, Documento, Testo } from "@/lib/docx";
import { RELAZIONE_EN } from "@/dati/relazione/relazioneEn";

const NUM = String.raw`(\d+(?:[.,]\d+)*)`;
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** "1,5" → "1.5"; "1.250,5" → "1,250.5"; "1.000" → "1,000"; "5.2.3" resta. */
export function numeroEn(n: string): string {
  if (n.includes(",")) return n.replace(/\./g, "\u0000").replace(",", ".").replace(/\u0000/g, ",");
  if (/^\d{1,3}(\.\d{3})+$/.test(n)) return n.replace(/\./g, ",");
  return n;
}
interface Voce { re: RegExp; en: string }
const conNumeri = (en: string, nums: string[]) => { let i = 0; return en.replace(/#/g, () => numeroEn(nums[i++] ?? "#")); };
const corte = new Map<string, string>();
const lunghe: Voce[] = [];
for (const [it, en] of [...RELAZIONE_EN].sort((a, b) => b[0].length - a[0].length)) {
  if (it.length < 25) corte.set(it, en);
  else lunghe.push({ re: new RegExp(escRe(it).replace(/#/g, NUM), "g"), en });
}
const MESI_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MESI_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LIV = "(IV|III|II|I)";
const REGOLE: [RegExp, string | ((...m: string[]) => string)][] = [
  [/^COMUNE DI (.+)$/s, "MUNICIPALITY OF $1"], [/^PROVINCIA DI (.+)$/s, "PROVINCE OF $1"],
  [/denominata «(.+?)»/g, "named «$1»"], [/ubicata a /g, "located in "],
  [new RegExp(`(\\d{1,2}) (${MESI_IT.join("|")}) (\\d{4})`, "g"), (_m, g, mese, a) => `${g} ${MESI_EN[MESI_IT.indexOf(mese!)]} ${a}`],
  [new RegExp(`LPL ${LIV} – LPS di classe ${LIV}`, "g"), "LPL $1 – class $2 LPS"],
  [new RegExp(`LPS e SPD di livello ${LIV}`, "g"), "LPS and SPD of level $1"],
  [new RegExp(`SPD di livello ${LIV}`, "g"), "SPD of level $1"],
  [new RegExp(`LPS di classe ${LIV}`, "g"), "class $1 LPS"],
  [/zona «/g, "zone «"], [/^Blocco (\d+) – /, "Block $1 – "], [/^Blocco (\d+) \(/, "Block $1 ("], [/^Tipologico (\d+)/, "Detail $1"], [/\bN° /g, "No. "],
  [/campo di progetto LPL/g, "design range LPL"], [/(\w) del (\d{1,2}\/\d{1,2}\/\d{4})/g, "$1 dated $2"],
  [/^Con un class (IV|III|II|I) LPS /, "With a class $1 LPS, "], [/\bcon (LPS|SPD)\b/g, "with $1"], [/^con ki = /, "with ki = "],
  [/^(\d+(?:[.,]\d+)?) per (asta|metro|punto|calata|compensatore|picchetto|supporto|incrocio|punta|progetto|elemento|giunto)$/, (_m, n, u) => `${n} per ${({ asta: "rod", metro: "metre", punto: "point", calata: "down-conductor", compensatore: "expansion piece", picchetto: "earth rod", supporto: "holder", incrocio: "crossing", punta: "tip", progetto: "project", elemento: "element", giunto: "joint" } as Record<string, string>)[u!]}`],
  [/^(\d+(?:[.,]\d+)?)\/(asta|calata|punto|picchetto)$/, (_m, n, u) => `${n}/${({ asta: "rod", calata: "down-conductor", punto: "point", picchetto: "earth rod" } as Record<string, string>)[u!]}`],
  [/^(\d+) aste$/, "$1 rods"], [/: (\d+) aste$/, ": $1 rods"], [/^(\d+) zone$/, "$1 zones"],
  [/\(LPL (IV|III|II|I)\)\. Le /g, "(LPL $1). The "],
];

/** Traduce un frammento di testo. */
export function traduciTesto(s: string): string {
  if (!s || !/[a-zà-ù]{2}/i.test(s)) return s;
  const t = s.trim(), pre = s.slice(0, s.indexOf(t)), post = s.slice(s.indexOf(t) + t.length);
  const nums = t.match(/\d+(?:[.,]\d+)*/g) ?? [];
  const chiave = t.replace(/\d+(?:[.,]\d+)*/g, "#");
  const corta = corte.get(chiave);
  if (corta !== undefined) return pre + conNumeri(corta, nums) + post;
  let out = s;
  for (const v of lunghe) { v.re.lastIndex = 0; if (v.re.test(out)) { v.re.lastIndex = 0; out = out.replace(v.re, (...m: string[]) => conNumeri(v.en, m.slice(1, -2).filter((x) => typeof x === "string"))); } }
  for (const [re, en] of REGOLE) out = typeof en === "string" ? out.replace(re, en) : out.replace(re, en as (...m: string[]) => string);
  // numeri decimali rimasti in formato italiano
  return out.replace(/(\d),(\d)/g, "$1.$2");
}

const tradTesto = (t: Testo): Testo => (typeof t === "string" ? traduciTesto(t) : t.map((r) => ({ ...r, t: traduciTesto(r.t) })));
const tradSvg = (svg: string) => svg.replace(/>([^<>]+)</g, (m, x: string) => (/[a-zà-ù]{2}/i.test(x) ? `>${traduciTesto(x.replace(/&amp;/g, "&")).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;")}<` : m));

function tradBlocco(b: Blocco): Blocco {
  switch (b.tipo) {
    case "titolo": return { ...b, testo: traduciTesto(b.testo) };
    case "par": return { ...b, testo: tradTesto(b.testo) };
    case "elenco": return { ...b, voci: b.voci.map(tradTesto) };
    case "tabella": return { ...b, intestazione: b.intestazione.map(tradTesto), righe: b.righe.map((r) => r.map(tradTesto)) };
    case "fascia": return { ...b, righe: b.righe.map((r) => ({ ...r, testo: tradTesto(r.testo) })) };
    case "sommario": return { ...b, titolo: traduciTesto(b.titolo) };
    case "immagine": return b.svg ? { ...b, svg: tradSvg(b.svg), ...(b.mancante ? { mancante: traduciTesto(b.mancante) } : {}) } : b;
    default: return b;
  }
}

/** Documento tradotto in inglese (stessa struttura, figure comprese). */
export function traduciDocumento(doc: Documento): Documento {
  return {
    ...doc, blocchi: doc.blocchi.map(tradBlocco), pagina: { pag: "Page", di: "of" },
    ...(doc.intestazione ? { intestazione: traduciTesto(doc.intestazione) } : {}), ...(doc.titolo ? { titolo: traduciTesto(doc.titolo) } : {}),
  };
}
