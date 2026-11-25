import { describe, expect, it } from "vitest";
import { applicaQuota0, quota0Proposta, type Corpo3D } from "./importEdificio";

const tri = (z0: number, z1: number) => [0, 0, z0, 10, 0, z0, 0, 10, z1];
const corpo: Corpo3D = { id: "c", nome: "m.ifc", impronta: [[0, 0], [10, 0], [10, 10], [0, 10]], quotaBase: 0, altezzaGronda: 66, altezzaColmo: 66, tipoTetto: "altro", mesh: { posizioni: [...tri(0, 5) /* palo sotto */, ...tri(20, 66), ...tri(25, 30)] } } as Corpo3D;
corpo.livelli = [{ nome: "FONDO", z: 12, quota: -9 }, { nome: "LEVEL 00", z: 22, quota: 0.13 }, { nome: "ROOF", z: 67, quota: 45 }];

describe("quota 0 dei modelli 3D", () => {
  it("proposta: piano con quota di progetto più vicina a 0", () => { expect(quota0Proposta(corpo)).toBe(22); });
  it("toglie le parti sotto e misura le altezze dalla quota 0", () => {
    const c = applicaQuota0(corpo, 22);
    expect(c.altezzaGronda).toBeCloseTo(44);
    expect(c.mesh!.posizioni.length).toBe(18); // il palo sotto la quota 0 è tolto
    expect(Math.min(...c.mesh!.posizioni.filter((_, i) => i % 3 === 2))).toBe(0);
  });
});
