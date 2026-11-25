import { describe, expect, it } from "vitest";
import { altezzaAstaMinima, calcolaAntenne, DATI_INIZIALI, puntoProtetto } from "./antenne";

describe("antenne radiomobili", () => {
  it("asta bassa sul tetto: piano + punta (H ≤ r)", () => {
    // asta 2 m, sfera 45 m: raggio protetto al piano sqrt(2·45·2 − 4) ≈ 13,3 m
    expect(puntoProtetto(2, 13, 0, 45)).toBe(true);
    expect(puntoProtetto(2, 13.5, 0, 45)).toBe(false);
  });
  it("asta più alta della sfera: la sfera scende lungo l'asta", () => {
    // H = 50 > r = 45: punto a 0,5 m dall'asse protetto se sotto la punta di almeno sqrt(2·45·0,5 − 0,25)
    const d = Math.sqrt(2 * 45 * 0.5 - 0.25);
    expect(puntoProtetto(50, 0.5, 50 - d - 0.01, 45)).toBe(true);
    expect(puntoProtetto(50, 0.5, 50 - d + 0.05, 45)).toBe(false);
  });
  it("altezza minima dell'asta sopra le antenne", () => {
    const h = altezzaAstaMinima(0.6, 6, 45);
    expect(h).toBeGreaterThan(6); expect(puntoProtetto(h, 0.6, 6, 45)).toBe(true); expect(puntoProtetto(h - 0.05, 0.6, 6, 45)).toBe(false);
  });
  it("calcolo completo con misure", () => {
    const r = calcolaAntenne({ ...DATI_INIZIALI, cavi: { coassiali: true, fibraMetallica: false, fibraDielettrica: false, alimentazione: true } });
    expect(r.protette).toBe(true);
    expect(r.s).toBeCloseTo(0.04 * 1 * 12);
    expect(r.misure.some((m) => /coassiali/.test(m.testo))).toBe(true);
    expect(r.isconConsigliato).toBe("proplus");
  });
});
