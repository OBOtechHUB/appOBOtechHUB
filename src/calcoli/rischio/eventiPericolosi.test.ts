import { describe, expect, it } from "vitest";
import { eventiPericolosi } from "./eventiPericolosi";

describe("eventiPericolosi", () => {
  it("AD = 9191.5, CD = 0.5, densità = 2.5 → ND ≈ 0.01149", () => {
    expect(eventiPericolosi(2.5, 9191.5, 0.5)).toBeCloseTo(0.01149, 5);
  });

  it("densità zero → ND = 0", () => {
    expect(eventiPericolosi(0, 9191.5, 1)).toBe(0);
  });

  it("CD = 2 (collina) raddoppia ND rispetto a CD = 1", () => {
    expect(eventiPericolosi(2, 5000, 2)).toBeCloseTo(2 * eventiPericolosi(2, 5000, 1), 10);
  });

  it("lancia errore con valori negativi", () => {
    expect(() => eventiPericolosi(-1, 100, 1)).toThrow();
    expect(() => eventiPericolosi(1, 100, -0.5)).toThrow();
  });
});
