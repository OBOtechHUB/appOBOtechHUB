import { describe, expect, it } from "vitest";
import { particolareAsta, svgParticolareAsta } from "./astaIscon";
import { calcolaProgettoAntenne } from "./progettoAntenne";
import { DATI_INIZIALI } from "./antenne";

describe("particolare dell'asta con il set isCon HM", () => {
  it("sceglie l'asta standard, il set e l'estensione oltre 6 m", () => {
    const a = particolareAsta(85, 80, 2);
    expect(a.lunghezza).toBe(6); expect(a.estensioni).toBe(0); expect(a.supporti).toBe(3); expect(a.fascetteTerra).toBe(1);
    const b = particolareAsta(87.4, 80, 3);
    expect(b.lunghezza).toBe(8); expect(b.estensioni).toBe(1); expect(b.supporti).toBe(5); expect(b.fascetteTerra).toBe(2);
    expect(b.materiali.map((m) => m.codice)).toEqual(expect.arrayContaining(["5408090", "5408094"]));
    const c = particolareAsta(95, 80, 2);
    expect(c.setApplicabile).toBe(false); expect(c.materiali).toHaveLength(0);
  });
  it("il disegno è un SVG valido senza attributi doppi", () => {
    const svg = svgParticolareAsta(particolareAsta(86, 80, 4));
    expect(svg.startsWith("<svg")).toBe(true);
    for (const tag of svg.match(/<[a-z]+ [^>]*>/g) ?? []) {
      const nomi = [...tag.matchAll(/ ([a-z-]+)="/g)].map((m) => m[1]);
      expect(new Set(nomi).size).toBe(nomi.length);
    }
    expect(svg).toContain("927 2 6-K");
  });
  it("nel progetto: set HM nei materiali al posto delle piastre AP", () => {
    const P = calcolaProgettoAntenne({ ...DATI_INIZIALI, tipo: "palo" as const, sommita: 80, quotaApparatoBasso: 77, lunghezzaCalata: 60 });
    expect(P.ca.fattibile && P.r.protette).toBe(true);
      expect(P.asta).not.toBeNull();
      expect(P.materiali.some((m) => m.codice === "5408090")).toBe(true);
      expect(P.materiali.some((m) => m.codice === "5408026" || m.codice === "5408028")).toBe(false);
  });
});
