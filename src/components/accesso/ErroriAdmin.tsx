import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, RefreshCw, RotateCcw } from "lucide-react";
import { dataOra, oggiFile, scaricaCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/Campo";
import { db } from "@/lib/accesso";

interface Errore { id: number; quando: string; app: string; pagina: string; messaggio: string; dettagli: string; browser: string; versione: string; utente: string | null; volte: number; risolto: string | null }
const NOMI_APP: Record<string, string> = { hub: "OBO Hub", lps: "Progettazione LPS", mappa: "Mappa carichi", prodotti: "Prodotti OBO", torrette: "Configuratore torrette" };
const data = (d: string) => new Date(d).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
/** Browser e sistema in parole semplici, dal testo del browser. */
export function browserBreve(ua: string): string {
  const b = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "browser";
  const s = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return s ? `${b} · ${s}` : b;
}

/** Admin → Errori: errori del browser mandati dalle app (ultimi 90 giorni). */
export function ErroriAdmin({ nomePersona }: { nomePersona: (utente: string | null, email: string | null) => string }) {
  const [errori, setErrori] = useState<Errore[] | null>(null);
  const [problema, setProblema] = useState("");
  const [app, setApp] = useState("");
  const [vista, setVista] = useState<"aperti" | "risolti" | "tutti">("aperti");
  const [aperto, setAperto] = useState<number | null>(null);
  const carica = useCallback(async () => {
    const r = await db().from("errori_app").select("*").order("quando", { ascending: false }).limit(2000);
    if (r.error) { setProblema(r.error.message); setErrori([]); return; }
    setProblema(""); setErrori((r.data ?? []) as Errore[]);
  }, []);
  useEffect(() => { void carica(); }, [carica]);
  const elenco = useMemo(() => (errori ?? []).filter((e) => (!app || e.app === app) && (vista === "tutti" || (vista === "aperti" ? !e.risolto : !!e.risolto))), [errori, app, vista]);
  // "Risolto" segna la data: il registro non si cancella mai
  const segna = async (ids: number[], risolto: boolean) => { if (!ids.length) return; await db().from("errori_app").update({ risolto: risolto ? new Date().toISOString() : null }).in("id", ids); void carica(); };
  const scarica = async () => {
    const tutti: Errore[] = [];
    for (let da = 0; ; da += 1000) { const r = await db().from("errori_app").select("*").order("quando", { ascending: true }).range(da, da + 999); const l = (r.data ?? []) as Errore[]; tutti.push(...l); if (l.length < 1000) break; }
    scaricaCsv(`registro-errori-obo-hub-${oggiFile()}.csv`, ["Quando", "App", "Pagina", "Messaggio", "Volte", "Browser", "Versione", "Utente", "Risolto", "Dettagli"],
      tutti.map((e) => [dataOra(e.quando), NOMI_APP[e.app] ?? e.app, e.pagina, e.messaggio, e.volte, e.browser, e.versione, e.utente ? nomePersona(e.utente, null) : "", e.risolto ? dataOra(e.risolto) : "", e.dettagli]));
  };
  const settimana = (errori ?? []).filter((e) => !e.risolto && Date.now() - new Date(e.quando).getTime() < 7 * 864e5);
  const aperti = (errori ?? []).filter((e) => !e.risolto).length;

  if (problema) return <p className="rounded-lg border-l-4 border-[#b3261e] bg-[#fdecea] p-3 text-sm text-[#5c1410]">Il registro errori non si legge ({problema}). Esegui <code>supabase/pro.sql</code> nell'editor SQL di Supabase.</p>;
  if (!errori) return <p className="text-sm text-muted-foreground" role="status">Caricamento…</p>;
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Errori che le app hanno incontrato sui computer e telefoni degli utenti, registrati da soli: pagina, messaggio, browser e versione, mai i dati inseriti. Lo stesso errore nella stessa ora conta una volta sola ("volte"). Quando un errore è sistemato premi <strong>Risolto</strong>: passa tra i risolti. <strong>Il registro non si cancella mai</strong> e si può scaricare completo.</p>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="App" className={`${inputCls} w-auto`} value={app} onChange={(e) => setApp(e.target.value)}>
        <option value="">Tutte le app ({errori.length})</option>
        {Object.entries(NOMI_APP).map(([k, n]) => { const c = errori.filter((e) => e.app === k).length; return c ? <option key={k} value={k}>{n} ({c})</option> : null; })}
      </select>
      <select aria-label="Stato" className={`${inputCls} w-auto`} value={vista} onChange={(e) => setVista(e.target.value as typeof vista)}>
        <option value="aperti">Da risolvere ({aperti})</option><option value="risolti">Risolti ({errori.length - aperti})</option><option value="tutti">Tutti ({errori.length})</option>
      </select>
      <span className="text-sm text-muted-foreground">{settimana.length} da risolvere negli ultimi 7 giorni</span>
      <span className="ml-auto flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void carica()}><RefreshCw strokeWidth={1.5} />Aggiorna</Button>
        <Button variant="outline" size="sm" onClick={() => void scarica()}><Download strokeWidth={1.5} />Scarica registro (CSV)</Button>
        {vista === "aperti" && elenco.length > 0 && <Button variant="outline" size="sm" onClick={() => void segna(elenco.map((e) => e.id), true)}><Check strokeWidth={1.5} />Segna tutti come risolti</Button>}
      </span>
    </div>
    {!elenco.length && <p className="rounded-lg border-[0.8px] p-4 text-sm"><Check className="mr-1 inline size-4 text-green-700" />{vista === "aperti" ? "Nessun errore da risolvere." : "Nessun errore in questo elenco."}</p>}
    <ul className="space-y-2">{elenco.map((e) => <li key={e.id} className="rounded-lg border-[0.8px] p-3 text-sm">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{NOMI_APP[e.app] ?? e.app}</span>
        <span className="font-mono text-xs text-muted-foreground">{data(e.quando)}</span>
        {e.volte > 1 && <span className="text-xs font-semibold text-[#b3261e]">{e.volte} volte</span>}
        <span className="text-xs text-muted-foreground">{browserBreve(e.browser)}{e.versione ? ` · versione ${e.versione}` : ""}{e.utente ? ` · ${nomePersona(e.utente, null)}` : ""}</span>
        {e.risolto ? <span className="ml-auto flex items-center gap-1 text-xs text-green-800 dark:text-green-300"><Check className="size-3.5" />risolto il {dataOra(e.risolto)}
          <Button variant="ghost" size="sm" className="h-7" title="Rimetti tra gli errori da risolvere" onClick={() => void segna([e.id], false)}><RotateCcw strokeWidth={1.5} />Riapri</Button></span>
          : <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => void segna([e.id], true)}><Check strokeWidth={1.5} />Risolto</Button>}
      </div>
      <p className="mt-1 break-words font-semibold">{e.messaggio}</p>
      <p className="break-all font-mono text-xs text-muted-foreground">{e.pagina}</p>
      {e.dettagli && <button type="button" className="mt-1 text-xs font-semibold text-primary underline" onClick={() => setAperto(aperto === e.id ? null : e.id)}>{aperto === e.id ? "Nascondi dettagli tecnici" : "Dettagli tecnici"}</button>}
      {aperto === e.id && <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">{e.dettagli}</pre>}
    </li>)}</ul>
  </div>;
}
