import { describe, it, expect } from "vitest";
import { INTERVALLI_TIPICI, aggiungiAnni, prossimeScadenze, riepilogo, scaduta, verificaSchema, vociPerTipo, CHECKLIST } from "./verifiche";

const v = (data: string, tipo: "visiva" | "completa" | "straordinaria") => verificaSchema.parse({ id: data + tipo, data, tipo });

describe("verifiche periodiche", () => {
  it("somma anni gestendo il 29 febbraio", () => {
    expect(aggiungiAnni("2024-02-29", 1)).toBe("2025-02-28");
    expect(aggiungiAnni("2026-11-07", 2)).toBe("2028-11-07");
  });

  it("scadenze per LPL III: visiva 2 anni, completa 4 anni (1 se critico)", () => {
    const lista = [v("2024-05-10", "completa"), v("2025-06-01", "visiva")];
    expect(prossimeScadenze(lista, INTERVALLI_TIPICI.III)).toEqual({ visiva: "2027-06-01", completa: "2028-05-10" });
    expect(prossimeScadenze(lista, INTERVALLI_TIPICI.III, true).completa).toBe("2025-05-10");
    expect(prossimeScadenze([], INTERVALLI_TIPICI.I)).toEqual({ visiva: null, completa: null });
  });

  it("la verifica straordinaria non sposta le scadenze", () => {
    const lista = [v("2024-01-01", "visiva"), v("2025-01-01", "straordinaria")];
    expect(prossimeScadenze(lista, INTERVALLI_TIPICI.I).visiva).toBe("2025-01-01");
  });

  it("riepilogo esiti", () => {
    const base = v("2026-01-01", "visiva");
    expect(riepilogo(base).esito).toBe("incompleta");
    const tutteC = { ...base, esiti: Object.fromEntries(vociPerTipo("visiva").map((x) => [x.id, { esito: "C" as const, nota: "" }])) };
    expect(riepilogo(tutteC)).toMatchObject({ esito: "conforme", daCompilare: 0 });
    const conNC = { ...tutteC, esiti: { ...tutteC.esiti, "capt-integrita": { esito: "NC" as const, nota: "asta piegata" } } };
    expect(riepilogo(conNC).esito).toBe("non conforme");
  });

  it("la verifica visiva esclude le misure", () => {
    expect(vociPerTipo("visiva").length).toBeLessThan(CHECKLIST.length);
    expect(vociPerTipo("visiva").some((x) => x.id === "terra-misura")).toBe(false);
  });

  it("scadenza superata", () => {
    expect(scaduta("2026-01-01", "2026-11-07")).toBe(true);
    expect(scaduta(null, "2026-11-07")).toBe(false);
  });
});
