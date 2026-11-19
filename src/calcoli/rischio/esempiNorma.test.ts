/**
 * Prove di non regressione con gli esempi dell'Allegato F della CEI EN IEC 62305-2:2026-10
 * (fabbricato residenziale, edificio per uffici, ospedale): stessi dati in ingresso, stessi risultati.
 * La norma arrotonda i risultati a 3 cifre decimali (valori di rischio × 10⁻⁵): le tolleranze ne tengono conto.
 * Qui ci sono solo i dati numerici degli esempi, nessun testo della norma.
 */
import { describe, it, expect } from "vitest";
import { calcolaZone, type Linea, type Struttura, type Zona, type Protezione } from "./rischioR1";

const NESSUNA: Protezione = { lps: "nessuno", spd: "nessuno" };
/** valore × 10⁻⁵ come nelle tabelle della norma */
const e5 = (v: number) => v * 1e5;
/** confronto con il valore pubblicato: scarto entro 1 unità sull'ultima cifra mostrata, oppure entro il 2 % */
function circa(calcolato: number, norma: number, ultimaCifra = 0.001) {
  const scarto = Math.abs(calcolato - norma);
  expect(scarto <= ultimaCifra * 1.01 || scarto <= Math.abs(norma) * 0.02, `calcolato ${calcolato}, norma ${norma}`).toBe(true);
}

/** zona interna di base: valori comuni, ognuno sovrascritto negli esempi */
const zona = (z: Partial<Zona> & Pick<Zona, "id" | "oreAnno">): Zona => ({
  nome: z.id, rt: 1e-5, rp: 1, rfId: "nessuno", categoria: "bassa", misureContatto: 1,
  esterna: false, esposti: false, impiantiCritici: false, serviziCritici: false, ...z,
});

// ------------------------------------------------------------------ F.2 Fabbricato residenziale

describe("Allegato F.2 – fabbricato residenziale", () => {
  const linee: Linea[] = [
    { nome: "Energia BT aerea", lunghezza: 1000, posa: 1, ambiente: 1, tipo: 1, schermata: false, connessione: "aerea-ns", uw: 2.5 },
    { nome: "Telecomunicazioni aerea", lunghezza: 800, posa: 1, ambiente: 1, tipo: 1, schermata: false, connessione: "aerea-ns", uw: 1.5 },
  ];
  // NSG = 8 con k = 2 → NG = 4
  const st: Struttura = { L: 15, W: 20, H: 6, NG: 4, k: 2, CD: 1, Uw: 2.5, PS: 1, linee };
  const z2 = zona({ id: "Z2", oreAnno: 4380, rfId: "ridotto", categoria: "bassa", rp: 1 });

  it("aree di raccolta e numero di eventi (Tab. F.4 e F.5)", () => {
    const e = calcolaZone(st, [z2], NESSUNA);
    circa(e.AD, 2.58e3, 10);
    circa(e.AM, 1.87e5, 1e3);
    circa(e.ND, 2.06e-2, 1e-4);
    circa(e.NM, 7.5e-1, 1e-2);
    circa(e.NL, 3.2e-1 + 2.56e-1, 1e-3);
    // NI per linea con la propria Uw: 3,07 (energia) + 6,17 (telecomunicazioni)
    circa(e.NI, 3.07 + 6.17, 0.02);
  });

  it("rischio senza protezione (Tab. F.8): R = 1,793 > RT", () => {
    const z = calcolaZone(st, [z2], NESSUNA).zone[0]!;
    circa(e5(z.componenti.RB), 0.062);
    circa(e5(z.componenti.RU), 0.003);
    circa(e5(z.componenti.RV), 1.728);
    circa(e5(z.R), 1.793);
    expect(z.conforme).toBe(false);
  });

  it("con SPD di LPL IV all'ingresso delle linee (Tab. F.9): R = 0,149 < RT", () => {
    const z = calcolaZone(st, [z2], { lps: "nessuno", spd: "IV" }).zone[0]!;
    circa(e5(z.componenti.RB), 0.062);
    circa(e5(z.componenti.RV), 0.086);
    circa(e5(z.R), 0.149);
    expect(z.conforme).toBe(true);
  });
});

