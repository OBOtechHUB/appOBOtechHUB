import { describe, expect, it } from "vitest";
import { calcolaTratta, pesoStimato } from "./calcolo";
import { interpola, qAmmessoStatica, verificaTraverso } from "./statica";
import { trattaSchema } from "./tipi";

describe("statica staffaggi", () => {
  it("interpola le tabelle OBO senza estrapolare", () => {
    const L = [200, 300, 400], q = [10, 8, 4];
    expect(interpola(L, q, 350)).toBe(6);
    expect(interpola(L, q, 100)).toBe(10);
    expect(interpola(L, q, 500)).toBeNull();
  });
  it("valori statici: MS4141 su 1 m regge piu' della tabella OBO (la tabella e' piu' prudente)", () => {
    expect(qAmmessoStatica({ Wy: 2.91, Iy: 6.05 }, 1000)).toBeGreaterThan(3.17);
  });
  it("traverso: carico su meta' luce piu' gravoso del distribuito", () => {
    const v = verificaTraverso("T", { L: [200, 1000], qzul: [20, 3.17] }, null, 1000, 500, 2);
    expect(v.valore).toBeCloseTo((8 * (2 / 4) * (1000 - 250) / 1000) / 1, 6);
    expect(v.esito).toBe("ok");
  });
});

describe("calcolo tratta", () => {
  it("trapezio a soffitto: supporti, carichi e verifiche", () => {
    const t = trattaSchema.parse({ id: "a", lunghezza: 30, interasse: 1.5, piani: [{ serie: "MKS", larghezza: 300, altezza: 60, caricoCavi: 20 }] });
    const r = calcolaTratta(t);
    expect(r.supporti).toBe(21);
    const pp = pesoStimato(t.piani[0]!);
    expect(r.Ftotale).toBeCloseTo((20 + pp) * 0.00981 * 1.5, 6);
    expect(r.verifiche.find((v) => v.elemento.startsWith("Traverso"))!.esito).toBe("ok");
    expect(r.perSupporto.find((c) => c.ruolo === "pendino")!.quantita).toBe(2);
    expect(r.perTratta.find((c) => c.ruolo === "passerella")!.quantita).toBe(10);
    expect(r.geometria.lunghezzaTraverso).toBe(500);
  });
  it("mensole: sceglie il tipo AW in base al carico", () => {
    const t = trattaSchema.parse({ id: "b", tipologia: "parete-mensola", interasse: 2, piani: [{ larghezza: 400, caricoCavi: 60 }, { larghezza: 200, caricoCavi: 10 }] });
    const r = calcolaTratta(t);
    expect(r.geometria.mensole!.map((m) => m.lunghezza)).toEqual([410, 210]);
    expect(r.geometria.mensole![0]!.tipo).toBe("AW 15");
    const t2 = { ...t, piani: [{ ...t.piani[0]!, caricoCavi: 120 }] };
    expect(calcolaTratta(t2).geometria.mensole![0]!.tipo).toBe("AW 30");
  });
  it("carico eccessivo: traverso non verificato", () => {
    const t = trattaSchema.parse({ id: "c", profilato: "MS4121", interasse: 3, piani: [{ larghezza: 600, caricoCavi: 200 }] });
    expect(calcolaTratta(t).esito).toBe("ko");
  });
});
