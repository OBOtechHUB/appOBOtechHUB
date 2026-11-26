/**
 * Immagini della vista 3D salvate sul dispositivo (IndexedDB) per la relazione tecnica, una lista per progetto.
 * Non si cancellano: «Togli dalla relazione» le segna come non usate.
 */
export interface Vista3D { id: string; progetto: string; immagine: Blob; didascalia: string; quando: string; inRelazione: boolean }

const DB = "lps-viste3d", STORE = "viste";
function apri(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === "undefined") { ko(new Error("IndexedDB non disponibile")); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: "id" }); s.createIndex("progetto", "progetto"); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error ?? new Error("IndexedDB"));
  });
}
async function operazione<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await apri();
  return new Promise<T>((ok, ko) => {
    const t = db.transaction(STORE, modo), r = f(t.objectStore(STORE));
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error ?? new Error("IndexedDB"));
    t.oncomplete = () => db.close();
  });
}

export async function salvaVista3D(progetto: string, immagine: Blob, didascalia: string): Promise<Vista3D> {
  const v: Vista3D = { id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `v-${Date.now()}`, progetto, immagine, didascalia, quando: new Date().toISOString(), inRelazione: true };
  await operazione("readwrite", (s) => s.put(v));
  return v;
}

/** Viste del progetto ancora da mettere nella relazione, dalla più vecchia. */
export async function visteRelazione(progetto: string): Promise<Vista3D[]> {
  try {
    const tutte = await operazione<Vista3D[]>("readonly", (s) => s.index("progetto").getAll(progetto));
    return tutte.filter((v) => v.inRelazione).sort((a, b) => a.quando.localeCompare(b.quando));
  } catch { return []; }
}

export async function togliDallaRelazione(id: string): Promise<void> {
  const v = await operazione<Vista3D | undefined>("readonly", (s) => s.get(id));
  if (v) await operazione("readwrite", (s) => s.put({ ...v, inRelazione: false }));
}
