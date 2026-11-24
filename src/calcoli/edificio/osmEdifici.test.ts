import { describe, expect, it } from "vitest";
import { corpiDaOsm, edificiDaOverpass, numeroTag } from "./osmEdifici";

const q = (lat: number, lon: number, d: number) => [{ lat, lon }, { lat, lon: lon + d }, { lat: lat + d, lon: lon + d }, { lat: lat + d, lon }, { lat, lon }];
describe("edifici da OSM", () => {
  it("tag di altezza", () => {
    expect(numeroTag("12,5 m")).toBe(12.5); expect(numeroTag("10 ft")).toBeCloseTo(3.048); expect(numeroTag(undefined)).toBeNull();
  });
  it("contorno con parti e altezze", () => {
    const ed = edificiDaOverpass({ elements: [
      { type: "way", id: 1, tags: { building: "yes", "building:levels": "4" }, geometry: q(45, 7, 0.001) },
      { type: "way", id: 2, tags: { "building:part": "yes", height: "16", min_height: "12" }, geometry: q(45.0004, 7.0004, 0.0001) },
      { type: "way", id: 3, tags: { building: "house", height: "8", "roof:shape": "gabled", "roof:height": "2" }, geometry: q(45.01, 7.01, 0.0002) },
      { type: "relation", id: 4, tags: { building: "yes", type: "multipolygon" }, members: [{ type: "way", role: "outer", geometry: [{ lat: 45.02, lon: 7.02 }, { lat: 45.02, lon: 7.021 }, { lat: 45.021, lon: 7.021 }] }, { type: "way", role: "outer", geometry: [{ lat: 45.021, lon: 7.021 }, { lat: 45.021, lon: 7.02 }, { lat: 45.02, lon: 7.02 }] }] },
    ] });
    expect(ed.length).toBe(3);
    expect(ed[0]!.altezza).toBe(12); expect(ed[0]!.stimata).toBe(true); expect(ed[0]!.parti.length).toBe(1);
    const c = corpiDaOsm([ed[0]!], { lat: 45, lon: 7 }, 9);
    expect(c.length).toBe(1); expect(c[0]!.quotaBase).toBe(12); expect(c[0]!.altezzaGronda).toBe(4);
    const casa = corpiDaOsm([ed[1]!], { lat: 45, lon: 7 }, 9)[0]!;
    expect(casa.tipoTetto).toBe("falde"); expect(casa.altezzaGronda).toBe(6); expect(casa.altezzaColmo).toBe(8);
    expect(ed[2]!.punti.length).toBe(4);
  });
});
