import { describe, expect, it } from "vitest";
import { calateIsconAltezza, type DatiCalateAltezza } from "./isconAltezza";

const base: DatiCalateAltezza = { lpl: "III", quotaPunta: 87.4, quotaBase: 0, quotaApparatoBasso: 74, struttura: "metallica", nCalate: null, versione: null, materiale: "aria", distanzaImpianti: 0.5, isconFinoATerra: false };

describe("calate isCon da grande altezza", () => {
  it("palo metallico di 80 m: PAE sotto l'antenna più bassa, il resto scende nel palo", () => {
    const r = calateIsconAltezza(base);
    expect(r.fattibile).toBe(true);
    expect(r.quotaPAE).toBeCloseTo(74 - 1.5, 6); // zona x 1,5 m (Pro+/Premium)
    expect(r.l).toBeCloseTo(87.4 - 72.5, 6);
    expect(r.s).toBeLessThanOrEqual(0.75 + 1e-9);
    expect(r.n).toBe(1); expect(r.versione).toBe("proplus"); // s = 0,04 · 14,9 = 0,596 m: Basic non basta, Pro+ sì
    expect(r.livelli.map((l) => l.tipo)).toEqual(["principale", "base"]);
  });
  it("struttura non conduttiva: livelli intermedi con passo da distanza disponibile", () => {
    const r = calateIsconAltezza({ ...base, struttura: "isolante", distanzaImpianti: 0.5 });
    expect(r.passoIntermedi).toBeGreaterThan(0);
    const inter = r.livelli.filter((l) => l.tipo === "intermedio");
    expect(inter.length).toBeGreaterThan(0);
    const quote = r.livelli.map((l) => l.quota);
    for (let i = 1; i < quote.length; i++) expect(quote[i - 1]! - quote[i]!).toBeLessThanOrEqual(r.passoIntermedi! + 1e-9);
  });
  it("antenna troppo bassa: non fattibile e quota minima del PAE", () => {
    const r = calateIsconAltezza({ ...base, quotaApparatoBasso: 30 });
    expect(r.fattibile).toBe(false);
    expect(r.lMassimaPossibile).toBeCloseTo(0.9 / (0.04 * 0.44), 3);
    expect(r.quotaPAEMinima).toBeCloseTo(87.4 - 0.9 / (0.04 * 0.44), 3);
  });
  it("isCon continuo fino a terra su palo metallico: niente tagli, materiali per tutta l'altezza", () => {
    const r = calateIsconAltezza({ ...base, isconFinoATerra: true });
    expect(r.fattibile).toBe(true);
    expect(r.materiali[0]!.quantita).toBe(Math.ceil(87.4 + 1));
    expect(r.avvisi.some((a) => /non si taglia/.test(a))).toBe(true);
  });
});
