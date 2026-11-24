import { describe, expect, it } from "vitest";
import { quantitaOrdine } from "./confezioni";
describe("quantità per confezione", () => {
  it("intere e per eccesso al multiplo della confezione", () => {
    expect(quantitaOrdine(4038.85)).toBe(4039);
    expect(quantitaOrdine(4038.85, 50)).toBe(4050);
    expect(quantitaOrdine(3593, 100)).toBe(3600);
    expect(quantitaOrdine(300, 100)).toBe(300);
    expect(quantitaOrdine(0, 10)).toBe(0);
  });
});
