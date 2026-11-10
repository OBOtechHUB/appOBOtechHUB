import { describe, it, expect } from "vitest";
import { candidati, conduttoriLinea, datiSpd, numero, poliAdatti, requisitiIngresso, UW_CATEGORIA } from "./sceltaSpd";

describe("scelta SPD", () => {
  it("conduttori della linea", () => {
    expect(conduttoriLinea("TN-C", "trifase")).toBe(4);
    expect(conduttoriLinea("TN-S", "trifase")).toBe(5);
    expect(conduttoriLinea("TT", "monofase")).toBe(2);   // fase + N: il PE è locale
    expect(conduttoriLinea("TT", "trifase")).toBe(4);
    expect(conduttoriLinea("TN-C-S", "trifase")).toBe(4); // entra con fasi + PEN
  });

  it("Iimp per polo: LPL I, 1 servizio, TN-C trifase → 25 kA; LPL III, 2 servizi, TN-S → 5 kA", () => {
    expect(requisitiIngresso("I", 1, "TN-C", "trifase", UW_CATEGORIA.II).iimpPolo).toBeCloseTo(25, 9);
    const r = requisitiIngresso("III", 2, "TN-S", "trifase", UW_CATEGORIA.II);
    expect(r.iimpPolo).toBeCloseTo(5, 9);
    expect(r.ucMin).toBeCloseTo(253, 9);
    expect(r.upMax).toBeCloseTo(2, 9);
  });

  it("lettura dei valori del catalogo", () => {
    expect(numero("12,5 kA")).toBe(12.5);
    expect(numero("≤1,3")).toBe(1.3);
    expect(numero("≤1500")).toBe(1500);
    const d = datiSpd({ "SPD to EN 61643-11": "Type 1+2", "Lightning surge current (10/350 μs)": "12,5 kA", "Lightning surge current (10/350)": "50 kA", "Protection level [L-N]": "≤1500", "Maximum continuous voltage AC": "255 V", "Pole version": "3", "TN-C network form": "yes" });
    expect(d).toMatchObject({ tipo: "Type 1+2", iimpPolo: 12.5, iimpTotale: 50, upKv: 1.5, uc: 255, poli: "3", reti: ["TN-C"] });
    expect(poliAdatti("TT", "trifase")).toEqual(["3+N/PE"]);
  });

  it("candidati all'ingresso ordinati per sovradimensionamento minimo", () => {
    const p = (codice: string, iimp: string, up: string, poli = "3") => ({ codice, nome: codice, datiTecnici: { "SPD to EN 61643-11": "Type 1+2", "Lightning surge current (10/350 μs)": iimp, "Protection level [L-N]": up, "Maximum continuous voltage AC": "255 V", "Pole version": poli } });
    const req = requisitiIngresso("III", 1, "TN-C", "trifase", UW_CATEGORIA.II); // 12,5 kA, Up ≤ 2 kV
    const c = candidati([p("A", "25 kA", "≤1,7"), p("B", "12,5 kA", "≤1,5"), p("C", "7 kA", "≤1,3"), p("D", "50 kA", "≤2,5"), p("E", "25 kA", "≤1,3", "1+N/PE")], "ingresso", req, "TN-C", "trifase");
    expect(c.map((x) => x.prodotto.codice)).toEqual(["B", "A"]);
  });
});
