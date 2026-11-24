/**
 * Scrittore DXF R12 (AC1009): il formato che AutoCAD, ZWCAD, BricsCAD e DraftSight aprono senza problemi.
 * Supporta layer con colore e tipo linea, stili di testo, blocchi con attributi (ATTDEF/ATTRIB),
 * polilinee 2D e 3D, cerchi, testi allineati, solidi e facce 3D. Logica pura, nessuna dipendenza.
 */
import { TIPI_LINEA, type LayerLps, type Primitiva } from "./standard";

export type P2 = [number, number];
export type P3 = [number, number, number];

/** Testo DXF sicuro (ASCII): accenti all'italiana (e'), gradi e simboli comuni convertiti. */
export function testoDxf(v: unknown): string {
  return String(v ?? "")
    .replace(/[àáâä]/g, "a'").replace(/[ÀÁÂÄ]/g, "A'").replace(/[èéêë]/g, "e'").replace(/[ÈÉÊË]/g, "E'")
    .replace(/[ìíîï]/g, "i'").replace(/[ÌÍÎÏ]/g, "I'").replace(/[òóôö]/g, "o'").replace(/[ÒÓÔÖ]/g, "O'")
    .replace(/[ùúûü]/g, "u'").replace(/[ÙÚÛÜ]/g, "U'")
    .replace(/°/g, "%%d").replace(/[×]/g, "x").replace(/[–—]/g, "-").replace(/[²]/g, "2").replace(/[³]/g, "3").replace(/[Ø⌀]/g, "%%c")
    .replace(/[“”«»]/g, "\"").replace(/[‘’]/g, "'")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e]/g, "?");
}

const n = (v: number) => (Number.isFinite(v) ? (Math.abs(v) < 1e-9 ? "0" : Number(v.toFixed(6)).toString()) : "0");

export interface Attributo { tag: string; valore: string; visibile?: boolean; altezza?: number; pos?: P2 }

interface Blocco { nome: string; righe: string[] }

/** Entità 2D registrate nello spazio modello (servono a disegnare il PDF vettoriale delle tavole). */
export type Disegnato =
  | { t: "linea"; layer: string; a: P2; b: P2 }
  | { t: "poli"; layer: string; p: P2[]; chiusa: boolean }
  | { t: "cerchio"; layer: string; c: P2; r: number }
  | { t: "arco"; layer: string; c: P2; r: number; da: number; a: number }
  | { t: "pieno"; layer: string; p: P2[] }
  | { t: "testo"; layer: string; p: P2; h: number; s: string; all: Allineamento; rot: number }
  | { t: "insert"; layer: string; nome: string; p: P2; scala: number; rot: number; attributi: Attributo[] };

export type Allineamento = "sinistra" | "centro" | "destra" | "centro-medio" | "sinistra-medio";

export class ScrittoreDXF {
  private entita: string[] = [];
  private blocchi = new Map<string, Blocco>();
  private layer = new Map<string, LayerLps>();
  private min: P2 = [Infinity, Infinity];
  private max: P2 = [-Infinity, -Infinity];
  /** fattore dei tipi linea ($LTSCALE): scala della tavola / 100 */
  ltscale = 1;
  /** entità 2D dello spazio modello, nell'ordine in cui sono state scritte */
  readonly disegnati: Disegnato[] = [];
  /** primitive e attributi di ogni blocco (per il PDF) */
  readonly definizioni = new Map<string, { primitive: Primitiva[]; attributi: Attributo[] }>();
  /** blocchi definiti fuori da definisciBlocco (archi) */

  constructor(layer: LayerLps[] = []) { layer.forEach((l) => this.aggiungiLayer(l)); }

  aggiungiLayer(l: LayerLps) { if (!this.layer.has(l.nome)) this.layer.set(l.nome, l); }
  haBlocco(nome: string) { return this.blocchi.has(nome); }

