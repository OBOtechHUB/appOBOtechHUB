import { describe, expect, it } from "vitest";
import { contorniDaTratti, trattiDaEntita, unisciTratti } from "./contorni";

describe("contorni da disegni senza polilinee chiuse", () => {
  it("unisce linee singole (anche invertite) in un contorno chiuso", () => {
    const linee = [[[0, 0], [10, 0]], [[10, 5], [10, 0]], [[10, 5], [0, 5]], [[0, 0], [0, 5.00001]]].map((p) => ({ layer: "MURI", punti: p as [number, number][], chiusa: false }));
    const c = unisciTratti(linee, 0.001);
    expect(c).toHaveLength(1); expect(c[0]!.punti).toHaveLength(4);
  });
  it("legge LINE, ARC, CIRCLE, polilinee aperte e blocchi INSERT", () => {
    const blocchi = { PILASTRO: [{ type: "LWPOLYLINE", layer: "0", shape: true, vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }] };
    const t = trattiDaEntita([
      { type: "LINE", layer: "A", vertices: [{ x: 0, y: 0 }, { x: 20, y: 0 }] },
      { type: "LINE", layer: "A", startPoint: { x: 20, y: 0 }, endPoint: { x: 20, y: 10 } },
      { type: "LWPOLYLINE", layer: "A", vertices: [{ x: 20, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }] },
      { type: "CIRCLE", layer: "B", center: { x: 50, y: 50 }, radius: 2 },
      { type: "ARC", layer: "C", center: { x: 0, y: 0 }, radius: 1, startAngle: 0, endAngle: 90 },
      { type: "INSERT", layer: "P", name: "PILASTRO", position: { x: 100, y: 0 }, rotation: 90 },
      { type: "LINE", layer: "A", isInPaperSpace: true, vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    ], blocchi, { rotazioneInGradi: true });
    const { chiusi } = contorniDaTratti(t);
    const A = chiusi.find((c) => c.layer === "A")!; expect(A.punti.length).toBeGreaterThanOrEqual(4);
    expect(chiusi.some((c) => c.layer === "B")).toBe(true);
    const P = chiusi.find((c) => c.layer === "P")!; expect(Math.min(...P.punti.map((p) => p[0]))).toBeCloseTo(99, 5);
  });
  it("se non si chiude niente propone il contorno esterno del layer", () => {
    const { chiusi, approssimati } = contorniDaTratti([{ layer: "X", punti: [[0, 0], [10, 0]], chiusa: false }, { layer: "X", punti: [[10, 8], [0, 8]], chiusa: false }]);
    expect(chiusi).toHaveLength(0); expect(approssimati[0]!.punti).toHaveLength(4);
  });
});
