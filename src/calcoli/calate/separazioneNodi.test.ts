import { describe, expect, it } from "vitest";
import { separazioneNodi } from "./separazioneNodi";
import type { Conduttore, Corpo } from "@/calcoli/edificio/tipi";

const cond = (id: string, tipo: "captazione" | "calata", punti: [number, number, number][]): Conduttore => ({ id, tipo, punti, materiale: "Al", sezione: "8", codiceOBO: "" });
const rett = (id: string, x0: number, y0: number, l: number, w: number, base: number, h: number): Corpo => ({ id, nome: id, impronta: [[x0, y0], [x0 + l, y0], [x0 + l, y0 + w], [x0, y0 + w]], quotaBase: base, altezzaGronda: h, tipoTetto: "piano", altezzaColmo: h });

describe("distanza di separazione ai nodi", () => {
  it("una calata: s = ki × l (kc = 1)", () => {
    const r = separazioneNodi({ conduttori: [cond("c", "calata", [[0, 0, 10], [0, 0, 0]])], aste: [{ id: "a", x: 0, y: 0, z: 10, altezza: 1, diametro: 0.016, codiceOBO: "" }], ki: 0.04 });
    expect(r.peggiore?.V).toBeCloseTo(11, 3);
    expect(r.peggiore?.sAria).toBeCloseTo(0.44, 3);
    expect(r.peggiore?.sSolido).toBeCloseTo(0.88, 3);
  });
  it("asta al centro tra due calate: la corrente si divide a metà", () => {
    const r = separazioneNodi({ conduttori: [cond("t", "captazione", [[0, 0, 10], [20, 0, 10]]), cond("c1", "calata", [[0, 0, 10], [0, 0, 0]]), cond("c2", "calata", [[20, 0, 10], [20, 0, 0]])], aste: [{ id: "a", x: 10, y: 0, z: 10, altezza: 1, diametro: 0.016, codiceOBO: "" }], ki: 0.04 });
    expect(r.peggiore?.V).toBeCloseTo(1 + 10, 3); // 1 m d'asta + due rami da 20 m in parallelo
    const asta = r.tratti.find((t) => t.origine === "asta:a")!;
    expect(asta.kc).toBeCloseTo(1, 3);
    expect(r.tratti.filter((t) => t.origine === "c1")[0]!.kc).toBeCloseTo(0.5, 3);
  });
  it("incrocio della maglia in pianta crea un nodo comune", () => {
    const r = separazioneNodi({ conduttori: [cond("x", "captazione", [[0, 5, 10], [10, 5, 10]]), cond("y", "captazione", [[5, 0, 10], [5, 10, 10]]), cond("c", "calata", [[0, 5, 10], [0, 5, 0]])], aste: [], ki: 0.04 });
    expect(r.nodi.some((n) => Math.abs(n.p[0] - 5) < 1e-6 && Math.abs(n.p[1] - 5) < 1e-6)).toBe(true);
    expect(r.nonCollegate).toEqual([]);
  });
  it("asta non collegata segnalata", () => {
    const r = separazioneNodi({ conduttori: [cond("c", "calata", [[0, 0, 10], [0, 0, 0]])], aste: [{ id: "iso", x: 5, y: 5, z: 10, altezza: 2, diametro: 0.016, codiceOBO: "" }], ki: 0.04 });
    expect(r.nonCollegate).toContain("asta:iso");
  });
  it("impianto sul tetto troppo vicino alla rete", () => {
    const corpi = [rett("edificio", 0, 0, 20, 20, 0, 10), rett("UTA", 9, 0.3, 2, 2, 10, 2)];
    const r = separazioneNodi({ conduttori: [cond("t", "captazione", [[0, 0, 10], [20, 0, 10]]), cond("c1", "calata", [[0, 0, 10], [0, 0, 0]])], aste: [], corpi, ki: 0.04 });
    expect(r.violazioni[0]?.nome).toBe("UTA");
    expect(r.violazioni[0]!.d).toBeLessThan(r.violazioni[0]!.s);
  });
});
