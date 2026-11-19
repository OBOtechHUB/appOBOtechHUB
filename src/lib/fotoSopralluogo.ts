/**
 * Foto del sopralluogo: ridotte nel browser (lato lungo 1600 px, JPEG), caricate nello storage privato
 * "sopralluoghi" (supabase/sopralluoghi.sql). Senza rete restano in coda sul dispositivo (IndexedDB)
 * e partono da sole quando la rete torna. Nulla si sovrascrive o si cancella sul server.
 */
const BUCKET = "sopralluoghi";
const DB = "lps-sopralluoghi", STORE = "coda";

export async function riduciFoto(file: Blob, lato = 1600, qualita = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const k = Math.min(1, lato / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b ?? file), "image/jpeg", qualita));
}

function apriDb(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "percorso" }); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
}
async function tx<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await apriDb();
  return new Promise((ok, ko) => { const t = db.transaction(STORE, modo), r = f(t.objectStore(STORE)); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
}
interface InCoda { percorso: string; blob: Blob }
export const fotoInCoda = () => tx<InCoda[]>("readonly", (s) => s.getAll() as IDBRequest<InCoda[]>).catch(() => [] as InCoda[]);
/** copia locale (anteprima offline) */
export const fotoLocale = (percorso: string) => tx<InCoda | undefined>("readonly", (s) => s.get(percorso) as IDBRequest<InCoda | undefined>).then((x) => x?.blob ?? null).catch(() => null);

async function client() { return (await import("@/integrations/supabase/client")).supabase; }

/** Percorso della foto per l'utente e il progetto. */
export async function percorsoFoto(progetto: string): Promise<string | null> {
  const { data } = await (await client()).auth.getUser();
  if (!data.user) return null;
  return `${data.user.id}/${progetto}/${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}_${Math.random().toString(36).slice(2, 7)}.jpg`;
}

/** Salva la foto: prima in coda sul dispositivo, poi prova subito a caricarla. */
export async function salvaFoto(percorso: string, blob: Blob): Promise<"caricata" | "in-coda"> {
  await tx("readwrite", (s) => s.put({ percorso, blob }));
  return (await caricaUna(percorso, blob)) ? "caricata" : "in-coda";
}
async function caricaUna(percorso: string, blob: Blob): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  try {
    const { error } = await (await client()).storage.from(BUCKET).upload(percorso, blob, { upsert: false, contentType: "image/jpeg" });
    if (error && !/exists|Duplicate/i.test(error.message)) return false;
    await tx("readwrite", (s) => s.delete(percorso)); // tolta solo la copia locale, la foto è sul server
    return true;
  } catch { return false; }
}
/** Carica le foto rimaste in coda; restituisce quante ne restano. */
export async function sincronizzaFoto(): Promise<number> {
  const coda = await fotoInCoda(); let resto = 0;
  for (const f of coda) if (!(await caricaUna(f.percorso, f.blob))) resto++;
  return resto;
}
/** Immagine della foto: copia locale se ancora in coda, altrimenti dal server. */
export async function scaricaFoto(percorso: string): Promise<Blob | null> {
  const loc = await fotoLocale(percorso); if (loc) return loc;
  try { const { data, error } = await (await client()).storage.from(BUCKET).download(percorso); return error ? null : data; } catch { return null; }
}
