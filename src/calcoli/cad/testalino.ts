/**
 * Testalino delle tavole LPS (in basso a destra, nella colonna) e legenda dei layer predefiniti.
 * Il testalino sta sul layer LPS-CART, la legenda dei layer su LPS-LEGE con un campione di linea per ogni layer
 * disegnato sul layer stesso. Misure in millimetri sulla carta, convertite con P() e hT() del foglio.
 */
import { COLONNA_MM, LAYER_LPS, type LayerLps } from "./standard";
import type { ScrittoreDXF, P2 } from "./dxf12";

export interface RevisioneTavola { rev: string; data: string; descrizione: string; autore?: string | undefined }
export interface DatiTestalino {
  codice: string; nome: string; comune: string; lpl: string; data: string;
  committente?: string | undefined; opera?: string | undefined; progettista?: string | undefined; albo?: string | undefined;
  rev?: string | undefined; revisioni?: RevisioneTavola[] | undefined;
}
/** Altezza del testalino sulla carta (mm), dal bordo interno della squadratura. */
export const ALTEZZA_TESTALINO = 106;

const corto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);
const dataIt = (s: string) => { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : s; };

/** Testalino con angolo in basso a sinistra in (colX, 10) mm, largo COLONNA_MM. */
export function disegnaTestalino(w: ScrittoreDXF, P: (x: number, y: number) => P2, hT: (mm: number) => number, colX: number, d: DatiTestalino, o: { sottotitolo: string; tav: string; scala: string; formato?: string | undefined }) {
  const lay = LAYER_LPS.cartiglio.nome, x0 = colX, x1 = colX + COLONNA_MM, xm = colX + COLONNA_MM / 2, y0 = 10, y1 = y0 + ALTEZZA_TESTALINO;
  const T = (x: number, y: number, h: number, s: string, a: "sinistra" | "destra" | "centro" = "sinistra") => w.testo(lay, P(x, y), hT(h), s, a);
  const L = (xa: number, ya: number, xb: number, yb: number) => w.linea(lay, P(xa, ya), P(xb, yb));
  w.poli(lay, [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], true);
  let y = y1;
  // 1. intestazione OBO
  T(x0 + 4, y - 9, 7, "OBO"); T(x0 + 25, y - 9, 3.4, "BETTERMANN");
  T(x1 - 4, y - 5.2, 2, "OBO Bettermann S.r.l.", "destra");
  T(x1 - 4, y - 8.6, 1.7, "Via C. Ferrero 16 - 10098 Rivoli (TO)", "destra");
  T(x1 - 4, y - 11.8, 1.7, "Tel. +39 011 9548 811 - tecnico@obo.it", "destra");
  y -= 14; L(x0, y, x1, y);
  // 2. titolo
  T(x0 + 4, y - 5.5, 3.1, "IMPIANTO DI PROTEZIONE CONTRO I FULMINI (LPS)");
  T(x0 + 4, y - 10.2, 2.4, corto(o.sottotitolo, 70));
  y -= 13; L(x0, y, x1, y);
  // 3. dati del progetto
  const riga = (e: string, v: string, xa: number, xb: number, yy: number) => { T(xa + 2, yy - 2.4, 1.6, e.toUpperCase()); T(xa + 2, yy - 5.4, 2.4, corto(v || "-", Math.floor((xb - xa - 4) / 1.45))); };
  const campi: [string, string, string, string][] = [
    ["Committente", d.committente ?? "", "", ""],
    ["Opera", d.opera || d.nome, "", ""],
    ["Comune", d.comune, "Codice progetto (CRM)", d.codice],
    ["Livello di protezione", `LPL ${d.lpl}`, "Norma", "CEI EN IEC 62305:2026-10"],
    ["Scala", o.scala, "Formato", o.formato ?? "-"],
    ["Data", d.data, "Revisione", d.rev ? `Rev. ${d.rev}` : "Bozza"],
  ];
  for (const [e1, v1, e2, v2] of campi) {
    if (e2) { riga(e1, v1, x0, xm, y); riga(e2, v2, xm, x1, y); L(xm, y, xm, y - 6.5); } else riga(e1, v1, x0, x1, y);
    y -= 6.5; L(x0, y, x1, y);
  }
  // 4. revisioni (le ultime 3, la più recente in alto)
  const cols: [string, number][] = [["REV.", 0], ["DATA", 12], ["DESCRIZIONE", 32], ["REDATTO", 112], ["CONTR.", 136], ["APPR.", 156]];
  cols.forEach(([t, dx]) => T(x0 + dx + 1.5, y - 3.4, 1.6, t));
  cols.slice(1).forEach(([, dx]) => L(x0 + dx, y, x0 + dx, y - 20));
  y -= 5; L(x0, y, x1, y);
  const rev = (d.revisioni ?? []).slice(-3).reverse();
  for (let i = 0; i < 3; i++) {
    const r = rev[i];
    if (r) { T(x0 + 1.5, y - 3.6, 2, r.rev); T(x0 + 13.5, y - 3.6, 1.9, dataIt(r.data)); T(x0 + 33.5, y - 3.6, 1.9, corto(r.descrizione, 54)); T(x0 + 113.5, y - 3.6, 1.7, corto(r.autore ?? "", 14)); }
    y -= 5; L(x0, y, x1, y);
  }
  // 5. progettista, timbro e firma, numero della tavola
  const xf = x0 + 70, xt = x1 - 38;
  L(xf, y, xf, y0); L(xt, y, xt, y0);
  T(x0 + 2, y - 2.6, 1.6, "PROGETTISTA");
  T(x0 + 2, y - 6.2, 2.2, corto(d.progettista || "-", 44));
  if (d.albo) T(x0 + 2, y - 9.6, 1.7, corto(d.albo, 50));
  T(x0 + 2, y0 + 1.6, 1.4, "Elaborato con Progettazione LPS (OBO Italia)");
  T(xf + 2, y - 2.6, 1.6, "TIMBRO E FIRMA");
  T(xt + 2, y - 2.6, 1.6, "TAVOLA");
  T((xt + x1) / 2, y0 + 3.5, 4.4, o.tav.replace(/^TAV\.\s*/, ""), "centro");
}

