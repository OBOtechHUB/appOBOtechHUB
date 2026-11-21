import { describe, expect, it } from "vitest";
import { generaTavola, type DatiTavola } from "./tavolaDXF";
import { aggiungiTavole, inviluppoSfera, sagomaCorpo, tabellaCalate, viste } from "./tavoleLPS";
import { pdfTavole } from "./pdfTavole";
import { LAYER_LPS } from "./standard";

function dati(): DatiTavola {
  const calata = (x: number, y: number) => ({ tipo: "calata", punti: [[x, y, 10], [x, y, 0]] as [number, number, number][] });
  return {
    progetto: { codice: "CRM-1", nome: "Prova", comune: "Torino", lpl: "III", data: "21/11/2026", committente: "Cliente S.p.A.", progettista: "Ing. Verdi", rev: "A", revisioni: [{ rev: "A", data: "2026-11-21", descrizione: "Prima emissione" }] },
    corpi: [{ nome: "Capannone", impronta: [[0, 0], [40, 0], [40, 20], [0, 20]], quotaBase: 0, altezzaGronda: 10, tipoTetto: "piano", altezzaColmo: 10 }],
    aste: [{ x: 20, y: 10, z: 10, altezza: 3 }],
    conduttori: [{ tipo: "captazione", punti: [[0, 0, 10], [40, 0, 10], [40, 20, 10], [0, 20, 10], [0, 0, 10]] }, calata(0, 0), calata(20, 0), calata(40, 0), calata(40, 20), calata(20, 20), calata(0, 20), { tipo: "terra", punti: [[-1, -1, -0.5], [41, -1, -0.5], [41, 21, -0.5], [-1, 21, -0.5], [-1, -1, -0.5]] }],
    supporti: [], morsetti: [], compensatori: [], picchetti: [{ x: -1, y: -1, lunghezza: 1.5 }], distinta: [],
    particolari: { marcatori: [], usati: [{ idParticolare: "P-A", nome: "Giunzione", punti: 4 }] }, nordInAlto: true, latoMaglia: 15,
  };
}

describe("tavole aggiuntive", () => {
  it("inviluppo della sfera: un'asta isolata di altezza h protegge fino a sqrt(h(2R-h)) dal piede", () => {
    const R = 45, h = 10, env = inviluppoSfera([[0, h]], R, 0.05);
    const r = Math.sqrt(h * (2 * R - h));
    const quota = (u: number) => env.reduce((a, b) => (Math.abs(b[0] - u) < Math.abs(a[0] - u) ? b : a))[1];
    expect(quota(0)).toBeCloseTo(h, 1);
    expect(quota(r + 0.5)).toBeLessThan(0.01);
    expect(quota(r / 2)).toBeGreaterThan(0.5);
  });
  it("sagoma di un tetto a falde: timpano nei prospetti laterali", () => {
    const c = { nome: "C", impronta: [[0, 0], [20, 0], [20, 10], [0, 10]] as [number, number][], quotaBase: 0, altezzaGronda: 6, tipoTetto: "falde", altezzaColmo: 9 };
    const [sud, est] = viste(true);
    expect(sagomaCorpo(c, sud!).poli).toHaveLength(4);
    expect(sagomaCorpo(c, est!).poli).toHaveLength(5);
    expect(Math.max(...sagomaCorpo(c, est!).poli.map((p) => p[1]))).toBe(9);
  });
  it("interasse delle calate misurato lungo il perimetro", () => {
    const t = tabellaCalate(dati());
    expect(t).toHaveLength(6);
    expect(t.map((c) => c.distanzaSuccessiva).sort((a, b) => a - b)).toEqual([20, 20, 20, 20, 20, 20]);
    expect(t[0]!.nome).toBe("C1");
  });
  it("quattro tavole nel DXF e quattro pagine nel PDF", () => {
    const d = dati(), base = generaTavola(d);
    const fogli = aggiungiTavole(base.dxf, d, base, { raggioSfera: 45, distanzaCalate: { tipica: 15 }, particolari: [{ idParticolare: "P-A", nome: "Giunzione", punti: 4, componenti: [{ codiceOBO: "5311519", descrizione: "Connettore", quantita: 1, unita: "/punto" }] }] });
    expect(fogli.map((f) => f.tav)).toEqual(["TAV. LPS-01", "TAV. LPS-02", "TAV. LPS-03", "TAV. LPS-04"]);
    const testo = base.dxf.finale();
    for (const t of ["TAV. LPS-02", "PROSPETTO SUD", "LPS-SFERA", "CALATE", "OLTRE", "5311519", "Maglia 40,00 x 20,00 m - copertura protetta dalle aste", "Cliente S.p.A.", "Ing. Verdi", "21/11/2026", "LAYER PREDEFINITI", "BETTERMANN"]) expect(testo).toContain(t);
    expect(testo.split("\r\n").filter((r) => r === "20,00").length).toBeGreaterThanOrEqual(4); // catena delle calate sui lati lunghi
    const pdf = new TextDecoder("latin1").decode(pdfTavole(base.dxf, fogli, Object.values(LAYER_LPS)));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Count 4");
    expect(pdf).toContain("(PROSPETTO EST) Tj");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });
});
