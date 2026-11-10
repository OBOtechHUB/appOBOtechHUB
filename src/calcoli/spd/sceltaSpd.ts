/**
 * Scelta degli SPD per la rete di alimentazione (CEI EN IEC 62305-4, CEI EN 61643-12).
 * - Iimp per polo all'ingresso (SPD tipo 1 se c'è un LPS): 50 % della corrente di fulmine dell'LPL
 *   va nell'impianto di terra e si divide tra i servizi entranti (n) e i conduttori della linea (m).
 * - Uc ≥ 1,1·U0 (rete 230/400 V → 253 V).
 * - Up ≤ 0,8·Uw (Uw: tensione di tenuta a impulso degli apparecchi da proteggere).
 * Regola n. 1, CEI EN IEC 62305-4:2024 Allegato C; ripartizione della corrente CEI EN IEC 62305-1:2024 E.2.
 * Up ≤ 0,8·Uw è la regola n. 1 (C.2.3.1.2), per apparecchi entro 10 m dall'SPD d'ingresso.
 */

export type Livello = "I" | "II" | "III" | "IV";
export type Sistema = "TN-C" | "TN-S" | "TN-C-S" | "TT";
export type Fasi = "monofase" | "trifase";

/** Corrente di picco del primo colpo positivo per LPL (kA). */
export const CORRENTE_LPL: Record<Livello, number> = { I: 200, II: 150, III: 100, IV: 100 };
/** Tensione di tenuta a impulso Uw per categoria di sovratensione, rete 230/400 V (kV). */
export const UW_CATEGORIA: Record<"I" | "II" | "III" | "IV", number> = { I: 1.5, II: 2.5, III: 4, IV: 6 };

/** Conduttori attivi della linea di alimentazione che portano corrente di fulmine. */
export function conduttoriLinea(sistema: Sistema, fasi: Fasi): number {
  const f = fasi === "trifase" ? 3 : 1;
  // Conduttori della linea entrante (CEI EN IEC 62305-1, E.2.3): TN-C e TN-C-S entrano con fasi + PEN,
  // TT con fasi + N (il PE è locale); solo TN-S ha anche il PE nella linea.
  return sistema === "TN-S" ? f + 2 : f + 1;
}

export interface Requisiti { iimpPolo: number; iimpTotale: number; ucMin: number; upMax: number; conduttori: number }

export function requisitiIngresso(lpl: Livello, servizi: number, sistema: Sistema, fasi: Fasi, uwKv: number, u0 = 230): Requisiti {
  const n = Math.max(1, Math.floor(servizi));
  const m = conduttoriLinea(sistema, fasi);
  const iimpTotale = (0.5 * CORRENTE_LPL[lpl]) / n;
  return { iimpPolo: iimpTotale / m, iimpTotale, ucMin: 1.1 * u0, upMax: 0.8 * uwKv, conduttori: m };
}

