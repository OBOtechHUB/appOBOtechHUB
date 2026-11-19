/**
 * Tipologici disegnati nell'app: blocchi OBO (aste, supporti, morsetti, giunti, dispersori, strutture…)
 * collegati da conduttori, con richiami numerati, legenda e distinta dei componenti.
 * Logica pura: modello del disegno, simboli in SVG, componenti del particolare, SVG finale e DXF.
 * Coordinate in unità di disegno (1 unità ≈ 1 mm a scala 1:5), asse y verso il basso come in SVG.
 */
import { z } from "zod";
import { ruoloDi, type Ruolo } from "./allinea";

export const UNITA_QUANTITA = ["per_m", "per_punto", "per_calata", "fisso", "per_asta", "per_supporto", "per_incrocio", "per_compensatore", "per_punta", "per_progetto", "per_picchetto", "per_elemento", "per_giunto"] as const;
export type UnitaQuantita = (typeof UNITA_QUANTITA)[number];
export const NOMI_UNITA: Record<UnitaQuantita, string> = { per_m: "per metro", per_punto: "per punto", per_calata: "per calata", fisso: "fisso", per_asta: "per asta", per_supporto: "per supporto", per_incrocio: "per incrocio", per_compensatore: "per compensatore", per_punta: "per punta", per_progetto: "per progetto", per_picchetto: "per picchetto", per_elemento: "per elemento", per_giunto: "per giunto" };

export const TIPI_BLOCCO = ["asta", "treppiede", "punta", "supporto-piano", "supporto-parete", "supporto-colmo", "morsetto", "giunto", "compensatore", "picchetto", "collettore", "targhetta", "tubo", "putrella", "parapetto", "copertura", "parete", "terreno", "blocco-cls", "spd"] as const;
export type TipoBlocco = (typeof TIPI_BLOCCO)[number];
/** blocchi che rappresentano la struttura (non sono componenti OBO da ordinare) */
export const STRUTTURA: ReadonlySet<TipoBlocco> = new Set<TipoBlocco>(["putrella", "parapetto", "copertura", "parete", "terreno"]);

export const bloccoSchema = z.object({
  id: z.string().max(40), tipo: z.enum(TIPI_BLOCCO), x: z.number().finite(), y: z.number().finite(),
  rot: z.number().finite().default(0), scala: z.number().finite().min(0.2).max(10).default(1),
  codiceOBO: z.string().max(40).default(""), descrizione: z.string().max(300).default(""),
  quantita: z.number().finite().nonnegative().default(1), unita: z.enum(UNITA_QUANTITA).default("fisso"),
  /** "obo": al posto del simbolo il disegno 2D ufficiale del prodotto (public/obo-disegni), largo `larghezzaObo` unità */
  vista: z.enum(["simbolo", "obo"]).default("simbolo"), larghezzaObo: z.number().finite().min(20).max(1500).default(140),
});
export const collegamentoSchema = z.object({
  id: z.string().max(40), da: z.string().max(40), a: z.string().max(40),
  tipo: z.enum(["conduttore", "piatto", "quota", "linea"]).default("conduttore"), ortogonale: z.boolean().default(false),
  codiceOBO: z.string().max(40).default(""), descrizione: z.string().max(300).default(""),
  quantita: z.number().finite().nonnegative().default(1), unita: z.enum(UNITA_QUANTITA).default("per_m"),
  /** testo della quota (es. "max 1 m") */
  testo: z.string().max(60).default(""),
});
export const testoSchema = z.object({ id: z.string().max(40), x: z.number().finite(), y: z.number().finite(), t: z.string().max(200), dim: z.number().finite().min(6).max(40).default(12) });
export const disegnoSchema = z.object({
  versione: z.literal(1).default(1), larghezza: z.number().finite().min(200).max(4000).default(800), altezza: z.number().finite().min(150).max(4000).default(500),
  blocchi: z.array(bloccoSchema).max(400).default([]), collegamenti: z.array(collegamentoSchema).max(800).default([]), testi: z.array(testoSchema).max(200).default([]),
});
export type BloccoTip = z.infer<typeof bloccoSchema>;
export type CollegamentoTip = z.infer<typeof collegamentoSchema>;
export type TestoTip = z.infer<typeof testoSchema>;
export type DisegnoTip = z.infer<typeof disegnoSchema>;
export const disegnoVuoto = (): DisegnoTip => ({ versione: 1, larghezza: 800, altezza: 500, blocchi: [], collegamenti: [], testi: [] });

