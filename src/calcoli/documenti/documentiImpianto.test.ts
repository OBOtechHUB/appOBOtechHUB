import { describe, expect, it } from "vitest";
import { creaDocx, testoDocumento } from "@/lib/docx";
import { esempio } from "@/calcoli/relazione/esempioRelazione";
import { dichiarazioneConformita, pianoVerifichePeriodiche, scadenzePiano, verbalePrimaVerifica, type IngressoDocumenti } from "./documentiImpianto";

function ingresso(): IngressoDocumenti {
  const e = esempio();
  return {
    comune: e.edificio.comune, indirizzo: e.edificio.indirizzo, nomeProgetto: e.edificio.nomeProgetto, codice: e.codice, rev: "A", lpl: "IV",
    aste: e.aste, conduttori: e.conduttori, picchetti: e.picchetti.length, tipoTerra: "tipo A",
    dati: { ...e.dati, impresaNome: "Elettro Rossi S.r.l.", impresaResponsabile: "Mario Rossi", dataMessaEsercizio: "2027-03-01" },
    piano: { critico: false, intervalli: null }, data: e.data,
  };
}

describe("documenti dell'impianto", () => {
  it("dichiarazione di conformità D.M. 37/2008 precompilata", () => {
    const t = testoDocumento(dichiarazioneConformita(ingresso()));
    for (const s of ["D.M. 22 gennaio 2008, n. 37", "Elettro Rossi S.r.l.", "lettera a", "SINELEC S.p.A.", "Grugliasco", "progetto OBO n. CRM-123 Rev. A", "LPS di classe IV", "Allegati obbligatori", "D.P.R. 22 ottobre 2001, n. 462"]) expect(t).toContain(s);
    expect(t).toContain("[DA COMPLETARE: partita IVA]");
  });
  it("verbale di prima verifica con una riga per calata", () => {
    const t = testoDocumento(verbalePrimaVerifica(ingresso()));
    expect(t).toContain("VERBALE DI PRIMA VERIFICA");
    expect(t).toContain("C1"); expect(t).toContain("C2");
    expect(t).toContain("Giunti di sezionamento accessibili");
  });
  it("piano con scadenze a vista, complete e D.P.R. 462", () => {
    const s = scadenzePiano("2027-03-01", { visiva: 1, completa: 3, critica: 1 }, false, 5, 10);
    expect(s.filter((x) => x.tipo === "completa").map((x) => x.data)).toEqual(["2030-03-01", "2033-03-01", "2036-03-01"]);
    expect(s.filter((x) => x.tipo === "a vista")).toHaveLength(7);
    expect(s.filter((x) => x.tipo === "D.P.R. 462/2001").map((x) => x.data)).toEqual(["2032-03-01", "2037-03-01"]);
    const x = ingresso(); x.dati = { ...x.dati, luogoDiLavoro: true };
    const t = testoDocumento(pianoVerifichePeriodiche(x));
    expect(t).toContain("01/03/2030"); expect(t).toContain("D.P.R. 462/2001");
  });
  it("crea file Word validi", () => {
    for (const d of [dichiarazioneConformita(ingresso()), verbalePrimaVerifica(ingresso()), pianoVerifichePeriodiche(ingresso())]) {
      const s = new TextDecoder().decode(creaDocx(d));
      expect(s.startsWith("PK")).toBe(true);
    }
  });
});

describe("verbale con i dati del sopralluogo", () => {
  it("riporta misure, esiti, SPD ed esito finale", async () => {
    const { sopralluogoSchema } = await import("@/lib/statoProgetto");
    const x = ingresso();
    x.sopralluogo = sopralluogoSchema.parse({ dataVerifica: "2027-02-20", verificatore: "Ing. Rossi", strumenti: "Metrel MI 3290", condizioni: "asciutto",
      calate: [{ nome: "C1", continuita: 0.12, resistenza: 8.5, giunto: true }, { nome: "C2", continuita: 0.2, resistenza: 9, giunto: false, note: "giunto coperto" }],
      resistenzaTotale: 1.8, metodo: "voltamperometrico", esiti: { "doc-progetto": { esito: "C" }, "doc-registro": { esito: "NA", nota: "prima verifica" } },
      spd: [{ quadro: "QG", tipo: "V50", indicatoreOk: true, collegatoOk: true }], esitoFinale: "conforme", note: "Nessuna prescrizione" });
    const t = testoDocumento(verbalePrimaVerifica(x));
    for (const s of ["20/02/2027", "Ing. Rossi", "Metrel MI 3290", "0,12", "8,5", "giunto coperto", "1,8", "■ C", "prima verifica", "V50", "■ Impianto conforme", "Nessuna prescrizione"]) expect(t).toContain(s);
    expect(t).not.toContain("DA COMPLETARE: data");
  });
});
