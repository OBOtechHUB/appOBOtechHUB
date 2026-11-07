/**
 * Dove trovare la scheda PDF di un particolare costruttivo.
 * Ordine di ricerca:
 *  1. public/particolari/<immagine> (se i PDF sono inclusi nell'app);
 *  2. archivio privato Supabase Storage, bucket "particolari" (link firmato valido 1 ora,
 *     solo per utenti collegati);
 *  3. altrimenti rimando alla cartella OneDrive "TYPICAL DATASHEET".
 */
import { risorsa } from "./base";

export const CARTELLA_ONEDRIVE = "https://1drv.ms/f/c/afd6898358a327d3/IgD-U0r-F_gnR7krG6nsx96jAZdzUpj93WqzMV_z5SacX1o?e=WLDxVs";
export const BUCKET_PARTICOLARI = "particolari";

/** "locale" = PDF disponibile all'indirizzo url (file dell'app o link firmato dell'archivio). */
export type SchedaPdf = { tipo: "locale"; url: string } | { tipo: "cartella"; url: string; fileAtteso: string };

type Fetch = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "headers">>;
/** Restituisce un link firmato al file nell'archivio, o null se non disponibile. */
export type FirmaArchivio = (file: string) => Promise<string | null>;

const cache = new Map<string, SchedaPdf>();

export function urlLocale(immagine: string): string {
  return risorsa("particolari/" + encodeURIComponent(immagine));
}

export const firmaSupabase: FirmaArchivio = async (file) => {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.storage.from(BUCKET_PARTICOLARI).createSignedUrl(file, 3600);
    return error || !data ? null : data.signedUrl;
  } catch {
    return null;
  }
};

export async function trovaSchedaPdf(
  immagine: string | null | undefined,
  f: Fetch = (u, i) => fetch(u, i),
  firma: FirmaArchivio = firmaSupabase,
): Promise<SchedaPdf> {
  const file = (immagine ?? "").trim();
  if (!file) return { tipo: "cartella", url: CARTELLA_ONEDRIVE, fileAtteso: "" };
  const inCache = cache.get(file);
  if (inCache) return inCache;

  const url = urlLocale(file);
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : null;
  try {
    const r = await f(url, { method: "HEAD", ...(ctrl ? { signal: ctrl.signal } : {}) });
    const tipo = r.headers.get("content-type") ?? "";
    // GitHub Pages e il server di sviluppo possono rispondere con una pagina HTML per file inesistenti
    if (r.ok && !tipo.includes("text/html")) {
      const esito: SchedaPdf = { tipo: "locale", url };
      cache.set(file, esito);
      return esito;
    }
  } catch {
    /* rete assente o timeout: si prova l'archivio */
  } finally {
    if (timer) clearTimeout(timer);
  }

  // link firmato: scade, quindi non va in cache
  const firmato = await firma(file);
  if (firmato) return { tipo: "locale", url: firmato };
  return { tipo: "cartella", url: CARTELLA_ONEDRIVE, fileAtteso: file };
}

/** Nome di un file collegato al particolare con altra estensione: "X.pdf" → "X.dwg". */
export function fileCollegato(immagine: string | null | undefined, estensione: "dwg" | "dxf"): string {
  const base = (immagine ?? "").trim().replace(/\.[a-z0-9]+$/i, "");
  return base ? `${base}.${estensione}` : "";
}

/** Link firmato (1 ora) a un file dell'archivio privato, o null se manca o l'utente non è collegato. */
export async function trovaFileArchivio(file: string, firma: FirmaArchivio = firmaSupabase): Promise<string | null> {
  return file ? firma(file) : null;
}

/** Solo per i test. */
export function svuotaCacheSchede(): void {
  cache.clear();
}