// ------------------------------------------------------------------ simboli
interface Simbolo {
  nome: string; categoria: "Captazione" | "Collegamenti" | "Terra" | "Struttura" | "Accessori";
  /** contenuto SVG centrato in 0,0 (prima di rotazione e scala) */
  forme: string;
  /** punti di collegamento relativi al centro */
  porte: [number, number][];
  /** ingombro (mezza larghezza, mezza altezza) per selezione e richiami */
  mezzo: [number, number];
  unita: UnitaQuantita;
  ruolo?: Ruolo;
}
const L = (pts: string, w = 2) => `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const R = (x: number, y: number, w: number, h: number, f = "none") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" stroke="currentColor" stroke-width="2"/>`;
const C = (x: number, y: number, r: number, f = "none") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="currentColor" stroke-width="2"/>`;
/** tratteggio a 45° in un rettangolo */
const tratteggio = (x: number, y: number, w: number, h: number, passo = 10) => {
  let s = "";
  for (let k = -h + passo; k < w; k += passo) {
    let ax = x + k, ay = y + h, bx = x + k + h, by = y;
    if (ax < x) { ay -= x - ax; ax = x; }
    if (bx > x + w) { by += bx - (x + w); bx = x + w; }
    if (bx > ax) s += `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="currentColor" stroke-width="0.8" opacity="0.6"/>`;
  }
  return s;
};

// colori dei materiali (stile tecnico OBO: linee scure, superfici in toni neutri)
const MET = "#AEB6BD", MET_L = "#E3E7EA", MET_S = "#7E8890", CLS = "#D5D3CC", CLS_S = "#B9B6AD", PLA = "#5A5F66", CU = "#C98A5E", CU_L = "#E8B48E", ZN = "#C7CDD2";
const P = (d: string, f = "none", w = 1.6) => `<path d="${d}" fill="${f}" stroke="currentColor" stroke-width="${w}" stroke-linejoin="round"/>`;
const RR = (x: number, y: number, w: number, h: number, f: string, r = 0, sw = 1.6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}" stroke="currentColor" stroke-width="${sw}"/>`;
/** tondo metallico verticale con riflesso */
const tondoV = (x: number, y1: number, y2: number, r: number, f = MET, l = MET_L) => RR(x - r, y1, 2 * r, y2 - y1, f, 0, 1.4) + `<rect x="${x - r * 0.45}" y="${y1 + 2}" width="${r * 0.45}" height="${Math.max(0, y2 - y1 - 4)}" fill="${l}"/>`;
/** blocco in 3D (fronte, faccia superiore e laterale) */
const blocco3d = (x: number, y: number, w: number, h: number, p: number, f = CLS, s2 = CLS_S) => P(`M${x},${y} h${w} v${h} h${-w} Z`, f) + P(`M${x},${y} l${p},${-p * 0.6} h${w} l${-p},${p * 0.6} Z`, MET_L) + P(`M${x + w},${y} l${p},${-p * 0.6} v${h} l${-p},${p * 0.6} Z`, s2);
/** vite: testa esagonale vista di lato */
const vite = (x: number, y: number) => RR(x - 5, y - 3, 10, 6, ZN, 1, 1.2) + `<line x1="${x - 1.7}" y1="${y - 3}" x2="${x - 1.7}" y2="${y + 3}" stroke="currentColor" stroke-width="0.8"/><line x1="${x + 1.7}" y1="${y - 3}" x2="${x + 1.7}" y2="${y + 3}" stroke="currentColor" stroke-width="0.8"/>`;
const tratteggioMattoni = (x: number, y: number, w: number, h: number) => { let s = ""; for (let r = 0, yy = y; yy < y + h; r++, yy += 12) { s += `<line x1="${x}" y1="${yy}" x2="${x + w}" y2="${yy}" stroke="currentColor" stroke-width="0.6" opacity="0.55"/>`; for (let xx = x + (r % 2 ? 0 : 12); xx < x + w; xx += 24) s += `<line x1="${xx}" y1="${yy}" x2="${xx}" y2="${Math.min(y + h, yy + 12)}" stroke="currentColor" stroke-width="0.6" opacity="0.55"/>`; } return s; };
const terra = (x: number, y: number, w: number, h: number) => { let s = ""; for (let i = 0; i < w / 9; i++) for (let j = 0; j < h / 9; j++) if ((i * 7 + j * 3) % 5 < 2) s += `<circle cx="${x + 4 + i * 9 + (j % 2) * 4}" cy="${y + 4 + j * 9}" r="1.1" fill="currentColor" opacity="0.45"/>`; return s; };

