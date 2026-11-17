import { describe, expect, it } from "vitest";
import { differenzaRelativa, fattoreDaMisura, metriPerPuntoPdf, proponiUnita, scalaComuneVicina, scalaDaTesto, unitaDaInsunits } from "./scala";

describe("scala dei file importati", () => {
  it("riconosce le unità DXF ($INSUNITS)", () => {
    expect(unitaDaInsunits(4)).toBe("mm");
    expect(unitaDaInsunits(6)).toBe("m");
    expect(unitaDaInsunits(0)).toBeNull();
  });

  it("tiene l'unità dichiarata se l'edificio è plausibile", () => {
    const p = proponiUnita([24000, 12000, 9000], "mm");
    expect(p.consigliata).toBe("mm");
    expect(p.dichiarataSospetta).toBe(false);
  });

  it("segnala un'unità dichiarata sbagliata e propone quella giusta", () => {
    const p = proponiUnita([24000, 12000, 9000], "m"); // 24 km: impossibile
    expect(p.dichiarataSospetta).toBe(true);
    expect(p.consigliata).toBe("mm");
  });

  it("senza unità propone metri per un edificio già in metri", () => {
    expect(proponiUnita([35, 18, 12]).consigliata).toBe("m");
  });

  it("senza unità riconosce i centimetri", () => {
    expect(proponiUnita([3500, 1800, 1200]).consigliata).toBe("cm");
  });

  it("legge la scala scritta nel PDF", () => {
    expect(scalaDaTesto("PIANTA PIANO TERRA  SCALA 1:100  tav. 3")).toBe(100);
    expect(scalaDaTesto("Prospetto sud sc. 1/200 – data 12/05/2024")).toBe(200);
    expect(scalaDaTesto("nessuna scala qui, solo 12:30")).toBeNull();
  });

  it("calcola i metri per punto PDF", () => {
    // 1:100 → 1 pollice (72 pt) = 2,54 m
    expect(metriPerPuntoPdf(100) * 72).toBeCloseTo(2.54, 6);
  });

  it("ricava il fattore da una misura nota e confronta le scale", () => {
    expect(fattoreDaMisura(200, 10)).toBeCloseTo(0.05);
    expect(fattoreDaMisura(0, 10)).toBeNull();
    expect(differenzaRelativa(100, 102)).toBeCloseTo(0.0196, 3);
    expect(scalaComuneVicina(101.5)).toBe(100);
    expect(scalaComuneVicina(127)).toBe(125);
    expect(scalaComuneVicina(170)).toBeNull();
  });
});
