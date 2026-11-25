import { describe, expect, it } from "vitest";
import lsp from "../../../public/cad/LPS.lsp?raw";
import { confrontaVersioni, LSP_VERSIONE, leggimiPacchetto } from "./versioni";

describe("versioni di LPS.lsp e istruzioni", () => {
  it("LSP_VERSIONE coincide con *LPS-VERSIONE* di public/cad/LPS.lsp", () => {
    expect(lsp.match(/\(setq \*LPS-VERSIONE\* "([^"]+)"\)/)?.[1]).toBe(LSP_VERSIONE);
    expect(lsp).toContain("c:LPS-VERSIONE");
  });
  it("confronto numerico delle versioni", () => {
    expect(confrontaVersioni("3.5", "3.6")).toBe(-1);
    expect(confrontaVersioni("3.10", "3.9")).toBe(1);
    expect(confrontaVersioni("3.6", "3.6.0")).toBe(0);
  });
  it("LEGGIMI con la versione", () => { expect(leggimiPacchetto()).toContain(`LPS.lsp ${LSP_VERSIONE}`); });
});