export const SIMBOLI: Record<TipoBlocco, Simbolo> = {
  asta: { nome: "Asta di captazione", categoria: "Captazione", unita: "per_asta", ruolo: "asta", mezzo: [12, 100], porte: [[0, -100], [0, 40], [0, 100]],
    forme: tondoV(0, -84, 92, 4) + P("M-4,-84 L0,-100 L4,-84 Z", MET) + RR(-9, 62, 18, 30, MET_S, 2) + `<rect x="-6" y="64" width="3" height="26" fill="${MET_L}"/>` + vite(12, 70) + vite(12, 84) },
  treppiede: { nome: "Treppiede con blocchi in cls", categoria: "Captazione", unita: "per_asta", ruolo: "accessorio", mezzo: [72, 50], porte: [[0, -50], [0, -20]],
    forme: P("M-3,-40 L-58,20 L-52,22 L3,-36 Z", MET) + P("M3,-40 L58,20 L52,22 L-3,-36 Z", MET) + tondoV(0, -40, 22, 3) + RR(-10, -50, 20, 16, MET_S, 2) + vite(14, -42)
      + blocco3d(-72, 22, 34, 14, 8) + blocco3d(38, 22, 34, 14, 8) + blocco3d(-16, 26, 32, 12, 6) },
  punta: { nome: "Captatore a fungo / punta", categoria: "Captazione", unita: "per_punta", ruolo: "asta", mezzo: [16, 28], porte: [[0, 28], [0, -28]],
    forme: tondoV(0, -14, 28, 3) + P("M-15,-10 Q0,-34 15,-10 Z", MET) + `<path d="M-9,-13 Q0,-27 6,-16" fill="none" stroke="${MET_L}" stroke-width="2.5"/>` },
  "supporto-piano": { nome: "Supporto conduttore per tetto piano (165 MBG)", categoria: "Collegamenti", unita: "per_m", ruolo: "supporto", mezzo: [32, 22], porte: [[0, -16], [-32, -16], [32, -16]],
    forme: P("M-30,22 L-22,2 L22,2 L30,22 Z", CLS) + P("M-22,2 L-16,-2 L16,-2 L22,2 Z", MET_L) + P("M-7,-2 L-7,-12 Q-7,-22 0,-22 Q7,-22 7,-12 L7,-2 Z", PLA) + `<circle cx="0" cy="-15" r="4.5" fill="${MET}" stroke="currentColor" stroke-width="1.2"/><circle cx="-1.2" cy="-16.2" r="1.4" fill="${MET_L}"/>` },
  "supporto-parete": { nome: "Supporto conduttore a parete", categoria: "Collegamenti", unita: "per_m", ruolo: "supporto", mezzo: [24, 16], porte: [[20, 0], [20, -16], [20, 16]],
    forme: RR(-24, -12, 7, 24, ZN, 1) + P("M-17,-3 L10,-3 L10,3 L-17,3 Z", ZN) + P("M10,-9 Q22,-9 22,0 Q22,9 10,9 Z", PLA) + `<circle cx="16" cy="0" r="4.5" fill="${MET}" stroke="currentColor" stroke-width="1.2"/>` + vite(-20, -16) },
  "supporto-colmo": { nome: "Supporto conduttore per colmo", categoria: "Collegamenti", unita: "per_m", ruolo: "supporto", mezzo: [28, 22], porte: [[0, -18], [-28, -18], [28, -18]],
    forme: P("M-28,22 Q-14,4 0,2 Q14,4 28,22 L22,22 Q12,10 0,9 Q-12,10 -22,22 Z", "#B5654A") + P("M-2,2 L-2,-10 L2,-10 L2,2 Z", ZN) + P("M-7,-10 Q-7,-24 0,-24 Q7,-24 7,-10 Z", PLA) + `<circle cx="0" cy="-17" r="4.5" fill="${MET}" stroke="currentColor" stroke-width="1.2"/>` },
  morsetto: { nome: "Morsetto di connessione (249)", categoria: "Collegamenti", unita: "per_punto", ruolo: "connettore", mezzo: [16, 16], porte: [[0, 0], [-16, 0], [16, 0], [0, -16], [0, 16]],
    forme: RR(-14, -14, 28, 28, ZN, 3) + RR(-10, -10, 20, 20, MET_L, 2, 1) + `<polygon points="-5,-3 0,-6 5,-3 5,3 0,6 -5,3" fill="${MET}" stroke="currentColor" stroke-width="1.2"/><circle cx="0" cy="0" r="1.6" fill="currentColor"/>` },
  giunto: { nome: "Giunto di sezionamento (233)", categoria: "Collegamenti", unita: "per_calata", ruolo: "sezionamento", mezzo: [16, 26], porte: [[0, -26], [0, 26]],
    forme: RR(-14, -16, 28, 32, ZN, 2) + `<rect x="-11" y="-13" width="5" height="26" fill="${MET_L}"/>` + vite(0, -7) + vite(0, 7) + tondoV(0, -26, -16, 3.5) + tondoV(0, 16, 26, 3.5) },
  compensatore: { nome: "Compensatore di dilatazione", categoria: "Collegamenti", unita: "per_compensatore", ruolo: "compensatore", mezzo: [34, 22], porte: [[-34, 0], [34, 0]],
    forme: `<path d="M-34,0 L-16,0 C-16,-28 16,-28 16,0 L34,0" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M-34,0 L-16,0 C-16,-28 16,-28 16,0 L34,0" fill="none" stroke="${MET}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 2"/>` + RR(-20, -5, 8, 10, ZN, 1) + RR(12, -5, 8, 10, ZN, 1) },
  picchetto: { nome: "Picchetto di terra (219)", categoria: "Terra", unita: "per_picchetto", ruolo: "picchetto", mezzo: [12, 80], porte: [[0, -80], [0, -66]],
    forme: tondoV(0, -76, 66, 5, ZN) + P("M-5,66 L0,80 L5,66 Z", ZN) + RR(-7, -80, 14, 6, MET_S, 1) + RR(-11, -70, 22, 12, ZN, 2) + vite(14, -64) },
  collettore: { nome: "Collettore equipotenziale (1801)", categoria: "Terra", unita: "fisso", ruolo: "connettore", mezzo: [56, 16], porte: [[-40, 14], [-20, 14], [0, 14], [20, 14], [40, 14]],
    forme: RR(-56, -12, 112, 8, PLA, 2) + RR(-50, -6, 100, 12, CU, 1) + `<rect x="-48" y="-5" width="96" height="3" fill="${CU_L}"/>` + [-40, -20, 0, 20, 40].map((x) => vite(x, -9)).join("") },
  targhetta: { nome: "Targhetta di identificazione calata", categoria: "Accessori", unita: "per_calata", ruolo: "targhetta", mezzo: [22, 14], porte: [[0, 14]],
    forme: RR(-22, -14, 44, 28, "#F2F2EE", 3) + `<circle cx="-16" cy="-8" r="1.5" fill="currentColor"/><circle cx="16" cy="-8" r="1.5" fill="currentColor"/><text x="0" y="6" font-size="12" font-weight="bold" text-anchor="middle" fill="currentColor" font-family="Arial">C1</text>` },
  tubo: { nome: "Tubo di protezione della calata", categoria: "Accessori", unita: "per_calata", ruolo: "accessorio", mezzo: [10, 60], porte: [[0, -60], [0, 60]],
    forme: RR(-9, -60, 18, 120, "#9AA4AC", 3) + `<rect x="-6" y="-57" width="4" height="114" fill="${MET_L}" opacity="0.8"/>` + RR(-11, -40, 22, 6, ZN, 1) + RR(-11, 30, 22, 6, ZN, 1) },
  putrella: { nome: "Putrella / profilo metallico", categoria: "Struttura", unita: "fisso", mezzo: [30, 40], porte: [[0, -40], [-30, -40], [30, -40], [0, 40]],
    forme: P("M-30,-40 H30 V-32 H5 V32 H30 V40 H-30 V32 H-5 V-32 H-30 Z", MET) + `<rect x="-3" y="-30" width="2" height="60" fill="${MET_L}"/>` },
  parapetto: { nome: "Parapetto / ringhiera metallica", categoria: "Struttura", unita: "fisso", mezzo: [64, 52], porte: [[-60, -50], [0, -50], [60, -50]],
    forme: RR(-64, -54, 128, 8, MET, 4) + [-56, -18, 18, 56].map((x) => tondoV(x, -46, 52, 3.5)).join("") + RR(-60, -2, 120, 5, MET, 2) },
  copertura: { nome: "Copertura piana (solaio con impermeabilizzazione)", categoria: "Struttura", unita: "fisso", mezzo: [150, 18], porte: [[-150, -18], [-75, -18], [0, -18], [75, -18], [150, -18]],
    forme: RR(-150, -18, 300, 6, "#3E4248", 0, 1) + RR(-150, -12, 300, 30, CLS) + tratteggio(-150, -12, 300, 30) },
  parete: { nome: "Parete in muratura", categoria: "Struttura", unita: "fisso", mezzo: [16, 120], porte: [[16, -120], [16, -60], [16, 0], [16, 60], [16, 120]],
    forme: RR(-16, -120, 32, 240, "#E2D4C4") + tratteggioMattoni(-16, -120, 32, 240) },
  terreno: { nome: "Terreno", categoria: "Struttura", unita: "fisso", mezzo: [150, 22], porte: [[-150, -22], [-75, -22], [0, -22], [75, -22], [150, -22]],
    forme: `<rect x="-150" y="-22" width="300" height="44" fill="#E7DFD1"/>` + terra(-150, -20, 300, 42) + L("-150,-22 150,-22", 2.5) },
  "blocco-cls": { nome: "Blocco in calcestruzzo", categoria: "Accessori", unita: "per_asta", ruolo: "accessorio", mezzo: [34, 18], porte: [[0, -16]],
    forme: blocco3d(-34, -6, 60, 22, 10) },
  spd: { nome: "Limitatore di sovratensione (SPD)", categoria: "Accessori", unita: "fisso", ruolo: "accessorio", mezzo: [16, 30], porte: [[0, -30], [0, 30]],
    forme: RR(-16, -26, 32, 52, "#EDEDE8", 3) + RR(-12, -10, 24, 20, "#E26B2B", 2, 1) + `<rect x="-10" y="16" width="20" height="5" fill="#3BA55C"/>` + vite(-8, -20) + vite(8, -20) + vite(-8, 22) + vite(8, 22) + L("0,-30 0,-26", 2) + L("0,26 0,30", 2) },
};
export const CATEGORIE_SIMBOLI = ["Captazione", "Collegamenti", "Terra", "Accessori", "Struttura"] as const;

