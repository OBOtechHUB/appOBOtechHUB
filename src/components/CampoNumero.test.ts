import { describe, expect, it } from "vitest";
import { analizzaNumero } from "./CampoNumero";
describe("campo numerico", () => {
  it("accetta virgola e stati intermedi", () => {
    expect(analizzaNumero("0,")).toBe(0); expect(analizzaNumero("1,25")).toBe(1.25); expect(analizzaNumero("")).toBeNull();
    expect(analizzaNumero(",5")).toBe(0.5); expect(analizzaNumero("1,2,3")).toBeUndefined(); expect(analizzaNumero("abc")).toBeUndefined();
  });
});
