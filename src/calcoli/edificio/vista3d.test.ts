import { describe, expect, it } from "vitest";
import { coloreMateriale, corpiInCopertura, direzioneSole, etichettaCorpo, localeDaLatLon, latLonDaLocale, lunghezzaScala, pixelPerMetro, posizioneSole, raggioConduttore, tasselliSatellite, vistaCamera } from "./vista3d";
import type { Corpo } from "./tipi";

const rett = (id: string, x: number, y: number, l: number, w: number, h: number, base = 0): Corpo => ({ id, nome: id, impronta: [[x, y], [x + l, y], [x + l, y + w], [x, y + w]], quotaBase: base, altezzaGronda: h, tipoTetto: "piano", altezzaColmo: h });

describe("vista 3D", () => {
  it("sole a mezzogiorno all'equinozio: a sud, altezza 90° − latitudine", () => {
    const s = posizioneSole(45, 80, 12);
    expect(s.azimut).toBeCloseTo(180, 0);
    expect(s.elevazione).toBeGreaterThan(43);
    expect(s.elevazione).toBeLessThan(47);
    const mattina = posizioneSole(45, 172, 8);
    expect(mattina.azimut).toBeLessThan(180);
    const d = direzioneSole(180, 45);
    expect(d[2]).toBeGreaterThan(0); // sole a sud = verso +z
  });
  it("viste predefinite e scala grafica", () => {
    const b = { minX: 0, maxX: 40, minY: 0, maxY: 20, H: 10 };
    const n = vistaCamera(b, "nord"), s = vistaCamera(b, "sud"), p = vistaCamera(b, "pianta");
    expect(n.posizione[2]).toBeLessThan(-20);
    expect(s.posizione[2]).toBeGreaterThan(0);
    expect(p.posizione[1]).toBeGreaterThan(40);
    expect(lunghezzaScala(10).metri).toBe(10);
    expect(lunghezzaScala(3).metri).toBe(20);
    expect(pixelPerMetro(50, 50, 600)).toBeCloseTo(600 / (2 * 50 * Math.tan((25 * Math.PI) / 180)), 6);
  });
  it("conversione locale ↔ lat/lon e tasselli satellitari", () => {
    const o = { lat: 45.07, lon: 7.68 };
    const g = latLonDaLocale(100, -50, o), [x, y] = localeDaLatLon(g.lat, g.lon, o);
    expect(x).toBeCloseTo(100, 6); expect(y).toBeCloseTo(-50, 6);
    const t = tasselliSatellite(o, 20, 10, 200);
    expect(t.length).toBeGreaterThan(0);
    expect(t.length).toBeLessThanOrEqual(36);
    const minX = Math.min(...t.map((q) => q.minX)), maxX = Math.max(...t.map((q) => q.maxX));
    expect(minX).toBeLessThanOrEqual(20 - 100); expect(maxX).toBeGreaterThanOrEqual(20 + 100);
    expect(t[0]!.url).toContain("World_Imagery");
  });
  it("conduttori, impianti in copertura ed etichette", () => {
    expect(raggioConduttore("Ø 8 mm")).toBeCloseTo(0.004);
    expect(raggioConduttore("30 × 3,5 mm")).toBeGreaterThan(0.005);
    expect(coloreMateriale("Rame")).toBe("#c27a3e");
    expect(coloreMateriale("isCon Pro 75")).toBe("#2a2d31");
    const corpi = [rett("A", 0, 0, 30, 20, 10), rett("UTA", 5, 5, 3, 2, 2, 10)];
    expect([...corpiInCopertura(corpi)]).toEqual(["UTA"]);
    expect(etichettaCorpo(corpi[1]!).testo).toBe("UTA · H 12 m");
  });
});
