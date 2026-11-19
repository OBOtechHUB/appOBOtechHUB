/**
 * Documento Word (.docx) minimo creato nel browser, senza librerie: titoli, paragrafi, elenchi, tabelle,
 * salti pagina, intestazione e piè di pagina con numero di pagina. Usato per la relazione tecnica.
 * Il file si apre e si modifica in Word, LibreOffice e Google Documenti.
 */
import { creaZip } from "./zip";

/** Pezzo di testo con formattazione. `daCompletare` = evidenziato in giallo (parte da scrivere a mano). */
export interface Run { t: string; b?: boolean; i?: boolean; sup?: boolean; sub?: boolean; daCompletare?: boolean; colore?: string }
export type Testo = string | Run[];
export type Blocco =
  | { tipo: "titolo"; livello: 1 | 2 | 3; testo: string }
  | { tipo: "par"; testo: Testo; allinea?: "sinistra" | "centro" | "destra" | "giustificato"; dimensione?: number; grassetto?: boolean; spazioPrima?: number; spazioDopo?: number; formula?: boolean; conSuccessivo?: boolean }
  | { tipo: "elenco"; voci: Testo[] }
  | { tipo: "tabella"; intestazione: Testo[]; righe: Testo[][]; larghezze?: number[]; evidenziaColonna?: number; evidenziaRighe?: number[]; dimensione?: number }
  | { tipo: "immagine"; svg: string; larghezza: number; altezza: number; png?: Uint8Array; jpeg?: boolean; pdf?: string; mancante?: string; allinea?: "sinistra" | "centro" | "destra" }
  | { tipo: "sommario"; titolo: string }
  /** fascia colorata a tutta larghezza (copertina): righe di testo su fondo `colore`; senza righe = barra sottile */
  | { tipo: "fascia"; colore: string; righe: { testo: Testo; dimensione?: number; grassetto?: boolean; colore?: string; allinea?: "sinistra" | "centro" | "destra" }[]; altezza?: number }
  | { tipo: "salto" };

/** Colori dello standard OBO (Brand Portal: OBO Orange e colori secondari). */
export const OBO = { arancio: "F39B00", sec1: "282A31", sec2: "41525D", sec3: "7694A4", sec4: "C5D9DE", sec5: "E4EBED", eco: "A9C8A0" } as const;

export interface Documento { blocchi: Blocco[]; intestazione?: string; piede?: Testo[]; titolo?: string; autore?: string }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const runs = (t: Testo): Run[] => (typeof t === "string" ? [{ t }] : t);

function run(r: Run, base: { b?: boolean; dim?: number; colore?: string } = {}): string {
  const p: string[] = [];
  if (r.b || base.b) p.push("<w:b/>");
  if (r.i) p.push("<w:i/>");
  if (r.colore || base.colore) p.push(`<w:color w:val="${r.colore ?? base.colore}"/>`);
  if (base.dim) p.push(`<w:sz w:val="${base.dim * 2}"/><w:szCs w:val="${base.dim * 2}"/>`);
  if (r.daCompletare) p.push('<w:highlight w:val="yellow"/>');
  if (r.sup) p.push('<w:vertAlign w:val="superscript"/>');
  if (r.sub) p.push('<w:vertAlign w:val="subscript"/>');
  const rpr = p.length ? `<w:rPr>${p.join("")}</w:rPr>` : "";
  // a capo dentro un pezzo di testo = <w:br/>
  return r.t.split("\n").map((riga, i) => `<w:r>${rpr}${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(riga)}</w:t></w:r>`).join("");
}

const ALLINEA = { sinistra: "left", centro: "center", destra: "right", giustificato: "both" } as const;

