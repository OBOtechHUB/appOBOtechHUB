import { describe, it, expect } from "vitest";
import { daGoogle, daOsm, linkGoogleEarth, linkGoogleMaps, anteprimaGoogleMaps, cercaLuoghi } from "./geo";

describe("ricerca dei luoghi", () => {
  it("voce OpenStreetMap: comune da city, town o village", () => {
    expect(daOsm({ display_name: "Via Roma 1, Bergamo", lat: "45.6983", lon: "9.6773", address: { city: "Bergamo", county: "Bergamo" } })).toEqual({ etichetta: "Via Roma 1, Bergamo", comune: "Bergamo", lat: 45.6983, lon: 9.6773 });
    expect(daOsm({ lat: "45.1", lon: "9.2", address: { village: "Zelo Surrigone" } })?.comune).toBe("Zelo Surrigone");
    expect(daOsm({ lat: "x", lon: "9" })).toBeNull();
  });
  it("risultato Google: comune da administrative_area_level_3", () => {
    const l = daGoogle({ formatted_address: "Via Roma, 1, 24121 Bergamo BG, Italia", geometry: { location: { lat: 45.69, lng: 9.67 } }, address_components: [{ long_name: "Bergamo", types: ["administrative_area_level_3", "political"] }, { long_name: "Provincia di Bergamo", types: ["administrative_area_level_2"] }] });
    expect(l).toEqual({ etichetta: "Via Roma, 1, 24121 Bergamo BG, Italia", comune: "Bergamo", lat: 45.69, lon: 9.67 });
    expect(daGoogle({})).toBeNull();
  });
  it("collegamenti a Google Maps e Google Earth", () => {
    expect(linkGoogleMaps(45.69, 9.67)).toBe("https://www.google.com/maps/search/?api=1&query=45.690000,9.670000");
    expect(linkGoogleEarth(45.69, 9.67)).toContain("earth.google.com/web/@45.690000,9.670000");
    expect(anteprimaGoogleMaps(45.69, 9.67)).toContain("output=embed");
  });
  it("meno di 3 caratteri: nessuna ricerca", async () => {
    expect(await cercaLuoghi("mi")).toEqual([]);
  });
});