// ------------------------------------------------------------------ F.3 Edificio per uffici

describe("Allegato F.3 – edificio per uffici", () => {
  const linee: Linea[] = [
    {
      nome: "Energia (AT + BT interrate)", lunghezza: 0, posa: 1, ambiente: 1, tipo: 1, schermata: false, connessione: "interrata-ns", uw: 2.5, ks3: 0.2,
      sezioni: [{ lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 0.2 }, { lunghezza: 100, posa: 0.3, ambiente: 0.5, tipo: 1 }],
    },
    // linea esterna in fibra, impianto interno in rame non schermato
    { nome: "Telecomunicazioni (fibra)", lunghezza: 0, posa: 1, ambiente: 1, tipo: 1, schermata: false, connessione: "nessuna", uw: 1.5, ks3: 1, impiantoInterno: true },
  ];
  // NSG = 4, k = 2
  const st: Struttura = { L: 20, W: 40, H: 25, NG: 2, k: 2, CD: 1, Uw: 2.5, PS: 0.5, linee };
  const interne = { esterna: false, FT: 5e-2, ks3: 1, oreApparecchi: 8760 };
  const zone: Zona[] = [
    zona({ id: "Z1", oreAnno: 175, rt: 1e-3, esterna: true, linee: [] }),
    zona({ id: "Z2", oreAnno: 18, rt: 1e-5, esterna: true, esposti: true, LD: 1e-1, linee: [] }),
    zona({ id: "Z3", oreAnno: 440, rfId: "alto", rp: 0.2, categoria: "normale", ...interne }),
    zona({ id: "Z4", oreAnno: 2630, rfId: "ridotto", rp: 0.5, categoria: "normale", ...interne }),
    zona({ id: "Z5", oreAnno: 2200, rfId: "ridotto", rp: 0.2, categoria: "elevata", ...interne }),
  ];
  const r = (e: ReturnType<typeof calcolaZone>, id: string) => e.zone.find((z) => z.zona.id === id)!;

  it("aree di raccolta e numero di eventi (Tab. F.13 e F.14)", () => {
    const e = calcolaZone(st, zone, NESSUNA);
    circa(e.AD, 2.75e4, 100);
    circa(e.AM, 1.99e5, 1e3);
    circa(e.ND, 1.1e-1, 1e-3);
    circa(e.NM, 3.98e-1, 1e-3);
    circa(e.NL, 4.8e-3 + 2.4e-3, 1e-4);
    circa(e.NI, 4.61e-2 + 2.31e-2, 2e-4);
  });

  it("rischio senza protezione (Tab. F.21)", () => {
    const e = calcolaZone(st, zone, NESSUNA);
    circa(e5(r(e, "Z1").componenti.RA), 0.002);
    circa(e5(r(e, "Z2").componenti.RAD), 2.259);
    circa(e5(r(e, "Z3").componenti.RB), 5.770);
    circa(e5(r(e, "Z3").componenti.RV), 0.756);
    circa(e5(r(e, "Z3").R), 6.526);
    circa(e5(r(e, "Z4").componenti.RB), 0.179);
    circa(e5(r(e, "Z4").R), 0.202);
    circa(e5(r(e, "Z5").componenti.RB), 0.137);
    circa(e5(r(e, "Z5").R), 0.156);
    expect(r(e, "Z2").conforme).toBe(false);
    expect(r(e, "Z3").conforme).toBe(false);
  });

  it("frequenza del danno senza protezione (Tab. F.22): F = 0,584 > FT = 0,05", () => {
    const z = r(calcolaZone(st, zone, NESSUNA), "Z3");
    circa(z.frequenze.FC, 0.11);
    circa(z.frequenze.FM, 0.398);
    circa(z.frequenze.FW, 0.007);
    circa(z.frequenze.FZ, 0.0692, 0.0001);
    circa(z.F, 0.584);
    expect(z.FT).toBe(0.05);
    expect(z.frequenzaConforme).toBe(false);
  });

  it("con LPS di classe II e SPD di LPL II (Tab. F.23 e F.24)", () => {
    const e = calcolaZone(st, zone, { lps: "II", spd: "II" });
    circa(e5(r(e, "Z2").componenti.RAD), 0.113);
    circa(e5(r(e, "Z3").componenti.RB), 0.577);
    circa(e5(r(e, "Z3").componenti.RV), 0.015);
    circa(e5(r(e, "Z3").R), 0.592);
    circa(e5(r(e, "Z4").R), 0.018);
    circa(e5(r(e, "Z5").R), 0.014);
    const z3 = r(e, "Z3");
    // impianti di energia e telecomunicazioni combinati per PC e PM (equazioni 14 e 15)
    circa(z3.frequenze.FC, 0.004);
    circa(z3.frequenze.FM, 0.008);
    circa(z3.frequenze.FZ, 0.001);
    circa(z3.F, 0.014);
    expect(e.conforme).toBe(true);
    expect(e.frequenzaConforme).toBe(true);
  });
});

