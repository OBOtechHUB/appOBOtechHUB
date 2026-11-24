import { useCallback, useEffect, useState } from "react";
import { DatabaseBackup, Download, ExternalLink, FolderSync, History, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/Campo";
import { db } from "@/lib/accesso";
import { formattaNome } from "@/lib/nomi";

/** Giorni dall'ultima copia (null = mai fatta). */
export function giorniDallaCopia(ultima: string | undefined, ora = Date.now()): number | null {
  if (!ultima) return null;
  const t = new Date(ultima).getTime();
  return isNaN(t) ? null : Math.floor((ora - t) / 864e5);
}

const conta = (v: unknown) => (Array.isArray(v) ? v.length : 0);
const GIORNI_TENUTI = 31;
/** Nome del file della copia di un giorno nella cartella OneDrive/SharePoint. */
export const nomeFileCopia = (giorno: string) => `OBO-Hub-copia-${giorno}.json`;
/** File di copia da togliere dalla cartella: solo quelli col nostro nome, più vecchi di 31 giorni. */
export function fileDaTogliere(nomi: string[], oggi: Date = new Date()): string[] {
  const limite = new Date(oggi.getTime() - GIORNI_TENUTI * 864e5).toLocaleDateString("sv-SE");
  return nomi.filter((n) => { const m = /^OBO-Hub-copia-(\d{4}-\d{2}-\d{2})\.json$/.exec(n); return !!m && m[1]! < limite; });
}

interface Copia { id: number; giorno: string; creata_il: string; origine: string; dimensione: number; progetti: number; progetti_mappa: number }
interface ProgettoCopia { id: string; utente: string; codice: string; nome: string; comune: string; data_modifica: string }

// ---------------------------------------------------------------- cartella del PC (File System Access API, Edge e Chrome)
type Permesso = "granted" | "denied" | "prompt";
interface CartellaPc { name: string; queryPermission(o: { mode: "readwrite" }): Promise<Permesso>; requestPermission(o: { mode: "readwrite" }): Promise<Permesso>; getFileHandle(n: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(d: Blob): Promise<void>; close(): Promise<void> }> }>; removeEntry(n: string): Promise<void>; keys(): AsyncIterable<string> }
const conCartella = typeof window !== "undefined" && "showDirectoryPicker" in window;
function idb<T>(fn: (s: IDBObjectStore) => IDBRequest<T>, modo: IDBTransactionMode): Promise<T> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open("obo-copie", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("cartella");
    r.onerror = () => ko(r.error);
    r.onsuccess = () => { const q = fn(r.result.transaction("cartella", modo).objectStore("cartella")); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); };
  });
}
const leggiCartella = () => idb<CartellaPc | undefined>((s) => s.get("h") as IDBRequest<CartellaPc | undefined>, "readonly").catch(() => undefined);
const salvaCartellaPc = (h: CartellaPc) => idb((s) => s.put(h, "h"), "readwrite");

