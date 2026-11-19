import { describe, expect, it } from "vitest";
import { numeriDaTesto } from "./letturaDisplay";
describe("lettura del display", () => {
  it("riconosce valori in ohm, milliohm e kiloohm", () => {
    expect(numeriDaTesto("R = 0,12 Ω  RLOW")[0]).toEqual({ valore: 0.12, testo: "0,12 Ω" });
    expect(numeriDaTesto("85 mΩ")[0]!.valore).toBe(0.085);
    expect(numeriDaTesto("Re 1.25 kΩ")[0]!.valore).toBe(1250);
    expect(numeriDaTesto("8.5 ohm 50Hz").map((x) => x.valore)).toEqual([8.5, 50]);
    expect(numeriDaTesto("distanza 5 m").map((x) => x.valore)).toEqual([]);
  });
});
