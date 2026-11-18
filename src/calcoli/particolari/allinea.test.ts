import { describe, expect, it } from "vitest";
import base from "@/dati/particolari/particolari.json";
import { allinea, ruoloDi, type ParticolareLib } from "./allinea";
import { allineaCatalogo, catalogoPerCopertura, CATALOGO_T1_05, proponiCaptazione } from "../captazione/proponiCaptazione";
import { componentiTerra } from "../terra/proponiTerra";
import { codiciComputo } from "../materiali/codiciComputo";
import { generaComputo } from "../materiali/computo";

const lib = base as ParticolareLib[];
/** copia della libreria con un articolo sostituito in un particolare */
function sostituisci(id: string, vecchio: string, nuovo: string, descr: string): ParticolareLib[] {
  return lib.map((p) => (p.id !== id ? p : { ...p, componenti: p.componenti.map((c) => (c.codiceOBO === vecchio ? { ...c, codiceOBO: nuovo, descrizione: descr } : c)) }));
}

describe("ruolo degli articoli dei particolari", () => {
  it("riconosce conduttori, supporti, connettori, sezionamento, picchetti, accessori", () => {
    expect(ruoloDi("RD 8-ALU-T – conduttore tondo Ø8 alluminio")).toBe("conduttore");
    expect(ruoloDi("5052 V4A 30x3,5 – piatto inox")).toBe("conduttore");
    expect(ruoloDi("165 MBG-8-10 – supporto conduttore per tetto piano")).toBe("supporto");
    expect(ruoloDi("157 F VA 230")).toBe("supporto");
    expect(ruoloDi("249 8-10 ALU – connettore rapido Vario")).toBe("connettore");
    expect(ruoloDi("5001 N-VA")).toBe("connettore");
    expect(ruoloDi("2760 20 V4A – morsetto universale per picchetto")).toBe("connettore");
    expect(ruoloDi("233 VA – giunto di sezionamento")).toBe("sezionamento");
    expect(ruoloDi("219 20 BP V4A – picchetto BP")).toBe("picchetto");
    expect(ruoloDi("910 N 8x40 GRW – tassello ad espansione")).toBe("accessorio");
    expect(ruoloDi("177 U – rondella per staffa")).toBe("accessorio");
  });
});

describe("collegamento automatico ai particolari", () => {
  it("con la libreria di base i codici restano quelli dei particolari", () => {
    const cat = allineaCatalogo(CATALOGO_T1_05, lib);
    expect(cat.conduttore.codice).toBe("5021294");
    expect(cat.supporto?.codice).toBe("5218700");
    expect(cat.connettore.codice).toBe("5311519");
  });

  it("se un particolare cambia articolo, la proposta usa il nuovo codice", () => {
    const mod = sostituisci("OBO-TBS-250-T1.05", "5218700", "9999001", "165 MBG-NUOVO – supporto conduttore per tetto piano");
    expect(allineaCatalogo(catalogoPerCopertura("guaina"), mod).supporto?.codice).toBe("9999001");
    const corpi = [{ id: "c", nome: "C", impronta: [[0, 0], [20, 0], [20, 10], [0, 10]] as [number, number][], quotaBase: 0, altezzaGronda: 6, tipoTetto: "piano" as const, altezzaColmo: 0 }];
    const p = proponiCaptazione(corpi, { raggio: 45, latoMaglia: 15, distanzaCalate: 15, strategia: "maglia", particolari: mod });
    expect(p.distinta.some((v) => v.codice === "9999001")).toBe(true);
    expect(p.distinta.some((v) => v.codice === "5218700")).toBe(false);
  });

  it("terra: il giunto di sezionamento segue il particolare", () => {
    const mod = sostituisci("OBO-TBS-200-T5.04", "5336341", "9999002", "233 NEW – giunto di sezionamento");
    expect(componentiTerra(mod).sezionamento.codice).toBe("9999002");
    expect(componentiTerra(lib).sezionamento.codice).toBe("5336341");
  });

  it("computo: le righe generiche hanno il codice del particolare e lo cambiano con esso", () => {
    const risultati = { captazione: { lunghezzaConduttori: 100, giunzioni: 4, incroci: 6, descrizione: "" }, calate: { lunghezzaConduttori: 40, numero: 4, distanzaSeparazione: 0.3 }, terra: { numeroPicchetti: 4, lunghezzaPicchetto: 3, lunghezzaAnello: 0, descrizione: "" } };
    const config = { sfridoPercento: 0, passoSupporti: { Piana: 1 } };
    const righe = generaComputo(risultati, config, "Piana", codiciComputo(lib, { copertura: "Piana" })).righe;
    const cod = (id: string) => righe.find((r) => r.id === id)?.codice;
    expect(cod("captazione-conduttore")).toBe("5021294");
    expect(cod("captazione-supporti")).toBe("5218700");
    expect(cod("maglia-incroci")).toBe("5311519");
    expect(cod("calate-conduttore")).toBe("5021294");
    expect(cod("terra-picchetti")).toBe("5000017");
    expect(righe.every((r) => r.codice !== "")).toBe(true);
    const mod = sostituisci("OBO-TBS-250-T4.01", "5021294", "9999003", "RD 8-NUOVO – conduttore tondo");
    expect(generaComputo(risultati, config, "Piana", codiciComputo(mod, { copertura: "Piana" })).righe.find((r) => r.id === "calate-conduttore")?.codice).toBe("9999003");
  });

  it("particolare assente: resta il codice di riserva", () => {
    expect(allinea({ codice: "123", descrizione: "x – supporto" }, "NON-ESISTE", lib).codice).toBe("123");
  });
});
