import { describe, expect, it } from "vitest";
import { calcolaZone, RT_ITALIA, type Struttura, type Zona } from "./rischioR1";

const zona: Zona = { id: "z", nome: "Z", oreAnno: 8760, rt: 1e-2, rp: 1, rfId: "ordinario", categoria: "normale", misureContatto: 1, esterna: true, esposti: false, impiantiCritici: false, serviziCritici: false };
const st: Struttura = { L: 40, W: 20, H: 15, NG: 3, CD: 1, k: 2, Uw: 2.5, linee: [{ nome: "E", lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 1, schermata: false, connessione: "interrata-ns", schermatura: "no", adiacente: null }] };

describe("Guida CEI 81-29:2026 (metodo italia)", () => {
  it("perdite minime e rischi separati", () => {
    const n = calcolaZone(st, [zona], { lps: "nessuno", spd: "nessuno" }).zone[0]!;
    const i = calcolaZone({ ...st, metodo: "italia" }, [zona], { lps: "nessuno", spd: "nessuno" }).zone[0]!;
    // LF normale 5e-2 → 5e-3: RL2 (solo RB2, RV2 con LF2) scende di un fattore 10
    expect(i.RL2).toBeCloseTo(n.RL2 / 10, 12);
    expect(i.conforme).toBe(i.RL1 <= RT_ITALIA.L1 && i.RL2 <= RT_ITALIA.L2);
    expect(n.conforme).toBe(n.R <= 1e-5);
  });
});
