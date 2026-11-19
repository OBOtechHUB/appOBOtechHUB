import { describe, expect, it } from "vitest";
import { relazioneTecnica, particolareDiRiga, sci, datiRelazioneVuoti } from "./relazioneTecnica";
import { creaDocx, testoDocumento } from "@/lib/docx";
import { esempio } from "./esempioRelazione";

describe("relazione tecnica", () => {
  it("segue il format OBO con i valori del progetto", () => {
    const doc = relazioneTecnica(esempio());
    const t = testoDocumento(doc);
    for (const s of ["COMUNE DI GRUGLIASCO", "PROVINCIA DI TORINO", "SINELEC S.p.A.", "1. Premessa", "2. Elenco elaborati", "3. Norme", "5. Definizioni", "6. Valutazione del rischio", "6.8 Componenti di rischio", "RU = (NL + NDJ)", "7. Protezione contro le scariche", "7.2 Calate", "R = f(Pr, Q)", "NYY 1 × 16", "Valutazione del rischio e scelta delle misure di protezione", "11. Individuazione della struttura", "13.4 Impianto di terra", "14. Particolari costruttivi", "15. Elenco materiale", "17. Valori NG", "CEI EN IEC 62561", "LPL IV", "Rev. A"]) expect(t).toContain(s);
    expect(t).toContain("Caso"); // esito della valutazione
    expect(t).toContain("Tipologico 1 – Asta su putrella");
    expect(t).toContain("Tipologico 2 – Giunzioni conduttore tondo");
    expect(t).toContain("N° 2 – aste non isolate su treppiede di altezza 4 m");
    expect(t).toContain("sostituiscono la serie CEI EN 50164");
    expect(t).toContain("Unità trattamento aria");
  });
  it("lascia evidenziate le parti da completare quando mancano i dati", () => {
    const e = esempio(); e.rischio = null; e.dati = datiRelazioneVuoti; e.righe = [];
    const t = testoDocumento(relazioneTecnica(e));
    expect(t).toContain("[DA COMPLETARE: committente]");
    expect(t).toContain("[DA COMPLETARE: valutazione del rischio non compilata");
  });
  it("riconosce il particolare dalla provenienza", () => {
    const e = esempio();
    expect(particolareDiRiga(e.righe[0]!, e.particolari)?.id).toBe("OBO-TBS-250-T2.01");
    expect(particolareDiRiga(e.righe[1]!, e.particolari)?.id).toBe("OBO-TBS-250-T1.01");
    expect(particolareDiRiga(e.righe[2]!, e.particolari)).toBeNull();
  });
  it("scrive i numeri piccoli in notazione scientifica", () => {
    expect(sci(1.234e-5).map((r) => r.t).join("")).toBe("1,23 × 10-5");
    expect(sci(0.5).map((r) => r.t).join("")).toBe("0,5");
  });
  it("aggiunge grafici e tabelle numerate", () => {
    const doc = relazioneTecnica(esempio());
    const img = doc.blocchi.filter((b) => b.tipo === "immagine");
    expect(img.length).toBeGreaterThanOrEqual(7);
    for (const b of img) if (b.tipo === "immagine") expect(b.svg.startsWith("<svg")).toBe(true);
    const t = testoDocumento(doc);
    expect(t).toContain("Tabella 1 – ");
    expect(t).toContain("Fattore di posizione CD");
    expect(t).toContain("Lunghezza minima l1");
  });
  it("genera i testi dai dati del progetto (stato di fatto, verifica per blocco, blocchi per il vento)", () => {
    const e = esempio();
    e.dati = { ...e.dati, parapetto: "si-collegato", calateEsistenti: "in-getto", calateNumero: 20, calateInterasse: 15, terraEsistente: "anello", terraCollegataAltri: true, spdEsistenti: "si", impiantiCopertura: "unità di trattamento aria", altezzaImpianti: 2, fissaggioAste: "treppiede", ventoKmh: 150, corpi: { c1: { altezzaDaProteggere: 1.5, nota: "" } } };
    const t = testoDocumento(relazioneTecnica(e));
    expect(t).toContain("Stato di fatto rilevato al sopralluogo");
    expect(t).toContain("presente e collegato elettricamente alle calate");
    expect(t).toContain("predisposte in fase di getto");
    expect(t).toContain("Verifica dell'altezza protetta per blocco");
    expect(t).toContain("Blocco 1");
    expect(t).toContain("km/h");
    expect(t).toContain("6 x 16 kg"); // 4 m su treppiede AL: 150 km/h → 6 blocchi (fino a 191 km/h)
    expect(t).toContain("dispersori degli edifici vicini");
    expect(t).not.toContain("DA COMPLETARE: stato di fatto");
  });
  it("crea un file Word valido", () => {
    const zip = creaDocx(relazioneTecnica(esempio()));
    const s = new TextDecoder().decode(zip);
    expect(s.startsWith("PK")).toBe(true);
    for (const f of ["[Content_Types].xml", "word/document.xml", "word/styles.xml", "word/footer1.xml"]) expect(s).toContain(f);
    expect(s).toContain("Riga senza codice &lt;&amp;&gt;");
    expect(s).toContain("NUMPAGES");
  });
});

describe("relazione in inglese", () => {
  it("traduce testi, tabelle, numeri e figure", async () => {
    const { numeroEn, traduciTesto } = await import("./traduzione");
    expect(numeroEn("1,5")).toBe("1.5"); expect(numeroEn("1.250,5")).toBe("1,250.5"); expect(numeroEn("5.2.3")).toBe("5.2.3");
    expect(traduciTesto("Figura 3 – ")).toBe("Figure 3 – ");
    expect(traduciTesto("COMUNE DI GRUGLIASCO")).toBe("MUNICIPALITY OF GRUGLIASCO");
    const e = esempio(); e.dati = { ...e.dati, lingua: "en" };
    const doc = relazioneTecnica(e), t = testoDocumento(doc);
    for (const s of ["Introduction", "Lightning risk assessment", "Rolling sphere radius R (m)", "Down-conductors", "Bill of materials", "MUNICIPALITY OF GRUGLIASCO", "class IV LPS"]) expect(t).toContain(s);
    expect(t).not.toContain("Valutazione del rischio fulminazione");
    expect(doc.pagina?.pag).toBe("Page");
    const svg = doc.blocchi.filter((b) => b.tipo === "immagine").map((b) => (b.tipo === "immagine" ? b.svg : "")).join("");
    expect(svg).toContain("without protection");
  });
});
