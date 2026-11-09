import { describe, it, expect } from "vitest";
import { calcolaZone, protezioneMinimaZone, zonaUnica, type Zona, calcolaR1, protezioneMinima, areaVicinanze, probabilitaPLD, spdMinimoFrequenza, RT_R1, type DatiRischio } from "./rischioR1";

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
    const d = { ...base, categoria: "elevata", rfId: "alto", rf: 1e-1, rp: 0.2 }; // con rp = 1 nemmeno il livello I basterebbe
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
    const { categoria: _c, rfId: _r, ...senzaNuovi } = base; void _c; void _r;
    const vecchio: DatiRischio = { ...senzaNuovi, LF: 1e-1, hz: 5, linee: [{ ...base.linee[0]!, schermata: true }] };
    const e = calcolaR1(vecchio, { lps: "nessuno", spd: "nessuno" });
    expect(Number.isFinite(e.R1)).toBe(true);
    expect(e.componenti.RZ).toBe(0);
  });

  it("più zone: N comuni, rischio valutato zona per zona (8.5)", () => {
    const { st, zona } = zonaUnica(base);
    const tetto: Zona = { ...zona, id: "z2", nome: "Terrazza", esterna: false, esposti: true, oreAnno: 500, rfId: "nessuno", linee: [] };
    const e = calcolaZone(st, [zona, tetto], { lps: "nessuno", spd: "nessuno" });
    expect(e.zone).toHaveLength(2);
    expect(e.zone[1]!.componenti.RAD).toBeCloseTo(e.ND * 1 * (500 / 8760) * 0.1, 12);
    expect(e.zone[1]!.componenti.RU).toBe(0); // nessuna linea nella zona
    expect(e.zone[1]!.componenti.RB).toBe(0); // rf = 0
    expect(e.Rmax).toBe(Math.max(e.zone[0]!.R, e.zone[1]!.R));
    const m = protezioneMinimaZone(st, [zona, tetto]);
    if (m) expect(m.esito.zone.every((z) => z.R <= RT_R1)).toBe(true);
  });

  it("struttura adiacente NDJ, cablaggio interno KS3 e TWS", () => {
    const { st, zona } = zonaUnica(base);
    const conAdiacente = { ...st, linee: [{ ...st.linee[0]!, adiacente: { L: 10, W: 10, H: 5, CDJ: 1 } }] };
    const e = calcolaZone(conAdiacente, [zona], { lps: "nessuno", spd: "nessuno" });
    expect(e.NDJ).toBeGreaterThan(0);
    const ks = calcolaZone(st, [{ ...zona, impiantiCritici: true, ks3: 0.01 }], { lps: "nessuno", spd: "nessuno" });
    expect(ks.zone[0]!.frequenze.FM).toBeCloseTo(ks.NM * 1e-4, 12); // PMS = KS3²
    const tws = calcolaZone({ ...st, PTWS: 0.1 }, [zona], { lps: "nessuno", spd: "nessuno" });
    expect(tws.zone[0]!.componenti.RA).toBeCloseTo(calcolaZone(st, [zona], { lps: "nessuno", spd: "nessuno" }).zone[0]!.componenti.RA * 0.1, 15);
  });
});
