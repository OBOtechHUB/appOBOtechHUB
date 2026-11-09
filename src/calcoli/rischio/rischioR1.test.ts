import { describe, it, expect } from "vitest";
import { calcolaR1, protezioneMinima, areaVicinanze, probabilitaPLD, spdMinimoFrequenza, RT_R1, type DatiRischio } from "./rischioR1";

const base: DatiRischio = {
  L: 40, W: 20, H: 12, NG: 4, CD: 1, k: 2, Uw: 2.5,
  linee: [{ nome: "Energia", lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 1, schermata: false }],
  rt: 1e-2, LF: 5e-2, categoria: "normale", rp: 1, rf: 1e-2, rfId: "ordinario", misureContatto: 1, impiantiCritici: false, frazionePresenza: 1,
};

describe("rischio – CEI EN IEC 62305-2:2024", () => {
  it("NSG = k·NG e numero di eventi pericolosi (Allegato A)", () => {
    const e = calcolaR1(base, { lps: "nessuno", spd: "nessuno" });
    expect(e.NSG).toBe(8);
    expect(e.AD).toBeCloseTo(800 + 2 * 36 * 60 + Math.PI * 1296, 6);
    expect(e.ND).toBeCloseTo(8 * e.AD * 1e-6, 12);
    // NL = NSG · 40·LL · CI·CE·CT · 10⁻⁶ (senza 1/k)
    expect(e.NL).toBeCloseTo(8 * 40000 * 0.3 * 0.5 * 1e-6, 12);
    // NI = (1/k) · NSG · 2·rI·LL · … con rI = 2000/Uw^1,8
    expect(e.NI).toBeCloseTo(4 * 2 * (2000 / Math.pow(2.5, 1.8)) * 1000 * 0.15 * 1e-6, 12);
    // AM con rM = 350/Uw = 140 m, NM = (1/k)·NSG·AM
    expect(areaVicinanze(40, 20, 2.5)).toBeCloseTo(2 * 140 * 60 + Math.PI * 140 * 140, 6);
    expect(e.NM).toBeCloseTo(4 * e.AM * 1e-6, 12);
  });

  it("componenti: RAT = ND·PAT·PP·LT e RB = ND·PB·(PP·LF1 + LF2), con PB = PS·PLPS·rp·rf", () => {
    const e = calcolaR1(base, { lps: "nessuno", spd: "nessuno" });
    expect(e.componenti.RA).toBeCloseTo(e.ND * (1 * 1 * 1e-2) * 1e-2, 14);
    expect(e.componenti.RB).toBeCloseTo(e.ND * (1 * 1 * 1 * 1e-2) * (5e-2 + 5e-2), 14);
    expect(e.RL2).toBeGreaterThan(0);
    expect(e.componenti.RC).toBe(0);
  });

  it("senza danni materiali R = solo L1", () => {
    const e = calcolaR1({ ...base, danniMateriali: false }, { lps: "nessuno", spd: "nessuno" });
    expect(e.RL2).toBe(0);
    expect(e.R1).toBeCloseTo(e.RL1, 15);
  });

  it("l'LPS riduce il rischio e la protezione minima rispetta RT", () => {
    const d = { ...base, categoria: "elevata", rfId: "alto", rf: 1e-1 };
    const senza = calcolaR1(d, { lps: "nessuno", spd: "nessuno" }).R1;
    const con = calcolaR1(d, { lps: "III", spd: "III" }).R1;
    expect(con).toBeLessThan(senza);
    const m = protezioneMinima(d);
    expect(m).not.toBeNull();
    expect(m!.esito.R1).toBeLessThanOrEqual(RT_R1);
  });

  it("struttura senza rischio d'incendio, pavimento isolante e poca fulminazione: protezione non necessaria", () => {
    const m = protezioneMinima({ ...base, rf: 0, rfId: "nessuno", rt: 1e-5, NG: 1 });
    expect(m?.protezione.lps).toBe("nessuno");
  });

  it("impianti critici aggiungono RC, RM, RW, RZ", () => {
    const e = calcolaR1({ ...base, impiantiCritici: true }, { lps: "nessuno", spd: "nessuno" });
    expect(e.componenti.RC).toBeGreaterThan(0);
    expect(e.componenti.RM).toBeGreaterThan(0);
    expect(e.componenti.RZ).toBeGreaterThan(0);
  });

  it("PLD dalla Tabella B.11", () => {
    expect(probabilitaPLD("no", 2.5)).toBe(1);
    expect(probabilitaPLD("5-20", 2.5)).toBe(0.95);
    expect(probabilitaPLD("1-5", 2.5)).toBe(0.6);
    expect(probabilitaPLD("<1", 1.5)).toBe(0.4);
    expect(probabilitaPLD("<1", 3)).toBe(0.2); // colonna inferiore (2,5 kV)
  });

  it("frequenza del danno F = FC + FM + FW + FZ e SPD minimo per FT", () => {
    const e = calcolaR1(base, { lps: "nessuno", spd: "nessuno" });
    expect(e.F).toBeCloseTo(e.ND + e.NM + e.NL + e.NI, 12);
    expect(e.FT).toBe(1);
    const spd = spdMinimoFrequenza(base, "nessuno");
    if (spd) expect(calcolaR1(base, { lps: "nessuno", spd }).frequenzaConforme).toBe(true);
    expect(calcolaR1({ ...base, serviziCritici: true }, { lps: "nessuno", spd: "nessuno" }).FT).toBe(0.1);
  });

  it("progetti salvati con l'edizione precedente: LF senza categoria e linea 'schermata'", () => {
    const vecchio = { ...base, categoria: undefined, rfId: undefined, LF: 1e-1, hz: 5, linee: [{ ...base.linee[0]!, schermata: true }] };
    const e = calcolaR1(vecchio, { lps: "nessuno", spd: "nessuno" });
    expect(Number.isFinite(e.R1)).toBe(true);
    expect(e.componenti.RZ).toBe(0);
  });
});
