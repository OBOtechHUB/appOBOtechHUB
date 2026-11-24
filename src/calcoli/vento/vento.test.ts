import { describe, expect, it } from "vitest";
import { ASTE, PARAMETRI_BASE, ce, pressioneBase, velocitaBase, zonaDa, azioneAsta, zavorraSostegno, zavorraTabelle, verificaParete, psiLambda, sardegnaEst, type Parametri, type Tronco } from "./vento";

const P = (x: Partial<Parametri> = {}): Parametri => ({ ...PARAMETRI_BASE, ...x });

describe("vento NTC 2018", () => {
  it("zone dalle regioni", () => {
    expect(zonaDa("Piemonte")).toBe(1);
    expect(zonaDa("Emilia-Romagna")).toBe(2);
    expect(zonaDa("Lazio")).toBe(3);
    expect(zonaDa("Calabria", "Reggio Calabria")).toBe(4);
    expect(zonaDa("Calabria", "Cosenza")).toBe(3);
    expect(zonaDa("Friuli-Venezia Giulia", "Trieste")).toBe(8);
    expect(zonaDa("Liguria")).toBe(7);
    expect(zonaDa("Sardegna", "", 39.22, 9.11)).toBe(5); // Cagliari
    expect(zonaDa("Sardegna", "", 40.72, 8.56)).toBe(6); // Sassari
    expect(sardegnaEst(40.92, 9.5)).toBe(true); // Olbia
  });
  it("velocità con l'altitudine e pressione", () => {
    expect(velocitaBase(1, 200).vb).toBe(25);
    expect(velocitaBase(3, 1000).vb).toBeCloseTo(27 * (1 + 0.37 * (1000 / 500 - 1)), 6);
    expect(pressioneBase(25)).toBeCloseTo(390.6, 1);
  });
  it("ce come NTC (cat. III a 10 m ≈ 2,14; sotto zmin costante)", () => {
    expect(ce(10, "III")).toBeCloseTo(2.138, 2);
    expect(ce(2, "IV")).toBeCloseTo(ce(8, "IV"), 9);
  });
  it("ψλ tra 0,6 e 1", () => {
    expect(psiLambda(9, 0.04)).toBeGreaterThan(0.85);
    expect(psiLambda(1, 1)).toBeCloseTo(0.6, 2);
  });
});

describe("aste e zavorre", () => {
  it("irod 10 m: ordine di grandezza come il calcolo a mano", () => {
    const s = ASTE.sostegni[0]!;
    const az = azioneAsta(s.tronchi as Tronco[], s.altezza, P());
    expect(az.F).toBeGreaterThan(0.2); expect(az.F).toBeLessThan(0.6);
    const z = zavorraSostegno(s, P());
    expect(z.esito).toBe("ok");
    expect(z.perBase).toBeGreaterThanOrEqual(1); expect(z.perBase).toBeLessThanOrEqual(5);
    expect(z.totali).toBe(6 * z.perBase!);
  });
  it("più vento e più quota = più blocchi", () => {
    const s = ASTE.sostegni[1]!;
    const a = zavorraSostegno(s, P({ zona: 1, categoria: "IV" })), b = zavorraSostegno(s, P({ zona: 9, categoria: "I", quotaBase: 20 }));
    expect((b.totali ?? 999)).toBeGreaterThanOrEqual(a.totali ?? 0);
  });
  it("19 m prova 12, 24, 36 basi", () => {
    const z = zavorraSostegno(ASTE.sostegni[3]!, P({ zona: 3, categoria: "II" }));
    expect([12, 24, 36]).toContain(z.basi);
  });
  it("tabelle isFang: blocchi 3–15 o oltre", () => {
    const t = zavorraTabelle(P());
    expect(t.length).toBe(17);
    for (const r of t) if (r.blocchi != null) expect([3, 6, 9, 12, 15]).toContain(r.blocchi);
  });
  it("asta a parete: reazioni e tensione", () => {
    const r = verificaParete({ id: "x", nome: "x", d: 16, l: 3 }, 0.5, "AL", P({ quotaBase: 10 }));
    expect(r.R1).toBeGreaterThan(r.F);
    expect(r.R2).toBeCloseTo(r.R1 - r.F, 9);
    expect(r.sigma).toBeGreaterThan(0);
  });
});
