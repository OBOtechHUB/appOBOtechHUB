import { describe, expect, it } from "vitest";
import { calataDaPunto, collegaAsta, dispersoreInPunto, magliaSuCorpo, supportiLungo } from "./modificaManuale";
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