/** Legenda dei layer predefiniti: campione di linea sul layer, nome, colore, tipo linea e descrizione. Restituisce la y finale (mm). */
export function legendaLayer(w: ScrittoreDXF, P: (x: number, y: number) => P2, hT: (mm: number) => number, x0: number, yAlto: number, yMin: number, layer: LayerLps[] = Object.values(LAYER_LPS)): number {
  const lg = LAYER_LPS.legenda.nome, xr = x0 + COLONNA_MM - 8;
  let y = yAlto;
  w.testo(lg, P(x0, y), hT(3.2), "LAYER PREDEFINITI"); y -= 6;
  w.testo(lg, P(x0 + 16, y), hT(1.7), "LAYER"); w.testo(lg, P(x0 + 50, y), hT(1.7), "COL."); w.testo(lg, P(x0 + 62, y), hT(1.7), "DESCRIZIONE");
  y -= 1.4; w.linea(lg, P(x0, y), P(xr, y)); y -= 3.8;
  const disegnabili = layer.filter((l) => !l.nome.startsWith("LPS-3D"));
  for (const l of disegnabili) {
    if (y < yMin) { w.testo(lg, P(x0, y), hT(1.7), `... altri ${disegnabili.length - disegnabili.indexOf(l)} layer (3D esclusi)`); y -= 3.8; break; }
    w.poli(l.nome, [P(x0, y + 0.9), P(x0 + 12, y + 0.9)], false);
    w.testo(lg, P(x0 + 16, y), hT(1.9), l.nome);
    w.testo(lg, P(x0 + 50, y), hT(1.9), String(l.colore));
    w.testo(lg, P(x0 + 62, y), hT(1.9), corto(`${l.descrizione}${l.linea !== "CONTINUOUS" ? ` (${l.linea === "LPS_TRATTEGGIO" ? "tratteggio" : "tratto-punto"})` : ""}`, 64));
    y -= 3.8;
  }
  return y;
}
