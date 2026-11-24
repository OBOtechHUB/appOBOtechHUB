// @vitest-environment node
import { describe, expect, it } from "vitest";
import { leggiDXF } from "./importEdificio";

const linea = (l: string, a: number[], b: number[]) => `0\nLINE\n8\n${l}\n10\n${a[0]}\n20\n${a[1]}\n30\n0\n11\n${b[0]}\n21\n${b[1]}\n31\n0\n`;
const dxf = `0\nSECTION\n2\nENTITIES\n${linea("EDIFICIO", [0, 0], [24000, 0])}${linea("EDIFICIO", [24000, 0], [24000, 12000])}${linea("EDIFICIO", [24000, 12000], [0, 12000])}${linea("EDIFICIO", [0, 12000], [0, 0])}0\nENDSEC\n0\nEOF\n`;

describe("DXF senza polilinee", () => {
  it("unisce le LINE in un contorno chiuso e lo importa", async () => {
    const f = new File([dxf], "pianta.dxf");
    const l = await leggiDXF(f, 1);
    expect(l.poligoni).toHaveLength(1);
    expect(l.corpi("EDIFICIO")[0]!.impronta).toHaveLength(4);
    expect(l.approssimato).toBe(false);
  });
});
