import { describe, expect, it } from "vitest";
import { DATI_INIZIALI } from "./antenne";
import { calcolaProgettoAntenne, svgSchemaCalate } from "./progettoAntenne";
import { relazioneAntenne } from "./relazioneAntenne";

const palo80 = { ...DATI_INIZIALI, tipo: "palo" as const, sommita: 80, quotaApparatoBasso: 77, lunghezzaCalata: 60 };

describe("progetto e relazione antenne", () => {
  it("materiali con calate in parallelo, isCon continuo e collegamento al palo", () => {
    const P = calcolaProgettoAntenne(palo80);
    expect(P.ca.fattibile).toBe(true);
    expect(P.lAuto).toBe(true);
    expect(P.lUsata).toBeCloseTo(P.ca.l, 2);
    const iscon = P.materiali.find((m) => m.unita === "m")!;
    expect(iscon.quantita).toBe(Math.ceil((P.r.asta + 1) * P.ca.n));
    expect(P.materiali.some((m) => /Collegamento del conduttore interno al palo/.test(m.descrizione))).toBe(true);
    expect(svgSchemaCalate(P.r.asta, 80, 77, P.ca, true, "terreno")).toContain("PAE");
  });
  it("relazione completa con tutte le sezioni", () => {
    const doc = relazioneAntenne({ dati: palo80, comune: "Paese" });
    const titoli = doc.blocchi.filter((b) => b.tipo === "titolo").map((b) => (b as { testo: string }).testo);
    for (const t of ["1. Oggetto", "3. Captazione", "5. Numero di conduttori in parallelo e versione isCon", "6. Collegamento al palo e collegamenti equipotenziali", "9. Materiali"]) expect(titoli).toContain(t);
    expect(doc.blocchi.some((b) => b.tipo === "immagine")).toBe(true);
  });
});
describe("schema SVG", () => {
  it("attributi non ripetuti (SVG valido per il browser)", () => {
    const P = calcolaProgettoAntenne({ ...palo80, struttura: "isolante" });
    const svg = svgSchemaCalate(P.r.asta, 80, 77, P.ca, true, "terreno");
    for (const tag of svg.match(/<[a-z]+ [^>]*>/g) ?? []) { const nomi = [...tag.matchAll(/ ([a-z-]+)="/g)].map((m) => m[1]); expect(new Set(nomi).size).toBe(nomi.length); }
  });
});
