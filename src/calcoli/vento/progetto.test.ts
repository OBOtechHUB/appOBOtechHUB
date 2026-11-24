import { describe, expect, test } from "bun:test";
import { verificaVentoProgetto } from "./progetto";
import type { Asta } from "@/calcoli/edificio/tipi";

const V = { zona: 1, altitudine: 200, categoria: "III" as const, quotaBase: 10, mu: 0.4, interasseParete: 0.5, materialeParete: "AL" as const };
const asta = (id: string, codice: string, altezza: number, z = 10): Asta => ({ id, x: 0, y: 0, z, altezza, diametro: 0.016, codiceOBO: codice });

describe("verifica al vento delle aste del progetto", () => {
  test("raggruppa e sceglie il metodo per ogni asta", () => {
    const aste = [asta("a", "5400810", 10, 0), asta("b", "5400810", 10, 0), asta("c", "5402864", 4), asta("d", "5401986", 2.5), asta("e", "9999999", 2)];
    const tipi: Record<string, "treppiede" | "basamento" | "fissa" | "isolata"> = { a: "treppiede", b: "treppiede", c: "treppiede", d: "basamento", e: "fissa" };
    const r = verificaVentoProgetto(aste, { "5402864": { nome: "isFang", dati: { "Nominal size Ø": "40/ 16/ 10 mm", Diameter: "40 mm" } } }, V, (a) => tipi[a.id]!);
    const m = Object.fromEntries(r.gruppi.map((g) => [g.codice, g]));
    expect(m["5400810"]!.metodo).toBe("irod"); expect(m["5400810"]!.numero).toBe(2);
    expect(m["5400810"]!.blocchi).toBeGreaterThan(0);
    expect(m["5402864"]!.metodo).toBe("tabella");
    expect(m["5401986"]!.metodo).toBe("basamento");
    expect(m["9999999"]!.metodo).toBe("parete"); expect(m["9999999"]!.parete!.sigma).toBeGreaterThan(0);
    expect(r.computo[0]!.codice).toBe("5403227");
    expect(r.computo[0]!.quantita).toBe(r.blocchiTotali);
    expect(r.computo[1]!.quantita).toBe(r.blocchiTotali);
    expect(r.computo.slice(2).every((c) => ["5408971", "5408972", "5408973", "5408905"].includes(c.codice))).toBe(true);
    expect(m["5400810"]!.barra?.codice).toBe("5408972");
  });
  test("la quota della base cambia la velocità", () => {
    const f = (z: number) => verificaVentoProgetto([asta("a", "5402864", 4, z)], {}, V, () => "treppiede").gruppi[0]!.vento;
    expect(f(30)).toBeGreaterThan(f(5));
  });
});
