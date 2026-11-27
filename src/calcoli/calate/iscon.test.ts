import { describe, expect, it } from "vitest";
import { ammessaPerCorrente, codiceIscon, lunghezzaMassima, scegliIscon, verificaIscon, versioneMinima } from "./iscon";

describe("conduttore isolato isCon", () => {
  it("verifica s richiesta contro s equivalente", () => {
    expect(verificaIscon("basic", 0.4).conforme).toBe(true);
    expect(verificaIscon("basic", 0.5).conforme).toBe(false);
    expect(verificaIscon("premium", 0.5, "solido").sEq).toBeCloseTo(1.8);
  });
  it("versione minima", () => {
    expect(versioneMinima(0.3)).toBe("basic");
    expect(versioneMinima(0.6)).toBe("proplus");
    expect(versioneMinima(0.85)).toBe("premium");
    expect(versioneMinima(1.2)).toBeNull();
  });
  it("lunghezza massima: LPL III, una calata (kc = 1), Pro+ in aria", () => {
    expect(lunghezzaMassima("proplus", 0.04, 1)).toBeCloseTo(18.75);
  });
  it("lunghezze massime come la tabella OBO (km = 1)", () => {
    expect(lunghezzaMassima("basic", 0.06, 1)).toBeCloseTo(7.5, 2);
    expect(lunghezzaMassima("pro", 0.06, 0.66)).toBeCloseTo(18.94, 2);
    expect(lunghezzaMassima("premium", 0.06, 0.44)).toBeCloseTo(34.09, 2);
    expect(lunghezzaMassima("premium", 0.08, 1)).toBeCloseTo(11.25, 2);
    expect(lunghezzaMassima("pro", 0.04, 0.44)).toBeCloseTo(42.61, 2);
  });
  it("LPL I con una sola calata: solo Premium 90 (H2, 200 kA)", () => {
    expect(ammessaPerCorrente("proplus", "I", 1)).toBe(false);
    expect(ammessaPerCorrente("premium", "I", 1)).toBe(true);
    expect(ammessaPerCorrente("basic", "I", 2)).toBe(true);
    expect(versioneMinima(0.3, "aria", "I", 1)).toBe("premium");
  });
  it("guida alla scelta OBO", () => {
    expect(scegliIscon({ sAria: 0.8 })?.versione).toBe("premium");
    expect(scegliIscon({ sAria: 0.4 })?.versione).toBe("basic");
    expect(scegliIscon({ sAria: 0.6 })?.versione).toBe("proplus"); // la Pro 75 normale non si propone più
    expect(scegliIscon({ sAria: 0.4, atex: true })?.codice).toBe("5408006");
    expect(scegliIscon({ sAria: 0.4, tensioniContatto: true })?.colore).toBe("grigio chiaro");
    expect(scegliIscon({ sAria: 1 })).toBeNull();
  });
  it("codice da ordinare: al metro (minimo 6 m) sotto la bobina, altrimenti bobina", () => {
    expect(codiceIscon("basic", 4.2)).toMatchObject({ codice: "5407980", quantita: 6 });
    expect(codiceIscon("basic", 37.1)).toMatchObject({ codice: "5407980", quantita: 38 });
    expect(codiceIscon("basic", 120)).toMatchObject({ codice: "5408014", quantita: 120 });
    expect(codiceIscon("premium", 20)).toMatchObject({ codice: "5407984", quantita: 20 });
    expect(codiceIscon("proplus", 20)).toMatchObject({ codice: "5408006", quantita: 20 });
  });
});