function paragrafo(t: Testo, o: { stile?: string; allinea?: keyof typeof ALLINEA; dim?: number; b?: boolean; prima?: number; dopo?: number; numero?: boolean; keepNext?: boolean; colore?: string } = {}): string {
  const ppr = [
    o.stile ? `<w:pStyle w:val="${o.stile}"/>` : "",
    o.keepNext ? "<w:keepNext/>" : "",
    o.numero ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : "",
    o.prima != null || o.dopo != null ? `<w:spacing${o.prima != null ? ` w:before="${o.prima * 20}"` : ""}${o.dopo != null ? ` w:after="${o.dopo * 20}"` : ""}/>` : "",
    o.allinea ? `<w:jc w:val="${ALLINEA[o.allinea]}"/>` : "",
  ].join("");
  return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ""}${runs(t).map((r) => run(r, { ...(o.b ? { b: true } : {}), ...(o.dim ? { dim: o.dim } : {}), ...(o.colore ? { colore: o.colore } : {}) })).join("")}</w:p>`;
}

/** Larghezza utile della pagina A4 con margini di 2 cm, in twip. */
const UTILE = 9638;

function tabella(b: Extract<Blocco, { tipo: "tabella" }>): string {
  const n = Math.max(b.intestazione.length, ...b.righe.map((r) => r.length), 1);
  const pesi = b.larghezze && b.larghezze.length === n ? b.larghezze : Array.from({ length: n }, () => 1);
  const tot = pesi.reduce((a, x) => a + x, 0);
  const w = pesi.map((x) => Math.round((x / tot) * UTILE));
  const dim = b.dimensione ?? 9;
  let evRiga = false, pari = false;
  // standard OBO: intestazione grigio-blu scuro con testo bianco, righe alternate chiare, evidenza in azzurro secondario
  const cella = (t: Testo, i: number, testa: boolean) => {
    const ev = !testa && (b.evidenziaColonna === i || evRiga);
    const fill = testa ? OBO.sec2 : ev ? OBO.sec4 : pari ? OBO.sec5 : "";
    return `<w:tc><w:tcPr><w:tcW w:w="${w[i]}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>${paragrafo(t, { stile: "Tabella", dim, ...(testa ? { b: true, colore: "FFFFFF" } : ev ? { b: true } : {}) })}</w:tc>`;
  };
  const riga = (r: Testo[], testa: boolean) => `<w:tr>${testa ? '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${Array.from({ length: n }, (_, i) => cella(r[i] ?? "", i, testa)).join("")}</w:tr>`;
  const bordi = `<w:top w:val="single" w:sz="8" w:space="0" w:color="${OBO.sec2}"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="${OBO.sec2}"/><w:right w:val="nil"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="${OBO.sec4}"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="FFFFFF"/>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${UTILE}" w:type="dxa"/><w:tblBorders>${bordi}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="28" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="28" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${w.map((x) => `<w:gridCol w:w="${x}"/>`).join("")}</w:tblGrid>${b.intestazione.length ? riga(b.intestazione, true) : ""}${b.righe.map((r, k) => { evRiga = !!b.evidenziaRighe?.includes(k); pari = k % 2 === 1; const x = riga(r, false); evRiga = false; pari = false; return x; }).join("")}</w:tbl>${paragrafo("", { dopo: 4 })}`;
}

