import { describe, expect, it } from "vitest";
import { estraiDati, migliori } from "./estraiDati";

const T = `RELAZIONE TECNICA - Comune di Grugliasco (TO)
Committente: Università degli Studi di Torino
Edificio sito in Via Leonardo da Vinci, 44. Struttura portante in cemento armato prefabbricato, copertura in lamiera grecata.
L'edificio ha dimensioni in pianta di circa 60 x 25 m, tre piani fuori terra, altezza massima pari a 14,50 m.
Destinazione d'uso: scolastica. Nel locale caldaia è presente una zona 2 secondo la classificazione ATEX.
Impianto fotovoltaico in copertura da 50 kWp. Commessa: P-2026-0142`;

describe("lettore dei documenti", () => {
  it("ricava i dati principali con la frase", () => {
    const d = migliori(estraiDati(T, "relazione.pdf"));
    const v = (c: string) => d.find((x) => x.campo === c)?.valore;
    expect(v("comune")).toBe("Grugliasco");
    expect(v("provincia")).toBe("TO");
    expect(v("committente")).toBe("Università degli Studi di Torino");
    expect(v("indirizzo")).toBe("Via Leonardo da Vinci, 44");
    expect(d.find((x) => x.campo === "altezza")?.numero).toBe(14.5);
    expect(d.find((x) => x.campo === "lunghezza")?.numero).toBe(60);
    expect(d.find((x) => x.campo === "larghezza")?.numero).toBe(25);
    expect(v("piani")).toBe("3");
    expect(v("struttura")).toMatch(/cemento armato/);
    expect(v("copertura")).toMatch(/lamiera/);
    expect(v("destinazione")).toBe("scolastica");
    expect(v("atex")).toBe("zona 2");
    expect(v("codice")).toBe("P-2026-0142");
    expect(d.find((x) => x.campo === "comune")?.frase).toContain("Grugliasco");
  });
});
