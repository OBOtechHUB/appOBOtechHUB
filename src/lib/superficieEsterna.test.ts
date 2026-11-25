import { describe, expect, it } from "vitest";
import { improntaDaTriangoli, prioritaTriangoli } from "./superficieEsterna";

// due quadrati di tetto (orizzontali) che formano una L, un solaio interno sotto il tetto e una parete esterna
const quad = (x0: number, y0: number, x1: number, y1: number, z: number) => [x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z];
const tetto = [...quad(0, 0, 20, 10, 10), ...quad(0, 10, 10, 30, 15)];
const solaio = quad(1, 1, 19, 9, 5);
const parete = [0, 0, 0, 20, 0, 0, 20, 0, 10, 0, 0, 0, 20, 0, 10, 0, 0, 10];
const tri = [...tetto, ...solaio, ...parete];

describe("superficie esterna dei modelli complessi", () => {
  it("priorità: tetto 1, parete esterna 2, solaio interno 3", () => {
    const p = prioritaTriangoli(tri);
    expect([...p.slice(0, 4)]).toEqual([1, 1, 1, 1]);
    expect([...p.slice(4, 6)]).toEqual([3, 3]);
    expect(p[6]).toBe(2);
  });
  it("impronta a L (non l'involucro convesso)", () => {
    const imp = improntaDaTriangoli(tri);
    const area = Math.abs(imp.reduce((s, a, i) => { const b = imp[(i + 1) % imp.length]!; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
    expect(area).toBeGreaterThan(350); expect(area).toBeLessThan(460); // L = 200 + 200 = 400 m² (convesso sarebbe ~500)
    expect(imp.length).toBeLessThan(20);
  });
});
