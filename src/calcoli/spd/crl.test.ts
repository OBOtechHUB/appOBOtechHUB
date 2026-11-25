import { describe, expect, it } from "vitest";
import { lunghezzaEquivalente, trattiValutati, valutaCrl } from "./crl";

describe("CRL CEI 64-8/4 sezione 443", () => {
  it("lunghezza equivalente e limite di 1 km", () => {
    const t = trattiValutati({ aereaBt: 0.3, cavoBt: 0.5, aereaAt: 0.5 });
    expect(t.aereaBt).toBeCloseTo(0.3); expect(t.cavoBt).toBeCloseTo(0.5); expect(t.aereaAt).toBeCloseTo(0.2); expect(t.cavoAt).toBe(0);
    expect(lunghezzaEquivalente(t)).toBeCloseTo(2 * 0.3 + 0.5 + 0.4 * 0.2);
  });
  it("lunghezze ignote: la linea aerea BT completa fino a 1 km", () => {
    expect(trattiValutati({ cavoBt: 0.2 }, 1, true).aereaBt).toBeCloseTo(0.8);
  });
  it("esito", () => {
    // urbano, solo cavo BT 1 km, Ng 2,5: CRL = 850 / (1 · 2,5) = 340 → serve
    const a = valutaCrl({ conseguenzeGravi: false, ambiente: "urbano", ng: 2.5, tratti: { cavoBt: 1 } });
    expect(a.crl).toBeCloseTo(340); expect(a.serve).toBe(true);
    // urbano, cavo BT 0,2 km, Ng 1: CRL = 850 / 0,2 = 4250 → non serve
    expect(valutaCrl({ conseguenzeGravi: false, ambiente: "urbano", ng: 1, tratti: { cavoBt: 0.2 } }).serve).toBe(false);
    expect(valutaCrl({ conseguenzeGravi: true, ambiente: "rurale", ng: 1, tratti: {} }).obbligatoria).toBe(true);
  });
});
