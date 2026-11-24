/**
 * Verifica della scala dei file importati (DXF, PDF, immagini, modelli 3D).
 * Logica pura: propone l'unità più plausibile per un edificio, legge la scala scritta nei PDF
 * ("1:100", "scala 1:200") e ricava il fattore da una misura nota. Nessuna dipendenza.
 */

export type Unita = "m" | "cm" | "mm" | "in" | "ft";

export const UNITA: { id: Unita; nome: string; metri: number }[] = [
  { id: "m", nome: "metri", metri: 1 },
  { id: "cm", nome: "centimetri", metri: 0.01 },
  { id: "mm", nome: "millimetri", metri: 0.001 },
  { id: "in", nome: "pollici", metri: 0.0254 },
  { id: "ft", nome: "piedi", metri: 0.3048 },
];

export function metriUnita(u: Unita): number {
  return UNITA.find((x) => x.id === u)?.metri ?? 1;
}

/** Codice $INSUNITS del DXF → unità (0 = non indicata). */
export function unitaDaInsunits(codice: unknown): Unita | null {
  const n = Number(codice);
  if (n === 1) return "in";
  if (n === 2) return "ft";
  if (n === 4) return "mm";
  if (n === 5) return "cm";
  if (n === 6) return "m";
  return null;
}

/** Dimensioni plausibili per un edificio o un complesso di edifici, in metri. */
export const LIMITI_EDIFICIO = { minimo: 2, massimo: 600, tipico: 30 };

export function plausibile(dimensioniM: number[]): boolean {
  const pos = dimensioniM.filter((d) => d > 0);
  if (!pos.length) return false;
  const max = massimo(pos);
  return max >= LIMITI_EDIFICIO.minimo && max <= LIMITI_EDIFICIO.massimo;
}

export interface Candidato { unita: Unita; dimensioniM: number[]; plausibile: boolean }
export interface PropostaUnita {
  consigliata: Unita;
  dichiarata: Unita | null;
  candidati: Candidato[];
  motivo: string;
  /** true se l'unità dichiarata nel file porta a dimensioni non plausibili */
  dichiarataSospetta: boolean;
}

const fmt = (v: number) => v.toLocaleString("it-IT", { maximumFractionDigits: v < 10 ? 2 : 1 });
export function descriviDimensioni(d: number[]): string {
  return d.filter((v) => v > 0).map(fmt).join(" × ") + " m";
}

/**
 * Propone l'unità del file partendo dalle dimensioni "grezze" (nell'unità del file) e,
 * se c'è, dall'unità dichiarata nel file. Preferisce l'unità dichiarata se dà un edificio plausibile;
 * altrimenti sceglie quella che dà le dimensioni più vicine a un edificio tipico.
 */
export function proponiUnita(dimensioniGrezze: number[], dichiarata: Unita | null = null): PropostaUnita {
  const candidati: Candidato[] = UNITA.map((u) => {
    const dimensioniM = dimensioniGrezze.map((d) => d * u.metri);
    return { unita: u.id, dimensioniM, plausibile: plausibile(dimensioniM) };
  });
  const per = (u: Unita) => candidati.find((c) => c.unita === u);
  const dich = dichiarata ? per(dichiarata) : undefined;
  if (dich && dich.plausibile) {
    return { consigliata: dich.unita, dichiarata, candidati, dichiarataSospetta: false,
      motivo: `Il file indica ${nomeUnita(dich.unita)}: l'edificio misura ${descriviDimensioni(dich.dimensioniM)}, dimensioni realistiche.` };
  }
  const distanza = (c: Candidato) => Math.abs(Math.log(Math.max(massimo(c.dimensioniM.filter((d) => d > 0)), 1e-9) / LIMITI_EDIFICIO.tipico));
  const plaus = candidati.filter((c) => c.plausibile).sort((a, b) => distanza(a) - distanza(b));
  // a parità di plausibilità si preferiscono le unità più comuni nei disegni edili: m, mm, cm
  const ordine: Unita[] = ["m", "mm", "cm", "in", "ft"];
  const migliore = plaus.length
    ? plaus.filter((c) => distanza(c) <= distanza(plaus[0] as Candidato) + 0.7).sort((a, b) => ordine.indexOf(a.unita) - ordine.indexOf(b.unita))[0] as Candidato
    : (candidati.slice().sort((a, b) => distanza(a) - distanza(b))[0] as Candidato);
  const sospetta = !!dich && !dich.plausibile;
  const motivo = !plaus.length
    ? `Con nessuna unità le dimensioni sembrano quelle di un edificio: controlla con una misura nota.`
    : sospetta
      ? `Il file indica ${nomeUnita(dichiarata as Unita)}, ma così l'edificio misurerebbe ${descriviDimensioni((dich as Candidato).dimensioniM)}: è più probabile che sia in ${nomeUnita(migliore.unita)} (${descriviDimensioni(migliore.dimensioniM)}).`
      : `Il file non indica l'unità: in ${nomeUnita(migliore.unita)} l'edificio misura ${descriviDimensioni(migliore.dimensioniM)}, la soluzione più realistica.`;
  return { consigliata: migliore.unita, dichiarata, candidati, motivo, dichiarataSospetta: sospetta };
}

export function nomeUnita(u: Unita): string {
  return UNITA.find((x) => x.id === u)?.nome ?? u;
}

/**
 * Cerca nel testo di un disegno la scala di stampa ("1:100", "scala 1/200", "SC. 1:50").
 * Restituisce il denominatore più frequente tra quelli usati in edilizia, oppure null.
 */
export function scalaDaTesto(testo: string): number | null {
  const conta = new Map<number, number>();
  const re = /(?:^|[^\d.,])1\s*[:/]\s*(\d{1,3}(?:[.\s]?\d{3})*|\d{2,5})(?![\d.,]*\d)/g;
  for (const m of testo.matchAll(re)) {
    const n = Number(String(m[1] ?? "").replace(/[.\s]/g, ""));
    if (n >= 10 && n <= 10000) conta.set(n, (conta.get(n) ?? 0) + (/scala|scale|sc\./i.test(testo.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0)) ? 3 : 1));
  }
  let migliore: number | null = null, voti = 0;
  for (const [n, v] of conta) if (v > voti) { migliore = n; voti = v; }
  return migliore;
}

/** Un punto PDF è 1/72 di pollice: metri reali per punto alla scala 1:rapporto. */
export function metriPerPuntoPdf(rapporto: number): number {
  return (0.0254 / 72) * rapporto;
}

/** Fattore (metri per unità del file) da una distanza misurata nel file e dalla sua lunghezza reale in metri. */
export function fattoreDaMisura(lunghezzaFile: number, lunghezzaRealeM: number): number | null {
  if (!(lunghezzaFile > 0) || !(lunghezzaRealeM > 0)) return null;
  return lunghezzaRealeM / lunghezzaFile;
}

/** Differenza relativa tra due fattori di scala (0.05 = 5%). */
export function differenzaRelativa(a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return Infinity;
  return Math.abs(a - b) / Math.max(a, b);
}

/** Rapporto di scala "normale" più vicino (1:50, 1:100, 1:200…) al valore misurato, se entro il 3%. */
export const SCALE_COMUNI = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 500, 1000, 2000, 2500, 5000];
export function scalaComuneVicina(rapporto: number): number | null {
  let best: number | null = null, d = Infinity;
  for (const s of SCALE_COMUNI) { const x = differenzaRelativa(s, rapporto); if (x < d) { d = x; best = s; } }
  return d <= 0.03 ? best : null;
}

export function distanza2(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}import { massimo, minimo } from "@/lib/estremi";

