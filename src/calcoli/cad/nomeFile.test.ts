import { describe, expect, it } from "vitest";
import { baseFile, nomeFileProgetto } from "./nomeFile";

describe("nome dei file CAD", () => {
  it("codice CRM e revisione", () => {
    expect(nomeFileProgetto("P-2026-0142", "Scuola", { emissione: { stato: "emesso", rev: "A" }, revisioni: [{ rev: "A" }] })).toBe("P-2026-0142_LPS_RevA");
    expect(nomeFileProgetto("P-2026-0142", "Scuola", { emissione: { stato: "bozza", rev: null }, revisioni: [{ rev: "A" }] })).toBe("P-2026-0142_LPS_RevB_bozza");
    expect(nomeFileProgetto("", "Scuola Città", { emissione: { stato: "bozza", rev: null }, revisioni: [] })).toBe("Scuola_Citta_LPS_RevA_bozza");
  });
  it("caratteri non validi", () => {
    expect(baseFile(" P/26 0142 ", "")).toBe("P_26_0142");
    expect(baseFile("", "")).toBe("progetto");
  });
});
