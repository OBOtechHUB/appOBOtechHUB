/**
 * Ricerca di indirizzi e comuni e posizione sulla mappa.
 * - Con la chiave VITE_GOOGLE_MAPS_KEY usa Google Maps (Geocoding API).
 * - Senza chiave i suggerimenti mentre si scrive arrivano da Photon (gratuito, dati OpenStreetMap, pensato per la ricerca
 *   durante la digitazione). Nominatim non va usato per i suggerimenti (regole d'uso OSMF): resta solo per la ricerca
 *   dalla posizione del dispositivo, una richiesta alla volta.
 * - I collegamenti e l'anteprima satellitare di Google Maps e Google Earth non richiedono chiavi.
 */
export interface Luogo {
  etichetta: string; comune: string; lat: number; lon: number;
  /** come in Google Maps: riga principale (luogo, via e numero) e riga secondaria (CAP, comune, provincia, paese) */
  principale?: string | undefined; secondario?: string | undefined;
  /** tipo di luogo: indirizzo, via, località, comune, provincia, regione, luogo */
  tipo?: string | undefined;
}

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
  const principale = nome || via || comune || p["state"] || p["country"] || "";
  const secondario = [nome && via ? via : "", [p["postcode"], principale === comune ? "" : comune].filter(Boolean).join(" "), p["county"] && p["county"] !== comune ? p["county"] : "", p["state"], p["country"] && p["country"] !== "Italia" ? p["country"] : ""]
    .filter((x, i, a) => x && x !== principale && a.indexOf(x) === i).join(", ");
  const t = p["type"] ?? p["osm_value"] ?? "";
  const tipo = t === "house" || p["housenumber"] ? "indirizzo" : t === "street" ? "via" : ["city", "town", "village"].includes(t) ? "comune" : ["district", "locality", "hamlet", "suburb"].includes(t) ? "località" : t === "county" ? "provincia" : t === "state" ? "regione" : "luogo";
  return { etichetta: parti.join(", ") || `${lat.toFixed(5)}, ${lon.toFixed(5)}`, comune, lat, lon, principale: principale || undefined, secondario: secondario || undefined, tipo };
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

/** Coordinate scritte a mano ("45.69, 9.67" o "45,69 9,67"), come in Google Maps. */
export function coordinateDaTesto(testo: string): { lat: number; lon: number } | null {
  const m = testo.trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = Number(String(m[1]).replace(",", ".")), lon = Number(String(m[2]).replace(",", "."));
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && /[.,]\d/.test(testo) ? { lat, lon } : null;
}

