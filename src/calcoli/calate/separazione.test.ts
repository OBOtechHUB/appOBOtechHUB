import { describe, it, expect } from "vitest";
import { KI, KM, distanzaSeparazione, kcDettagliato, kcSemplificato, numeroCalate, passoCalate, perimetro, verificaPunti } from "./separazione";

describe("calate e distanza di separazione", () => {
  it("passo e numero delle calate", () => {
    expect(passoCalate("III")).toBe(15);
    expect(numeroCalate(120, "III")).toBe(8);
    expect(numeroCalate(20, "I")).toBe(2);
    expect(numeroCalate(10, "IV")).toBe(2);
    expect(numeroCalate(0, "IV")).toBe(0);
  });

  it("kc semplificato e dettagliato", () => {
    expect(kcSemplificato(1)).toBe(1);
    expect(kcSemplificato(2)).toBe(0.66);
    expect(kcSemplificato(3)).toBe(0.44); // Tab. 13 edizione 2024: 3 e più
    expect(kcSemplificato(8)).toBe(0.44);
    const k = kcDettagliato(8, 15, 10);
    expect(k).toBeCloseTo(1 / 16 + 0.1 + 0.2 * Math.cbrt(1.5), 9);
    expect(kcDettagliato(1, 100, 1)).toBe(1);
  });

  it("s = ki·kc/km·l: LPL III, 4 calate, aria, l = 10 m → 0,176 m", () => {
    expect(distanzaSeparazione(KI.III, 0.44, KM.aria, 10)).toBeCloseTo(0.176, 9);
    expect(distanzaSeparazione(KI.III, 0.44, KM.solido, 10)).toBeCloseTo(0.352, 9);
    expect(() => distanzaSeparazione(0.04, 0.44, 0, 10)).toThrow();
  });

  it("verifica dei punti critici", () => {
    const e = verificaPunti([{ id: "a", descrizione: "Antenna", l: 10, d: 0.3, materiale: "aria" }, { id: "b", descrizione: "Canale", l: 10, d: 0.3, materiale: "solido" }], KI.III, 0.44);
    expect(e[0]?.conforme).toBe(true);
    expect(e[1]?.conforme).toBe(false);
  });

  it("perimetro", () => {
    expect(perimetro([[0, 0], [20, 0], [20, 10], [0, 10]])).toBe(60);
  });
});
