import { describe, expect, it } from "vitest";
import { calcolaTratta } from "./calcolo";
import { barreNecessarie, catalogoDaJson, distintaProgetto, trovaArticolo } from "./componenti";
import { relazioneStaffaggi } from "./relazione";
import { tavoleStaffaggi } from "./tavole";
import { nuovaTratta, progettoStaffaggiSchema, trattaSchema } from "./tipi";
import { pdfTavole } from "@/calcoli/cad/pdfTavole";
import { creaDocx } from "@/lib/docx";

const progetto = () => {
  const a = nuovaTratta(1);
  const b = trattaSchema.parse({ ...nuovaTratta(2), tipologia: "parete-mensola", piani: [{ larghezza: 200 }, { larghezza: 300, caricoCavi: 30 }] });
  return progettoStaffaggiSchema.parse({ nome: "Prova", codice: "CRM-1", tratte: [a, b] });
};

describe("uscite staffaggi", () => {
  it("taglia i profilati dalle barre da 3 m", () => {
    expect(barreNecessarie([700, 700, 700, 700]).barre).toBe(1);
    expect(barreNecessarie([1600, 1600]).barre).toBe(2);
    expect(barreNecessarie([]).barre).toBe(0);
  });
  it("somma i componenti di tutte le tratte", () => {
    const pr = progetto(), r = pr.tratte.map((t) => calcolaTratta(t));
    const d = distintaProgetto(pr, r, { articoli: [], aggiornato: null });
    const mensole = d.filter((x) => x.ruolo === "mensola").reduce((s, x) => s + x.quantita, 0);
    expect(mensole).toBe(2 * r[1]!.supporti);
    expect(d.some((x) => x.ruolo === "profilato" && x.quantita > 0)).toBe(true);
    expect(d.every((x) => x.codice === null)).toBe(true);
  });
  it("trova il codice nel catalogo con finitura e misure", () => {
    const cat = catalogoDaJson({ catalogo: [
      { codice: "1", nome: "Profile rail MS4141", varianti: [{ codice: "6347108", tipo: "MS4141P3000FS", valori: ["3000 mm", "FS"] }, { codice: "6347109", tipo: "MS4141P3000FT", valori: ["3000 mm", "FT"] }] },
      { codice: "6420604", nome: "Bracket AW 30", varianti: [{ codice: "6420604", tipo: "AW 30 31 FS", valori: ["310 mm", "FS"] }] },
    ] });
    expect(trovaArticolo({ ruolo: "profilato", tipo: "MS4141" }, "FT", cat)?.codice).toBe("6347109");
    expect(trovaArticolo({ ruolo: "mensola", tipo: "AW 30", lunghezza: 310 }, "FS", cat)?.codice).toBe("6420604");
    expect(trovaArticolo({ ruolo: "mensola", tipo: "AW 30", lunghezza: 410 }, "FS", cat)).toBeNull();
  });
  it("crea tavole DXF e PDF e la relazione Word", () => {
    const pr = progetto(), r = pr.tratte.map((t) => calcolaTratta(t));
    const { w, fogli, layer } = tavoleStaffaggi(pr, r);
    expect(fogli).toHaveLength(2);
    const dxf = w.finale();
    expect(dxf).toContain("STF-PROFILATI");
    expect(dxf).toContain("STF-01");
    const pdf = new TextDecoder().decode(pdfTavole(w, fogli, layer, { titolo: "x" }));
    expect(pdf.startsWith("%PDF")).toBe(true);
    const doc = relazioneStaffaggi(pr, r, distintaProgetto(pr, r, { articoli: [], aggiornato: null }));
    expect(creaDocx(doc).length).toBeGreaterThan(2000);
  });
});