/** Cerca un indirizzo, un luogo o un comune mentre si scrive (almeno 2 caratteri). `vicino` dà priorità ai risultati attorno a un punto. */
export async function cercaLuoghi(testo: string, segnale?: AbortSignal, vicino?: { lat: number; lon: number } | null): Promise<Luogo[]> {
  const q = testo.trim();
  if (q.length < 2) return [];
  const coord = coordinateDaTesto(q);
  if (coord) return [{ etichetta: `${coord.lat.toFixed(6)}, ${coord.lon.toFixed(6)}`, comune: "", lat: coord.lat, lon: coord.lon, principale: `${coord.lat.toFixed(6)}, ${coord.lon.toFixed(6)}`, secondario: "Coordinate", tipo: "coordinate" }];
  const opz = segnale ? { signal: segnale } : {};
  if (CHIAVE_GOOGLE) {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&language=${lingua()}&region=it&key=${CHIAVE_GOOGLE}`, opz);
    if (!r.ok) throw new Error("Ricerca non disponibile");
    const j = (await r.json()) as { status?: string; results?: VoceGoogle[] };
    if (j.status && j.status !== "OK" && j.status !== "ZERO_RESULTS") throw new Error("Ricerca non disponibile");
    return (j.results ?? []).map(daGoogle).filter((x): x is Luogo => x !== null).slice(0, 8);
  }
  // Photon: suggerimenti durante la digitazione; prima i risultati vicini al progetto (o al centro Italia)
  const lang = lingua() === "en" ? "en" : "default";
  const c = vicino ?? { lat: 42.5, lon: 12.5 };
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=${lang}&lat=${c.lat}&lon=${c.lon}${vicino ? "&zoom=10&location_bias_scale=0.3" : ""}`, opz);
  if (!r.ok) throw new Error("Ricerca non disponibile");
  const j = (await r.json()) as { features?: VocePhoton[] };
  const visti = new Set<string>();
  return (j.features ?? []).map(daPhoton).filter((x): x is Luogo => x !== null).filter((l) => { const k = l.etichetta.toLowerCase(); if (visti.has(k)) return false; visti.add(k); return true; });
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

/** Errore di posizione con le istruzioni per risolverlo. */
export class ErrorePosizione extends Error {
  constructor(messaggio: string, public passi: string[] = []) { super(messaggio); }
}

function sistema(): "windows" | "mac" | "iphone" | "android" | "altro" {
  const u = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /iPhone|iPad|iPod/i.test(u) ? "iphone" : /Android/i.test(u) ? "android" : /Windows/i.test(u) ? "windows" : /Macintosh|Mac OS X/i.test(u) ? "mac" : "altro";
}

/** Istruzioni quando il browser risponde "permesso negato": sito bloccato oppure localizzazione spenta nel sistema. */
export async function passiPermesso(): Promise<ErrorePosizione> {
  let stato = "";
  try { stato = (await navigator.permissions.query({ name: "geolocation" as PermissionName })).state; } catch { /* non supportato (Safari vecchi) */ }
  const so = sistema();
  const sito = ["Clicca il lucchetto (o l'icona delle impostazioni) a sinistra dell'indirizzo del sito", "Alla voce Posizione scegli Consenti", "Ricarica la pagina e premi di nuovo La mia posizione"];
  const sistemaSpento: Record<string, string[]> = {
    windows: ["Apri Impostazioni di Windows → Privacy e sicurezza → Posizione", "Attiva Servizi di localizzazione", "Attiva anche Consenti alle app desktop di accedere alla posizione", "Torna qui e premi di nuovo La mia posizione"],
    mac: ["Apri Impostazioni di Sistema → Privacy e sicurezza → Localizzazione", "Attiva Localizzazione e attiva il tuo browser nell'elenco", "Torna qui e premi di nuovo La mia posizione"],
    iphone: ["Apri Impostazioni → Privacy e sicurezza → Localizzazione e attivala", "Più in basso apri Siti web di Safari (o il tuo browser) e scegli Chiedi o Mentre usi l'app", "Torna qui e premi di nuovo La mia posizione"],
    android: ["Apri le impostazioni rapide e attiva Posizione (GPS)", "Nel browser: menu → Impostazioni → Impostazioni sito → Posizione → consenti questo sito", "Torna qui e premi di nuovo La mia posizione"],
    altro: ["Attiva la localizzazione nelle impostazioni del dispositivo", "Consenti la posizione a questo sito nelle impostazioni del browser"],
  };
  if (stato === "denied") return new ErrorePosizione("Il browser ha bloccato la posizione per questo sito.", so === "iphone" ? sistemaSpento.iphone : sito);
  return new ErrorePosizione(so === "windows" || so === "mac" ? "La localizzazione del computer è spenta oppure non è consentita al browser." : "La localizzazione del dispositivo è spenta o non consentita.", sistemaSpento[so] ?? sistemaSpento.altro ?? []);
}

function leggiPosizione(alta: boolean): Promise<{ lat: number; lon: number; precisione: number }> {
  return new Promise((ok, ko) => navigator.geolocation.getCurrentPosition(
    (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude, precisione: p.coords.accuracy }),
    (e) => ko(e),
    { enableHighAccuracy: alta, timeout: alta ? 12000 : 20000, maximumAge: 120000 },
  ));
}

/** Posizione del dispositivo: prova con la precisione normale (Wi-Fi, va bene sui PC) e, se serve, con il GPS. */
export async function posizioneDispositivo(): Promise<{ lat: number; lon: number; precisione?: number }> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) throw new ErrorePosizione("Questo dispositivo non fornisce la posizione: cerca l'indirizzo.");
  if (typeof window !== "undefined" && !window.isSecureContext) throw new ErrorePosizione("La posizione funziona solo con il sito aperto in https.");
  let ultimo: GeolocationPositionError | null = null;
  for (const alta of [false, true]) {
    try { return await leggiPosizione(alta); } catch (e) {
      ultimo = e as GeolocationPositionError;
      if (ultimo.code === ultimo.PERMISSION_DENIED) throw await passiPermesso();
    }
  }
  throw new ErrorePosizione(ultimo?.code === 3 ? "Il dispositivo non ha risposto in tempo con la posizione." : "Il dispositivo non riesce a trovare la posizione.",
    ["Controlla che Wi-Fi o GPS siano attivi", "Riprova tra qualche secondo, oppure scrivi l'indirizzo nella ricerca"]);
}

const c = (v: number) => v.toFixed(6);
export const linkGoogleMaps = (lat: number, lon: number) => `https://www.google.com/maps/search/?api=1&query=${c(lat)},${c(lon)}`;
export const linkGoogleEarth = (lat: number, lon: number) => `https://earth.google.com/web/@${c(lat)},${c(lon)},0a,400d,35y,0h,0t,0r`;
/** Anteprima satellitare di Google Maps da mettere in un iframe. */
export const anteprimaGoogleMaps = (lat: number, lon: number) => `https://maps.google.com/maps?q=${c(lat)},${c(lon)}&t=k&z=19&output=embed`;
