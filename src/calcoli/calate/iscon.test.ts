import { describe, expect, it } from "vitest";
import { lunghezzaMassima, verificaIscon, versioneMinima } from "./iscon";

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
});
