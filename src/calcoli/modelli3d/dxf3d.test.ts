import { describe, it, expect } from "vitest";
import DxfParser from "dxf-parser";
import { coloreAci, esportaDxf3D, limiti, nomeLayer, numeroTriangoli, type Mesh3D } from "./dxf3d";

const cubo: Mesh3D = {
  nome: "Asta Ø16",
  posizioni: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0],
  indici: [0, 1, 2, 0, 2, 3],
  colore: [0.7, 0.7, 0.7],
};

describe("DXF 3D da mesh", () => {
  it("limiti e triangoli", () => {
    expect(limiti([cubo])).toEqual({ min: [0, 0, 0], max: [10, 10, 0] });
    expect(numeroTriangoli(cubo)).toBe(2);
    expect(numeroTriangoli({ nome: "x", posizioni: new Array(18).fill(0) })).toBe(2);
    expect(limiti([])).toBeNull();
  });

  it("nomi layer validi e colori", () => {
    expect(nomeLayer("Asta Ø16", 0)).toBe("Asta_16");
    expect(nomeLayer("", 2)).toBe("PARTE_3");
    expect(coloreAci([1, 0, 0])).toBe(1);
    expect(coloreAci([0.5, 0.5, 0.5])).toBe(8);
    expect(coloreAci(null)).toBe(8);
  });

  it("produce un DXF leggibile con un 3DFACE per triangolo, anche in metri", () => {
    const testo = esportaDxf3D([cubo]);
    const dxf = new DxfParser().parseSync(testo);
    const facce = dxf?.entities.filter((e) => e.type === "3DFACE") ?? [];
    expect(facce).toHaveLength(2);
    expect(facce[0]?.layer).toBe("Asta_16");
    const inMetri = esportaDxf3D([cubo], 0.001, "m");
    expect(inMetri).toContain("\r\n0.01\r\n");
  });
});
