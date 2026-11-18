import { describe, expect, it } from "vitest";
import { apriRevisione, emetti, impronta, modificatoDopoEmissione, revSuccessiva } from "./revisioni";

describe("revisioni del progetto", () => {
  it("sequenza A, B … Z, AA", () => {
    expect(revSuccessiva(null)).toBe("A");
    expect(revSuccessiva("A")).toBe("B");
    expect(revSuccessiva("Z")).toBe("AA");
    expect(revSuccessiva("AZ")).toBe("BA");
  });
  it("l'impronta ignora revisioni ed emissione e cambia con il contenuto", () => {
    const a = { x: 1, esteso: { revisioni: [1], emissione: { stato: "emesso" } } };
    expect(impronta(a)).toBe(impronta({ x: 1, esteso: { revisioni: [], emissione: { stato: "bozza" } } }));
    expect(impronta(a)).not.toBe(impronta({ x: 2, esteso: {} }));
  });
  it("emissione, modifica rilevata, nuova revisione", () => {
    const c1 = { edificio: { nome: "Capannone" } };
    const r = emetti([], c1, { autore: "Marco", descrizione: "" });
    expect(r.revisione.rev).toBe("A");
    expect(r.revisione.descrizione).toBe("Prima emissione");
    expect(modificatoDopoEmissione(r.emissione, c1)).toBe(false);
    expect(modificatoDopoEmissione(r.emissione, { edificio: { nome: "Capannone 2" } })).toBe(true);
    const bozza = apriRevisione(r.emissione);
    expect(bozza.stato).toBe("bozza");
    expect(modificatoDopoEmissione(bozza, { edificio: { nome: "Capannone 2" } })).toBe(false);
    const r2 = emetti(r.revisioni, { edificio: { nome: "Capannone 2" } }, { autore: "Marco", descrizione: "Aggiunte calate" });
    expect(r2.revisione.rev).toBe("B");
    expect(r2.revisioni).toHaveLength(2);
  });
});
