import { describe, expect, it } from "vitest";
import type { Corpo } from "./tipi";
import { applicaQuota, bloccoDaPunti, corpoSotto, improntaDaPunti, quotaDaProspetto, scalaDaDuePunti, sommita } from "./pianta2D";

const capannone: Corpo = { id: "a", nome: "Capannone", impronta: [[0, 0], [40, 0], [40, 20], [0, 20]], quotaBase: 0, altezzaGronda: 8, tipoTetto: "piano", altezzaColmo: 8 };
const uffici: Corpo = { id: "b", nome: "Uffici", impronta: [[0, 0], [10, 0], [10, 10], [0, 10]], quotaBase: 0, altezzaGronda: 12, tipoTetto: "piano", altezzaColmo: 12 };

describe("pianta 2D", () => {
  it("blocco sul tetto: base sulla copertura più alta sotto il suo centro", () => {
    const b = bloccoDaPunti([[20, 5], [24, 8]], 2.5, [capannone, uffici], { id: "x" })!;
    expect(b.impronta).toEqual([[20, 5], [24, 5], [24, 8], [20, 8]]);
    expect(b.quotaBase).toBe(8); expect(b.altezzaGronda).toBe(2.5); expect(sommita(b)).toBe(10.5);
    expect(b.nome).toBe("Blocco su Capannone");
    expect(bloccoDaPunti([[2, 2], [4, 4]], 3, [capannone, uffici], { id: "y" })!.quotaBase).toBe(12);
    expect(bloccoDaPunti([[50, 50], [52, 52]], 3, [capannone], { id: "z" })!.quotaBase).toBe(0);
    expect(bloccoDaPunti([[1, 1], [1, 5]], 3, [capannone], { id: "w" })).toBeNull();
  });
  it("poligono e corpo sotto", () => {
    expect(improntaDaPunti([[0, 0], [2, 0], [1, 2]])?.length).toBe(3);
    expect(corpoSotto([5, 5], [capannone, uffici])?.id).toBe("b");
    expect(corpoSotto([5, 5], [capannone, uffici], "b")?.id).toBe("a");
  });
  it("altezze dal prospetto", () => {
    const m = scalaDaDuePunti({ x: 0, y: 0 }, { x: 200, y: 0 }, 10)!; // 0,05 m/px
    expect(quotaDaProspetto(900, 660, m)).toBe(12);
    expect(applicaQuota(capannone, 9.5, "gronda")).toEqual({ altezzaGronda: 9.5, altezzaColmo: 9.5 });
    expect(applicaQuota(capannone, 11, "colmo")).toEqual({ tipoTetto: "falde", altezzaColmo: 11 });
    expect(applicaQuota({ ...capannone, quotaBase: 8 }, 10.5, "gronda").altezzaGronda).toBe(2.5);
  });
});
