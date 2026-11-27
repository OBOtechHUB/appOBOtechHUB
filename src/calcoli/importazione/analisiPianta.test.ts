import { describe, expect, it } from "vitest";
import { altezzaDaTesto, analizzaPianta, corpiDaPianta, sembraProspetto, type PoliCad } from "./analisiPianta";

const rett = (layer: string, x: number, y: number, w: number, h: number, chiusa = true): PoliCad => ({ layer, chiusa, punti: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] });

describe("analisi della pianta CAD", () => {
  it("legge le altezze scritte nei testi", () => {
    expect(altezzaDaTesto("+12,50")).toBe(12.5);
    expect(altezzaDaTesto("H=9")).toBe(9);
    expect(altezzaDaTesto("h 2.5 m")).toBe(2.5);
    expect(altezzaDaTesto("quota +6.40")).toBe(6.4);
    expect(altezzaDaTesto("\\fArial|b0;Hgr 10")).toBe(10);
    expect(altezzaDaTesto("UTA 3")).toBeNull();
    expect(altezzaDaTesto("Capannone")).toBeNull();
  });
  it("riconosce corpi, impianti sul tetto, lucernari e doppioni (disegno in mm)", () => {
    const poli = [
      rett("EDIFICIO", 0, 0, 40000, 20000),           // corpo principale
      rett("EDIFICIO", 40000, 0, 15000, 10000),       // corpo accanto
      rett("EDIFICIO", 0, 0, 40000, 20000),           // doppione
      rett("IMPIANTI", 5000, 5000, 3000, 2000),       // UTA sul tetto
      rett("LUCERNARI", 20000, 8000, 2000, 2000),     // lucernario
      rett("EDIFICIO", 1000, 1000, 100, 100),         // troppo piccolo
    ];
    const el = analizzaPianta(poli, [
      { layer: "TESTI", x: 30000, y: 15000, testo: "+12,50" },
      { layer: "TESTI", x: 6000, y: 6000, testo: "UTA h 2,8" },
      { layer: "TESTI", x: 45000, y: 5000, testo: "H=8" },
    ], 0.001);
    const per = (r: string) => el.filter((e) => e.ruolo === r);
    expect(per("corpo")).toHaveLength(2);
    expect(per("impianto")).toHaveLength(1);
    expect(per("lucernario")).toHaveLength(1);
    expect(per("ignora")).toHaveLength(2);
    expect(per("corpo").map((e) => e.altezza).sort()).toEqual([12.5, 8]);
    expect(per("impianto")[0]!.altezza).toBe(2.8);
    const corpi = corpiDaPianta(el, 0.001, { corpo: 10, impianto: 1.5, lucernario: 0.6 });
    expect(corpi).toHaveLength(4);
    const uta = corpi.find((c) => c.nome.startsWith("Impianto"))!, luc = corpi.find((c) => c.nome.startsWith("Lucernario"))!;
    expect(uta.quotaBase).toBe(12.5); expect(uta.altezzaGronda).toBe(2.8);
    expect(luc.quotaBase).toBe(12.5); expect(luc.altezzaGronda).toBe(0.6);
    expect(uta.impronta[0]).toEqual([5, 5]);
  });
  it("una grande parte interna è un corpo (es. corpo più alto), non un impianto", () => {
    const el = analizzaPianta([rett("A", 0, 0, 30, 20), rett("A", 0, 0, 20, 20)], [], 1);
    expect(el.map((e) => e.ruolo)).toEqual(["corpo", "corpo"]);
  });
});

describe("prospetti scambiati per piante", () => {
  const q = (x: number, y: number, l: number, h: number): [number, number][] => [[x, y], [x + l, y], [x + l, y + h], [x, y + h]];
  it("contorni minuscoli o sottili senza un corpo intorno non sono corpi", () => {
    const el = analizzaPianta([{ layer: "A-ROOF", punti: q(0, 0, 7, 0.06), chiusa: true }, { layer: "A-ROOF", punti: q(20, 0, 0.6, 0.6), chiusa: true }, { layer: "A", punti: q(0, 10, 30, 20), chiusa: true }], [], 1);
    expect(el.filter((e) => e.ruolo === "corpo").map((e) => Math.round(e.area))).toEqual([600]);
    expect(el.filter((e) => e.ruolo === "ignora").length).toBe(2);
  });
  it("avviso dal nome del file o dal contenuto", () => {
    expect(sembraProspetto("--Elevation - HPS_Prospetto 01.dwg", [{ ruolo: "corpo", area: 600 }], [30, 20])).toMatch(/prospetto o una sezione/);
    expect(sembraProspetto("pianta coperture.dwg", [{ ruolo: "corpo", area: 600 }], [30, 20])).toBeNull();
    expect(sembraProspetto("disegno.dwg", [{ ruolo: "ignora", area: 0.4 }, { ruolo: "ignora", area: 0.2 }], [71.3, 41.4])).toMatch(/non sembra una pianta/);
    expect(sembraProspetto("disegno.dwg", [], [10, 10])).toBeNull();
  });
});
