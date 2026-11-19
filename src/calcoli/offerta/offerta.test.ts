import { describe, expect, it } from "vitest";
import { testoDocumento } from "@/lib/docx";
import { leggiListino, prezzoUnitario, versioneDaFile, type VoceListino } from "@/lib/listinoMetel";
import { documentoOfferta, offertaVuota, righeOfferta, totaliOfferta } from "./offerta";

const TESTA = ["MARCHIO", "CODICE ARTICOLO", "CODICE EAN", "DESCRIZIONE PRODOTTO", "QUANTITA'\nCARTONE ", "QUANTITA'\nMULTIPLA", "QUANTITA'\nMINIMA", "QUANTITA'\nMASSIMA", "LEAD\nTIME", "PREZZO AL\nRIVENDITORE", "PREZZO AL\nPUBBLICO", "MOLTIPLICATORE\nPREZZO", "CODICE\nVALUTA", "UNITA' MISURA", "PRODOTTO\nCOMPOSTO", "STATO DEL\nPRODOTTO", "DATA\nULTIMA VARIAZIONE", "FAMIGLIA   SCONTO", "FAMIGLIA \nSTATISTICA", "CODICE ELECTROCOD"];
const riga = (codice: string, descr: string, conf: number, prezzo: number, molt: number, um: string, fam: string) => ["OBO", codice, "4012195000792", descr, conf, conf, conf, 999999, 3, prezzo, prezzo, molt, "EUR", um, 0, 3, "20260101", fam, fam, "3640"];

describe("listino METEL e offerta", () => {
  const { voci, scartate } = leggiListino([TESTA, riga("1003038", "604 3 G Collare di fissaggio", 1000, 11.18, 100, "PCE", "0116"), riga("5021296", "RD 8-ALU-T Conduttore tondo", 50, 145, 100, "MTR", "0210"), ["", "", ""], riga("1003038", "doppione", 1, 1, 1, "PCE", "")]);
  it("legge le colonne METEL e il prezzo per moltiplicatore", () => {
    expect(voci).toHaveLength(2); expect(scartate).toBe(1);
    expect(prezzoUnitario(voci[0]!)).toBeCloseTo(0.1118, 6);
    expect(voci[1]!.unita).toBe("MTR"); expect(voci[1]!.famigliaSconto).toBe("0210"); expect(voci[0]!.confezione).toBe(1000);
    expect(versioneDaFile("OBO_LISTINO_METEL_2026-1__OBOLSP021.xlsx")).toBe("2026-1");
    expect(() => leggiListino([["A", "B"]])).toThrow();
  });
  it("calcola netti con sconto per famiglia, confezioni e prezzi manuali", () => {
    const m = new Map<string, VoceListino>(voci.map((v) => [v.codice, v]));
    const o = { ...offertaVuota, scontoPercento: 40, scontiFamiglia: { "0210": 50 } };
    const r = righeOfferta([
      { codice: "5021296", descrizione: "tondo", quantita: 60.4, unita: "m" }, { codice: "5021296", descrizione: "tondo", quantita: 20, unita: "m" },
      { codice: "1003038", descrizione: "collare", quantita: 12, unita: "pz" }, { codice: "9999999", descrizione: "senza prezzo", quantita: 2, unita: "pz" },
    ], m, o);
    const tondo = r.find((x) => x.codice === "5021296")!;
    expect(tondo.quantitaProgetto).toBeCloseTo(80.4); expect(tondo.quantita).toBe(100); // 81 m → confezione da 50
    expect(tondo.netto).toBeCloseTo(0.725, 4); expect(tondo.totale).toBe(72.5);
    expect(r.find((x) => x.codice === "1003038")!.quantita).toBe(1000);
    expect(r.find((x) => x.codice === "9999999")!.fonte).toBe("mancante");
    const r2 = righeOfferta([{ codice: "1003038", descrizione: "collare", quantita: 12, unita: "pz" }], m, { ...o, arrotondaConfezioni: false, prezziManuali: { "1003038": 0.05 } });
    expect(r2[0]!.quantita).toBe(12); expect(r2[0]!.totale).toBe(0.6); expect(r2[0]!.fonte).toBe("manuale");
    const t = totaliOfferta(r); expect(t.mancanti).toBe(1); expect(t.netto).toBeCloseTo(72.5 + 1000 * 0.1118 * 0.6, 2);
    const txt = testoDocumento(documentoOfferta({ righe: r, o: { ...o, destinatario: "Elettro Rossi S.r.l." }, progetto: "Polo", comune: "Grugliasco", data: new Date("2026-11-19T12:00:00Z") }));
    expect(txt).toContain("Elettro Rossi S.r.l."); expect(txt).toContain("Totale netto"); expect(txt).toContain("su richiesta");
  });
});
