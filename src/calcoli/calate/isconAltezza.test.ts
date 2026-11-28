import { describe, expect, it } from "vitest";
import { calateIsconAltezza, type DatiCalateAltezza } from "./isconAltezza";

const base: DatiCalateAltezza = { lpl: "III", quotaPunta: 87.4, quotaBase: 0, quotaApparatoBasso: 74, struttura: "metallica", nCalate: null, versione: null, materiale: "aria", distanzaImpianti: 0.5, isconFinoATerra: false };

describe("calate isCon da grande altezza", () => {
  it("palo metallico di 80 m, cavo corto: PAE sotto l'antenna più bassa, il resto scende nel palo", () => {
    const r = calateIsconAltezza({ ...base, obiettivo: "antenne" });
    expect(r.fattibile).toBe(true);
    // fine del cavo sotto l'antenna più bassa lasciando x = 2·s per il terminale PAE (istruzioni OBO)
    expect(r.zonaX).toBeCloseTo(2 * r.s, 9);
    expect(r.quotaPAE! + r.zonaX).toBeCloseTo(74, 6);
    expect(r.l).toBeCloseTo(87.4 - r.quotaPAE!, 6);
    expect(r.s).toBeLessThanOrEqual(0.75 + 1e-9);
    expect(r.n).toBe(1); expect(r.versione).toBe("proplus"); // l ≈ 14,6 m: Basic (11,25 m) non basta, Pro+ (18,75 m) sì
    expect(r.livelli.map((l) => l.tipo)).toEqual(["principale", "principale", "base"]);
  });
  it("struttura non conduttiva: livelli intermedi con passo da distanza disponibile", () => {
    const r = calateIsconAltezza({ ...base, struttura: "isolante", distanzaImpianti: 0.5 });
    expect(r.passoIntermedi).toBeGreaterThan(0);
    const inter = r.livelli.filter((l) => l.tipo === "intermedio");
    expect(inter.length).toBeGreaterThan(0);
    const quote = r.livelli.slice(1).map((l) => l.quota);
    for (let i = 1; i < quote.length; i++) expect(quote[i - 1]! - quote[i]!).toBeLessThanOrEqual(r.passoIntermedi! + 1e-9);
  });
  it("antenna troppo bassa: non fattibile e quota minima del PAE", () => {
    const r = calateIsconAltezza({ ...base, quotaApparatoBasso: 30 });
    expect(r.fattibile).toBe(false);
    expect(r.lMassimaPossibile).toBeCloseTo(0.9 / (0.04 * 0.44), 3);
    expect(r.quotaPAEMinima).toBeCloseTo(87.4 - 0.9 / (0.04 * 0.44), 3);
  });
  it("il cavo isCon non si prolunga: un pezzo unico per calata entro la lunghezza ammessa", () => {
    const r = calateIsconAltezza({ ...base, isconFinoATerra: true });
    expect(r.materiali[0]!.quantita).toBe(Math.ceil(r.l + 0.5) * r.n);
    expect(r.l + 0.5).toBeLessThanOrEqual(r.lMax + 1e-9);
    expect(r.avvisi.some((a) => /non si può prolungare/.test(a))).toBe(true);
    expect(r.materiali.some((m) => m.codice === "5408036")).toBe(true);
  });
  it("calate affiancate: kc 1 per la distanza", () => {
    const a = calateIsconAltezza({ ...base, nCalate: 2, versione: "proplus" }), b = calateIsconAltezza({ ...base, nCalate: 2, versione: "proplus", calateDistanziate: false });
    expect(a.kc).toBeCloseTo(0.66); expect(b.kc).toBe(1); expect(b.lMax).toBeLessThan(a.lMax);
  });

});

describe("scelta delle calate", () => {
  it("confronto 1–4 calate × Basic/Pro+/Premium e conteggio dei collegamenti", async () => {
    const { confrontoCalate, cosaMigliora } = await import("./isconAltezza");
    const c = confrontoCalate(base);
    expect(c).toHaveLength(12);
    expect(c.some((x) => x.versione === ("pro" as never))).toBe(false);
    const due = c.find((x) => x.n === 2 && x.versione === "basic")!;
    expect(due.collegamenti).toBe(2);
    expect(cosaMigliora(2, "proplus", 0.04, "III")).toMatch(/l massima da 18,8 a 28,4 m/);
    const iso = calateIsconAltezza({ ...base, struttura: "isolante", isconFinoATerra: true, nCalate: 2, versione: "basic" });
    expect(iso.collegamentiTotali).toBe(2 * (1 + iso.livelliIntermedi));
  });
});

describe("scendere il più possibile", () => {
  it("la fine del cavo scende con più cavi e versioni migliori", async () => {
    const { scendiConPiuCavi } = await import("./isconAltezza");
    // dal 28/11/2026 (predefinito): la soluzione è la più semplice che isola le antenne (1 Pro+), poi il cavo si usa per tutta la lunghezza ammessa
    for (const r of [calateIsconAltezza({ ...base, obiettivo: "basso" }), calateIsconAltezza(base)]) {
      expect(r.fattibile).toBe(true);
      expect(r.versione).toBe("proplus"); expect(r.n).toBe(1);
      expect(r.l).toBeCloseTo(0.75 / 0.04 - 0.5, 6); // l massima 18,75 m meno 0,5 m per i collegamenti
      expect(r.quotaPAE! + r.zonaX).toBeLessThanOrEqual(74 + 1e-9); // le antenne restano sopra il tratto x
    }
    const corto = calateIsconAltezza({ ...base, obiettivo: "antenne" }), lungo = calateIsconAltezza(base);
    expect(lungo.l).toBeGreaterThan(corto.l);
    const r = calateIsconAltezza({ ...base, nCalate: 3, versione: "premium" });
    expect(r.quotaPAE!).toBeCloseTo(87.4 - (0.9 / (0.04 * 0.44) - 0.5), 6);
    const righe = scendiConPiuCavi(base, "proplus");
    expect(righe[0]!.quotaFine!).toBeGreaterThan(righe[1]!.quotaFine!);
    expect(righe[1]!.quotaFine!).toBeGreaterThan(righe[2]!.quotaFine!);
    expect(righe[2]!.quotaFine!).toBeCloseTo(righe[3]!.quotaFine!, 6);
    expect(r.avvisi.some((a) => /il più in basso possibile/.test(a))).toBe(true);
  });
});