// ------------------------------------------------------------------ geometria
const rad = (g: number) => (g * Math.PI) / 180;
/** punti di collegamento relativi al centro: quelli del simbolo o, per i disegni OBO, centro e metà dei lati */
function porte(b: BloccoTip, ind?: IndiceDisegniObo | null): [number, number][] {
  const o = disegnoObo(b, ind);
  if (o) return [[0, 0], [0, -o.h / 2], [0, o.h / 2], [-o.w / 2, 0], [o.w / 2, 0]].map(([x, y]) => [x! / b.scala, y! / b.scala] as [number, number]);
  return SIMBOLI[b.tipo].porte;
}
/** posizione assoluta di una porta del blocco */
export function portaAssoluta(b: BloccoTip, i: number, ind?: IndiceDisegniObo | null): [number, number] {
  const [px, py] = porte(b, ind)[i] ?? [0, 0];
  const c = Math.cos(rad(b.rot)), s = Math.sin(rad(b.rot)), k = b.scala;
  return [b.x + (px * c - py * s) * k, b.y + (px * s + py * c) * k];
}
/** coppia di porte più vicine tra due blocchi */
export function porteCollegamento(a: BloccoTip, b: BloccoTip, ind?: IndiceDisegniObo | null): [[number, number], [number, number]] {
  let best: [[number, number], [number, number]] = [[a.x, a.y], [b.x, b.y]], dMin = Infinity;
  porte(a, ind).forEach((_, i) => porte(b, ind).forEach((__, j) => {
    const p = portaAssoluta(a, i, ind), q = portaAssoluta(b, j, ind), d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < dMin) { dMin = d; best = [p, q]; }
  }));
  return best;
}
/** percorso del collegamento: diretto o a L (prima orizzontale) */
export function percorso(c: CollegamentoTip, blocchi: BloccoTip[], ind?: IndiceDisegniObo | null): [number, number][] | null {
  const a = blocchi.find((b) => b.id === c.da), b = blocchi.find((x) => x.id === c.a);
  if (!a || !b) return null;
  const [p, q] = porteCollegamento(a, b, ind);
  if (c.ortogonale && c.tipo !== "quota" && Math.abs(p[0] - q[0]) > 0.5 && Math.abs(p[1] - q[1]) > 0.5) return [p, [q[0], p[1]], q];
  return [p, q];
}
/** Quota spostata di `off` unità a lato del segmento p–q, con linee di richiamo e testo. */
export function quota(p: [number, number], q: [number, number], off = 26) {
  const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l;
  const a: [number, number] = [p[0] + nx * off, p[1] + ny * off], b: [number, number] = [q[0] + nx * off, q[1] + ny * off];
  let ang = (Math.atan2(dy, dx) * 180) / Math.PI; if (ang > 90 || ang < -90) ang += 180;
  const mx = (a[0] + b[0]) / 2 + nx * 6, my = (a[1] + b[1]) / 2 + ny * 6;
  const f = (x: [number, number]) => `${r1(x[0])},${r1(x[1])}`;
  return { linea: `${f(a)} ${f(b)}`, estensioni: [`${f(p)} ${r1(a[0] + nx * 4)},${r1(a[1] + ny * 4)}`, `${f(q)} ${r1(b[0] + nx * 4)},${r1(b[1] + ny * 4)}`] as [string, string], tx: r1(mx), ty: r1(my), ang: r1(ang) };
}
/** Indice dei disegni 2D OBO copiati nell'app (public/obo-disegni/indice.json). */
export interface IndiceDisegniObo { base: string; codici: Record<string, string>; disegni: Record<string, { w: number; h: number }> }
/** Disegno OBO del blocco (se scelto e disponibile): file, larghezza e altezza in unità di disegno. */
export function disegnoObo(b: BloccoTip, ind?: IndiceDisegniObo | null): { href: string; w: number; h: number } | null {
  if (b.vista !== "obo" || !ind || !b.codiceOBO) return null;
  const file = ind.codici[b.codiceOBO.trim()], dim = file ? ind.disegni[file] : undefined;
  if (!file || !dim || !dim.w) return null;
  const w = b.larghezzaObo * b.scala; return { href: ind.base + file, w, h: (w * dim.h) / dim.w };
}
/** mezza larghezza e mezza altezza effettive del blocco (simbolo o disegno OBO) */
export function ingombro(b: BloccoTip, ind?: IndiceDisegniObo | null): [number, number] {
  const o = disegnoObo(b, ind); if (o) return [o.w / 2, o.h / 2];
  const m = SIMBOLI[b.tipo].mezzo; return [m[0] * b.scala, m[1] * b.scala];
}
/** markup del blocco: disegno OBO (immagine) o simbolo vettoriale */
export function markupBlocco(b: BloccoTip, ind?: IndiceDisegniObo | null): string {
  const o = disegnoObo(b, ind);
  if (o) return `<g transform="translate(${r1(b.x)} ${r1(b.y)}) rotate(${b.rot})"><image href="${esc(o.href)}" x="${r1(-o.w / 2)}" y="${r1(-o.h / 2)}" width="${r1(o.w)}" height="${r1(o.h)}" preserveAspectRatio="xMidYMid meet" style="mix-blend-mode:multiply"/></g>`;
  return `<g transform="${trasformazione(b)}" color="${STRUTTURA.has(b.tipo) ? "#41525D" : "#282A31"}">${SIMBOLI[b.tipo].forme}</g>`;
}
/** conduttore disegnato come tondo o piatto metallico (contorno scuro, corpo metallico, riflesso) */
export function markupConduttore(pts: string, tipo: "conduttore" | "piatto" | "linea"): string {
  if (tipo === "linea") return `<polyline points="${pts}" fill="none" stroke="#41525D" stroke-width="1" stroke-dasharray="6 4"/>`;
  const w = tipo === "piatto" ? 9 : 7;
  return `<polyline points="${pts}" fill="none" stroke="#3A3F45" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pts}" fill="none" stroke="#AEB6BD" stroke-width="${w - 2.6}" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pts}" fill="none" stroke="#E8ECEF" stroke-width="${tipo === "piatto" ? 1.2 : 1.6}" stroke-linejoin="round" stroke-linecap="round" transform="translate(-0.8 -1.2)"/>`;
}
export const trasformazione = (b: BloccoTip) => `translate(${r1(b.x)} ${r1(b.y)}) rotate(${b.rot}) scale(${b.scala})`;
const r1 = (v: number) => Math.round(v * 10) / 10;