  private estendi(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.min = [Math.min(this.min[0], x), Math.min(this.min[1], y)];
    this.max = [Math.max(this.max[0], x), Math.max(this.max[1], y)];
  }
  private push(dest: string[], ...coppie: (string | number)[]) {
    for (let i = 0; i < coppie.length; i += 2) dest.push(String(coppie[i]), typeof coppie[i + 1] === "number" ? n(coppie[i + 1] as number) : String(coppie[i + 1]));
  }
  private dest(blocco?: string): string[] {
    if (!blocco) return this.entita;
    const b = this.blocchi.get(blocco); if (!b) throw new Error(`Blocco ${blocco} non definito`);
    return b.righe;
  }

  // ---------------- entità (nello spazio modello o in un blocco)
  linea(layer: string, a: P3 | P2, b: P3 | P2, blocco?: string) {
    const d = this.dest(blocco);
    this.push(d, 0, "LINE", 8, layer, 10, a[0], 20, a[1], 30, a[2] ?? 0, 11, b[0], 21, b[1], 31, b[2] ?? 0);
    if (!blocco) { this.estendi(a[0], a[1]); this.estendi(b[0], b[1]); if ((a[2] ?? 0) === 0 && (b[2] ?? 0) === 0) this.disegnati.push({ t: "linea", layer, a: [a[0], a[1]], b: [b[0], b[1]] }); }
  }
  cerchio(layer: string, c: P2, r: number, blocco?: string) {
    const d = this.dest(blocco);
    this.push(d, 0, "CIRCLE", 8, layer, 10, c[0], 20, c[1], 30, 0, 40, r);
    if (!blocco) { this.estendi(c[0] - r, c[1] - r); this.estendi(c[0] + r, c[1] + r); this.disegnati.push({ t: "cerchio", layer, c, r }); }
  }
  /** Arco (gradi, senso antiorario da `da` ad `a`). */
  arco(layer: string, c: P2, r: number, da: number, a: number) {
    this.push(this.entita, 0, "ARC", 8, layer, 10, c[0], 20, c[1], 30, 0, 40, r, 50, da, 51, a);
    this.estendi(c[0] - r, c[1] - r); this.estendi(c[0] + r, c[1] + r);
    this.disegnati.push({ t: "arco", layer, c, r, da, a });
  }
  /** Polilinea 2D (R12 POLYLINE), eventualmente chiusa, a quota costante. */
  poli(layer: string, punti: P2[], chiusa: boolean, blocco?: string, quota = 0) {
    if (punti.length < 2) return;
    const d = this.dest(blocco);
    this.push(d, 0, "POLYLINE", 8, layer, 66, 1, 10, 0, 20, 0, 30, quota, 70, chiusa ? 1 : 0);
    for (const p of punti) { this.push(d, 0, "VERTEX", 8, layer, 10, p[0], 20, p[1], 30, quota); if (!blocco) this.estendi(p[0], p[1]); }
    this.push(d, 0, "SEQEND", 8, layer);
    if (!blocco && quota === 0) this.disegnati.push({ t: "poli", layer, p: punti.map((q) => [q[0], q[1]] as P2), chiusa });
  }
  /** Polilinea 3D. */
  poli3d(layer: string, punti: P3[], chiusa = false) {
    if (punti.length < 2) return;
    this.push(this.entita, 0, "POLYLINE", 8, layer, 66, 1, 10, 0, 20, 0, 30, 0, 70, 8 | (chiusa ? 1 : 0));
    for (const p of punti) { this.push(this.entita, 0, "VERTEX", 8, layer, 10, p[0], 20, p[1], 30, p[2], 70, 32); this.estendi(p[0], p[1]); }
    this.push(this.entita, 0, "SEQEND", 8, layer);
  }
  faccia(layer: string, a: P3, b: P3, c: P3, d: P3) {
    this.push(this.entita, 0, "3DFACE", 8, layer, 10, a[0], 20, a[1], 30, a[2], 11, b[0], 21, b[1], 31, b[2], 12, c[0], 22, c[1], 32, c[2], 13, d[0], 23, d[1], 33, d[2]);
    [a, b, c, d].forEach((p) => this.estendi(p[0], p[1]));
  }
  /** Solido pieno (triangolo o quadrilatero). */
  pieno(layer: string, p: P2[], blocco?: string) {
    const v = [p[0], p[1], p[3] ?? p[2], p[2]] as P2[]; // ordine SOLID: 1,2,4,3
    const d = this.dest(blocco);
    this.push(d, 0, "SOLID", 8, layer, 10, v[0]![0], 20, v[0]![1], 30, 0, 11, v[1]![0], 21, v[1]![1], 31, 0, 12, v[2]![0], 22, v[2]![1], 32, 0, 13, v[3]![0], 23, v[3]![1], 33, 0);
    if (!blocco) { p.forEach((q) => this.estendi(q[0], q[1])); this.disegnati.push({ t: "pieno", layer, p: p.map((q) => [q[0], q[1]] as P2) }); }
  }
  testo(layer: string, p: P2, h: number, s: string, all: Allineamento = "sinistra", rot = 0, blocco?: string) {
    const d = this.dest(blocco);
    const [h72, v73] = all === "centro" ? [1, 0] : all === "destra" ? [2, 0] : all === "centro-medio" ? [1, 2] : all === "sinistra-medio" ? [0, 2] : [0, 0];
    this.push(d, 0, "TEXT", 8, layer, 10, p[0], 20, p[1], 30, 0, 40, h, 1, testoDxf(s), 50, rot, 7, "LPS");
    if (h72 || v73) this.push(d, 72, h72, 11, p[0], 21, p[1], 31, 0, 73, v73);
    if (!blocco) { this.estendi(p[0], p[1]); this.estendi(p[0] + testoDxf(s).length * h * 0.6, p[1] + h); this.disegnati.push({ t: "testo", layer, p, h, s, all, rot }); }
  }

