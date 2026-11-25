/**
 * Esportazione verso ZWCAD / AutoCAD: file "progetto.lpsdati" letto dal comando LPS-IMPORTA di LPS.lsp.
 *
 * Formato: un record LISP per riga, letto dal CAD con la funzione nativa (read).
 * Coordinate in metri (il LISP converte nelle unità del disegno). Testi solo ASCII
 * (accenti tolti), così ZWCAD e AutoCAD li leggono uguali qualunque sia la codifica.
 *
 *   (LPSDATI 1)
 *   (LSP "3.6")   versione di LPS.lsp con cui è stato scritto il file: LPS.lsp 3.6+ avvisa se quella caricata è più vecchia
 *   (PROGETTO "codice" "nome" "comune" "LPL" raggio "rev" "data" "committente" "progettista" "indirizzo" "file")
 *   (CORPO "id" "nome" quotaBase altezzaGronda "piano|falde|altro" colmo|nil ((x y) ...) [MESH])
 *   (TRIANGOLI "id" quotaBase x1 y1 z1 x2 y2 z2 x3 y3 z3 ...)   geometria reale (IFC/3D importato), 40 triangoli per riga
 *   (ASTA "id" x y zBase altezza diametro "codice" "origine")
 *   (CONDUTTORE "captazione|calata|terra|anello" "materiale" sezione "codice" ((x y z) ...))
 *   (SUPPORTO "tipo" x y z rotazioneGradi "codice")
 *   (MORSETTO "tipo" x y z rotazioneGradi "codice")
 *   (PICCHETTO "id" x y zTesta lunghezza diametro "codice")
 *   (VOCE "codice" "descrizione" quantita "pz|m")  ; distinta: descrizioni per blocchi e legenda
 *   (PARTICOLARE "P01" "nome" punti)            ; particolari costruttivi usati (legenda)
 *   (RICHIAMO "P01" x y z)                      ; richiamo al particolare in un punto
 *   (CALATA_NUM "C1" x y z)                     ; numero della calata (in alto)
 *   (ESPOSTA "LPL" x0 x1 y z passo)              ; tratto di copertura esposta (riga di celle)
 *   (PARETE "LPL" x y nx ny zDa zA larghezza)    ; faccia di parete esposta
 */

import { LSP_VERSIONE } from "./versioni";
import { massimo, minimo } from "../../lib/estremi";
import type { Corpo, Punto3, RisultatoSfera } from "../captazione/sferaRotolante";
import type { RisultatoCombinato } from "../captazione/verificaMaglia";
import { ordinaCalate, scegliRichiami } from "./tavolaDXF";

export interface AstaCAD { id?: string | undefined; x: number; y: number; z?: number | undefined; altezza: number; diametro?: number | undefined; codiceOBO?: string | undefined; origine?: string | undefined }
export interface ConduttoreCAD { tipo: string; punti: Punto3[]; materiale?: string | undefined; sezione?: number | undefined; codiceOBO?: string | undefined }
export interface ComponenteCAD { tipo?: string | undefined; x: number; y: number; z: number; rotazione?: number | undefined; codiceOBO?: string | undefined }
export interface PicchettoCAD { id?: string | undefined; x: number; y: number; z?: number | undefined; lunghezza: number; diametro?: number | undefined; codiceOBO?: string | undefined }

export interface ProgettoCAD {
  progetto: { codice?: string; nome?: string; comune?: string; lpl?: string; raggio?: number; rev?: string; data?: string; committente?: string; progettista?: string; indirizzo?: string; file?: string };
  edificio: { corpi: (Corpo & { mesh?: { posizioni: ArrayLike<number>; indici?: ArrayLike<number> | undefined } | undefined })[] };
  aste?: AstaCAD[] | undefined;
  conduttori?: ConduttoreCAD[] | undefined;
  supporti?: ComponenteCAD[] | undefined;
  morsetti?: ComponenteCAD[] | undefined;
  picchetti?: PicchettoCAD[] | undefined;
  /** distinta materiali: descrizioni dei codici per blocchi e legenda */
  distinta?: { codice: string; descrizione: string; quantita: number; unita: string }[] | undefined;
  /** particolari costruttivi collegati ai componenti (da posizioniParticolari) */
  particolari?: { marcatori: { idParticolare: string; nome: string; x: number; y: number; z?: number | undefined }[]; usati: { idParticolare: string; nome: string; punti: number }[] } | undefined;
  /** punto (m) dove LPS-AUTO disegna il modello 3D: accanto alla tavola del DXF del pacchetto */
  origine?: [number, number, number] | undefined;
}