// ------------------------------------------------------------------ F.4 Ospedale

describe("Allegato F.4 – ospedale", () => {
  const linee: Linea[] = [{
    nome: "Energia (AT + BT interrate)", lunghezza: 0, posa: 1, ambiente: 1, tipo: 1, schermata: false, connessione: "interrata-ns", uw: 2.5,
    sezioni: [{ lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 0.2 }, { lunghezza: 50, posa: 0.3, ambiente: 0.5, tipo: 1 }],
  }];
  // NSG = 8, k = 2; la linea di telecomunicazioni e i suoi impianti sono in fibra: trascurati
  const st: Struttura = { L: 50, W: 150, H: 10, NG: 4, k: 2, CD: 1, Uw: 2.5, PS: 0.5, linee };
  const interne = { esterna: true, impiantiCritici: true, oreApparecchi: 8760, rp: 0.2 };
  const zone: Zona[] = [
    zona({ id: "Z1", oreAnno: 175, rt: 1e-2, esterna: true, linee: [] }),
    zona({ id: "Z2", oreAnno: 90, rt: 1e-5, esterna: true, esposti: true, LD: 1e-1, linee: [] }),
    zona({ id: "Z3", oreAnno: 8760, rfId: "ordinario", categoria: "elevata", ks3: 0.2, FT: 5e-2, ...interne }),
    zona({ id: "Z4", oreAnno: 3100, rfId: "ridotto", categoria: "molto-elevata", ks3: 0.01, FT: 1e-2, ...interne }),
    zona({ id: "Z5", oreAnno: 8760, rfId: "ridotto", categoria: "molto-elevata", ks3: 0.01, FT: 1e-2, ...interne }),
  ];
  const r = (e: ReturnType<typeof calcolaZone>, id: string) => e.zone.find((z) => z.zona.id === id)!;

  it("aree di raccolta e numero di eventi (Tab. F.27 e F.28)", () => {
    const e = calcolaZone(st, zone, NESSUNA);
    circa(e.AD, 2.23e4, 100);
    circa(e.AM, 1.18e5, 1e3);
    circa(e.ND, 1.79e-1, 1e-3);
    circa(e.NM, 4.7e-1, 1e-2);
    circa(e.NL, 1.2e-2, 1e-4);
    circa(e.NI, 1.15e-1, 1e-3);
  });

  it("rischio senza protezione (Tab. F.35)", () => {
    const e = calcolaZone(st, zone, NESSUNA);
    circa(e5(r(e, "Z1").componenti.RA), 0.036);
    circa(e5(r(e, "Z2").componenti.RAD), 18.357, 0.05);
    const z3 = r(e, "Z3").componenti;
    circa(e5(z3.RB), 3.572); circa(e5(z3.RC), 17.862); circa(e5(z3.RM), 1.881); circa(e5(z3.RV), 0.480); circa(e5(z3.RW), 1.200); circa(e5(z3.RZ), 11.531);
    circa(e5(r(e, "Z3").R), 36.528);
    const z4 = r(e, "Z4").componenti;
    circa(e5(z4.RB), 0.484); circa(e5(z4.RC), 63.213, 0.05); circa(e5(z4.RM), 0.017); circa(e5(z4.RW), 4.247); circa(e5(z4.RZ), 40.807, 0.05);
    circa(e5(r(e, "Z4").R), 108.834, 0.1);
    circa(e5(r(e, "Z5").R), 306.787, 0.2);
  });

  it("frequenza del danno senza protezione (Tab. F.36)", () => {
    const e = calcolaZone(st, zone, NESSUNA);
    circa(r(e, "Z3").frequenze.FC, 0.179);
    circa(r(e, "Z3").frequenze.FM, 0.019);
    circa(r(e, "Z3").F, 0.325);
    circa(r(e, "Z4").F, 0.306);
    expect(r(e, "Z4").FT).toBe(0.01);
  });

  it("con cartello sul tetto, LPS di classe II, SPD all'ingresso di LPL II e SPD coordinati per zona (Tab. F.37 e F.38)", () => {
    const protette = zone.map((z) =>
      z.id === "Z2" ? { ...z, misureContatto: 0.1 }
      : z.id === "Z3" ? { ...z, spd: "I" as const }
      : z.id === "Z4" || z.id === "Z5" ? { ...z, pspd: 0.002 } : z);
    const e = calcolaZone(st, protette, { lps: "II", spd: "II" });
    circa(e5(r(e, "Z1").R), 0.002);
    circa(e5(r(e, "Z2").R), 0.092);
    const z3 = r(e, "Z3").componenti;
    circa(e5(z3.RB), 0.357); circa(e5(z3.RC), 0.179); circa(e5(z3.RM), 0.019); circa(e5(z3.RV), 0.010); circa(e5(z3.RW), 0.012); circa(e5(z3.RZ), 0.115);
    circa(e5(r(e, "Z3").R), 0.692);
    circa(e5(r(e, "Z4").R), 0.266);
    circa(e5(r(e, "Z5").R), 0.685);
    circa(r(e, "Z3").F, 0.0032, 0.0001);
    circa(r(e, "Z4").F, 0.0006, 0.0001);
    expect(e.conforme).toBe(true);
    expect(e.frequenzaConforme).toBe(true);
  });
});

describe("Tab. C.2, Nota 2 – categorie di perdita diverse per persone (L1) e struttura (L2)", () => {
  it("museo: persone a perdita normale, patrimonio a perdita elevata → RB2 con LF2 = 0,1", () => {
    const st: Struttura = { L: 30, W: 20, H: 12, NG: 2, k: 2, CD: 1, Uw: 2.5, PS: 1, linee: [] };
    const base = zona({ id: "Sale", oreAnno: 2000, rfId: "ordinario", categoria: "normale" });
    const uguale = calcolaZone(st, [base], NESSUNA).zone[0]!.componenti;
    const museo = calcolaZone(st, [{ ...base, categoriaL2: "elevata" }], NESSUNA).zone[0]!.componenti;
    expect(museo.RB).toBeGreaterThan(uguale.RB);
    // RB2 = ND · PB · LF2: raddoppia passando da 0,05 a 0,1, RB1 resta uguale
    const nd = calcolaZone(st, [base], NESSUNA).ND, pb = 1 * 1 * 1 * 1e-2;
    expect(museo.RB - uguale.RB).toBeCloseTo(nd * pb * (0.1 - 0.05), 12);
  });
});

