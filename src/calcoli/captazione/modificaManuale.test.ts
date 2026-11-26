import { describe, expect, it } from "vitest";
import { agganciaSpostamento, calataDaPunto, collegaAsta, dispersoreInPunto, magliaSuCorpo, spostaCorpo, supportiLungo } from "./modificaManuale";
import { CATALOGO_T1_05 } from "./proponiCaptazione";
import type { Corpo } from "@/calcoli/edificio/tipi";

const corpo: Corpo = { id: "c", nome: "c", impronta: [[0, 0], [20, 0], [20, 10], [0, 10]], quotaBase: 0, altezzaGronda: 8, tipoTetto: "piano", altezzaColmo: 8 };

describe("modifica a mano della captazione", () => {
  it("supporti ogni 1 m", () => { expect(supportiLungo([[0, 0, 0], [5, 0, 0]], 1, "supporto")).toHaveLength(5); });
  it("calata da un punto del tetto: tratto al bordo, calata, dispersore", () => {
    const r = calataDaPunto([corpo], [5, 3, 8], CATALOGO_T1_05);
    expect(r.conduttori.map((c) => c.tipo)).toEqual(["captazione", "calata"]);
    expect(r.conduttori[1]!.punti[0]).toEqual([5, 0, 8]);
    expect(r.picchetti).toHaveLength(1);
    expect(r.supporti.filter((s) => s.tipo === "supporto calata").length).toBeGreaterThanOrEqual(7);
  });
  it("maglia su una copertura con calate", () => {
    const r = magliaSuCorpo(corpo, 10, CATALOGO_T1_05, { calate: true, distanzaCalate: 15 });
    expect(r.conduttori.filter((c) => c.tipo === "captazione").length).toBeGreaterThan(1);
    expect(r.conduttori.filter((c) => c.tipo === "calata").length).toBeGreaterThanOrEqual(4);
  });
  it("collega un'asta al conduttore più vicino", () => {
    const r = collegaAsta({ id: "a", x: 5, y: 3, z: 8, altezza: 1.5, diametro: 0.016, codiceOBO: "" }, [{ id: "p", tipo: "captazione", punti: [[0, 0, 8], [20, 0, 8]], materiale: "Al", sezione: "8", codiceOBO: "" }], CATALOGO_T1_05);
    expect(r?.conduttori[0]!.punti[1]).toEqual([5, 0, 8]);
  });
  it("dispersore collegato al piede della calata vicina", () => {
    const r = dispersoreInPunto([3, -2, 0], [{ id: "k", tipo: "calata", punti: [[0, 0, 8], [0, 0, 0]], materiale: "Al", sezione: "8", codiceOBO: "" }]);
    expect(r.picchetti).toHaveLength(1);
    expect(r.conduttori[0]?.tipo).toBe("terra");
  });
});

describe("spostamento dei blocchi", () => {
  const A: Corpo = { id: "A", nome: "A", impronta: [[0, 0], [20, 0], [20, 10], [0, 10]], quotaBase: 0, altezzaGronda: 8, tipoTetto: "piano", altezzaColmo: 8 };
  const B: Corpo = { id: "B", nome: "B", impronta: [[30, 0], [40, 0], [40, 10], [30, 10]], quotaBase: 0, altezzaGronda: 5, tipoTetto: "piano", altezzaColmo: 5 };
  const k = (id: string, tipo: "captazione" | "calata" | "terra", punti: [number, number, number][]) => ({ id, tipo, punti, materiale: "Al", sezione: "Ø 8 mm", codiceOBO: "" });
  const st = {
    corpi: [A, B, { ...B, id: "U", nome: "UTA", impronta: [[5, 5], [8, 5], [8, 7], [5, 7]] as [number, number][], quotaBase: 8, altezzaGronda: 2, altezzaColmo: 2 }],
    aste: [{ id: "a1", x: 5, y: 5, z: 8, altezza: 2, diametro: 0.016, codiceOBO: "" }, { id: "a2", x: 35, y: 5, z: 5, altezza: 2, diametro: 0.016, codiceOBO: "" }],
    conduttori: [k("c1", "captazione", [[0, 0, 8], [20, 0, 8]]), k("c2", "calata", [[0, 0, 8], [0, 0, 0]]), k("t", "terra", [[0, 0, -0.5], [30, 0, -0.5]])],
    supporti: [{ x: 10, y: 0, z: 8 }, { x: 35, y: 0, z: 5 }, { x: 0, y: 0, z: 4 }], morsetti: [], compensatori: [],
    picchetti: [{ x: 0, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }],
  };
  it("sposta il blocco con aste, conduttori, supporti e picchetto della sua calata", () => {
    const r = spostaCorpo(st, "A", 2, 3);
    expect(r.corpi[0]!.impronta[0]).toEqual([2, 3]);
    expect(r.corpi[1]).toBe(B);
    expect(r.corpi[2]!.impronta[0]).toEqual([7, 8]);
    expect(r.aste.map((a) => [a.x, a.y])).toEqual([[7, 8], [35, 5]]);
    expect(r.conduttori[0]!.punti[1]).toEqual([22, 3, 8]);
    expect(r.conduttori[1]!.punti[1]).toEqual([2, 3, 0]);
    expect(r.conduttori[2]).toBe(st.conduttori[2]);
    expect(r.supporti.map((s) => s.x)).toEqual([12, 35, 2]);
    expect(r.picchetti.map((p) => p.x)).toEqual([2, 30]);
    const solo = spostaCorpo(st, "A", 2, 3, false);
    expect(solo.aste).toBe(st.aste);
  });
  it("aggancio al lato di un altro blocco e a 10 cm", () => {
    expect(agganciaSpostamento(A, [A, B], 9.8, 0.04)).toEqual([10, 0]);
    const [x, y] = agganciaSpostamento(A, [A, B], 5.03, 2.27);
    expect(x).toBeCloseTo(5, 6); expect(y).toBeCloseTo(2.3, 6);
  });
});