/** Admin → Copia di sicurezza: copie automatiche con data (31 giorni), cartella OneDrive/SharePoint, ripristino di un progetto. */
export function CopiaSicurezza({ ultima, cartella, onFatto }: { ultima: string | undefined; cartella: string | undefined; onFatto: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [url, setUrl] = useState(cartella ?? "");
  const [copie, setCopie] = useState<Copia[] | null>(null), [manca, setManca] = useState(false);
  const [pc, setPc] = useState<CartellaPc | null>(null), [permesso, setPermesso] = useState<Permesso | null>(null), [sync, setSync] = useState("");
  const [aperta, setAperta] = useState<{ copia: Copia; progetti: ProgettoCopia[]; email: Record<string, string> } | null>(null);
  const giorni = giorniDallaCopia(ultima);

  const carica = useCallback(async () => {
    const { data, error } = await db().rpc("elenco_copie");
    if (error) { setManca(/Could not find|does not exist/.test(error.message)); setCopie([]); return [] as Copia[]; }
    setManca(false); setCopie(data as Copia[]); return data as Copia[];
  }, []);

  /** Scrive nella cartella del PC le copie che mancano e toglie quelle più vecchie di 31 giorni (solo i file col nome delle copie). */
  const sincronizza = useCallback(async (h: CartellaPc, lista: Copia[]) => {
    setSync("Salvo le copie nella cartella…");
    const presenti: string[] = [];
    for await (const n of h.keys()) presenti.push(n);
    let scritte = 0;
    for (const c of lista) {
      const nome = nomeFileCopia(c.giorno);
      if (presenti.includes(nome) && c.origine !== "a mano") continue;
      const { data, error } = await db().rpc("scarica_copia", { p_id: c.id });
      if (error || !data) continue;
      const f = await h.getFileHandle(nome, { create: true }), w = await f.createWritable();
      await w.write(new Blob([JSON.stringify(data)], { type: "application/json" })); await w.close(); scritte++;
    }
    const via = fileDaTogliere(presenti);
    for (const n of via) await h.removeEntry(n).catch(() => undefined);
    setSync(`Cartella «${h.name}» aggiornata: ${scritte} ${scritte === 1 ? "copia salvata" : "copie salvate"}${via.length ? `, ${via.length} più vecchie di ${GIORNI_TENUTI} giorni tolte` : ""}. OneDrive la carica su SharePoint da solo.`);
  }, []);

  useEffect(() => {
    void (async () => {
      const lista = await carica();
      if (!conCartella) return;
      const h = await leggiCartella(); if (!h) return;
      setPc(h);
      const p = await h.queryPermission({ mode: "readwrite" }).catch(() => "prompt" as Permesso); setPermesso(p);
      if (p === "granted" && lista.length) await sincronizza(h, lista).catch((e) => setSync("Cartella non aggiornata: " + (e instanceof Error ? e.message : String(e))));
    })();
  }, [carica, sincronizza]);

  async function scegliCartella() {
    try {
      const h = await (window as unknown as { showDirectoryPicker(o: object): Promise<CartellaPc> }).showDirectoryPicker({ id: "obo-hub-copie", mode: "readwrite", startIn: "documents" });
      await salvaCartellaPc(h); setPc(h); setPermesso("granted");
      await sincronizza(h, copie ?? []);
    } catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setSync("Cartella non scelta: " + (e instanceof Error ? e.message : String(e))); }
  }
  async function permetti() {
    if (!pc) return;
    const p = await pc.requestPermission({ mode: "readwrite" }); setPermesso(p);
    if (p === "granted") await sincronizza(pc, copie ?? []);
  }
  function scaricaFile(d: unknown, nome: string) {
    const blob = new Blob([JSON.stringify(d, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return blob.size;
  }
  async function scarica() {
    setBusy(true); setMsg("");
    try {
      const { data, error } = await db().rpc("copia_sicurezza");
      if (error) throw new Error(error.message.includes("Could not find") ? "manca la funzione: esegui supabase/pro.sql nell'editor SQL di Supabase" : error.message);
      const d = data as Record<string, unknown>;
      const size = scaricaFile(d, nomeFileCopia(new Date().toLocaleDateString("sv-SE")));
      setMsg(`Copia scaricata (${(size / 1048576).toFixed(1)} MB): ${conta(d["progetti"])} progetti LPS, ${conta(d["progetti_archivio"])} nell'archivio, ${conta(d["accessi_profili"])} utenti, ${conta(d["mappa_progetti"])} progetti della Mappa.`);
      onFatto();
    } catch (e) { setMsg("Copia non riuscita: " + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); }
  }
  async function creaOra() {
    setBusy(true); setMsg("");
    const { error } = await db().rpc("crea_copia_ora");
    setBusy(false);
    if (error) { setMsg("Copia non creata: " + error.message); return; }
    const lista = await carica(); onFatto(); setMsg("Copia di oggi creata nel database.");
    if (pc && permesso === "granted") await sincronizza(pc, lista);
  }
  async function scaricaCopia(c: Copia) {
    setBusy(true);
    const { data, error } = await db().rpc("scarica_copia", { p_id: c.id });
    setBusy(false);
    if (error || !data) { setMsg("Copia non scaricata: " + (error?.message ?? "vuota")); return; }
    scaricaFile(data, nomeFileCopia(c.giorno));
  }
  async function apri(c: Copia) {
    setBusy(true);
    const { data, error } = await db().rpc("scarica_copia", { p_id: c.id });
    setBusy(false);
    if (error || !data) { setMsg("Copia non aperta: " + (error?.message ?? "vuota")); return; }
    const d = data as { progetti?: ProgettoCopia[]; accessi_profili?: { utente?: string; email?: string; nome?: string }[]; profiles?: { id?: string; email?: string }[] };
    const email: Record<string, string> = {};
    for (const a of d.accessi_profili ?? []) if (a.utente && a.email) email[a.utente] = formattaNome(a.nome, a.email) ? `${formattaNome(a.nome, a.email)} (${a.email})` : a.email;
    for (const a of d.profiles ?? []) if (a.id && a.email && !email[a.id]) email[a.id] = a.email;
    setAperta({ copia: c, progetti: [...(d.progetti ?? [])].sort((a, b) => (b.data_modifica ?? "").localeCompare(a.data_modifica ?? "")), email });
  }
  async function ripristina(p: ProgettoCopia) {
    if (!aperta) return;
    const giorno = new Date(aperta.copia.giorno).toLocaleDateString("it-IT");
    if (!window.confirm(`Ripristinare "${p.nome}" com'era il ${giorno}?\n\nViene creato un NUOVO progetto "${p.nome} (ripristino del ${giorno})" tra i progetti di ${aperta.email[p.utente] ?? "chi l'ha creato"}. Il progetto attuale non viene toccato.`)) return;
    setBusy(true);
    const { error } = await db().rpc("ripristina_progetto_da_copia", { p_copia: aperta.copia.id, p_progetto: p.id });
    setBusy(false);
    setMsg(error ? "Ripristino non riuscito: " + error.message : `Ripristinato: "${p.nome} (ripristino del ${giorno})" è nei progetti di ${aperta.email[p.utente] ?? "chi l'ha creato"}.`);
  }
  async function salvaIndirizzo() {
    const { error } = await db().from("impostazioni_admin").upsert({ chiave: "cartella_copie", valore: url.trim() });
    setMsg(error ? "Indirizzo non salvato: " + error.message : "Indirizzo salvato."); if (!error) onFatto();
  }
  const mb = (b: number) => `${(b / 1048576).toFixed(b < 1048576 ? 2 : 1)} MB`;

  return <div className="max-w-4xl space-y-5">
    <div className={`rounded-lg border-l-4 p-4 ${giorni === null || giorni > 1 ? "border-[#b3261e] bg-[#fdecea] text-[#5c1410]" : "border-green-700 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"}`}>
      <p className="font-semibold">{giorni === null ? "Nessuna copia di sicurezza fatta finora." : giorni === 0 ? "Ultima copia: oggi." : `Ultima copia: ${giorni} ${giorni === 1 ? "giorno" : "giorni"} fa (${new Date(ultima!).toLocaleDateString("it-IT")}).`}</p>
      <p className="mt-1 text-sm">Il database fa da solo una copia ogni notte (alle 3:17, ora italiana) e tiene quelle degli ultimi {GIORNI_TENUTI} giorni.</p>
    </div>

    {manca && <p className="rounded-lg border-l-4 border-[#b3261e] bg-[#fdecea] p-3 text-sm text-[#5c1410]">Le copie automatiche non sono ancora attive: esegui una volta <strong>supabase/copie-automatiche.sql</strong> (SQL 13) nell'editor SQL di Supabase. Fino ad allora puoi solo scaricare la copia a mano qui sotto.</p>}

    <section className="space-y-3 rounded-lg border-[0.8px] border-bordo-scheda p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><History className="size-4" strokeWidth={1.5} />Copie con data (ultimi {GIORNI_TENUTI} giorni)</h3>
        {!manca && <Button size="sm" variant="outline" disabled={busy} onClick={() => void creaOra()}><DatabaseBackup strokeWidth={1.5} />Crea la copia adesso</Button>}</div>
      {copie === null ? <p className="text-sm text-muted-foreground">Carico…</p> : !copie.length ? <p className="text-sm text-muted-foreground">{manca ? "—" : "Ancora nessuna copia."}</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-1">Giorno</th><th className="p-1">Tipo</th><th className="p-1 text-right">Progetti LPS</th><th className="p-1 text-right">Progetti Mappa</th><th className="p-1 text-right">Dimensione</th><th className="p-1" /></tr></thead>
          <tbody>{copie.map((c) => <tr key={c.id} className="border-b">
            <td className="p-1 font-medium">{new Date(c.giorno).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</td>
            <td className="p-1 text-xs text-muted-foreground">{c.origine} · {new Date(c.creata_il).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</td>
            <td className="p-1 text-right">{c.progetti}</td><td className="p-1 text-right">{c.progetti_mappa}</td><td className="p-1 text-right">{mb(c.dimensione)}</td>
            <td className="p-1 text-right whitespace-nowrap"><Button size="sm" variant="ghost" disabled={busy} onClick={() => void scaricaCopia(c)} title="Scarica il file di questa copia"><Download strokeWidth={1.5} />Scarica</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void apri(c)} title="Ripristina un progetto LPS com'era in questo giorno"><RotateCcw strokeWidth={1.5} />Ripristina…</Button></td>
          </tr>)}</tbody>
        </table></div>}
      {aperta && <div className="rounded-md bg-muted p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Progetti LPS nella copia del {new Date(aperta.copia.giorno).toLocaleDateString("it-IT")} ({aperta.progetti.length})</p><Button size="sm" variant="ghost" onClick={() => setAperta(null)}>Chiudi</Button></div>
        <p className="mb-2 text-xs text-muted-foreground">Il ripristino crea un nuovo progetto «… (ripristino del giorno)» tra i progetti del suo proprietario: il progetto attuale non viene modificato né cancellato. I dati della Mappa carichi si recuperano dal file scaricato.</p>
        <ul className="max-h-80 divide-y overflow-y-auto text-sm">{aperta.progetti.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
          <span><b>{p.codice ? `${p.codice} · ` : ""}{p.nome}</b> <span className="text-xs text-muted-foreground">{p.comune} · {aperta.email[p.utente] ?? "—"} · modificato il {p.data_modifica ? new Date(p.data_modifica).toLocaleDateString("it-IT") : "—"}</span></span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void ripristina(p)}><RotateCcw strokeWidth={1.5} />Ripristina</Button></li>)}</ul>
      </div>}
    </section>

    <section className="space-y-2 rounded-lg border-[0.8px] border-bordo-scheda p-4">
      <h3 className="flex items-center gap-2 font-semibold"><FolderSync className="size-4" strokeWidth={1.5} />Copia anche su SharePoint (cartella OBO Hub di OneDrive)</h3>
      <p className="text-sm text-muted-foreground">Il sito non può scrivere direttamente su SharePoint senza un'autorizzazione dell'IT di Microsoft 365. Si usa la cartella <b>OBO Hub</b> sincronizzata da OneDrive sul tuo PC: scegli una volta la cartella (di solito «OneDrive - OBO Bettermann» → «OBO Hub»); ogni volta che apri questa pagina l'app ci salva le copie nuove come <code>OBO-Hub-copia-AAAA-MM-GG.json</code> e toglie quelle più vecchie di {GIORNI_TENUTI} giorni. OneDrive le carica su SharePoint da solo. Funziona con Edge e Chrome.</p>
      {!conCartella ? <p className="text-sm text-[#b3261e]">Questo browser non permette di salvare in una cartella: usa Edge o Chrome sul PC.</p> :
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={pc ? "outline" : "default"} disabled={busy || manca} onClick={() => void scegliCartella()}><FolderSync strokeWidth={1.5} />{pc ? `Cartella: ${pc.name} (cambia)` : "Scegli la cartella OBO Hub"}</Button>
          {pc && permesso !== "granted" && <Button disabled={busy} onClick={() => void permetti()}>Salva ora le copie nella cartella</Button>}
          {pc && permesso === "granted" && <Button variant="outline" disabled={busy} onClick={() => void sincronizza(pc, copie ?? [])}>Aggiorna la cartella</Button>}
        </div>}
      {sync && <p role="status" className="text-sm">{sync}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <input className={`${inputCls} min-w-0 flex-1`} type="url" placeholder="Indirizzo della cartella su SharePoint (per aprirla da qui)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button variant="outline" onClick={() => void salvaIndirizzo()}><Save strokeWidth={1.5} />Salva</Button>
        {cartella && <Button variant="outline" asChild><a href={cartella} target="_blank" rel="noopener noreferrer"><ExternalLink strokeWidth={1.5} />Apri su SharePoint</a></Button>}
      </div>
    </section>

    <section className="space-y-2">
      <p className="text-sm text-muted-foreground">Le copie contengono tutti i dati di OBO Hub: progetti LPS (anche l'archivio dei cancellati), cataloghi personali, utenti e permessi, richieste di accesso, registri completi, progetti e persone della Mappa carichi. <strong>Le password non ci sono.</strong> Contengono però dati di lavoro e nomi: tienile solo nella cartella OBO riservata, non inviarle per email.</p>
      <Button variant="outline" disabled={busy} onClick={() => void scarica()}><DatabaseBackup strokeWidth={1.5} />{busy ? "Attendi…" : "Scarica una copia completa adesso"}</Button>
    </section>
    {msg && <p role="status" className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">{msg}</p>}
  </div>;
}