// ---------- lettura dei dati tecnici del catalogo OBO ----------
export const numero = (v: string | undefined): number | null => {
  if (!v) return null;
  const m = /([\d.]+(?:,\d+)?|\d+(?:\.\d+)?)/.exec(v.replace(/\s/g, ""));
  if (!m) return null;
  const n = Number(m[1]!.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const primo = (d: Record<string, string>, chiavi: string[]) => { for (const k of chiavi) if (d[k] !== undefined) return d[k]; return undefined; };

export interface DatiSpd { tipo: string | null; iimpPolo: number | null; iimpTotale: number | null; upKv: number | null; uc: number | null; inKa: number | null; poli: string | null; reti: string[] }

/** Estrae i valori utili alla scelta dai dati tecnici di un prodotto OBO. */
export function datiSpd(d: Record<string, string>): DatiSpd {
  const tipo = primo(d, ["SPD to EN 61643-11"]) ?? null;
  let up = numero(primo(d, ["Protection level [L-N]", "Protection level (L-N)", "Protection level (L-N / L/N-PE)", "Protection level", "Combined voltage protection level [L-PE]"]));
  if (up !== null && up > 50) up = up / 1000; // valori in V → kV
  const reti: string[] = [];
  for (const r of ["TN-C", "TN-S", "TN-C-S", "TT"]) if (/^(yes|si|sì)$/i.test(d[`${r} network form`] ?? "")) reti.push(r);
  const nf = d["Network form"] ?? "";
  if (!reti.length && nf && !/other/i.test(nf)) for (const r of nf.split(/[,/]\s*/)) { const t = r.trim(); if (t === "TN") reti.push("TN-C", "TN-S", "TN-C-S"); else if (t === "All") reti.push("TN-C", "TN-S", "TN-C-S", "TT"); else if (t) reti.push(t); }
  return {
    tipo,
    iimpPolo: numero(primo(d, ["Lightning surge current (10/350 μs)", "Lightning surge current (10/350 μs) [L-N]"])),
    iimpTotale: numero(primo(d, ["Lightning surge current (10/350)", "Lightning surge current (10/350) [total]"])),
    upKv: up,
    uc: numero(primo(d, ["Maximum continuous voltage (L-N)", "Maximum continuous voltage AC"])),
    inKa: numero(primo(d, ["Nominal discharge current (8/20 µs) [L-N]", "Nominal discharge current (8/20 µs)"])),
    poli: primo(d, ["Pole version"]) ?? null,
    reti,
  };
}

/** Esecuzioni dei poli adatte al sistema. */
export function poliAdatti(sistema: Sistema, fasi: Fasi): string[] {
  if (fasi === "monofase") return sistema === "TN-C" ? ["2", "1"] : ["1+N/PE", "2"];
  if (sistema === "TN-C") return ["3"];
  if (sistema === "TT") return ["3+N/PE"];
  return ["3+N/PE", "4"];
}

export type Livello2 = "ingresso" | "sottoquadro" | "apparecchio";
const TIPI: Record<Livello2, RegExp> = { ingresso: /^Type 1/, sottoquadro: /^Type 2/, apparecchio: /Type 3|2\+3/ };

export interface ProdottoSpd { codice: string; nome: string; datiTecnici: Record<string, string> }
export interface Candidato { prodotto: ProdottoSpd; dati: DatiSpd; punteggio: number; note: string[] }

/** Prodotti adatti, ordinati dal più adatto (requisiti soddisfatti con il minimo sovradimensionamento). */
export function candidati(prodotti: ProdottoSpd[], livello: Livello2, req: Requisiti, sistema: Sistema, fasi: Fasi): Candidato[] {
  const poli = poliAdatti(sistema, fasi);
  const out: Candidato[] = [];
  for (const p of prodotti) {
    const d = datiSpd(p.datiTecnici);
    if (!d.tipo || !TIPI[livello].test(d.tipo)) continue;
    if (d.poli && !poli.includes(d.poli)) continue;
    if (d.reti.length && !d.reti.includes(sistema)) continue;
    if (d.uc !== null && d.uc < req.ucMin) continue;
    if (d.uc !== null && d.uc > 440) continue; // rete 230/400 V: si escludono le versioni per tensioni più alte
    const note: string[] = [];
    let punteggio = 0;
    if (livello === "ingresso") {
      const iimp = d.iimpPolo ?? (d.iimpTotale !== null ? d.iimpTotale / req.conduttori : null);
      if (iimp === null || iimp < req.iimpPolo - 1e-9) continue;
      punteggio += iimp - req.iimpPolo;
      note.push(`Iimp ${iimp} kA per polo (richiesti ${round(req.iimpPolo)} kA)`);
    }
    if (d.upKv !== null) {
      if (d.upKv > req.upMax + 1e-9) continue;
      note.push(`Up ${d.upKv} kV (massimo ${round(req.upMax)} kV)`);
    } else note.push("Up da verificare sulla scheda");
    if (d.uc !== null) note.push(`Uc ${d.uc} V`);
    punteggio += d.upKv === null ? 5 : 0;
    out.push({ prodotto: p, dati: d, punteggio, note });
  }
  return out.sort((a, b) => a.punteggio - b.punteggio || (a.dati.upKv ?? 9) - (b.dati.upKv ?? 9));
}

const round = (v: number) => Math.round(v * 100) / 100;
