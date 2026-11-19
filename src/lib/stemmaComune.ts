/**
 * Stemma e provincia del Comune del progetto, da Wikidata (comune italiano, Q747074) e Wikimedia Commons.
 * Servizi pubblici con CORS aperto (origin=*): nessuna chiave, nessun dato del progetto oltre al nome del Comune.
 * Se il servizio non risponde la relazione usa lo stemma caricato a mano o lascia il riquadro vuoto.
 */

const WD = "https://www.wikidata.org/w/api.php";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const COMUNE_ITALIANO = "Q747074";

export interface ComuneTrovato {
  id: string;
  nome: string;
  provincia: string;
  /** nome del file su Commons (senza "File:") */
  fileStemma: string | null;
  lat: number | null;
  lon: number | null;
}
export interface StemmaComune {
  comune: ComuneTrovato;
  blob: Blob;
  /** autore e licenza, da riportare nella relazione quando la licenza lo chiede */
  credito: string;
  pubblicoDominio: boolean;
  pagina: string;
}

/** "10095 Grugliasco (TO)", "Grugliasco TO, Italia" → "Grugliasco". */
export function pulisciComune(s: string): string {
  return s
    .replace(/\b\d{5}\b/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .split(",")[0]!
    .replace(/\s+[A-Z]{2}$/, "")
    .replace(/^\s*(comune\s+di|città\s+di)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Città metropolitana di Torino", "provincia di Cuneo", "libero consorzio comunale di Ragusa" → nome breve. */
export function nomeProvincia(etichetta: string): string {
  return etichetta
    .replace(/^(città metropolitana|provincia autonoma|provincia|libero consorzio comunale|ente di decentramento regionale)\s+dell['’]\s*/i, "L'")
    .replace(/^(città metropolitana|provincia autonoma|provincia|libero consorzio comunale|ente di decentramento regionale)\s+(della|degli|dei|del|di)\s+/i, "")
    .trim();
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Fra gli omonimi: stesso nome, poi la provincia indicata, poi il più vicino alle coordinate del progetto. */
export function scegliComune(candidati: ComuneTrovato[], nome: string, provincia?: string, vicino?: { lat: number; lon: number } | null): ComuneTrovato | null {
  if (!candidati.length) return null;
  const n = norm(nome);
  let lista = candidati.filter((c) => norm(c.nome) === n);
  if (!lista.length) lista = candidati;
  if (provincia?.trim()) {
    const p = norm(nomeProvincia(provincia));
    const conProv = lista.filter((c) => norm(c.provincia) === p);
    if (conProv.length) lista = conProv;
  }
  if (vicino && lista.length > 1) {
    const d = (c: ComuneTrovato) => (c.lat == null || c.lon == null ? Infinity : (c.lat - vicino.lat) ** 2 + ((c.lon - vicino.lon) * Math.cos((vicino.lat * Math.PI) / 180)) ** 2);
    lista = [...lista].sort((a, b) => d(a) - d(b));
  }
  return lista[0] ?? null;
}

type Claim = { rank?: "preferred" | "normal" | "deprecated"; mainsnak?: { datavalue?: { value?: unknown } }; qualifiers?: Record<string, unknown> };
type Entita = { id: string; labels?: Record<string, { value: string }>; claims?: Record<string, Claim[]> };
/** valori della proprietà: prima quelli preferiti, poi quelli ancora validi (senza data di fine P582), mai i deprecati */
const valori = (e: Entita, p: string) => {
  const peso = (c: Claim) => (c.rank === "preferred" ? 0 : c.qualifiers?.["P582"] ? 2 : 1);
  return (e.claims?.[p] ?? []).filter((c) => c.rank !== "deprecated").sort((a, b) => peso(a) - peso(b)).map((c) => c.mainsnak?.datavalue?.value);
};
const idDi = (v: unknown) => (v && typeof v === "object" && "id" in v ? String((v as { id: unknown }).id) : null);

async function json<T>(url: string, segnale?: AbortSignal): Promise<T> {
  const r = await fetch(url, segnale ? { signal: segnale } : {});
  if (!r.ok) throw new Error(`Servizio non disponibile (${r.status}).`);
  return (await r.json()) as T;
}

async function entita(ids: string[], props: string, segnale?: AbortSignal): Promise<Entita[]> {
  if (!ids.length) return [];
  const u = `${WD}?action=wbgetentities&format=json&origin=*&languages=it&props=${props}&ids=${ids.slice(0, 50).join("|")}`;
  const r = await json<{ entities?: Record<string, Entita> }>(u, segnale);
  return Object.values(r.entities ?? {});
}

/** Comuni italiani con quel nome (con provincia, stemma e coordinate). */
export async function cercaComuni(nome: string, segnale?: AbortSignal): Promise<ComuneTrovato[]> {
  const q = pulisciComune(nome);
  if (q.length < 2) return [];
  const s = await json<{ search?: { id: string }[] }>(`${WD}?action=wbsearchentities&format=json&origin=*&language=it&uselang=it&type=item&limit=20&search=${encodeURIComponent(q)}`, segnale);
  const ent = (await entita((s.search ?? []).map((x) => x.id), "labels|claims", segnale)).filter((e) => valori(e, "P31").some((v) => idDi(v) === COMUNE_ITALIANO));
  const idProv = [...new Set(ent.map((e) => idDi(valori(e, "P131")[0])).filter((x): x is string => !!x))];
  const prov = new Map((await entita(idProv, "labels", segnale)).map((e) => [e.id, e.labels?.["it"]?.value ?? ""]));
  return ent.map((e) => {
    const coord = valori(e, "P625")[0] as { latitude?: number; longitude?: number } | undefined;
    const st = valori(e, "P94")[0];
    const p = idDi(valori(e, "P131")[0]);
    return {
      id: e.id, nome: e.labels?.["it"]?.value ?? q, provincia: nomeProvincia(p ? prov.get(p) ?? "" : ""),
      fileStemma: typeof st === "string" ? st : null,
      lat: typeof coord?.latitude === "number" ? coord.latitude : null, lon: typeof coord?.longitude === "number" ? coord.longitude : null,
    };
  });
}

const senzaHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Stemma del Comune come immagine raster (Commons converte gli SVG in PNG), con autore e licenza. */
export async function stemmaDelComune(nome: string, opz: { provincia?: string; vicino?: { lat: number; lon: number } | null; segnale?: AbortSignal; larghezza?: number } = {}): Promise<{ comune: ComuneTrovato | null; stemma: StemmaComune | null }> {
  const comune = scegliComune(await cercaComuni(nome, opz.segnale), pulisciComune(nome), opz.provincia, opz.vicino);
  if (!comune?.fileStemma) return { comune, stemma: null };
  type Info = { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }> } };
  const u = `${COMMONS}?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${opz.larghezza ?? 500}&titles=${encodeURIComponent(`File:${comune.fileStemma}`)}`;
  const info = Object.values((await json<Info>(u, opz.segnale)).query?.pages ?? {})[0]?.imageinfo?.[0];
  const src = info?.thumburl ?? info?.url;
  if (!src) return { comune, stemma: null };
  const r = await fetch(src, opz.segnale ? { signal: opz.segnale } : {});
  if (!r.ok) return { comune, stemma: null };
  const m = info?.extmetadata ?? {};
  const licenza = senzaHtml(m["LicenseShortName"]?.value ?? "");
  const autore = senzaHtml(m["Artist"]?.value ?? "");
  const pd = /public domain|pubblico dominio|^pd\b|cc0/i.test(licenza);
  return {
    comune,
    stemma: {
      comune, blob: await r.blob(), pubblicoDominio: pd, pagina: info?.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(comune.fileStemma)}`,
      credito: `Stemma del Comune di ${comune.nome}: Wikimedia Commons, «${comune.fileStemma}»${autore ? `, ${autore}` : ""}${licenza ? `, ${licenza}` : ""}.`,
    },
  };
}
