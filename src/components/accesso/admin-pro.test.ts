import { describe, it, expect } from "vitest";
import { giorniDallaCopia } from "./CopiaSicurezza";
import { raggruppa } from "./UsoAdmin";
import { browserBreve } from "./ErroriAdmin";
import { ERRORE_IGNORATO } from "@/lib/registro";

describe("strumenti admin", () => {
  it("giorni dall'ultima copia", () => {
    const ora = new Date("2026-11-10T12:00:00Z").getTime();
    expect(giorniDallaCopia(undefined, ora)).toBeNull();
    expect(giorniDallaCopia("non data", ora)).toBeNull();
    expect(giorniDallaCopia("2026-11-10T08:00:00Z", ora)).toBe(0);
    expect(giorniDallaCopia("2026-11-01T12:00:00Z", ora)).toBe(9);
  });
  it("statistiche d'uso raggruppate per app", () => {
    const r = [
      { giorno: "2026-11-09", app: "lps", sezione: "", aperture: 3, persone: 2, visitatori: 0 },
      { giorno: "2026-11-10", app: "lps", sezione: "", aperture: 5, persone: 3, visitatori: 1 },
      { giorno: "2026-11-10", app: "mappa", sezione: "", aperture: 1, persone: 1, visitatori: 0 },
    ];
    expect(raggruppa(r, (x) => x.app)).toEqual([{ k: "lps", aperture: 8, giorni: 2, persone: 4 }, { k: "mappa", aperture: 1, giorni: 1, persone: 1 }]);
  });
  it("browser in parole semplici ed errori ignorati", () => {
    expect(browserBreve("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Edge · Windows");
    expect(browserBreve("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari · iPhone");
    expect(ERRORE_IGNORATO.test("Failed to fetch")).toBe(true);
    expect(ERRORE_IGNORATO.test("Cannot read properties of undefined (reading 'x')")).toBe(false);
  });
});