/** Stringa LISP sicura: solo ASCII, niente virgolette doppie né barre rovesciate. */
export function testoLisp(v: unknown): string {
  const s = String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[“”«»]/g, "'")
    .replace(/["]/g, "'")
    .replace(/\\/g, "/")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7e]/g, "?");
  return `"${s}"`;
}

/** massimo di triangoli reali per corpo nel .lpsdati (i più grandi: pareti e coperture) */
export const MAX_TRIANGOLI_CAD = 20000;
const N3 = (v: number) => numeroLisp(v, 3);
/** righe TRIANGOLI di un corpo con geometria reale (40 triangoli per riga, così il LISP legge righe corte) */
export function righeTriangoli(id: string, quotaBase: number, posizioni: ArrayLike<number>, indici?: ArrayLike<number> | null): string[] {
  const v = (i: number): [number, number, number] => [posizioni[i * 3] ?? 0, posizioni[i * 3 + 1] ?? 0, posizioni[i * 3 + 2] ?? 0];
  const n = indici ? Math.floor(indici.length / 3) : Math.floor(posizioni.length / 9);
  const tri: { a: number; t: [number, number, number][] }[] = [];
  for (let k = 0; k < n; k++) {
    const t = indici ? [v(indici[k * 3]!), v(indici[k * 3 + 1]!), v(indici[k * 3 + 2]!)] : [v(k * 3), v(k * 3 + 1), v(k * 3 + 2)];
    const [p, q, w] = t as [[number, number, number], [number, number, number], [number, number, number]];
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = w[0] - p[0], vy = w[1] - p[1], vz = w[2] - p[2];
    const a = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (a > 1e-8) tri.push({ a, t });
  }
  const scelti = tri.length > MAX_TRIANGOLI_CAD ? [...tri].sort((x, y) => y.a - x.a).slice(0, MAX_TRIANGOLI_CAD) : tri;
  const out: string[] = [];
  for (let i = 0; i < scelti.length; i += 40) {
    const parte = scelti.slice(i, i + 40).flatMap((x) => x.t.flatMap((p) => [N3(p[0]), N3(p[1]), N3(p[2])]));
    out.push(`(TRIANGOLI ${testoLisp(id)} ${numeroLisp(quotaBase)} ${parte.join(" ")})`);
  }
  return out;
}

/** Numero LISP: punto decimale, 4 decimali, mai notazione esponenziale. */
export function numeroLisp(v: number | null | undefined, decimali = 4): string {
  if (v == null || !Number.isFinite(v)) return "nil";
  const t = v.toFixed(decimali);
  return t === "-0" || /^-0\.0+$/.test(t) ? (0).toFixed(decimali) : t;
}

const P2 = (p: [number, number]) => `(${numeroLisp(p[0])} ${numeroLisp(p[1])})`;
const P3 = (p: Punto3) => `(${numeroLisp(p[0])} ${numeroLisp(p[1])} ${numeroLisp(p[2])})`;

/**
 * Zone esposte da disegnare. Con 'combinata' si esporta l'esito della verifica combinata
 * (sfera + maglia): una zona protetta dalla maglia NON è esposta. Senza, vale la sola sfera.
 */
export interface ZoneEsposte { lpl: string; risultato: RisultatoSfera; combinata?: RisultatoCombinato | null | undefined }

