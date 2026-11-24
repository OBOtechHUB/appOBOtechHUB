import { describe, expect, it } from "vitest";
import { modello3D, triangola } from "./modello3D";
import { esportaDxf3D, numeroTriangoli } from "../modelli3d/dxf3d";

describe("modello 3D per CAD", () => {
  it("triangola un poligono a L", () => {
    expect(triangola([[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]]).length).toBe(4);
  });
  it("edificio, falde, aste, conduttori a tubo, componenti, edificio reale", () => {
    const m = modello3D({
      corpi: [{ impronta: [[0, 0], [20, 0], [20, 10], [0, 10]], quotaBase: 0, altezzaGronda: 6, tipoTetto: "falde", altezzaColmo: 8 },
        { impronta: [[30, 0], [31, 0], [31, 1]], altezzaGronda: 3, mesh: { posizioni: [30, 0, 0, 31, 0, 0, 31, 1, 3] } }],
      aste: [{ x: 5, y: 5, z: 8, altezza: 2, diametro: 0.016 }],
      conduttori: [{ tipo: "captazione", sezione: 50, punti: [[0, 0, 6], [20, 0, 6], [20, 10, 6]] }, { tipo: "calata", punti: [[0, 0, 6], [0, 0, 0]] }],
      supporti: [{ x: 1, y: 0, z: 6, tipo: "supporto tetto piano cls" }],
      morsetti: [{ x: 0, y: 0, z: 6, tipo: "morsetto" }],
      picchetti: [{ x: -1, y: -1, z: 0, lunghezza: 1.5 }],
    });
    const nomi = m.map((x) => x.nome).sort();
    expect(nomi).toEqual(["LPS-3D-ASTE", "LPS-3D-CALATE", "LPS-3D-CAPTAZIONE", "LPS-3D-EDIFICIO", "LPS-3D-MORSETTI", "LPS-3D-SUPPORTI", "LPS-3D-TERRA"]);
    const ed = m.find((x) => x.nome === "LPS-3D-EDIFICIO")!;
    expect(numeroTriangoli(ed)).toBe(4 * 2 + 2 + 2 * 2 + 2 + 1); // pareti, base, 2 falde, 2 timpani, triangolo reale
    expect(Math.max(...Array.from(ed.posizioni).filter((_, i) => i % 3 === 2))).toBe(8);
    const dxf = esportaDxf3D(m, 1, "m");
    expect(dxf).toContain("LPS-3D-CAPTAZIONE"); expect(dxf.match(/3DFACE/g)!.length).toBeGreaterThan(100);
  });
});
