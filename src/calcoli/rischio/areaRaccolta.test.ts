import { describe, it, expect } from "vitest";
import { areaRaccolta } from "./areaRaccolta";

describe("areaRaccolta", () => {
  it("L=40, W=20, H=12 → ≈ 9191,50 m²", () => {
    // 800 + 4320 + π·1296
    expect(areaRaccolta(40, 20, 12)).toBeCloseTo(800 + 4320 + Math.PI * 1296, 6);
    expect(areaRaccolta(40, 20, 12)).toBeCloseTo(9191.5, 1);
  });
  it("H=0 → solo area in pianta", () => {
    expect(areaRaccolta(10, 5, 0)).toBe(50);
  });
  it("struttura puntiforme L=W=0 → cerchio di raggio 3H", () => {
    expect(areaRaccolta(0, 0, 10)).toBeCloseTo(Math.PI * 900, 6);
  });
  it("valori negativi → errore", () => {
    expect(() => areaRaccolta(-1, 5, 5)).toThrow();
  });
});
