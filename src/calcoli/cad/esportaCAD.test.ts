import { describe, it, expect } from "vitest";
import { generaFileCAD, testoLisp, numeroLisp, leggiEdificioDaCAD } from "./esportaCAD";
import { calcolaSferaRotolante } from "../captazione/sferaRotolante";
import { proponiCaptazione } from "../captazione/proponiCaptazione";

describe("esportazione verso il CAD", () => {
  it("testi ASCII senza virgolette doppie né barre rovesciate", () => {
    expect(testoLisp('Città "nuova" C:\\dati')).toBe(`"Citta 'nuova' C:/dati"`);
    expect(testoLisp(undefined)).toBe('""');
  });
  it("numeri con punto decimale, senza esponenziale né -0", () => {
    expect(numeroLisp(1e-7)).toBe("0.0000");
    expect(numeroLisp(-0.00001)).toBe("0.0000");
    expect(numeroLisp(12345678.9)).toBe("12345678.9000");
    expect(numeroLisp(null)).toBe("nil");
  });
  it("un record per riga, intestazione LPSDATI, zone esposte unite per riga", () => {
    const corpi = [{ id: "A", impronta: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][], altezzaGronda: 5 }];
    const ris = calcolaSferaRotolante({ corpi, raggio: 30, passo: 1 });
    const t = generaFileCAD({ progetto: { codice: "X" }, edificio: { corpi } }, [{ lpl: "II", risultato: ris }]);
    const righe = t.trim().split("\r\n");
    expect(righe[1]!).toBe("(LPSDATI 1)");
    expect(righe.filter((r) => r.startsWith("(CORPO")).length).toBe(1);
    // 11×11 celle tutte esposte → 11 tratti, uno per riga di celle
    expect(righe.filter((r) => r.startsWith("(ESPOSTA")).length).toBe(11);
    for (const r of righe.slice(1)) {
      expect(r.startsWith("(") && r.endsWith(")")).toBe(true);
      let p = 0;
      for (const c of r.replace(/"[^"]*"/g, "")) { p += c === "(" ? 1 : c === ")" ? -1 : 0; expect(p >= 0).toBe(true); }
      expect(p).toBe(0);
    }
  });
  it("con la verifica combinata, il tetto protetto dalla maglia non viene esportato come esposto", () => {
    const corpi = [{ id: "C", impronta: [[0, 0], [60, 0], [60, 40], [0, 40]] as [number, number][], altezzaGronda: 8 }];
    const p = proponiCaptazione(corpi, { raggio: 30, latoMaglia: 10, distanzaCalate: 10 });
    const soloSfera = generaFileCAD({ progetto: {}, edificio: { corpi } }, [{ lpl: "II", risultato: p.sfera }]);
    const combinata = generaFileCAD({ progetto: {}, edificio: { corpi } }, [{ lpl: "II", risultato: p.sfera, combinata: p.combinata }]);
    expect(soloSfera.includes("(ESPOSTA")).toBe(true);   // la sola sfera tocca il centro delle maglie
    expect(combinata.includes("(ESPOSTA")).toBe(false);  // ma la maglia le protegge
  });

  it("lettura del file restituito dal CAD", () => {
    const e = leggiEdificioDaCAD('{"versione":"1","unita":"m","corpi":[{"id":"CAD1","impronta":[[0,0],[1,0],[1,1]],"altezzaGronda":3}]}');
    expect(e.corpi.length).toBe(1);
    expect(() => leggiEdificioDaCAD('{"corpi":[{"impronta":[[0,0]],"altezzaGronda":3}]}')).toThrow();
  });

  it("passa al LISP distinta, particolari, richiami e numeri delle calate", () => {
    const t = generaFileCAD({
      progetto: { codice: "P1", nome: "Prova", comune: "Roma", lpl: "III", raggio: 45 },
      edificio: { corpi: [{ id: "c", nome: "C", impronta: [[0, 0], [10, 0], [10, 10], [0, 10]], quotaBase: 0, altezzaGronda: 6, tipoTetto: "piano", altezzaColmo: 6 } as never] },
      conduttori: [{ tipo: "calata", punti: [[0, 10, 6], [0, 10, 0]] }, { tipo: "calata", punti: [[10, 0, 6], [10, 0, 0]] }],
      supporti: [{ x: 1, y: 0, z: 6, codiceOBO: "5218700" }],
      distinta: [{ codice: "5218700", descrizione: "Supporto tetto piano", quantita: 10, unita: "pz" }, { codice: "5218700", descrizione: "Supporto tetto piano", quantita: 2, unita: "pz" }],
      particolari: { marcatori: [{ idParticolare: "A", nome: "Supporto", x: 1, y: 0, z: 6 }], usati: [{ idParticolare: "A", nome: "Supporto", punti: 1 }] },
    });
    expect(t).toContain('(VOCE "5218700" "Supporto tetto piano" 12.00 "pz")');
    expect(t).toContain('(PARTICOLARE "P01" "Supporto" 1)');
    expect(t).toContain('(RICHIAMO "P01" 1.0000 0.0000 6.0000)');
    expect(t).toContain('(CALATA_NUM "C1" 0.0000 10.0000 6.0000)');
    expect(t).toContain('(CALATA_NUM "C2" 10.0000 0.0000 6.0000)');
    expect(t.indexOf("(VOCE")).toBeLessThan(t.indexOf("(SUPPORTO"));
  });
});

describe("record ORIGINE per LPS-AUTO", () => {
  it("scrive l'origine del modello 3D quando indicata", () => {
    const t = generaFileCAD({ progetto: { codice: "P", nome: "N", comune: "C", lpl: "III" }, edificio: { corpi: [] }, origine: [120.5, -3, 0] });
    expect(t).toContain("(ORIGINE 120.5000 -3.0000 0.0000)");
    expect(generaFileCAD({ progetto: {}, edificio: { corpi: [] } })).not.toMatch(/ORIGINE/);
  });
});