const EMU = 360000;
function immagine(b: Extract<Blocco, { tipo: "immagine" }>, id: number): string {
  if (!b.png) return paragrafo([{ t: "[immagine]", i: true }], { allinea: "centro" });
  const cx = Math.round(b.larghezza * EMU), cy = Math.round(b.altezza * EMU);
  return `<w:p><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="40"/><w:jc w:val="${ALLINEA[b.allinea ?? "centro"]}"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Figura ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="img${id}.${b.jpeg ? "jpeg" : "png"}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

export type ImmaginePdf = { png: Uint8Array; larghezza: number; altezza: number };
/**
 * Converte le immagini del documento in PNG: gli SVG con `converti`, le schede PDF (prima pagina) con `convertiPdf`.
 * Una scheda non trovata diventa un paragrafo evidenziato da completare.
 */
export async function rasterizza(doc: Documento, converti: (svg: string, larghezzaCm: number, altezzaCm: number) => Promise<Uint8Array>, convertiPdf?: (file: string) => Promise<ImmaginePdf | null>): Promise<Documento> {
  const blocchi: Blocco[] = [];
  for (const b of doc.blocchi) {
    if (b.tipo !== "immagine" || b.png) { blocchi.push(b); continue; }
    if (b.pdf) {
      let r: ImmaginePdf | null = null;
      try { r = convertiPdf ? await convertiPdf(b.pdf) : null; } catch { r = null; }
      blocchi.push(r ? { ...b, ...r } : { tipo: "par", testo: [{ t: `[DA COMPLETARE: ${b.mancante ?? `inserire la scheda ${b.pdf}`}]`, daCompletare: true }], allinea: "centro" });
      continue;
    }
    blocchi.push({ ...b, png: await converti(b.svg, b.larghezza, b.altezza) });
  }
  return { ...doc, blocchi };
}

/** Sommario come campo TOC di Word (capitoli = titoli di livello 1): Word lo aggiorna con i numeri di pagina all'apertura. */
function sommario(titolo: string, blocchi: Blocco[]): string {
  const voci = blocchi.flatMap((b) => (b.tipo === "titolo" && b.livello === 1 ? [b.testo] : []));
  const voce = (t: string, i: number) => `<w:p><w:pPr><w:pStyle w:val="Sommario1"/></w:pPr>${i === 0 ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-1" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' : ""}${run({ t })}<w:r><w:tab/></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGEREF _Toc${i + 1} \\h </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t></w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>${i === voci.length - 1 ? '<w:r><w:fldChar w:fldCharType="end"/></w:r>' : ""}</w:p>`;
  return paragrafo(titolo, { stile: "TitoloSommario" }) + (voci.length ? voci.map(voce).join("") : "") + '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function fascia(b: Extract<Blocco, { tipo: "fascia" }>): string {
  const righe = b.righe.length ? b.righe.map((r) => paragrafo(r.testo, { stile: "Tabella", allinea: r.allinea ?? "sinistra", dim: r.dimensione ?? 11, colore: r.colore ?? "FFFFFF", ...(r.grassetto ? { b: true } : {}), dopo: 2 })).join("") : '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="40" w:lineRule="exact"/></w:pPr></w:p>';
  const h = b.altezza ? `<w:trPr><w:trHeight w:val="${Math.round(b.altezza * 567)}" w:hRule="${b.righe.length ? "atLeast" : "exact"}"/></w:trPr>` : "";
  return `<w:tbl><w:tblPr><w:tblW w:w="${UTILE}" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="${b.righe.length ? 340 : 0}" w:type="dxa"/><w:left w:w="400" w:type="dxa"/><w:bottom w:w="${b.righe.length ? 340 : 0}" w:type="dxa"/><w:right w:w="400" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${UTILE}"/></w:tblGrid><w:tr>${h}<w:tc><w:tcPr><w:tcW w:w="${UTILE}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${b.colore}"/><w:vAlign w:val="center"/></w:tcPr>${righe}</w:tc></w:tr></w:tbl>`;
}

function corpo(blocchi: Blocco[]): string {
  let img = 0, cap = 0;
  return blocchi.map((b) => {
    switch (b.tipo) {
      case "titolo": {
        const x = paragrafo(b.testo, { stile: `Titolo${b.livello}`, keepNext: true });
        if (b.livello !== 1) return x;
        cap++; // segnalibro per il numero di pagina nel sommario
        return x.replace("</w:pPr>", `</w:pPr><w:bookmarkStart w:id="${cap}" w:name="_Toc${cap}"/>`).replace(/<\/w:p>$/, `<w:bookmarkEnd w:id="${cap}"/></w:p>`);
      }
      case "par": return paragrafo(b.testo, { ...(b.formula ? { stile: "Formula" } : {}), ...(b.allinea ? { allinea: b.allinea } : {}), ...(b.dimensione ? { dim: b.dimensione } : {}), ...(b.grassetto ? { b: true } : {}), ...(b.spazioPrima != null ? { prima: b.spazioPrima } : {}), ...(b.spazioDopo != null ? { dopo: b.spazioDopo } : {}), ...(b.conSuccessivo ? { keepNext: true } : {}) });
      case "elenco": return b.voci.map((v) => paragrafo(v, { stile: "Elenco", numero: true })).join("");
      case "tabella": return tabella(b);
      case "immagine": return immagine(b, b.png ? ++img : 0);
      case "sommario": return sommario(b.titolo, blocchi);
      case "fascia": return fascia(b);
      case "salto": return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    }
  }).join("");
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

const STILI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:color w:val="282A31"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="it-IT"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="264" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normale"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Titolo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normale"/><w:next w:val="Normale"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="3" w:color="F39B00"/></w:pBdr><w:spacing w:before="360" w:after="160"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/><w:color w:val="282A31"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Titolo2"><w:name w:val="heading 2"/><w:basedOn w:val="Normale"/><w:next w:val="Normale"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="41525D"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Titolo3"><w:name w:val="heading 3"/><w:basedOn w:val="Normale"/><w:next w:val="Normale"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="80"/><w:jc w:val="left"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="41525D"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TitoloSommario"><w:name w:val="TOC Heading"/><w:basedOn w:val="Normale"/><w:next w:val="Normale"/><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="3" w:color="F39B00"/></w:pBdr><w:spacing w:before="120" w:after="240"/><w:jc w:val="left"/></w:pPr><w:rPr><w:b/><w:caps/><w:color w:val="282A31"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Sommario1"><w:name w:val="toc 1"/><w:basedOn w:val="Normale"/><w:next w:val="Normale"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9628"/></w:tabs><w:spacing w:before="60" w:after="60"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Elenco"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normale"/><w:pPr><w:spacing w:after="40"/><w:ind w:left="567" w:hanging="283"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Tabella"><w:name w:val="Table Text"/><w:basedOn w:val="Normale"/><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Formula"><w:name w:val="Formula"/><w:basedOn w:val="Normale"/><w:pPr><w:spacing w:before="80" w:after="120"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:i/><w:color w:val="282A31"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Piede"><w:name w:val="footer"/><w:basedOn w:val="Normale"/><w:pPr><w:spacing w:after="0" w:line="220" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="14"/><w:szCs w:val="14"/><w:color w:val="41525D"/></w:rPr></w:style>
</w:styles>`;

const NUMERAZIONE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="–"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

const campo = (istr: string) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${istr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;

/** Crea il file .docx. */
export function creaDocx(doc: Documento, data = new Date()): Uint8Array<ArrayBuffer> {
  const piede = (doc.piede ?? []).map((r) => paragrafo(r, { stile: "Piede" })).join("")
    + `<w:p><w:pPr><w:pStyle w:val="Piede"/><w:jc w:val="right"/></w:pPr><w:r><w:t xml:space="preserve">Pag. </w:t></w:r>${campo("PAGE")}<w:r><w:t xml:space="preserve"> di </w:t></w:r>${campo("NUMPAGES")}</w:p>`;
  const intest = doc.intestazione ? `<w:p><w:pPr><w:pStyle w:val="Piede"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="F39B00"/></w:pBdr><w:jc w:val="right"/></w:pPr>${run({ t: doc.intestazione })}</w:p>` : "<w:p/>";
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${corpo(doc.blocchi)}<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/><w:headerReference w:type="first" r:id="rIdH1"/><w:footerReference w:type="first" r:id="rIdF"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1134" w:bottom="1418" w:left="1134" w:header="567" w:footer="454" w:gutter="0"/><w:titlePg/></w:sectPr></w:body></w:document>`;
  const iso = data.toISOString().replace(/\.\d+Z$/, "Z");
  const pngs = doc.blocchi.flatMap((b) => (b.tipo === "immagine" && b.png ? [{ dati: b.png, ext: b.jpeg ? "jpeg" : "png" }] : []));
  const relImg = pngs.map((x, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/img${i + 1}.${x.ext}"/>`).join("");
  return creaZip([
    { nome: "[Content_Types].xml", dati: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { nome: "_rels/.rels", dati: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { nome: "docProps/core.xml", dati: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(doc.titolo ?? "")}</dc:title><dc:creator>${esc(doc.autore ?? "OBO Hub · Progettazione LPS")}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>` },
    { nome: "word/_rels/document.xml.rels", dati: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/><Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${relImg}</Relationships>` },
    { nome: "word/document.xml", dati: documento },
    { nome: "word/styles.xml", dati: STILI },
    { nome: "word/numbering.xml", dati: NUMERAZIONE },
    { nome: "word/settings.xml", dati: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings ${NS}><w:defaultTabStop w:val="709"/><w:updateFields w:val="true"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>` },
    { nome: "word/header1.xml", dati: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${NS}>${intest}</w:hdr>` },
    ...pngs.map((x, i) => ({ nome: `word/media/img${i + 1}.${x.ext}`, dati: x.dati })),
    { nome: "word/header2.xml", dati: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${NS}><w:p/></w:hdr>` },
    { nome: "word/footer1.xml", dati: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS}>${piede}</w:ftr>` },
  ], data);
}

/** Testo semplice del documento (per le prove e la ricerca). */
export function testoDocumento(doc: Documento): string {
  const t = (x: Testo) => runs(x).map((r) => r.t).join("");
  return doc.blocchi.map((b) => b.tipo === "titolo" ? b.testo : b.tipo === "par" ? t(b.testo) : b.tipo === "elenco" ? b.voci.map(t).join("\n") : b.tipo === "tabella" ? [b.intestazione, ...b.righe].map((r) => r.map(t).join(" | ")).join("\n") : b.tipo === "fascia" ? b.righe.map((r) => t(r.testo)).join("\n") : "").join("\n");
}
