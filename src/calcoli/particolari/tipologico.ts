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

export const SIMBOLI: Record<TipoBlocco, Simbolo> = {
  asta: { nome: "Asta di captazione", categoria: "Captazione", unita: "per_asta", ruolo: "asta", mezzo: [8, 90], porte: [[0, -90], [0, 40], [0, 90]],
    forme: L("0,-90 0,90", 4) + L("-4,-82 0,-92 4,-82", 2) + R(-6, 70, 12, 20) },
  treppiede: { nome: "Treppiede con blocchi", categoria: "Captazione", unita: "per_asta", ruolo: "accessorio", mezzo: [60, 40], porte: [[0, -40], [0, 0]],
    forme: L("0,-40 -50,30", 3) + L("0,-40 50,30", 3) + L("0,-40 0,30", 3) + R(-60, 30, 30, 10, "currentColor") + R(30, 30, 30, 10, "currentColor") + R(-15, 30, 30, 10, "currentColor") },
  punta: { nome: "Punta / captatore a fungo", categoria: "Captazione", unita: "per_punta", ruolo: "asta", mezzo: [14, 24], porte: [[0, 24], [0, -24]],
    forme: L("0,-24 0,24", 3) + `<path d="M-12,-8 Q0,-30 12,-8 Z" fill="none" stroke="currentColor" stroke-width="2"/>` },
  "supporto-piano": { nome: "Supporto conduttore tetto piano", categoria: "Collegamenti", unita: "per_m", ruolo: "supporto", mezzo: [28, 18], porte: [[0, -14], [-28, -14], [28, -14]],
    forme: `<path d="M-28,18 L-18,-2 L18,-2 L28,18 Z" fill="none" stroke="currentColor" stroke-width="2"/>` + R(-6, -16, 12, 14) + C(0, -14, 4) },
  "supporto-parete": { nome: "Supporto conduttore a parete", categoria: "Collegamenti", unita: "per_m", ruolo: "supporto", mezzo: [20, 14], porte: [[18, 0], [18, -14], [18, 14]],
    forme: R(-20, -14, 6, 28, "currentColor") + L("-14,0 12,0", 3) + C(16, 0, 5) },
  "supporto-colmo": { nome: "Supporto conduttore per colmo", categoria: "Collegamenti", unita: "per_m", ruolo: "supporto", mezzo: [24, 18], porte: [[0, -16], [-24, -16], [24, -16]],
    forme: L("-24,18 0,0 24,18", 3) + L("0,0 0,-12", 3) + C(0, -16, 4) },
  morsetto: { nome: "Morsetto / connettore", categoria: "Collegamenti", unita: "per_punto", ruolo: "connettore", mezzo: [12, 12], porte: [[0, 0], [-12, 0], [12, 0], [0, -12], [0, 12]],
    forme: R(-12, -12, 24, 24) + L("-12,-12 12,12", 1.5) + L("-12,12 12,-12", 1.5) },
  giunto: { nome: "Giunto di sezionamento", categoria: "Collegamenti", unita: "per_calata", ruolo: "sezionamento", mezzo: [14, 22], porte: [[0, -22], [0, 22]],
    forme: R(-14, -14, 28, 28) + L("0,-22 0,-6", 3) + L("0,6 0,22", 3) + C(0, -6, 3, "currentColor") + C(0, 6, 3, "currentColor") },
  compensatore: { nome: "Compensatore di dilatazione", categoria: "Collegamenti", unita: "per_compensatore", ruolo: "compensatore", mezzo: [30, 18], porte: [[-30, 0], [30, 0]],
    forme: `<path d="M-30,0 L-14,0 C-14,-24 14,-24 14,0 L30,0" fill="none" stroke="currentColor" stroke-width="3"/>` },
  picchetto: { nome: "Picchetto / dispersore", categoria: "Terra", unita: "per_picchetto", ruolo: "picchetto", mezzo: [8, 70], porte: [[0, -70], [0, -60]],
    forme: L("0,-70 0,62", 4) + L("-5,62 0,72 5,62", 2) + R(-8, -66, 16, 10) },
  collettore: { nome: "Collettore equipotenziale", categoria: "Terra", unita: "fisso", ruolo: "connettore", mezzo: [50, 12], porte: [[-40, 12], [-20, 12], [0, 12], [20, 12], [40, 12]],
    forme: R(-50, -8, 100, 16) + [-40, -20, 0, 20, 40].map((x) => C(x, 0, 3, "currentColor")).join("") },
  targhetta: { nome: "Targhetta di identificazione", categoria: "Accessori", unita: "per_calata", ruolo: "targhetta", mezzo: [18, 12], porte: [[0, 12]],
    forme: R(-18, -12, 36, 24) + `<text x="0" y="5" font-size="12" text-anchor="middle" fill="currentColor" font-family="Arial">C1</text>` },
  tubo: { nome: "Tubo di protezione calata", categoria: "Accessori", unita: "per_calata", ruolo: "accessorio", mezzo: [8, 50], porte: [[0, -50], [0, 50]],
    forme: R(-8, -50, 16, 100) + L("0,-50 0,50", 1) },
  putrella: { nome: "Putrella / profilo metallico", categoria: "Struttura", unita: "fisso", mezzo: [30, 40], porte: [[0, -40], [-30, -40], [30, -40], [0, 40]],
    forme: `<path d="M-30,-40 H30 V-32 H5 V32 H30 V40 H-30 V32 H-5 V-32 H-30 Z" fill="none" stroke="currentColor" stroke-width="2"/>` },
  parapetto: { nome: "Parapetto / ringhiera", categoria: "Struttura", unita: "fisso", mezzo: [60, 50], porte: [[-60, -50], [0, -50], [60, -50]],
    forme: L("-60,-50 60,-50", 4) + [-60, -20, 20, 60].map((x) => L(`${x},-50 ${x},50`, 2)).join("") + L("-60,0 60,0", 1.5) },
  copertura: { nome: "Copertura piana (solaio)", categoria: "Struttura", unita: "fisso", mezzo: [150, 15], porte: [[-150, -15], [-75, -15], [0, -15], [75, -15], [150, -15]],
    forme: R(-150, -15, 300, 30) + tratteggio(-150, -15, 300, 30) },
  parete: { nome: "Parete / muratura", categoria: "Struttura", unita: "fisso", mezzo: [15, 120], porte: [[15, -120], [15, -60], [15, 0], [15, 60], [15, 120]],
    forme: R(-15, -120, 30, 240) + tratteggio(-15, -120, 30, 240) },
  terreno: { nome: "Terreno", categoria: "Struttura", unita: "fisso", mezzo: [150, 10], porte: [[-150, -10], [-75, -10], [0, -10], [75, -10], [150, -10]],
    forme: L("-150,-10 150,-10", 3) + Array.from({ length: 20 }, (_, i) => L(`${-150 + i * 15},-10 ${-160 + i * 15},4`, 1)).join("") },
  "blocco-cls": { nome: "Blocco in calcestruzzo", categoria: "Accessori", unita: "per_asta", ruolo: "accessorio", mezzo: [30, 12], porte: [[0, -12]],
    forme: R(-30, -12, 60, 24, "none") + tratteggio(-30, -12, 60, 24, 8) },
  spd: { nome: "Limitatore di sovratensione (SPD)", categoria: "Accessori", unita: "fisso", ruolo: "accessorio", mezzo: [14, 24], porte: [[0, -24], [0, 24]],
    forme: R(-14, -18, 28, 36) + L("0,-24 0,-18", 2) + L("0,18 0,24", 2) + L("-6,-8 4,0 -4,0 6,8", 2) },
};
export const CATEGORIE_SIMBOLI = ["Captazione", "Collegamenti", "Terra", "Accessori", "Struttura"] as const;

