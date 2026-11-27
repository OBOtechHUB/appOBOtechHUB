import { describe, expect, it } from "vitest";
import { calcolaPalo, DATI_PALO } from "./palo";

describe("impianti su palo con calate isolate isCon", () => {
  it("palo d'antenna LPL IV, 9 m isolati: basta un Basic 45", () => {
    const r = calcolaPalo(DATI_PALO);
    expect(r.l).toBeCloseTo(9);
    expect(r.scelta?.n).toBe(1);
    expect(r.scelta?.s).toBeCloseTo(0.36, 3);
    expect(r.scelta?.versione).toBe("basic");
    expect(r.materiali.some((m) => m.codice === "5407980" && m.quantita === 10)).toBe(true);
  });
  it("tratto lungo: servono più conduttori", () => {
    const r = calcolaPalo({ ...DATI_PALO, lpl: "II", quotaPunta: 40, quotaCollegamento: 20 });
    expect(r.opzioni[0]!.versione).toBeNull(); // 0,06 × 20 = 1,2 m
    expect(r.scelta?.n).toBe(2); // 0,06 × 0,66 × 20 = 0,79 → Premium 90
    expect(r.scelta?.versione).toBe("premium");
  });
  it("LPL I con un conduttore: solo Premium 90", () => {
    const r = calcolaPalo({ ...DATI_PALO, lpl: "I", quotaPunta: 30, quotaCollegamento: 25 });
    expect(r.scelta?.versione).toBe("premium");
  });
  it("esigenze di posa: zona ATEX → Pro+ 75", () => {
    const r = calcolaPalo({ ...DATI_PALO, esigenze: { atex: true } });
    expect(r.scelta?.versione).toBe("proplus");
  });
  it("versione scelta dall'utente: Pro+ o Premium", () => {
    expect(calcolaPalo({ ...DATI_PALO, versione: "proplus" }).scelta?.versione).toBe("proplus");
    const r = calcolaPalo({ ...DATI_PALO, versione: "premium" });
    expect(r.scelta?.versione).toBe("premium");
    expect(r.materiali.some((m) => m.codice === "5407984")).toBe(true);
    const lungo = calcolaPalo({ ...DATI_PALO, lpl: "II", quotaPunta: 40, quotaCollegamento: 20, versione: "proplus" });
    expect(lungo.scelta?.n).toBe(3); // 0,06 × 0,44 × 20 = 0,53 ≤ 0,75
  });
  it("palo isolato oltre 6 m: estensione dei supporti", () => {
    const r = calcolaPalo({ ...DATI_PALO, mastoIsolato: 8 });
    expect(r.materiali.some((m) => m.codice === "5408094")).toBe(true);
  });
});

import { creaDocx, testoDocumento } from "@/lib/docx";
import { relazionePalo } from "./relazionePalo";
describe("relazione impianto su palo", () => {
  it("contiene tenuta dell'isolamento e numero di conduttori", () => {
    const doc = relazionePalo({ dati: { ...DATI_PALO, lpl: "II", quotaPunta: 40, quotaCollegamento: 20 }, committente: "Prova", data: new Date(2026, 10, 26) });
    const t = testoDocumento(doc);
    expect(t).toMatch(/Tenuta dell'isolamento/);
    expect(t).toMatch(/servono 2 conduttori isCon Premium 90 in parallelo/);
    expect(t).toMatch(/VERIFICATA/);
    expect(creaDocx(doc).length).toBeGreaterThan(5000);
  });
});
