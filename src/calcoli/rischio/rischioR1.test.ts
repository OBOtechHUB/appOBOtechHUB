import { describe, it, expect } from "vitest";
import { calcolaR1, protezioneMinima, areaVicinanze, RT_R1, type DatiRischio } from "./rischioR1";

const base: DatiRischio = {
  L: 40, W: 20, H: 12, NG: 4, CD: 1,
  linee: [{ nome: "Energia", lunghezza: 1000, posa: 0.5, ambiente: 0.5, tipo: 1, schermata: false }],
  rt: 1e-2, LF: 1e-1, rp: 1, rf: 1e-2, hz: 5, misureContatto: 1, impiantiCritici: false, frazionePresenza: 1,
};

describe("rischio R1", () => {
  it("eventi pericolosi ND e NL", () => {
    const e = calcolaR1(base, { lps: "nessuno", spd: "nessuno" });
    expect(e.AD).toBeCloseTo(800 + 2 * 36 * 60 + Math.PI * 1296, 6);
    expect(e.ND).toBeCloseTo(4 * e.AD * 1e-6, 12);
    expect(e.NL).toBeCloseTo(4 * 40000 * 0.25 * 1e-6, 12);
    expect(areaVicinanze(40, 20)).toBeCloseTo(60000 + Math.PI * 250000, 6);
  });

  it("componenti: RB = ND·PB·LB, RA = ND·PTA·PB·LA", () => {
    const e = calcolaR1(base, { lps: "nessuno", spd: "nessuno" });
    expect(e.componenti.RB).toBeCloseTo(e.ND * 1 * (1 * 1e-2 * 5 * 1e-1), 12);
    expect(e.componenti.RA).toBeCloseTo(e.ND * 1e-2 * 1e-2, 12);
    expect(e.componenti.RC).toBe(0);
    expect(e.R1).toBeGreaterThan(RT_R1);
  });

  it("l'LPS riduce R1 e la protezione minima rispetta il rischio tollerabile", () => {
    const senza = calcolaR1(base, { lps: "nessuno", spd: "nessuno" }).R1;
    const con = calcolaR1(base, { lps: "III", spd: "III" }).R1;
    expect(con).toBeLessThan(senza);
    const m = protezioneMinima(base);
    expect(m).not.toBeNull();
    expect(m!.esito.R1).toBeLessThanOrEqual(RT_R1);
  });

  it("struttura senza rischio d'incendio e con poche persone può non richiedere protezione", () => {
    const m = protezioneMinima({ ...base, rf: 0, rt: 1e-5, NG: 1 });
    expect(m?.protezione.lps).toBe("nessuno");
  });

  it("impianti critici aggiungono RC, RM, RW, RZ", () => {
    const e = calcolaR1({ ...base, impiantiCritici: true }, { lps: "nessuno", spd: "nessuno" });
    expect(e.componenti.RC).toBeGreaterThan(0);
    expect(e.componenti.RM).toBeGreaterThan(0);
    expect(e.componenti.RZ).toBeGreaterThan(0);
  });
});
