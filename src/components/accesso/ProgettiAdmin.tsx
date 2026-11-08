import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Archive, Copy, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/Campo";
import { db, type Profilo } from "@/lib/accesso";
import { creaProgetto } from "@/lib/progetti.functions";
import { caricaSnapshot, impostaAttivo, snapshot, snapshotSchema } from "@/lib/statoProgetto";
import { salvaAttivo } from "@/components/ProjectSync";
import { scarica } from "@/lib/esportazioni";

interface Riga { id: string; utente: string | null; email?: string | null; codice: string; nome: string; comune: string; data_creazione: string | null; data_modifica: string | null; eliminato_il?: string; archiviato: boolean }

const data = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "—");

/**
 * Tutti i progetti salvati da tutti gli utenti, compresi quelli eliminati (archivio).
 * Solo lettura: l'amministratore può scaricarli o aprirne una COPIA nei propri progetti;
 * l'originale dell'utente non viene mai modificato.
 */
export function ProgettiAdmin({ profili }: { profili: Profilo[] }) {
  const [righe, setRighe] = useState<Riga[]>([]);
  const [filtro, setFiltro] = useState("");
  const [utente, setUtente] = useState("");
  const [archivio, setArchivio] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const emailDi = useMemo(() => new Map(profili.map((p) => [p.utente, p.email])), [profili]);

  const carica = useCallback(async () => {
    setMsg("");
    const campi = "id,utente,codice,nome,comune,data_creazione,data_modifica";
    const [p, a] = await Promise.all([
      db().from("progetti").select(campi).order("data_modifica", { ascending: false }).limit(2000),
      db().from("progetti_archivio").select(`${campi},email,eliminato_il`).order("eliminato_il", { ascending: false }).limit(2000),
    ]);
    if (p.error) setMsg("Non riesco a leggere i progetti di tutti: esegui supabase/admin-progetti.sql nello SQL Editor di Supabase.");
    setRighe([
      ...((p.data ?? []) as Riga[]).map((r) => ({ ...r, archiviato: false })),
      ...((a.data ?? []) as Riga[]).map((r) => ({ ...r, archiviato: true })),
    ]);
  }, []);
  useEffect(() => { void carica(); }, [carica]);

  const email = (r: Riga) => (r.utente && emailDi.get(r.utente)) || r.email || "utente eliminato";
  const visibili = righe.filter((r) => r.archiviato === archivio && (!utente || r.utente === utente)
    && (!filtro || `${r.codice} ${r.nome} ${r.comune} ${email(r)}`.toLowerCase().includes(filtro.toLowerCase())));
  const conteggio = (id: string) => righe.filter((r) => !r.archiviato && r.utente === id).length;

  async function leggiDati(r: Riga): Promise<unknown> {
    const { data: d, error } = await db().from(r.archiviato ? "progetti_archivio" : "progetti").select("dati").eq("id", r.id).single();
    if (error || !d) throw new Error("Progetto non disponibile.");
    return (d as { dati: unknown }).dati;
  }
  async function azione(fn: () => Promise<void>) {
    setBusy(true); setMsg("");
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : "Operazione non riuscita."); } finally { setBusy(false); }
  }
  const scaricaJson = (r: Riga) => azione(async () => {
    const dati = await leggiDati(r);
    scarica(new Blob([JSON.stringify({ progetto: { codice: r.codice, nome: r.nome, comune: r.comune, utente: email(r) }, dati }, null, 2)], { type: "application/json" }), `${(r.codice || r.nome).replace(/[^\w-]+/g, "_")}.json`);
  });
  const apriCopia = (r: Riga) => azione(async () => {
    if (!window.confirm(`Aprire una COPIA di "${r.nome}" di ${email(r)} tra i tuoi progetti? L'originale dell'utente non verrà toccato.`)) return;
    const dati = snapshotSchema.parse(await leggiDati(r));
    await salvaAttivo();
    const p = await creaProgetto({ data: { codice: r.codice, nome: `${r.nome} (copia da ${email(r)})`.slice(0, 200), comune: r.comune, dati } });
    caricaSnapshot(p.dati);
    impostaAttivo({ id: p.id, codice: p.codice, nome: p.nome, proprietario: p.utente, salvato: JSON.stringify(snapshot()) });
    await navigate({ to: "/strumenti" });
  });

  return <div>
    <div className="flex flex-wrap items-center gap-2">
      <input aria-label="Cerca progetto" className={`${inputCls} max-w-xs`} placeholder="Cerca per nome, codice, comune, email" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <select aria-label="Utente" className="rounded border px-2 py-2 text-sm" value={utente} onChange={(e) => setUtente(e.target.value)}>
        <option value="">Tutti gli utenti</option>
        {profili.map((p) => <option key={p.utente} value={p.utente}>{p.email} ({conteggio(p.utente)})</option>)}
      </select>
      <Button variant={archivio ? "default" : "outline"} onClick={() => setArchivio(!archivio)}><Archive strokeWidth={1.5} />{archivio ? "Mostra progetti attivi" : `Eliminati dagli utenti (${righe.filter((r) => r.archiviato).length})`}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => void carica()}><RefreshCw strokeWidth={1.5} />Aggiorna</Button>
    </div>
    {msg && <p role="status" className="mt-3 rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">{msg}</p>}
    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
      <thead><tr className="border-b text-left"><th className="p-2">Progetto</th><th className="p-2">Utente</th><th className="p-2">{archivio ? "Eliminato il" : "Ultima modifica"}</th><th className="p-2">Creato</th><th className="p-2">Azioni</th></tr></thead>
      <tbody>{visibili.map((r) => <tr key={`${r.archiviato}-${r.id}`} className="border-b align-top">
        <td className="p-2"><p className="font-semibold">{r.codice && `${r.codice} · `}{r.nome}</p><p className="text-xs text-muted-foreground">{r.comune || "Comune non indicato"}</p></td>
        <td className="p-2">{email(r)}</td>
        <td className="whitespace-nowrap p-2 text-xs">{data(archivio ? r.eliminato_il : r.data_modifica)}</td>
        <td className="whitespace-nowrap p-2 text-xs">{data(r.data_creazione)}</td>
        <td className="p-2"><div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" disabled={busy} title="Crea una copia nei tuoi progetti e aprila (l'originale resta com'è)" onClick={() => void apriCopia(r)}><Copy />Apri copia</Button>
          <Button size="sm" variant="ghost" disabled={busy} aria-label={`Scarica ${r.nome}`} title="Scarica il progetto (JSON)" onClick={() => void scaricaJson(r)}><Download /></Button>
        </div></td>
      </tr>)}</tbody>
    </table></div>
    {!visibili.length && <p className="py-8 text-center text-sm text-muted-foreground">{archivio ? "Nessun progetto eliminato." : "Nessun progetto salvato."}</p>}
    <p className="mt-3 text-xs text-muted-foreground">Sola lettura: da qui non si modificano né si cancellano i progetti degli utenti. I progetti che un utente elimina restano nell'archivio; anche eliminando un account i suoi progetti restano salvati.</p>
  </div>;
}
