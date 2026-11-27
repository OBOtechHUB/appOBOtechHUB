import { describe, expect, it } from "vitest";
import { SPECIFICA_ATTUALE, SPECIFICHE, daChiedere, specificheDopo } from "./specifiche";

describe("specifiche di calcolo", () => {
  it("id unici e in ordine", () => {
    const id = SPECIFICHE.map((s) => s.id);
    expect(new Set(id).size).toBe(id.length);
    expect([...id].sort()).toEqual(id);
  });
  it("progetto senza indicazione: tutti gli aggiornamenti; progetto aggiornato: nessuno", () => {
    expect(specificheDopo(undefined).length).toBe(SPECIFICHE.length);
    expect(specificheDopo(SPECIFICA_ATTUALE)).toEqual([]);
    expect(specificheDopo("2026-11-26-1").map((s) => s.id)[0]).toBe("2026-11-27-1");
    expect(specificheDopo(undefined, "antenne").every((s) => s.riguarda.includes("antenne"))).toBe(true);
  });
  it("si chiede una volta sola per aggiornamento", () => {
    expect(daChiedere(undefined)).toBe(true);
    expect(daChiedere({ calcolato: SPECIFICA_ATTUALE })).toBe(false);
    expect(daChiedere({ calcolato: "2026-11-25-1", rimandato: SPECIFICA_ATTUALE })).toBe(false);
    expect(daChiedere({ calcolato: "2026-11-25-1", rimandato: "2026-11-26-1" })).toBe(true);
  });
});