// ------------------------------------------------------------------ componenti e richiami
export interface ComponenteTip { codiceOBO: string | null; descrizione: string; quantita: number; unitaQuantita: UnitaQuantita; posizione: number }

const descrBlocco = (b: BloccoTip) => b.descrizione.trim() || SIMBOLI[b.tipo].nome;
const descrColl = (c: CollegamentoTip) => c.descrizione.trim() || (c.tipo === "piatto" ? "Conduttore piatto" : "Conduttore tondo");

/**
 * Componenti del tipologico: blocchi OBO e conduttori con codice o descrizione, raggruppati per codice + descrizione + unità
 * (le quantità si sommano). Ogni gruppo ha il numero di richiamo (posizione) nell'ordine di comparsa.
 */
export function componentiTipologico(d: DisegnoTip): { componenti: ComponenteTip[]; richiami: Map<string, number> } {
  const gruppi = new Map<string, ComponenteTip>(), richiami = new Map<string, number>();
  const aggiungi = (id: string, codice: string, descr: string, q: number, u: UnitaQuantita) => {
    const k = `${codice.trim() || "—"}|${codice.trim() ? "" : descr}|${u}`;
    let g = gruppi.get(k);
    if (!g) { g = { codiceOBO: codice.trim() || null, descrizione: descr, quantita: 0, unitaQuantita: u, posizione: gruppi.size + 1 }; gruppi.set(k, g); }
    g.quantita = Math.round((g.quantita + q) * 1000) / 1000; richiami.set(id, g.posizione);
  };
  for (const b of d.blocchi) if (!STRUTTURA.has(b.tipo) || b.codiceOBO.trim()) aggiungi(b.id, b.codiceOBO, descrBlocco(b), b.quantita, b.unita);
  for (const c of d.collegamenti) if ((c.tipo === "conduttore" || c.tipo === "piatto") && (c.codiceOBO.trim() || c.descrizione.trim())) aggiungi(c.id, c.codiceOBO, descrColl(c), c.quantita, c.unita);
  return { componenti: [...gruppi.values()], richiami };
}

