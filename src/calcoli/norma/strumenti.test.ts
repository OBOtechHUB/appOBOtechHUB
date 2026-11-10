import { describe, it, expect } from "vitest";
import {
  PARAMETRI_FULMINE, raggioSfera, sezioneMinima, sezioneMinimaSchermo, lunghezzaCavoSuolo, correnteMaxSchermoRame, verificaContattoPasso, requisitiEsplosione,
  campoFulmineDiretto, fattoreSchermatura, distanzaImpatto, campoFulmineVicino, cadutaCollegamenti, livelloEffettivo, verificaSpdDettagliata,
  tensioneIndotta, ksSchermo, correnteConduttoriCC, spdFotovoltaico, spdFotovoltaicoCommutazione,
} from "./strumenti";

describe("strumenti CEI EN IEC 62305:2024", () => {
  it("parametri del fulmine e sfera rotolante (parte 1)", () => {
    expect(PARAMETRI_FULMINE.I.primoPositivo.I).toBe(200);
    expect(PARAMETRI_FULMINE.II.successivo.I).toBe(37.5);
    expect(PARAMETRI_FULMINE.IV.r).toBe(60);
    expect(raggioSfera(3)).toBeCloseTo(20.4, 1);
    expect(raggioSfera(16)).toBeCloseTo(60.6, 1);
  });

  it("sezioni minime (Tab. 7, 8, 9, 10)", () => {
    expect(sezioneMinima("captatore-calata", "alluminio", "nastro")).toBe(70);
    expect(sezioneMinima("captatore-calata", "acciaio-inox", "cordato")).toBe(70);
    expect(sezioneMinima("dispersore", "acciaio-zincato", "nastro")).toBe(90);
    expect(sezioneMinima("dispersore", "acciaio-inox", "nastro")).toBe(100);
    expect(sezioneMinima("equipotenziale-barre", "rame", "cordato")).toBe(16);
    expect(sezioneMinima("equipotenziale-interno", "acciaio-zincato", "tondo")).toBe(16);
    expect(sezioneMinima("dispersore", "alluminio", "tondo")).toBeNull();
  });

  it("schermo dei cavi entranti (parte 3, Allegato A)", () => {
    const Lc = lunghezzaCavoSuolo(400); // 8·20 = 160 m
    expect(Lc).toBe(160);
    expect(sezioneMinimaSchermo(10, 17.24e-9, Lc, 2.5)).toBeCloseTo(10 * 17.24e-9 * 160 * 1e6 / 2.5, 9);
    expect(correnteMaxSchermoRame(16)).toBe(128);
  });

  it("tensioni di contatto e passo (8.1, 8.2)", () => {
    expect(verificaContattoPasso({ nessunoEntro3m: false, calateNaturali10: false, suoloIsolante: true }).tollerabile).toBe(true);
    expect(verificaContattoPasso({ nessunoEntro3m: false, calateNaturali10: false, suoloIsolante: false }).tollerabile).toBe(false);
    expect(requisitiEsplosione("0-20").length).toBeGreaterThan(requisitiEsplosione("2-22").length);
  });

  it("schermatura magnetica (parte 4, Allegato A)", () => {
    // esempio della norma: Cu, wm = 2 m → SF = 12,6 dB; struttura 10×10×10, I0 = 100 kA, dr = h/2, dw = l/2
    expect(fattoreSchermatura("rame-alluminio", 2, 0, "25kHz")).toBeCloseTo(12.6, 1);
    const d = campoFulmineDiretto(100000, 2, 5, 5);
    expect(d.H1).toBeCloseTo(179, 0);
    expect(campoFulmineDiretto(100000, 2, 2, 5).H1).toBeCloseTo(447, 0);
    expect(campoFulmineDiretto(100000, 2, 5, 5, true).H1).toBeCloseTo(89.4, 1);
    expect(distanzaImpatto(60, 100, 20)).toBe(70);
    expect(distanzaImpatto(60, 10, 20)).toBeCloseTo(Math.sqrt(1200 - 100) + 10, 9);
    const v = campoFulmineVicino(100000, 50, 12.6, 2);
    expect(v.H0).toBeCloseTo(318.3, 1);
    expect(v.H1).toBeCloseTo(318.3 / Math.pow(10, 0.63), 0);
    expect(v.dSF).toBeCloseTo(2.52, 2);
    expect(fattoreSchermatura("rame-alluminio", 10, 0, "1MHz")).toBe(0);
  });

  it("SPD: livello di protezione effettivo e regola n. 2 (Allegato C)", () => {
    const du = cadutaCollegamenti(10, 1);
    expect(du).toBeCloseTo(1, 12);
    expect(livelloEffettivo(1.5, du, "limitatore")).toBeCloseTo(2.5, 12);
    expect(livelloEffettivo(1.5, du, "commutazione")).toBe(1.5);
    expect(verificaSpdDettagliata(1.2, 4, 0.5).ok).toBe(true);
    expect(verificaSpdDettagliata(2.5, 4, 0, 2).ok).toBe(false);
  });

  it("tensione indotta (Allegato H) e fotovoltaico (Allegato F)", () => {
    const u = tensioneIndotta({ lpl: "III", d: 1, w: 0.1, lp: 3, lo: 0, kc: 0.44, ks1: 1, ks2: 1 });
    expect(u.h).toBeCloseTo(0.8 * Math.log(1.1) * 25, 9);
    expect(u.Ui1).toBeCloseTo(0.7 * u.h * 0.44 * 3, 9);
    expect(u.Ui2).toBeCloseTo((3 * 0.1 * 5) / 1000, 12);
    expect(ksSchermo("maglia", 2)).toBeCloseTo(0.24, 12);
    expect(correnteConduttoriCC("I", 0.44, 4)).toBeCloseTo(11, 9);
    expect(spdFotovoltaico("II", 4).singolo).toEqual({ In: 7.5, Iimp: 3.75 });
    expect(spdFotovoltaico("IV", 2).totale).toEqual({ In: 17, Iimp: 10 });
    expect(spdFotovoltaicoCommutazione("II", 3)).toEqual({ singolo: 18.5, totale: 37.5 });
    expect(spdFotovoltaicoCommutazione("IV", 4)).toEqual({ singolo: 6.25, totale: 12.5 });
  });
});
