import { describe, it, expect } from "vitest";
import {
  resistenzaPicchetto, resistenzaOrizzontale, resistenzaMaglia, resistivitaWenner, resistenzaParallelo,
  diametroEquivalentePiatto, pratiche, stimaImpianto,
} from "./resistenzaTerra";

describe("resistenza di terra", () => {
  it("picchetto 3 m, Ø 20 mm, ρ = 100 Ω·m ≈ 32 Ω (formula pratica ρ/L ≈ 33 Ω)", () => {
    const r = resistenzaPicchetto(100, 3, 0.02);
    expect(r).toBeCloseTo((100 / (2 * Math.PI * 3)) * (Math.log(1200) - 1), 9);
    expect(r).toBeGreaterThan(30);
    expect(r).toBeLessThan(35);
    expect(Math.abs(r - pratiche.picchetto(100, 3)) / r).toBeLessThan(0.1);
  });

  it("anello Ø 20 m (perimetro 62,8 m) a 0,7 m ≈ 2ρ/(3D)", () => {
    const L = Math.PI * 20;
    const r = resistenzaOrizzontale(100, L, diametroEquivalentePiatto(0.03), 0.7);
    expect(Math.abs(r - pratiche.anello(100, 20)) / r).toBeLessThan(0.1);
  });

  it("maglia 20×20 m con 120 m di conduttore", () => {
    expect(resistenzaMaglia(100, 400, 120)).toBeCloseTo(25 * Math.sqrt(Math.PI / 400) + 100 / 120, 9);
  });

  it("Wenner: a = 2 m, R = 8 Ω → ρ ≈ 100,5 Ω·m", () => {
    expect(resistivitaWenner(2, 8)).toBeCloseTo(4 * Math.PI * 8, 9);
  });

  it("parallelo ideale e con coefficiente di utilizzo", () => {
    expect(resistenzaParallelo([10, 10])).toBeCloseTo(5, 9);
    expect(resistenzaParallelo([10, 10], 0.8)).toBeCloseTo(6.25, 9);
    expect(Number.isNaN(resistenzaParallelo([]))).toBe(true);
    expect(() => resistenzaParallelo([10], 0)).toThrow();
  });

  it("valori non validi → errore", () => {
    expect(() => resistenzaPicchetto(0, 3)).toThrow();
    expect(() => resistenzaOrizzontale(100, -1)).toThrow();
  });

  it("stima impianto anello + 4 picchetti", () => {
    const s = stimaImpianto(100, { metriOrizzontali: 60, larghezzaPiatto: 0.03, diametroTondo: 0.01, profondita: 0.7, picchetti: Array.from({ length: 4 }, () => ({ lunghezza: 3 })) });
    expect(s.rOrizzontale).not.toBeNull();
    expect(s.rPicchetti).not.toBeNull();
    expect(s.rTotale).toBeLessThan(s.rOrizzontale!);
    expect(s.conforme).toBe(s.rTotale <= 10);
    expect(s.dettaglio.length).toBe(3);
  });
});
