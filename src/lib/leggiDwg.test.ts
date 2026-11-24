// @vitest-environment node
import { describe, expect, it } from "vitest";
import { letturaDaPolilinee, polilineeDaDatabase, leggiDWG } from "./leggiDwg";

describe("lettura DWG", () => {
  it("polilinee dal database LibreDWG: chiuse per flag o per primo = ultimo vertice", () => {
    const poli = polilineeDaDatabase({ entities: [
      { type: "LWPOLYLINE", layer: "EDIFICIO", flag: 1, vertices: [{ x: 0, y: 0 }, { x: 24000, y: 0 }, { x: 24000, y: 12000 }, { x: 0, y: 12000 }] },
      { type: "LWPOLYLINE", layer: "EDIFICIO", flag: 0, vertices: [{ x: 30000, y: 0 }, { x: 36000, y: 0 }, { x: 36000, y: 6000 }, { x: 30000, y: 0 }] },
      { type: "LWPOLYLINE", layer: "QUOTE", flag: 0, vertices: [{ x: 0, y: -1000 }, { x: 24000, y: -1000 }] },
      { type: "LINE", layer: "X" },
      { type: "LWPOLYLINE", layer: "CARTIGLIO", flag: 1, isInPaperSpace: true, vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
    ] });
    const l = letturaDaPolilinee(poli, "mm", "DWG");
    expect(l.layers[0]).toBe("EDIFICIO");
    expect(l.corpi("EDIFICIO")).toHaveLength(2);
    expect(l.corpi("EDIFICIO")[1]!.impronta).toHaveLength(3);
    expect(l.ingombro("EDIFICIO")).toEqual([36000, 12000]);
    expect(l.corpi("QUOTE")).toHaveLength(0);
  });

  it("legge un DWG vero (file di prova di LibreDWG, se raggiungibile)", async () => {
    let buf: ArrayBuffer;
    try {
      const r = await fetch("https://raw.githubusercontent.com/LibreDWG/libredwg/master/test/test-data/example_2000.dwg");
      if (!r.ok) return;
      buf = await r.arrayBuffer();
    } catch { return; } // senza rete il test si salta
    const f = { name: "example_2000.dwg", size: buf.byteLength, arrayBuffer: async () => buf } as unknown as File;
    const l = await leggiDWG(f, "./node_modules/@mlightcad/libredwg-web/wasm");
    expect(l.unita).toBe("mm");
    expect(l.layers.length).toBeGreaterThan(0);
    expect(l.poligoni.length).toBeGreaterThan(0); // linee e archi uniti o contorno del layer: si importa sempre
  }, 60000);
});
