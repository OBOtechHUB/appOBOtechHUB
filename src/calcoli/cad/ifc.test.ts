import { describe, expect, it } from "vitest";
import { eIfcLps, generaIFC, guidIfc, leggiIfcLps, testoIfc } from "./ifc";
import type { Corpo } from "@/calcoli/edificio/tipi";

const corpo = { id: "c1", nome: "Blocco A", impronta: [[0, 0], [20, 0], [20, 10], [0, 10]], quotaBase: 0, altezzaGronda: 8, tipoTetto: "piano", altezzaColmo: 0 } as unknown as Corpo;
const ingresso = {
  progetto: { codice: "CRM-1", nome: "Scuola è nuova", comune: "Torino" },
  corpi: [corpo],
  aste: [{ id: "a1", x: 5, y: 5, z: 8, altezza: 4, diametro: 0.016, codiceOBO: "5402864" }],
  conduttori: [{ id: "k1", tipo: "captazione" as const, punti: [[0, 0, 8], [20, 0, 8], [20, 10, 8]] as [number, number, number][], materiale: "Al", sezione: "8", codiceOBO: "5021294" }],
  picchetti: [{ id: "p1", x: 0, y: -1, z: 0, lunghezza: 1.5, codiceOBO: "5000194" }],
  data: new Date("2026-11-24T12:00:00Z"),
};

describe("esportazione IFC", () => {
  it("GlobalId di 22 caratteri e testi codificati", () => {
    expect(guidIfc()).toMatch(/^[0-9A-Za-z_$]{22}$/);
    expect(testoIfc("l'asta è")).toBe("'l''asta \\X2\\00E8\\X0\\'");
  });
  it("scrive un IFC4 con corpi, aste, conduttori e picchetti", () => {
    const t = generaIFC(ingresso);
    expect(t.startsWith("ISO-10303-21;")).toBe(true);
    expect(t).toContain("FILE_SCHEMA(('IFC4'))");
    expect(t.match(/IFCBUILDINGELEMENTPROXY\(/g)?.length).toBe(4);
    expect(t).toContain("IFCSWEPTDISKSOLID(");
    expect(t).toContain("'5402864'");
    // ogni riferimento #n punta a un'entità esistente
    const def = new Set([...t.matchAll(/^#(\d+)=/gm)].map((m) => m[1]));
    for (const m of t.matchAll(/#(\d+)(?!=)/g)) expect(def.has(m[1])).toBe(true);
  });
  it("si reimporta: stessi corpi, aste, conduttori e picchetti", () => {
    const t = generaIFC(ingresso);
    expect(eIfcLps(t)).toBe(true);
    const m = leggiIfcLps(t);
    expect(m.corpi.length).toBe(1); expect(m.corpi[0]!.impronta.length).toBe(4); expect(m.corpi[0]!.altezzaGronda).toBeCloseTo(8);
    expect(m.aste[0]).toMatchObject({ x: 5, y: 5, z: 8, altezza: 4, codiceOBO: "5402864" }); expect(m.aste[0]!.diametro).toBeCloseTo(0.016);
    expect(m.conduttori[0]).toMatchObject({ tipo: "captazione", codiceOBO: "5021294", materiale: "Al" }); expect(m.conduttori[0]!.punti.length).toBe(3);
    expect(m.picchetti[0]).toMatchObject({ x: 0, y: -1, lunghezza: 1.5 });
    expect(m.corpi[0]!.nome).toBe("Blocco A");
  });
  it("si apre con web-ifc e ha la geometria", async () => {
    const W = await import("web-ifc");
    const api = new W.IfcAPI();
    await api.Init();
    const id = api.OpenModel(new TextEncoder().encode(generaIFC(ingresso)));
    const proxy = api.GetLineIDsWithType(id, W.IFCBUILDINGELEMENTPROXY);
    expect(proxy.size()).toBe(4);
    let conMesh = 0;
    for (let i = 0; i < proxy.size(); i++) if (api.GetFlatMesh(id, proxy.get(i)).geometries.size() > 0) conMesh++;
    expect(conMesh).toBe(4);
    api.CloseModel(id);
  }, 30000);
});
