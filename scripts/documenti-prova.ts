/**
 * Genera tutti i documenti dal progetto di prova completo (src/calcoli/prova/progettoProva.ts):
 * relazione tecnica (italiano e inglese), dichiarazione di conformità, verbale di prima verifica, piano delle verifiche,
 * offerta (Word ed Excel), tipologico disegnato (SVG/PNG) e tavola CAD (DXF).
 * Uso: bun scripts/documenti-prova.ts <cartella> [listino.json]
 * I grafici si convertono con rsvg-convert se presente; il listino vero (JSON del foglio METEL) è facoltativo.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { progettoProva, TIPOLOGICO_PROVA, TIPOLOGICO_PROVA_OBO, LISTINO_PROVA, OFFERTA_PROVA } from "@/calcoli/prova/progettoProva";
import { relazioneTecnica } from "@/calcoli/relazione/relazioneTecnica";
import { dichiarazioneConformita, pianoVerifichePeriodiche, verbalePrimaVerifica, type IngressoDocumenti } from "@/calcoli/documenti/documentiImpianto";
import { documentoOfferta, righeOfferta, totaliOfferta } from "@/calcoli/offerta/offerta";
import { svgTipologico } from "@/calcoli/particolari/tipologico";
import { leggiListino, type VoceListino } from "@/lib/listinoMetel";
import { creaDocx, rasterizza, testoDocumento, type Documento } from "@/lib/docx";
import { estesoSchema } from "@/lib/statoProgetto";

const out = process.argv[2] ?? "documenti-prova";
mkdirSync(out, { recursive: true });
const rsvg = spawnSync("rsvg-convert", ["--version"]).status === 0;
const cartellaObo = `${process.cwd()}/public/obo-disegni/`;
const indiceObo = existsSync(`${cartellaObo}indice.json`) ? (() => { const j = JSON.parse(readFileSync(`${cartellaObo}indice.json`, "utf8")); return { base: cartellaObo, codici: j.codici, disegni: j.disegni }; })() : null;
/** immagini dei disegni OBO incorporate nell'SVG (rsvg non legge file esterni arbitrari) */
const incorpora = (svg: string) => svg.replace(/href="([^"]+\.jpg)"/g, (m, p: string) => (existsSync(p) ? `href="data:image/jpeg;base64,${readFileSync(p).toString("base64")}"` : m));
const converti = async (svgIn: string, w: number) => {
  if (!rsvg) return new Uint8Array();
  const svg = incorpora(svgIn);
  const r = spawnSync("rsvg-convert", ["-w", String(Math.round((w / 2.54) * 200))], { input: svg, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(String(r.stderr));
  return new Uint8Array(r.stdout);
};
const logo = existsSync("public/relazione/logo-obo.png") ? (() => { const b = readFileSync("public/relazione/logo-obo.png"); return { dati: new Uint8Array(b), jpeg: false, larghezzaPx: b.readUInt32BE(16), altezzaPx: b.readUInt32BE(20) }; })() : undefined;
const report: string[] = [];
async function salva(nome: string, doc: Documento) {
  const d = rsvg ? await rasterizza(doc, converti) : doc;
  writeFileSync(`${out}/${nome}`, creaDocx(d));
  const gialli = (testoDocumento(d).match(/\[(DA COMPLETARE|TO BE COMPLETED): [^\]]+\]/g) ?? []).length;
  report.push(`${nome}: ${d.blocchi.length} blocchi, ${gialli} parti da completare`);
}

const e = progettoProva();
e.immagini = { logo }; e.disegniObo = indiceObo;
await salva("01-Relazione-tecnica-LPS.docx", relazioneTecnica(e));
await salva("01b-LPS-technical-report-EN.docx", relazioneTecnica({ ...e, dati: { ...e.dati, lingua: "en" } }));

const { bloccoImmagine } = await import("@/calcoli/relazione/relazioneTecnica");
const x: IngressoDocumenti = {
  comune: e.edificio.comune, indirizzo: e.edificio.indirizzo, nomeProgetto: e.edificio.nomeProgetto, codice: e.codice, rev: e.revisioni.at(-1)?.rev, lpl: e.edificio.lplProgetto ?? e.lplDisegno,
  aste: e.aste, conduttori: e.conduttori, picchetti: e.picchetti.length, tipoTerra: "anello e picchetti", dati: e.dati, piano: { critico: false, intervalli: null },
  logo: logo ? bloccoImmagine(logo, 4.2, "sinistra", 3) : undefined, data: e.data,
};
await salva("02-Dichiarazione-di-conformita-DM37.docx", dichiarazioneConformita(x));
await salva("03-Verbale-prima-verifica.docx", verbalePrimaVerifica(x));
await salva("04-Piano-verifiche-periodiche.docx", pianoVerifichePeriodiche(x));

// offerta: listino vero se passato (JSON delle righe del foglio METEL), altrimenti prezzi di prova
let voci: VoceListino[] = LISTINO_PROVA, versione = "prova";
if (process.argv[3] && existsSync(process.argv[3])) { voci = leggiListino(JSON.parse(readFileSync(process.argv[3], "utf8"))).voci; versione = "2026-1"; }
const mappa = new Map(voci.map((v) => [v.codice, v]));
const righe = righeOfferta(e.righe.map((r) => ({ codice: r.codice, descrizione: r.descrizione, quantita: r.quantita, unita: r.unita })), mappa, OFFERTA_PROVA);
await salva("05-Offerta-materiali.docx", documentoOfferta({ righe, o: OFFERTA_PROVA, progetto: e.edificio.nomeProgetto, comune: e.edificio.comune, codice: e.codice, rev: "A", versioneListino: versione, logo: x.logo, data: e.data }));
const t = totaliOfferta(righe);
const XLSX = await import("xlsx").catch(() => null);
if (XLSX) { const ws = XLSX.utils.aoa_to_sheet([["Pos.", "Codice", "Descrizione", "Q.tà", "U.m.", "Listino unit. €", "Sconto %", "Netto unit. €", "Totale €"], ...righe.map((r, i) => [i + 1, r.codice, r.descrizione, r.quantita, r.unita, r.listino, r.sconto, r.netto, r.totale]), [], ["", "", "Totale netto", "", "", "", "", "", t.netto]]);
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Offerta"); writeFileSync(`${out}/06-Offerta-materiali.xlsx`, new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer)); }
report.push(`Offerta: totale netto ${t.netto.toFixed(2)} €, ${t.mancanti} articoli senza prezzo (listino ${versione})`);

const svg = svgTipologico(TIPOLOGICO_PROVA, { titolo: "Tipologico – Asta su treppiede e tondo su tetto piano", legenda: true });
writeFileSync(`${out}/07-Tipologico.svg`, svg);
if (rsvg) writeFileSync(`${out}/07-Tipologico.png`, await converti(svg, 30));
if (indiceObo && rsvg) writeFileSync(`${out}/07b-Tipologico-disegni-OBO.png`, await converti(svgTipologico(TIPOLOGICO_PROVA_OBO, { titolo: "Tipologico – Asta su treppiede e tondo su tetto piano (disegni OBO)", legenda: true, obo: indiceObo }), 30));

const s = estesoSchema.parse({ modello: e.modello, aste: e.aste, conduttori: e.conduttori, lpl: e.lplDisegno, particolari: [], picchetti: e.picchetti.map((p, i) => ({ id: `p${i}`, x: (i % 5) * 20, y: Math.floor(i / 5) * 30, z: 0, lunghezza: p.lunghezza, codiceOBO: "" })) });
const modCad = await import("@/lib/exportCAD").catch((err: unknown) => { report.push(`Tavola DXF non creata: ${String(err).slice(0, 120)}`); return null; });
if (modCad) {
  const cad = modCad.generaCAD(s, { codice: e.codice ?? "", nome: e.edificio.nomeProgetto, comune: e.edificio.comune }, {}, { senzaModello3D: false });
  writeFileSync(`${out}/08-Tavola-LPS.dxf`, new Uint8Array(await cad.dxf.arrayBuffer()));
  report.push("Tavola DXF con pianta, calate, legenda, cartiglio e modello 3D");
}

writeFileSync(`${out}/LEGGIMI.txt`, `Documenti del progetto di prova completo (dati inventati), ${new Date().toISOString().slice(0, 10)}\n\n${report.join("\n")}\n`);
console.log(report.join("\n"));