/** Tipo di blocco suggerito per un componente del catalogo (dalla descrizione). */
export function tipoDaDescrizione(descrizione: string): TipoBlocco {
  const d = descrizione.toLowerCase();
  if (/treppiede|stativ/.test(d) && !/\basta\b/.test(d)) return "treppiede";
  if (/blocco cls|basamento|fangfix|f-fix/.test(d)) return "blocco-cls";
  if (/fungo/.test(d)) return "punta";
  if (/colmo/.test(d)) return "supporto-colmo";
  if (/parete|muro|facciata/.test(d)) return "supporto-parete";
  if (/collettore|equipotenzial/.test(d)) return "collettore";
  if (/tubo|guaina/.test(d)) return "tubo";
  const r = ruoloDi(descrizione);
  const PER_RUOLO: Partial<Record<Ruolo, TipoBlocco>> = { asta: "asta", supporto: "supporto-piano", connettore: "morsetto", compensatore: "compensatore", picchetto: "picchetto", punta: "picchetto", sezionamento: "giunto", targhetta: "targhetta" };
  return PER_RUOLO[r] ?? "morsetto";
}

/** Disegno di partenza da un particolare esistente: un blocco per componente, in fila, collegati in sequenza. */
export function disegnoDaComponenti(componenti: { codiceOBO: string | null; descrizione: string; quantita: number; unitaQuantita: string }[]): DisegnoTip {
  const d = disegnoVuoto();
  const conduttori = componenti.filter((c) => ruoloDi(c.descrizione) === "conduttore");
  const altri = componenti.filter((c) => ruoloDi(c.descrizione) !== "conduttore");
  const n = altri.length, sc = n <= 2 ? 1.5 : n <= 4 ? 1.25 : 1;
  const passo = n > 1 ? Math.min(220, (d.larghezza - 160) / (n - 1)) : 0, x0 = d.larghezza / 2 - (passo * (n - 1)) / 2;
  d.blocchi.push({ id: "s1", tipo: "copertura", x: d.larghezza / 2, y: 430, rot: 0, scala: Math.max(1, (d.larghezza - 60) / 300), codiceOBO: "", descrizione: "", quantita: 1, unita: "fisso", vista: "simbolo", larghezzaObo: 140 });
  const tetto = 430 - 18 * Math.max(1, (d.larghezza - 60) / 300);
  altri.forEach((c, i) => {
    const tipo = tipoDaDescrizione(c.descrizione), m = SIMBOLI[tipo].mezzo[1] * sc;
    const unita = (UNITA_QUANTITA as readonly string[]).includes(c.unitaQuantita) ? (c.unitaQuantita as UnitaQuantita) : SIMBOLI[tipo].unita;
    d.blocchi.push({ id: `b${i + 1}`, tipo, x: x0 + i * passo, y: tetto - m, rot: 0, scala: sc, codiceOBO: c.codiceOBO ?? "", descrizione: c.descrizione, quantita: c.quantita, unita, vista: "simbolo", larghezzaObo: 140 });
  });
  const cond = conduttori[0];
  for (let i = 1; i < altri.length; i++) d.collegamenti.push({ id: `k${i}`, da: `b${i}`, a: `b${i + 1}`, tipo: "conduttore", ortogonale: false, codiceOBO: i === 1 && cond ? cond.codiceOBO ?? "" : "", descrizione: i === 1 && cond ? cond.descrizione : "", quantita: i === 1 && cond ? cond.quantita : 0, unita: i === 1 && cond && (UNITA_QUANTITA as readonly string[]).includes(cond.unitaQuantita) ? (cond.unitaQuantita as UnitaQuantita) : "per_m", testo: "" });
  if (cond && altri.length < 2) d.testi.push({ id: "t1", x: 40, y: 40, t: `Conduttore: ${cond.descrizione}`, dim: 12 });
  return d;
}