// ------------------------------------------------------------------ geometria
const rad = (g: number) => (g * Math.PI) / 180;
/** posizione assoluta di una porta del blocco */
export function portaAssoluta(b: BloccoTip, i: number): [number, number] {
  const [px, py] = SIMBOLI[b.tipo].porte[i] ?? [0, 0];
  const c = Math.cos(rad(b.rot)), s = Math.sin(rad(b.rot)), k = b.scala;
  return [b.x + (px * c - py * s) * k, b.y + (px * s + py * c) * k];
}
/** coppia di porte più vicine tra due blocchi */
export function porteCollegamento(a: BloccoTip, b: BloccoTip): [[number, number], [number, number]] {
  let best: [[number, number], [number, number]] = [[a.x, a.y], [b.x, b.y]], dMin = Infinity;
  SIMBOLI[a.tipo].porte.forEach((_, i) => SIMBOLI[b.tipo].porte.forEach((__, j) => {
    const p = portaAssoluta(a, i), q = portaAssoluta(b, j), d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < dMin) { dMin = d; best = [p, q]; }
  }));
  return best;
}
/** percorso del collegamento: diretto o a L (prima orizzontale) */
export function percorso(c: CollegamentoTip, blocchi: BloccoTip[]): [number, number][] | null {
  const a = blocchi.find((b) => b.id === c.da), b = blocchi.find((x) => x.id === c.a);
  if (!a || !b) return null;
  const [p, q] = porteCollegamento(a, b);
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
  if (/treppiede|stativ/.test(d)) return "treppiede";
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
  const passo = Math.min(160, (d.larghezza - 120) / Math.max(1, altri.length - 1 || 1));
  d.blocchi.push({ id: "s1", tipo: "copertura", x: d.larghezza / 2, y: 400, rot: 0, scala: Math.max(1, (d.larghezza - 60) / 300), codiceOBO: "", descrizione: "", quantita: 1, unita: "fisso" });
  altri.forEach((c, i) => {
    const tipo = tipoDaDescrizione(c.descrizione), m = SIMBOLI[tipo].mezzo[1];
    const unita = (UNITA_QUANTITA as readonly string[]).includes(c.unitaQuantita) ? (c.unitaQuantita as UnitaQuantita) : SIMBOLI[tipo].unita;
    d.blocchi.push({ id: `b${i + 1}`, tipo, x: 60 + i * passo, y: 385 - m, rot: 0, scala: 1, codiceOBO: c.codiceOBO ?? "", descrizione: c.descrizione, quantita: c.quantita, unita });
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
export function svgTipologico(d: DisegnoTip, opz: { titolo?: string; legenda?: boolean } = {}): string {
  const { componenti, richiami } = componentiTipologico(d);
  const W = d.larghezza, H = d.altezza;
  const righeLeg = opz.legenda ? componenti.length : 0;
  const hTit = opz.titolo ? 34 : 0, hLeg = righeLeg ? 28 + righeLeg * 20 + 8 : 0;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + hTit + hLeg}" viewBox="0 ${-hTit} ${W} ${H + hTit + hLeg}" font-family="NimbusSanL-Reg, Nimbus Sans L, Arial, sans-serif">`);
  out.push(`<rect x="0" y="${-hTit}" width="${W}" height="${H + hTit + hLeg}" fill="#fff"/>`);
  if (opz.titolo) out.push(`<rect x="0" y="${-hTit}" width="${W}" height="${hTit - 4}" fill="${SCURO}"/><rect x="0" y="-4" width="${W}" height="3" fill="${ARANCIO}"/><text x="12" y="${-hTit + 21}" font-size="15" font-weight="bold" fill="#fff">${esc(opz.titolo)}</text>`);
  for (const c of d.collegamenti) {
    const pts = percorso(c, d.blocchi); if (!pts) continue;
    const s = pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(" ");
    if (c.tipo === "quota") {
      const q2 = quota(pts[0]!, pts[pts.length - 1]!);
      out.push(`<g color="${MEDIO}"><polyline points="${q2.estensioni[0]}" fill="none" stroke="currentColor" stroke-width="0.8"/><polyline points="${q2.estensioni[1]}" fill="none" stroke="currentColor" stroke-width="0.8"/><polyline points="${q2.linea}" fill="none" stroke="currentColor" stroke-width="1" marker-start="url(#fr)" marker-end="url(#fr)"/><text x="${q2.tx}" y="${q2.ty}" font-size="12" text-anchor="middle" fill="currentColor" transform="rotate(${q2.ang} ${q2.tx} ${q2.ty})">${esc(c.testo || "")}</text></g>`);
    } else out.push(`<polyline points="${s}" fill="none" stroke="${c.tipo === "linea" ? MEDIO : SCURO}" stroke-width="${c.tipo === "linea" ? 1 : c.tipo === "piatto" ? 6 : 4}" stroke-linejoin="round" stroke-linecap="round"${c.tipo === "linea" ? ' stroke-dasharray="6 4"' : ""}/>`);
  }
  for (const b of d.blocchi) out.push(`<g transform="${trasformazione(b)}" color="${STRUTTURA.has(b.tipo) ? MEDIO : SCURO}">${SIMBOLI[b.tipo].forme}</g>`);
  for (const t of d.testi) out.push(`<text x="${r1(t.x)}" y="${r1(t.y)}" font-size="${t.dim}" fill="${SCURO}">${esc(t.t)}</text>`);
  // richiami: pallino arancio con numero, linea di richiamo verso il blocco (una volta per numero e per elemento)
  for (const b of d.blocchi) { const n = richiami.get(b.id); if (n) out.push(richiamo(b.x + SIMBOLI[b.tipo].mezzo[0] * b.scala + 18, b.y - SIMBOLI[b.tipo].mezzo[1] * b.scala * 0.5 - 14, b.x + SIMBOLI[b.tipo].mezzo[0] * b.scala * 0.6, b.y - SIMBOLI[b.tipo].mezzo[1] * b.scala * 0.3, n)); }
  for (const c of d.collegamenti) { const n = richiami.get(c.id); const pts = percorso(c, d.blocchi); if (n && pts) { const [p, q] = [pts[0]!, pts[1]!]; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; out.push(richiamo(mx + 22, my - 26, mx, my, n)); } }
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