export function generaFileCAD(pr: ProgettoCAD, esposte: ZoneEsposte[] = []): string {
  const r: string[] = [];
  const p = pr.progetto;
  r.push(";; Progettazione LPS - dati per LPS.lsp (ZWCAD / AutoCAD) - coordinate in metri");
  r.push("(LPSDATI 1)");
  r.push(`(LSP ${testoLisp(LSP_VERSIONE)})`);
  r.push(`(PROGETTO ${testoLisp(p.codice)} ${testoLisp(p.nome)} ${testoLisp(p.comune)} ${testoLisp(p.lpl)} ${numeroLisp(p.raggio ?? null)} ${testoLisp(p.rev)} ${testoLisp(p.data)} ${testoLisp(p.committente)} ${testoLisp(p.progettista)} ${testoLisp(p.indirizzo)} ${testoLisp(p.file)})`);
  if (pr.origine) r.push(`(ORIGINE ${numeroLisp(pr.origine[0])} ${numeroLisp(pr.origine[1])} ${numeroLisp(pr.origine[2])})`);
  // distinta raggruppata per codice (serve prima dei componenti: il LISP la usa per le descrizioni dei blocchi)
  const voci = new Map<string, { d: string; q: number; u: string }>();
  for (const v of pr.distinta ?? []) { if (!v.codice) continue; const o = voci.get(v.codice); voci.set(v.codice, { d: o?.d || v.descrizione, q: (o?.q ?? 0) + v.quantita, u: v.unita }); }
  for (const [codice, v] of voci) r.push(`(VOCE ${testoLisp(codice)} ${testoLisp(v.d)} ${numeroLisp(v.q, 2)} ${testoLisp(v.u)})`);
  for (const u of pr.particolari?.usati ?? []) r.push(`(PARTICOLARE ${testoLisp(`P${String((pr.particolari?.usati ?? []).indexOf(u) + 1).padStart(2, "0")}`)} ${testoLisp(u.nome)} ${u.punti})`);
  pr.edificio.corpi.forEach((c, k) => {
    const colmo = c.tipoTetto === "falde" && c.altezzaColmo != null ? numeroLisp(c.altezzaColmo) : "nil";
    const id = c.id || `C${k + 1}`, mesh = c.mesh && c.mesh.posizioni.length >= 9;
    r.push(`(CORPO ${testoLisp(id)} ${testoLisp(c.nome || c.id || `Corpo ${k + 1}`)} ${numeroLisp(c.quotaBase ?? 0)} ${numeroLisp(c.altezzaGronda)} ${testoLisp(c.tipoTetto || "piano")} ${colmo} (${c.impronta.map(P2).join(" ")})${mesh ? " MESH" : ""})`);
    // edificio reale (IFC o modello 3D importato): triangoli in 3DFACE, senza la scatola estrusa
    if (mesh) for (const riga of righeTriangoli(id, c.quotaBase ?? 0, c.mesh!.posizioni, c.mesh!.indici)) r.push(riga);
  });
  (pr.aste ?? []).forEach((a, k) => {
    r.push(`(ASTA ${testoLisp(a.id || `A${k + 1}`)} ${numeroLisp(a.x)} ${numeroLisp(a.y)} ${numeroLisp(a.z ?? null)} ${numeroLisp(a.altezza)} ${numeroLisp(a.diametro ?? 0.016)} ${testoLisp(a.codiceOBO)} ${testoLisp(a.origine || "progetto")})`);
  });
  for (const c of pr.conduttori ?? []) {
    if (c.punti.length < 2) continue;
    r.push(`(CONDUTTORE ${testoLisp(c.tipo)} ${testoLisp(c.materiale)} ${numeroLisp(c.sezione ?? null, 2)} ${testoLisp(c.codiceOBO)} (${c.punti.map(P3).join(" ")}))`);
  }
  for (const [nome, lista] of [["SUPPORTO", pr.supporti ?? []], ["MORSETTO", pr.morsetti ?? []]] as const) {
    for (const s of lista) {
      r.push(`(${nome} ${testoLisp(s.tipo)} ${numeroLisp(s.x)} ${numeroLisp(s.y)} ${numeroLisp(s.z)} ${numeroLisp(s.rotazione ?? 0, 2)} ${testoLisp(s.codiceOBO)})`);
    }
  }
  (pr.picchetti ?? []).forEach((q, k) => {
    r.push(`(PICCHETTO ${testoLisp(q.id || `P${k + 1}`)} ${numeroLisp(q.x)} ${numeroLisp(q.y)} ${numeroLisp(q.z ?? 0)} ${numeroLisp(q.lunghezza)} ${numeroLisp(q.diametro ?? 0.02)} ${testoLisp(q.codiceOBO)})`);
  });
  // richiami ai particolari (al massimo 2 per particolare) e numeri delle calate
  if (pr.particolari) {
    const zDi = new Map(pr.particolari.marcatori.map((m) => [`${m.x}|${m.y}`, m.z ?? 0]));
    for (const m of scegliRichiami(pr.particolari.usati, pr.particolari.marcatori, 5)) r.push(`(RICHIAMO ${testoLisp(m.codice)} ${numeroLisp(m.x)} ${numeroLisp(m.y)} ${numeroLisp(zDi.get(`${m.x}|${m.y}`) ?? 0)})`);
  }
  const calate = (pr.conduttori ?? []).filter((c) => c.tipo === "calata" && c.punti.length >= 2).map((c) => c.punti.reduce((a, b) => (b[2] > a[2] ? b : a), c.punti[0] as Punto3));
  if (calate.length) {
    const xs = pr.edificio.corpi.flatMap((c) => c.impronta.map((p) => p[0])), ys = pr.edificio.corpi.flatMap((c) => c.impronta.map((p) => p[1]));
    const centro: [number, number] = xs.length ? [(minimo(xs) + massimo(xs)) / 2, (minimo(ys) + massimo(ys)) / 2] : [0, 0];
    ordinaCalate(calate.map((p) => [p[0], p[1]] as [number, number]), centro).forEach((i, n) => { const p = calate[i] as Punto3; r.push(`(CALATA_NUM ${testoLisp(`C${n + 1}`)} ${numeroLisp(p[0])} ${numeroLisp(p[1])} ${numeroLisp(p[2])})`); });
  }
  // zone esposte: righe di celle consecutive unite in un unico tratto
  for (const { lpl, risultato: ris, combinata } of esposte) {
    const g = ris.griglia;
    const esp = (k: number) => (combinata ? combinata.stato[k]! === 3 : ris.esposta[k]! === 1);
    for (let j = 0; j < g.ny; j++) {
      let i = 0;
      while (i < g.nx) {
        const k = j * g.nx + i;
        if (!esp(k)) { i++; continue; }
        const z = ris.altezze[k]!;
        let i1 = i;
        while (i1 + 1 < g.nx && esp(k + (i1 + 1 - i)) && Math.abs(ris.altezze[k + (i1 + 1 - i)]! - z) < 0.05) i1++;
        r.push(`(ESPOSTA ${testoLisp(lpl)} ${numeroLisp(g.x0 + i * g.passo)} ${numeroLisp(g.x0 + i1 * g.passo)} ${numeroLisp(g.y0 + j * g.passo)} ${numeroLisp(z)} ${numeroLisp(g.passo)})`);
        i = i1 + 1;
      }
    }
    for (const f of ris.facceEsposte) {
      r.push(`(PARETE ${testoLisp(lpl)} ${numeroLisp(f.x)} ${numeroLisp(f.y)} ${f.normale[0]} ${f.normale[1]} ${numeroLisp(f.zDa)} ${numeroLisp(f.zA)} ${numeroLisp(g.passo)})`);
    }
  }
  return r.join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------------ */
/* Ritorno dal CAD: edificio_da_CAD.json scritto da LPS-ESPORTA         */
/* ------------------------------------------------------------------ */

export interface EdificioDaCAD {
  versione: string;
  unita: "m";
  corpi: Corpo[];
}

/** Legge e controlla il file scritto da LPS-ESPORTA. Lancia un errore leggibile se non valido. */
export function leggiEdificioDaCAD(testo: string): EdificioDaCAD {
  let d: unknown;
  try { d = JSON.parse(testo); } catch { throw new Error("Il file non è un JSON valido"); }
  const o = d as Partial<EdificioDaCAD>;
  if (!o || !Array.isArray(o.corpi)) throw new Error("Nel file manca l'elenco dei corpi");
  o.corpi.forEach((c, k) => {
    if (!Array.isArray(c.impronta) || c.impronta.length < 3) throw new Error(`Corpo ${k + 1}: impronta non valida`);
    if (!(typeof c.altezzaGronda === "number" && c.altezzaGronda > 0)) throw new Error(`Corpo ${k + 1}: altezza non valida`);
  });
  return { versione: String(o.versione ?? "1"), unita: "m", corpi: o.corpi };
}
