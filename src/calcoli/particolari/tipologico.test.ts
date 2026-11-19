import { describe, expect, it } from "vitest";
import { componentiTipologico, disegnoDaComponenti, disegnoSchema, percorso, svgTipologico, tipoDaDescrizione, type DisegnoTip } from "./tipologico";
import { particolareSchema } from "./selezione";

const d: DisegnoTip = disegnoSchema.parse({
  blocchi: [
    { id: "s", tipo: "copertura", x: 400, y: 420, scala: 2.5 },
    { id: "a", tipo: "asta", x: 200, y: 300, codiceOBO: "5402864", descrizione: "101 3B-4000 Asta captazione", unita: "per_asta" },
    { id: "t", tipo: "treppiede", x: 200, y: 365, codiceOBO: "5408945", descrizione: "F-FIX treppiede", unita: "per_asta" },
    { id: "m1", tipo: "morsetto", x: 300, y: 340, codiceOBO: "5311550", descrizione: "249 8-10 Morsetto", unita: "per_punto" },
    { id: "m2", tipo: "morsetto", x: 500, y: 340, codiceOBO: "5311550", descrizione: "249 8-10 Morsetto", unita: "per_punto" },
    { id: "p", tipo: "supporto-piano", x: 400, y: 387, codiceOBO: "5218700", descrizione: "165 MBG-8-10", quantita: 1, unita: "per_m" },
  ],
  collegamenti: [
    { id: "k1", da: "a", a: "m1", codiceOBO: "5021296", descrizione: "RD 8-ALU-T Conduttore", unita: "per_m" },
    { id: "k2", da: "m1", a: "m2", ortogonale: true },
    { id: "q", da: "m1", a: "m2", tipo: "quota", testo: "max 1 m" },
  ],
});

describe("tipologici disegnati", () => {
  it("raggruppa i componenti per codice e numera i richiami", () => {
    const { componenti, richiami } = componentiTipologico(d);
    expect(componenti.map((c) => c.codiceOBO)).toEqual(["5402864", "5408945", "5311550", "5218700", "5021296"]);
    expect(componenti.find((c) => c.codiceOBO === "5311550")!.quantita).toBe(2);
    expect(richiami.get("m1")).toBe(richiami.get("m2"));
    expect(richiami.has("s")).toBe(false); // la struttura non è un componente
    expect(richiami.has("k2")).toBe(false); // conduttore senza codice né descrizione
  });
  it("collega le porte più vicine e disegna l'SVG con legenda", () => {
    const pts = percorso(d.collegamenti[0]!, d.blocchi)!;
    expect(pts).toHaveLength(2);
    const svg = svgTipologico(d, { titolo: "Asta su treppiede", legenda: true });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Asta su treppiede"); expect(svg).toContain("5402864"); expect(svg).toContain("max 1 m");
  });
  it("crea un disegno di partenza da un particolare e lo salva nel particolare", () => {
    expect(tipoDaDescrizione("233 A VA Morsetto sezionamento")).toBe("giunto");
    expect(tipoDaDescrizione("101 3B-4000 Asta captazione")).toBe("asta");
    const nd = disegnoDaComponenti([{ codiceOBO: "5402864", descrizione: "101 3B-4000 – asta", quantita: 1, unitaQuantita: "per_asta" }, { codiceOBO: "5021296", descrizione: "RD 8-ALU-T 75 – conduttore tondo", quantita: 1, unitaQuantita: "per_m" }, { codiceOBO: "5311550", descrizione: "249 8-10 – morsetto", quantita: 2, unitaQuantita: "per_asta" }]);
    expect(nd.blocchi.filter((b) => b.tipo !== "copertura")).toHaveLength(2);
    expect(componentiTipologico(nd).componenti).toHaveLength(3);
    const p = particolareSchema.parse({ id: "PERS-1", nome: "Prova", categoria: "captazione", condizioni: { elemento: "asta", tipo: "treppiede", parametri: {} }, componenti: [], bloccoCAD: null, immagine: null, note: "", origine: "proposto", verificato: false, disegno: nd });
    expect(p.disegno?.blocchi.length).toBe(nd.blocchi.length);
  });
});

describe("blocchi con il disegno OBO", () => {
  it("usa l'immagine del prodotto quando è scelta e disponibile", async () => {
    const { disegnoObo, markupBlocco, ingombro } = await import("./tipologico");
    const ind = { base: "obo-disegni/", codici: { "5218700": "5218700.jpg" }, disegni: { "5218700.jpg": { w: 400, h: 200 } } };
    const b = disegnoSchema.parse({ blocchi: [{ id: "x", tipo: "supporto-piano", x: 100, y: 100, codiceOBO: "5218700", vista: "obo", larghezzaObo: 120 }] }).blocchi[0]!;
    expect(disegnoObo(b, ind)).toEqual({ href: "obo-disegni/5218700.jpg", w: 120, h: 60 });
    expect(markupBlocco(b, ind)).toContain('<image href="obo-disegni/5218700.jpg"');
    expect(ingombro(b, ind)).toEqual([60, 30]);
    expect(markupBlocco({ ...b, vista: "simbolo" }, ind)).not.toContain("<image");
    expect(disegnoObo({ ...b, codiceOBO: "0000000" }, ind)).toBeNull();
  });
});