  // ---------------- blocchi
  /** Definisce un blocco da primitive (simboli in metri a 1:100) con eventuali attributi. */
  definisciBlocco(nome: string, primitive: Primitiva[], attributi: Attributo[] = [], descrizione = "") {
    if (this.blocchi.has(nome)) return;
    const b: Blocco = { nome, righe: [] };
    this.blocchi.set(nome, b);
    this.definizioni.set(nome, { primitive, attributi });
    for (const p of primitive) {
      if (p.t === "cerchio") this.cerchio("0", p.c, p.r, nome);
      else if (p.t === "linea") this.linea("0", p.a, p.b, nome);
      else if (p.t === "poli") this.poli("0", p.p, p.chiusa, nome);
      else this.pieno("0", p.p, nome);
    }
    for (const a of attributi) {
      const pos = a.pos ?? [0, 0];
      this.push(b.righe, 0, "ATTDEF", 8, "0", 10, pos[0], 20, pos[1], 30, 0, 40, a.altezza ?? 0.25, 1, testoDxf(a.valore), 3, testoDxf(a.tag), 2, a.tag, 70, a.visibile ? 0 : 1, 7, "LPS");
      if (a.visibile) this.push(b.righe, 72, 1, 11, pos[0], 21, pos[1], 31, 0, 74, 2);
    }
    void descrizione;
  }
  /** Inserisce un blocco con i valori degli attributi (stesso ordine/tag della definizione). */
  inserisci(layer: string, nome: string, p: P2 | P3, scala = 1, rot = 0, attributi: Attributo[] = []) {
    const z = p[2] ?? 0;
    this.push(this.entita, 0, "INSERT", 8, layer, ...(attributi.length ? [66, 1] : []), 2, nome, 10, p[0], 20, p[1], 30, z, 41, scala, 42, scala, 43, scala, 50, rot);
    const r = (rot * Math.PI) / 180;
    for (const a of attributi) {
      const q = a.pos ?? [0, 0];
      const x = p[0] + (q[0] * Math.cos(r) - q[1] * Math.sin(r)) * scala, y = p[1] + (q[0] * Math.sin(r) + q[1] * Math.cos(r)) * scala;
      this.push(this.entita, 0, "ATTRIB", 8, layer, 10, x, 20, y, 30, z, 40, (a.altezza ?? 0.25) * scala, 1, testoDxf(a.valore), 2, a.tag, 70, a.visibile ? 0 : 1, 50, rot, 7, "LPS");
      if (a.visibile) this.push(this.entita, 72, 1, 11, x, 21, y, 31, z, 74, 2);
    }
    if (attributi.length) this.push(this.entita, 0, "SEQEND", 8, layer);
    this.estendi(p[0], p[1]);
    this.disegnati.push({ t: "insert", layer, nome, p: [p[0], p[1]], scala, rot, attributi });
  }

