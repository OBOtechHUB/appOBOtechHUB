/**
 * Progetto completo delle antenne: captazione (sfera rotolante), calate isolate isCon con il collegamento al palo
 * (PAE), numero di conduttori in parallelo scelto in automatico, materiali per il computo e schema per la relazione.
 * Unica fonte per la pagina Antenne, il computo materiali e la relazione tecnica.
 */
import { calcolaAntenne, type DatiAntenne, type RisultatoAntenne } from "./antenne";
import { calateIsconAltezza, type DatiCalateAltezza, type RisultatoCalateAltezza } from "@/calcoli/calate/isconAltezza";
import { CORRENTE_LPL } from "./palo";
import { ISCON } from "@/calcoli/calate/iscon";

export interface RigaMateriale { codice: string; descrizione: string; quantita: number; unita: "m" | "pz"; categoria: "calate" | "morsetti" | "supporti" | "accessori" | "captazione" }
export interface ProgettoAntenne {
  r: RisultatoAntenne; ca: RisultatoCalateAltezza; datiCalate: DatiCalateAltezza; apparatoBasso: number; lAuto: boolean; lUsata: number;
  /** corrente di fulmine per conduttore (kA) con la soluzione scelta */
  correntePerConduttore: number | null;
  materiali: RigaMateriale[];
}

export function calcolaProgettoAntenne(d: DatiAntenne): ProgettoAntenne {
  const r0 = calcolaAntenne(d);
  const auto = d.calateAuto !== false;
  const apparatoBasso = d.quotaApparatoBasso ?? Math.max(0, d.sommita - 3);
  const datiCalate: DatiCalateAltezza = { lpl: d.lpl, ki: d.ki, quotaPunta: r0.asta, quotaBase: 0, quotaApparatoBasso: apparatoBasso, struttura: d.struttura ?? "metallica",
    nCalate: auto ? null : Math.min(4, d.numeroCalate), versione: d.versione ?? null, materiale: "aria", distanzaImpianti: d.distanzaImpianti ?? 0.5, isconFinoATerra: false, calateDistanziate: d.calateDistanziate !== false, obiettivo: d.obiettivo ?? "antenne" };
  const ca = calateIsconAltezza(datiCalate);
  const lAuto = d.lAuto !== false && ca.fattibile;
  const lUsata = lAuto ? Math.round(ca.l * 100) / 100 : d.lunghezzaCalata;
  const r = lAuto ? calcolaAntenne({ ...d, lunghezzaCalata: lUsata }) : r0;
  const correntePerConduttore = ca.fattibile ? CORRENTE_LPL[d.lpl] * (ca.n <= 1 ? 1 : ca.n === 2 ? 0.66 : 0.44) : null;
  const cat = (codice: string, descr: string): RigaMateriale["categoria"] => (codice === "5408058" ? "accessori" : /piastra|collegamento/i.test(descr) ? "morsetti" : /supporti/i.test(descr) ? "supporti" : "calate");
  const materiali: RigaMateriale[] = ca.materiali.map((m) => ({ codice: m.codice, descrizione: m.descrizione, quantita: m.quantita, unita: m.unita === "m" ? "m" : "pz", categoria: cat(m.codice, m.descrizione) }));
  if (r.protette) materiali.unshift({ codice: "", descrizione: `Asta di captazione con la punta a ${r.asta.toLocaleString("it-IT", { maximumFractionDigits: 2 })} m (${(r.asta - d.sommita).toLocaleString("it-IT", { maximumFractionDigits: 2 })} m sopra le antenne), supporto isolato sul palo`, quantita: 1, unita: "pz", categoria: "captazione" });
  return { r, ca, datiCalate, apparatoBasso, lAuto, lUsata, correntePerConduttore, materiali };
}

/** Schema verticale delle calate in SVG (colori fissi, per la relazione Word). */
export function svgSchemaCalate(punta: number, sommita: number, apparatoBasso: number, ca: RisultatoCalateAltezza, finoATerra: boolean, piano: string): string {
  const W = 420, H = 520, top = 30, bot = 470, zMax = Math.max(punta, sommita, 1);
  const y = (z: number) => bot - (Math.max(0, z) / zMax) * (bot - top);
  const xP = 220, xI = 196, xA = 246, f = (v: number) => v.toLocaleString("it-IT", { maximumFractionDigits: 1 });
  const t = (x: number, yy: number, s: string, colore = "#282a31", grassetto = false) => `<text x="${x}" y="${yy}" font-family="Arial" font-size="13" fill="${colore}"${grassetto ? ' font-weight="bold"' : ""}>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
  const pae = ca.quotaPAE;
  const parti = [
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    `<line x1="30" x2="${W - 30}" y1="${bot}" y2="${bot}" stroke="#282a31" stroke-width="2"/>`,
    ...Array.from({ length: 18 }, (_, i) => `<line x1="${36 + i * 20}" x2="${26 + i * 20}" y1="${bot}" y2="${bot + 12}" stroke="#7694a4" stroke-width="1"/>`),
    t(32, bot + 30, `${piano} · 0 m`),
    `<line x1="${xP}" x2="${xP}" y1="${y(Math.min(punta, sommita + 0.5))}" y2="${bot}" stroke="#7694a4" stroke-width="8" stroke-linecap="round"/>`,
    `<line x1="${xP}" x2="${xP}" y1="${y(punta)}" y2="${y(sommita)}" stroke="#f39b00" stroke-width="4"/>`,
    `<circle cx="${xP}" cy="${y(punta)}" r="5" fill="#f39b00"/>`, t(xP + 10, y(punta) + 5, `punta ${f(punta)} m`),
    `<rect x="${xA}" y="${y(sommita)}" width="18" height="${Math.max(6, y(apparatoBasso) - y(sommita))}" rx="2" fill="#41525d"/>`, t(xA + 24, y(apparatoBasso) + 5, `antenne da ${f(apparatoBasso)} m`),
  ];
  if (pae != null) parti.push(
    `<line x1="${xI}" x2="${xI}" y1="${y(punta - 0.3)}" y2="${y(finoATerra ? 0 : pae)}" stroke="#1b1f23" stroke-width="5"/>`,
    `<rect x="${xI - 18}" y="${y(pae + ca.zonaX)}" width="36" height="${Math.max(3, y(pae) - y(pae + ca.zonaX))}" fill="#f39b00" fill-opacity="0.2"/>`,
    `<line x1="40" x2="${W - 40}" y1="${y(pae)}" y2="${y(pae)}" stroke="#f39b00" stroke-width="2.5"/>`,
    `<rect x="${xI - 7}" y="${y(pae) - 7}" width="14" height="14" fill="#f39b00"/>`,
    t(34, y(pae) - 8, `fine isCon ${f(pae)} m`, "#c47a00", true),
    t(34, (y(punta) + y(pae)) / 2 + 4, `l = ${f(ca.l)} m`),
    t(34, bot - 14, `isCon dalla punta al collegamento sul palo · ${ca.n} ${ca.n === 1 ? "calata" : "calate"}`),
  );
  for (const l of ca.livelli.filter((x) => x.tipo === "intermedio")) parti.push(`<line x1="50" x2="${W - 50}" y1="${y(l.quota)}" y2="${y(l.quota)}" stroke="#2b7de9" stroke-width="1.5" stroke-dasharray="6 5"/>`, t(34, y(l.quota) - 5, `${f(l.quota)} m`, "#2b7de9"));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parti.join("")}</svg>`;
}
export { ISCON };