// ------------------------------------------------------------------ SVG finale (relazione, scheda, anteprima)
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ARANCIO = "#F39B00", SCURO = "#282A31", MEDIO = "#41525D", CHIARO = "#E4EBED";

/** SVG del tipologico con richiami e, se `legenda`, tabella dei componenti sotto il disegno. */
export function svgTipologico(d: DisegnoTip, opz: { titolo?: string; legenda?: boolean; obo?: IndiceDisegniObo | null } = {}): string {
  const { componenti, richiami } = componentiTipologico(d);
  const W = d.larghezza, H = d.altezza;
  const righeLeg = opz.legenda ? componenti.length : 0;
  const hTit = opz.titolo ? 34 : 0, hLeg = righeLeg ? 28 + righeLeg * 20 + 8 : 0;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + hTit + hLeg}" viewBox="0 ${-hTit} ${W} ${H + hTit + hLeg}" font-family="NimbusSanL-Reg, Nimbus Sans L, Arial, sans-serif">`);
  out.push(`<rect x="0" y="${-hTit}" width="${W}" height="${H + hTit + hLeg}" fill="#fff"/>`);
  if (opz.titolo) out.push(`<rect x="0" y="${-hTit}" width="${W}" height="${hTit - 4}" fill="${SCURO}"/><rect x="0" y="-4" width="${W}" height="3" fill="${ARANCIO}"/><text x="12" y="${-hTit + 21}" font-size="15" font-weight="bold" fill="#fff">${esc(opz.titolo)}</text>`);
  for (const c of d.collegamenti) {
    const pts = percorso(c, d.blocchi, opz.obo); if (!pts) continue;
    const s = pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(" ");
    if (c.tipo === "quota") {
      const q2 = quota(pts[0]!, pts[pts.length - 1]!);
      out.push(`<g color="${MEDIO}"><polyline points="${q2.estensioni[0]}" fill="none" stroke="currentColor" stroke-width="0.8"/><polyline points="${q2.estensioni[1]}" fill="none" stroke="currentColor" stroke-width="0.8"/><polyline points="${q2.linea}" fill="none" stroke="currentColor" stroke-width="1" marker-start="url(#fr)" marker-end="url(#fr)"/><text x="${q2.tx}" y="${q2.ty}" font-size="12" text-anchor="middle" fill="currentColor" transform="rotate(${q2.ang} ${q2.tx} ${q2.ty})">${esc(c.testo || "")}</text></g>`);
    } else out.push(markupConduttore(s, c.tipo));
  }
  // prima la struttura, poi i componenti
  for (const b of [...d.blocchi.filter((x) => STRUTTURA.has(x.tipo)), ...d.blocchi.filter((x) => !STRUTTURA.has(x.tipo))]) out.push(markupBlocco(b, opz.obo));
  for (const t of d.testi) out.push(`<text x="${r1(t.x)}" y="${r1(t.y)}" font-size="${t.dim}" fill="${SCURO}">${esc(t.t)}</text>`);
  // richiami: pallino arancio con numero, linea di richiamo verso il blocco (una volta per numero e per elemento)
  for (const b of d.blocchi) { const n = richiami.get(b.id); if (n) { const [mx, my] = ingombro(b, opz.obo); out.push(richiamo(b.x + mx + 18, b.y - my * 0.5 - 14, b.x + mx * 0.6, b.y - my * 0.3, n)); } }
  for (const c of d.collegamenti) { const n = richiami.get(c.id); const pts = percorso(c, d.blocchi, opz.obo); if (n && pts) { const [p, q] = [pts[0]!, pts[1]!]; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; out.push(richiamo(mx + 22, my - 26, mx, my, n)); } }
  if (righeLeg) {
    let y = H + 10;
    out.push(`<rect x="10" y="${y}" width="${W - 20}" height="22" fill="${MEDIO}"/><text x="18" y="${y + 15}" font-size="12" font-weight="bold" fill="#fff">Pos.</text><text x="62" y="${y + 15}" font-size="12" font-weight="bold" fill="#fff">Codice OBO</text><text x="160" y="${y + 15}" font-size="12" font-weight="bold" fill="#fff">Descrizione</text><text x="${W - 18}" y="${y + 15}" font-size="12" font-weight="bold" fill="#fff" text-anchor="end">Quantità</text>`);
    y += 22;
    componenti.forEach((c, i) => {
      if (i % 2) out.push(`<rect x="10" y="${y}" width="${W - 20}" height="20" fill="${CHIARO}"/>`);
      out.push(`<circle cx="26" cy="${y + 10}" r="8" fill="${ARANCIO}"/><text x="26" y="${y + 14}" font-size="10" font-weight="bold" fill="#fff" text-anchor="middle">${c.posizione}</text><text x="62" y="${y + 14}" font-size="11" fill="${SCURO}">${esc(c.codiceOBO ?? "—")}</text><text x="160" y="${y + 14}" font-size="11" fill="${SCURO}">${esc(c.descrizione.slice(0, Math.max(20, Math.floor((W - 330) / 6))))}</text><text x="${W - 18}" y="${y + 14}" font-size="11" fill="${SCURO}" text-anchor="end">${String(c.quantita).replace(".", ",")} ${esc(NOMI_UNITA[c.unitaQuantita])}</text>`);
      y += 20;
    });
  }
  out.push(`<defs><marker id="fr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,2 L10,5 L0,8 z" fill="${MEDIO}"/></marker></defs></svg>`);
  return out.join("");
}
function richiamo(x: number, y: number, ax: number, ay: number, n: number): string {
  return `<line x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(x)}" y2="${r1(y)}" stroke="${ARANCIO}" stroke-width="1.2"/><circle cx="${r1(x)}" cy="${r1(y)}" r="10" fill="${ARANCIO}"/><text x="${r1(x)}" y="${r1(y + 4)}" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">${n}</text>`;
}
