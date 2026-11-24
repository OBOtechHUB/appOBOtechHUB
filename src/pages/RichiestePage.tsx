/**
 * Richieste all'ufficio tecnico: chi ha l'account apre una richiesta (cliente, comune, tipo, scadenza, ore stimate),
 * il tecnico la prende in carico, crea il progetto LPS collegato e la chiude. In Mappa carichi le stesse richieste
 * si mettono in mappa con le ore stimate. Niente si cancella: una richiesta si annulla.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, FolderPlus, FolderOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { CampoNumero } from "@/components/CampoNumero";
import { PageTitle } from "@/components/PageTitle";
import { useAuth } from "@/lib/auth";
import { useAccesso } from "@/lib/accesso";
import { STATI_RICHIESTA, TIPI_RICHIESTA, aggiornaRichiesta, elencaRichieste, nuovaRichiesta, type NuovaRichiesta, type Richiesta, type StatoRichiesta, type TipoRichiesta } from "@/lib/richieste";
import { creaProgetto, leggiProgetto } from "@/lib/progetti.functions";
import { caricaSnapshot, impostaAttivo, snapshot, snapshotVuoto } from "@/lib/statoProgetto";
import { salvaAttivo } from "@/components/ProjectSync";
import { formattaNome } from "@/lib/nomi";

const vuota: NuovaRichiesta = { richiedente: "", cliente: "", comune: "", tipo: "progetto-lps", descrizione: "", priorita: "Media", scadenza: null, ore_stimate: null };
const dataIt = (s: string | null) => (s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("it-IT") : "—");
const COLORE: Record<StatoRichiesta, string> = { nuova: "bg-accent/20", "in-carico": "bg-secondary", "in-lavorazione": "bg-primary/15", completata: "bg-green-600/15", annullata: "bg-muted text-muted-foreground" };

export function RichiestePage() {
  const { user } = useAuth(), navigate = useNavigate();
  const [lista, setLista] = useState<Richiesta[] | null>(null), [errore, setErrore] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const [filtro, setFiltro] = useState<"aperte" | "mie" | "tutte">("aperte"), [nuova, setNuova] = useState<NuovaRichiesta | null>(null);
  const accesso = useAccesso();
  // nome come nella Mappa carichi, così "Mie" e il tecnico coincidono nelle due app
  const mioNome = useMemo(() => (accesso.profilo?.mappa_persona || accesso.profilo?.nome || user?.email?.split("@")[0] || "").trim(), [accesso.profilo, user]);
  const carica = () => elencaRichieste().then((l) => { setLista(l); setErrore(""); }, (e: unknown) => setErrore(e instanceof Error ? e.message : "Richieste non disponibili."));
  useEffect(() => { if (user) void carica(); }, [user]);
  async function azione(fn: () => Promise<void>, ok: string) { setBusy(true); setErrore(""); setMsg(""); try { await fn(); setMsg(ok); await carica(); } catch (e) { setErrore(e instanceof Error ? e.message : "Operazione non riuscita."); } finally { setBusy(false); } }

  async function creaProgettoDa(r: Richiesta) {
    await salvaAttivo();
    const s = snapshotVuoto();
    const nome = [r.cliente, r.comune].filter(Boolean).join(" – ").slice(0, 200) || "Progetto da richiesta";
    const dati = { ...s, edificio: { ...s.edificio, nomeProgetto: nome, comune: r.comune }, esteso: { ...s.esteso, relazione: { committente: r.cliente } } };
    const p = await creaProgetto({ data: { codice: "", nome, comune: r.comune, dati: dati as never } });
    await aggiornaRichiesta(r.id, { progetto: p.id, stato: r.stato === "nuova" || r.stato === "in-carico" ? "in-lavorazione" : r.stato, tecnico: r.tecnico || mioNome });
    caricaSnapshot(p.dati); impostaAttivo({ id: p.id, codice: p.codice, nome: p.nome, proprietario: p.utente, salvato: JSON.stringify(snapshot()) });
    await navigate({ to: "/dati-edificio" });
  }
  async function apriProgetto(id: string) {
    await salvaAttivo(); const p = await leggiProgetto({ data: { id } });
    caricaSnapshot(p.dati); impostaAttivo({ id: p.id, codice: p.codice, nome: p.nome, proprietario: p.utente, salvato: JSON.stringify(snapshot()) });
    await navigate({ to: "/dati-edificio" });
  }

  const vis = (lista ?? []).filter((r) => filtro === "tutte" || (filtro === "mie" ? r.tecnico === mioNome || r.richiedente === mioNome : r.stato !== "completata" && r.stato !== "annullata"));
  const aperte = (lista ?? []).filter((r) => r.stato !== "completata" && r.stato !== "annullata");
  const ore = aperte.reduce((t, r) => t + (r.ore_stimate ?? 0), 0);

  if (!user) return <main className="mx-auto max-w-5xl px-4 py-8"><PageTitle titolo="Richieste all'ufficio tecnico" /><p className="mt-4 text-muted-foreground">Accedi con il tuo account per vedere e aprire le richieste.</p></main>;
  return <main className="mx-auto max-w-6xl px-4 py-8"><PageTitle titolo="Richieste all'ufficio tecnico" />
    <p className="mt-2 text-sm text-muted-foreground">Apri una richiesta per l'ufficio tecnico: il tecnico la prende in carico, crea il progetto LPS collegato e la chiude. Le stesse richieste compaiono in Mappa carichi, dove si mettono in mappa con le ore stimate. Le richieste non si cancellano: si annullano.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Aperte</p><p className="text-2xl font-semibold">{aperte.length}</p></div>
      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Ore stimate aperte</p><p className="text-2xl font-semibold">{ore.toLocaleString("it-IT")} h</p></div>
      <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">In scadenza (7 giorni)</p><p className="text-2xl font-semibold">{aperte.filter((r) => r.scadenza && new Date(`${r.scadenza}T23:59:00`).getTime() - Date.now() < 7 * 864e5).length}</p></div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button type="button" onClick={() => setNuova({ ...vuota, richiedente: mioNome })}><Plus />Nuova richiesta</Button>
      {(["aperte", "mie", "tutte"] as const).map((f) => <Button key={f} type="button" size="sm" variant={filtro === f ? "default" : "outline"} aria-pressed={filtro === f} onClick={() => setFiltro(f)}>{f === "aperte" ? "Aperte" : f === "mie" ? "Mie" : "Tutte"}</Button>)}
      <Button type="button" size="sm" variant="ghost" onClick={() => void carica()} aria-label="Aggiorna"><RefreshCw /></Button>
    </div>
    {errore && <p role="alert" className="mt-3 text-sm text-destructive">{errore}</p>}
    {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
    {nuova && <section className="mt-4 rounded-lg border p-4" aria-labelledby="h-nuova-ric"><h2 id="h-nuova-ric" className="font-semibold">Nuova richiesta</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Campo etichetta="Richiedente"><input className={inputCls} value={nuova.richiedente} maxLength={200} onChange={(e) => setNuova({ ...nuova, richiedente: e.target.value })} /></Campo>
        <Campo etichetta="Cliente"><input className={inputCls} value={nuova.cliente} maxLength={300} placeholder="es. Elettro Rossi S.r.l." onChange={(e) => setNuova({ ...nuova, cliente: e.target.value })} /></Campo>
        <Campo etichetta="Comune / cantiere"><input className={inputCls} value={nuova.comune} maxLength={200} onChange={(e) => setNuova({ ...nuova, comune: e.target.value })} /></Campo>
        <Campo etichetta="Tipo"><select className={inputCls} value={nuova.tipo} onChange={(e) => setNuova({ ...nuova, tipo: e.target.value as TipoRichiesta })}>{Object.entries(TIPI_RICHIESTA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Campo>
        <Campo etichetta="Priorità"><select className={inputCls} value={nuova.priorita} onChange={(e) => setNuova({ ...nuova, priorita: e.target.value as NuovaRichiesta["priorita"] })}><option>Alta</option><option>Media</option><option>Bassa</option></select></Campo>
        <div className="grid grid-cols-2 gap-2"><Campo etichetta="Scadenza"><input type="date" className={inputCls} value={nuova.scadenza ?? ""} onChange={(e) => setNuova({ ...nuova, scadenza: e.target.value || null })} /></Campo>
          <Campo etichetta="Ore stimate"><CampoNumero className={inputCls} valore={nuova.ore_stimate} min={0} max={2000} onValore={(v) => setNuova({ ...nuova, ore_stimate: v })} /></Campo></div>
        <div className="sm:col-span-3"><Campo etichetta="Descrizione"><textarea className={`${inputCls} min-h-20`} value={nuova.descrizione} maxLength={5000} placeholder="Cosa serve, documenti disponibili, contatti…" onChange={(e) => setNuova({ ...nuova, descrizione: e.target.value })} /></Campo></div>
      </div>
      <div className="mt-3 flex gap-2"><Button type="button" disabled={busy || !nuova.cliente.trim()} onClick={() => void azione(async () => { await nuovaRichiesta(nuova); setNuova(null); }, "Richiesta aperta.")}>Apri richiesta</Button><Button type="button" variant="outline" onClick={() => setNuova(null)}>Annulla</Button></div>
    </section>}
    {lista && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[960px] text-sm">
      <thead><tr className="border-b text-left"><th className="p-2">Aperta</th><th className="p-2">Cliente e comune</th><th className="p-2">Tipo</th><th className="p-2">Priorità</th><th className="p-2">Scadenza</th><th className="p-2 text-right">Ore</th><th className="p-2">Stato</th><th className="p-2">Tecnico</th><th className="p-2">Azioni</th></tr></thead>
      <tbody>{vis.map((r) => <tr key={r.id} className="border-b align-top">
        <td className="p-2 whitespace-nowrap">{dataIt(r.creata_il)}<div className="text-xs text-muted-foreground">{formattaNome(r.richiedente)}</div></td>
        <td className="p-2"><b>{r.cliente || "—"}</b>{r.comune && <div>{r.comune}</div>}{r.descrizione && <div className="mt-1 max-w-xs whitespace-pre-line text-xs text-muted-foreground">{r.descrizione}</div>}</td>
        <td className="p-2">{TIPI_RICHIESTA[r.tipo]}</td><td className="p-2">{r.priorita}</td>
        <td className="p-2 whitespace-nowrap">{dataIt(r.scadenza)}</td><td className="p-2 text-right">{r.ore_stimate ?? "—"}</td>
        <td className="p-2"><select aria-label={`Stato della richiesta di ${r.cliente}`} className={`rounded border px-2 py-1 ${COLORE[r.stato]}`} value={r.stato} disabled={busy} onChange={(e) => void azione(() => aggiornaRichiesta(r.id, { stato: e.target.value as StatoRichiesta }), "Stato aggiornato.")}>{Object.entries(STATI_RICHIESTA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>{r.progetto_mappa && <div className="mt-1 text-xs text-muted-foreground">In Mappa carichi</div>}</td>
        <td className="p-2">{formattaNome(r.tecnico) || <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void azione(() => aggiornaRichiesta(r.id, { tecnico: mioNome, stato: r.stato === "nuova" ? "in-carico" : r.stato }), "Richiesta presa in carico.")}>Prendi in carico</Button>}</td>
        <td className="p-2">{r.progetto
          ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void azione(() => apriProgetto(r.progetto!), "")}><FolderOpen />Apri progetto</Button>
          : r.tipo === "progetto-lps" && r.stato !== "annullata" && <Button type="button" size="sm" disabled={busy} onClick={() => void azione(() => creaProgettoDa(r), "Progetto creato.")}><FolderPlus />Crea progetto LPS</Button>}</td>
      </tr>)}
        {!vis.length && <tr><td colSpan={9} className="p-3 text-muted-foreground">Nessuna richiesta.</td></tr>}</tbody></table></div>}
  </main>;
}
