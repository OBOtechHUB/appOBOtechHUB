import { describe, it, expect } from "vitest";
import { leggiMappa, primaInManutenzione, SEZIONI_LPS, APP_HUB } from "./manutenzione";

describe("manutenzione", () => {
  it("legge il JSON salvato e ignora valori non validi", () => {
    expect(leggiMappa('{"app:lps":{"nome":"LPS","nome_en":"LPS"}}')).toHaveProperty("app:lps");
    expect(leggiMappa("non json")).toEqual({});
    expect(leggiMappa("[1,2]")).toEqual({});
    expect(leggiMappa(undefined)).toEqual({});
  });
  it("trova la prima voce in manutenzione (app intera prima della sezione)", () => {
    const m = { "lps:rischio": { nome: "R", nome_en: "R" }, "app:lps": { nome: "L", nome_en: "L" } };
    expect(primaInManutenzione(m, ["app:lps", "lps:rischio"])).toBe("app:lps");
    expect(primaInManutenzione({ "lps:rischio": m["lps:rischio"] }, ["app:lps", "lps:rischio"])).toBe("lps:rischio");
    expect(primaInManutenzione({ "lps:spd": { nome: "S", nome_en: "S" } }, ["app:lps", undefined])).toBeNull();
    expect(primaInManutenzione(undefined, ["app:lps"])).toBeNull();
  });
  it("elenchi con nomi inglesi e senza la Mappa tra le sezioni LPS", () => {
    expect(SEZIONI_LPS.some((s) => s.id === "lps:app_mappa")).toBe(false);
    expect(SEZIONI_LPS.find((s) => s.id === "lps:rischio")?.nome_en).toBe("Risk assessment");
    expect(APP_HUB.map((a) => a.id)).toEqual(["app:lps", "app:mappa", "app:prodotti", "app:torrette"]);
  });
});