  // ---------------- file finale
  finale(): string {
    const r: string[] = [];
    const w = (...c: (string | number)[]) => this.push(r, ...c);
    const ext = Number.isFinite(this.min[0]) ? { min: this.min, max: this.max } : { min: [0, 0] as P2, max: [10, 10] as P2 };
    w(0, "SECTION", 2, "HEADER", 9, "$ACADVER", 1, "AC1009", 9, "$DWGCODEPAGE", 3, "ANSI_1252", 9, "$INSBASE", 10, 0, 20, 0, 30, 0,
      9, "$EXTMIN", 10, ext.min[0], 20, ext.min[1], 30, 0, 9, "$EXTMAX", 10, ext.max[0], 20, ext.max[1], 30, 0,
      9, "$LIMMIN", 10, ext.min[0], 20, ext.min[1], 9, "$LIMMAX", 10, ext.max[0], 20, ext.max[1],
      9, "$LTSCALE", 40, this.ltscale, 9, "$INSUNITS", 70, 6, 9, "$MEASUREMENT", 70, 1, 9, "$TEXTSTYLE", 7, "LPS", 9, "$CLAYER", 8, "0", 0, "ENDSEC");
    w(0, "SECTION", 2, "TABLES");
    const tipi = Object.entries(TIPI_LINEA);
    w(0, "TABLE", 2, "LTYPE", 70, tipi.length + 1);
    w(0, "LTYPE", 2, "CONTINUOUS", 70, 0, 3, "Solid line", 72, 65, 73, 0, 40, 0);
    for (const [nome, t] of tipi) {
      w(0, "LTYPE", 2, nome, 70, 0, 3, t.descrizione, 72, 65, 73, t.schema.length, 40, t.schema.reduce((s, v) => s + Math.abs(v), 0));
      t.schema.forEach((v) => w(49, v));
    }
    w(0, "ENDTAB");
    const layer = [...this.layer.values()];
    w(0, "TABLE", 2, "LAYER", 70, layer.length + 1);
    w(0, "LAYER", 2, "0", 70, 0, 62, 7, 6, "CONTINUOUS");
    for (const l of layer) w(0, "LAYER", 2, l.nome, 70, 0, 62, l.colore, 6, l.linea);
    w(0, "ENDTAB");
    w(0, "TABLE", 2, "STYLE", 70, 2,
      0, "STYLE", 2, "STANDARD", 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 0.25, 3, "txt", 4, "",
      0, "STYLE", 2, "LPS", 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 0.25, 3, "arial.ttf", 4, "", 0, "ENDTAB");
    w(0, "ENDSEC");
    w(0, "SECTION", 2, "BLOCKS");
    for (const b of this.blocchi.values()) {
      const conAttributi = b.righe.includes("ATTDEF");
      w(0, "BLOCK", 8, "0", 2, b.nome, 70, conAttributi ? 2 : 0, 10, 0, 20, 0, 30, 0, 3, b.nome);
      for (const x of b.righe) r.push(x);
      w(0, "ENDBLK", 8, "0");
    }
    w(0, "ENDSEC");
    w(0, "SECTION", 2, "ENTITIES");
    for (const x of this.entita) r.push(x);
    w(0, "ENDSEC", 0, "EOF");
    return r.join("\r\n") + "\r\n";
  }
}
