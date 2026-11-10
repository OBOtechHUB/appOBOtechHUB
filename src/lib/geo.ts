/**
 * Ricerca di indirizzi e comuni e posizione sulla mappa.
 * - Con la chiave VITE_GOOGLE_MAPS_KEY usa Google Maps (Geocoding API).
 * - Senza chiave i suggerimenti mentre si scrive arrivano da Photon (gratuito, dati OpenStreetMap, pensato per la ricerca
 *   durante la digitazione). Nominatim non va usato per i suggerimenti (regole d'uso OSMF): resta solo per la ricerca
 *   dalla posizione del dispositivo, una richiesta alla volta.
 * - I collegamenti e l'anteprima satellitare di Google Maps e Google Earth non richiedono chiavi.
 */
export interface Luogo { etichetta: string; comune: string; lat: number; lon: number }

const CHIAVE_GOOGLE = (import.meta.env["VITE_GOOGLE_MAPS_KEY"] as string | undefined) || "";
export const fornitoreGeo = (): "Google Maps" | "Photon (OpenStreetMap)" => (CHIAVE_GOOGLE ? "Google Maps" : "Photon (OpenStreetMap)");

interface VocePhoton { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> }
/** Converte una voce di Photon (GeoJSON, coordinate [lon, lat]). */
export function daPhoton(v: VocePhoton): Luogo | null {
  const [lon, lat] = v.geometry?.coordinates ?? [NaN, NaN];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const p = v.properties ?? {};
  const comune = p["city"] ?? p["town"] ?? p["village"] ?? p["district"] ?? p["county"] ?? "";
  const via = [p["street"], p["housenumber"]].filter(Boolean).join(" ");
  const nome = p["name"] && p["name"] !== p["street"] ? p["name"] : "";
  const parti = [nome, via, [p["postcode"], comune].filter(Boolean).join(" "), p["state"], p["country"]].filter((x, i, a) => x && a.indexOf(x) === i);
  return { etichetta: parti.join(", ") || `${lat.toFixed(5)}, ${lon.toFixed(5)}`, comune, lat, lon };
}

interface VoceOsm { display_name?: string; lat?: string; lon?: string; address?: Record<string, string> }
/** Converte una voce di Nominatim; il comune è city, town, village o municipality. */
export function daOsm(v: VoceOsm): Luogo | null {
  const lat = Number(v.lat), lon = Number(v.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const a = v.address ?? {};
  const comune = a["city"] ?? a["town"] ?? a["village"] ?? a["municipality"] ?? a["hamlet"] ?? a["county"] ?? "";
  return { etichetta: v.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`, comune, lat, lon };
}
interface VoceGoogle { formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } }; address_components?: { long_name: string; types: string[] }[] }
/** Converte un risultato di Google Geocoding; in Italia il comune è administrative_area_level_3, altrove locality. */
export function daGoogle(v: VoceGoogle): Luogo | null {
  const lat = v.geometry?.location?.lat, lon = v.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  const c = v.address_components ?? [];
  const tipo = (t: string) => c.find((x) => x.types.includes(t))?.long_name;
  const comune = tipo("administrative_area_level_3") ?? tipo("locality") ?? tipo("postal_town") ?? tipo("administrative_area_level_2") ?? "";
  return { etichetta: v.formatted_address ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`, comune, lat, lon };
}

const lingua = () => { try { return localStorage.getItem("obo-lingua") === "en" ? "en" : "it"; } catch { return "it"; } };

/** Cerca un indirizzo o un comune (almeno 3 caratteri). */
export async function cercaLuoghi(testo: string, segnale?: AbortSignal): Promise<Luogo[]> {
  const q = testo.trim();
  if (q.length < 3) return [];
  const opz = segnale ? { signal: segnale } : {};
  if (CHIAVE_GOOGLE) {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&language=${lingua()}&region=it&key=${CHIAVE_GOOGLE}`, opz);
    if (!r.ok) throw new Error("Ricerca non disponibile");
    const j = (await r.json()) as { status?: string; results?: VoceGoogle[] };
    if (j.status && j.status !== "OK" && j.status !== "ZERO_RESULTS") throw new Error("Ricerca non disponibile");
    return (j.results ?? []).map(daGoogle).filter((x): x is Luogo => x !== null).slice(0, 5);
  }
  // Photon: suggerimenti durante la digitazione, risultati vicini all'Italia per primi
  const lang = lingua() === "en" ? "en" : "default";
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=${lang}&lat=42.5&lon=12.5`, opz);
  if (!r.ok) throw new Error("Ricerca non disponibile");
  const j = (await r.json()) as { features?: VocePhoton[] };
  return (j.features ?? []).map(daPhoton).filter((x): x is Luogo => x !== null);
}

/** Indirizzo e comune da una coordinata (es. la posizione del dispositivo). */
export async function luogoDaCoordinate(lat: number, lon: number): Promise<Luogo> {
  const base: Luogo = { etichetta: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, comune: "", lat, lon };
  try {
    if (CHIAVE_GOOGLE) {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&language=${lingua()}&key=${CHIAVE_GOOGLE}`);
      const j = (await r.json()) as { results?: VoceGoogle[] };
      const l = j.results?.[0] ? daGoogle(j.results[0]) : null;
      return l ? { ...l, lat, lon } : base;
    }
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=${lingua()}&lat=${lat}&lon=${lon}`);
    const l = r.ok ? daOsm((await r.json()) as VoceOsm) : null;
    return l ? { ...l, lat, lon } : base;
  } catch { return base; }
}

/** Posizione del dispositivo (chiede il permesso al browser). */
export function posizioneDispositivo(): Promise<{ lat: number; lon: number }> {
  return new Promise((ok, ko) => {
    if (!("geolocation" in navigator)) { ko(new Error("Questo dispositivo non fornisce la posizione.")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => ko(new Error(e.code === e.PERMISSION_DENIED ? "Permesso di posizione negato: consentilo nel browser o cerca l'indirizzo." : "Posizione non disponibile: riprova o cerca l'indirizzo.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

const c = (v: number) => v.toFixed(6);
export const linkGoogleMaps = (lat: number, lon: number) => `https://www.google.com/maps/search/?api=1&query=${c(lat)},${c(lon)}`;
export const linkGoogleEarth = (lat: number, lon: number) => `https://earth.google.com/web/@${c(lat)},${c(lon)},0a,400d,35y,0h,0t,0r`;
/** Anteprima satellitare di Google Maps da mettere in un iframe. */
export const anteprimaGoogleMaps = (lat: number, lon: number) => `https://maps.google.com/maps?q=${c(lat)},${c(lon)}&t=k&z=19&output=embed`;
