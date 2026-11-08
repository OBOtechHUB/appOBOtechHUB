import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, RefreshCw, Save, ShieldCheck, ShieldX, Trash2, UserCheck, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEZIONI, db, gestione, useAccesso, type Profilo } from "@/lib/accesso";
import { ProgettiAdmin } from "@/components/accesso/ProgettiAdmin";
import { MappaUtente, type PersonaMappa } from "@/components/accesso/MappaUtente";
import { InvitaUtenti } from "@/components/accesso/InvitaUtenti";

interface Richiesta { id: string; email: string; nome: string; azienda: string; motivo: string; stato: "in_attesa" | "approvata" | "rifiutata"; sezioni: string[]; creata_il: string; gestita_il: string | null }
interface Evento { id: number; utente: string | null; email: string | null; evento: string; quando: string; dettagli: Record<string, unknown> }

const data = (d: string | null) => (d ? new Date(d).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "—");
const giorno = (d: Date) => d.toISOString().slice(0, 10);
const NOMI_EVENTO: Record<string, string> = { accesso: "Accesso", uscita: "Uscita", password_cambiata: "Password cambiata", authenticator_attivato: "Authenticator collegato", approvazione: "Richiesta approvata", rifiuto: "Richiesta rifiutata", modifica_utente: "Utente modificato", reimpostazione: "Reimpostazione", eliminazione: "Utente eliminato", invito: "Invito creato", accesso_negato: "Accesso negato" };

function Kpi({ titolo, valore, nota, evidenzia }: { titolo: string; valore: number | string; nota?: string; evidenzia?: boolean }) {
  return <div className={`rounded-lg border-[0.8px] p-4 ${evidenzia ? "border-primary bg-primary/5" : "border-bordo-scheda"}`}>
    <p className="text-sm text-muted-foreground">{titolo}</p>
    <p className="mt-1 text-3xl font-bold">{valore}</p>
    {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
  </div>;
}

function SceltaSezioni({ valore, onChange }: { valore: string[]; onChange: (v: string[]) => void }) {
  const tutte = valore.includes("tutte");
  const cambia = (id: string, on: boolean) => onChange(on ? [...valore.filter((x) => x !== "tutte"), id] : valore.filter((x) => x !== id));
  const lps = SEZIONI.filter((s) => !s.id.startsWith("app_"));
  const tutteLps = lps.every((s) => valore.includes(s.id));
  return <div className="space-y-3">
    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={tutte} onChange={(e) => onChange(e.target.checked ? ["tutte"] : [])} />Tutte le app e sezioni (anche quelle future)</label>
    {!tutte && <>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">App di OBO Hub</p>
        <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={valore.includes("app_mappa")} onChange={(e) => cambia("app_mappa", e.target.checked)} />Mappa carichi ufficio tecnico</label>
        <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={tutteLps} onChange={(e) => onChange(e.target.checked ? [...new Set([...valore, ...lps.map((x) => x.id)])] : valore.filter((x) => x.startsWith("app_")))} />Progettazione LPS (tutte le sezioni)</label>
      </div>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progettazione LPS · singole sezioni</p>
        <div className="mt-1 grid gap-1 sm:grid-cols-2">{lps.map((s) => <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={valore.includes(s.id)} onChange={(e) => cambia(s.id, e.target.checked)} />{s.nome}</label>)}</div>
      </div>
      <p className="text-xs text-muted-foreground">L'Amministrazione la vede solo chi ha ruolo Amministratore (scheda Utenti).</p>
    </>}
  </div>;
}

/** Grafico a barre degli accessi per giorno (ultimi 30 giorni). */
function GraficoAccessi({ eventi }: { eventi: Evento[] }) {
  const giorni = useMemo(() => {
    const oggi = new Date(); const out: { g: string; n: number }[] = [];
    for (let i = 29; i >= 0; i--) { const d = new Date(oggi); d.setDate(d.getDate() - i); out.push({ g: giorno(d), n: 0 }); }
    for (const e of eventi) if (e.evento === "accesso") { const x = out.find((o) => o.g === e.quando.slice(0, 10)); if (x) x.n++; }
    return out;
  }, [eventi]);
  const max = Math.max(1, ...giorni.map((g) => g.n));
  return <div>
    <div className="flex h-40 items-end gap-[3px]" role="img" aria-label="Accessi per giorno negli ultimi 30 giorni">
      {giorni.map((g) => <div key={g.g} className="group relative flex flex-1 flex-col items-center justify-end">
        <div className="w-full rounded-t bg-primary transition-colors group-hover:bg-[#d98a00]" style={{ height: `${(g.n / max) * 100}%`, minHeight: g.n ? 3 : 0 }} />
        <span className="pointer-events-none absolute -top-6 hidden whitespace-nowrap rounded bg-[#212529] px-1.5 py-0.5 text-[10px] text-white group-hover:block">{new Date(g.g).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}: {g.n}</span>
      </div>)}
    </div>
    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{new Date(giorni[0]!.g).toLocaleDateString("it-IT")}</span><span>oggi</span></div>
  </div>;
}

export function AdminPage() {
  const io = useAccesso();
  const [profili, setProfili] = useState<Profilo[]>([]);
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [impostazioni, setImpostazioni] = useState<Record<string, string>>({});
  const [conAuth, setConAuth] = useState<Set<string>>(new Set());
  const [persone, setPersone] = useState<PersonaMappa[]>([]);
  const [sezioniRichiesta, setSezioniRichiesta] = useState<Record<string, string[]>>({});
  const [modifica, setModifica] = useState<{ utente: string; sezioni: string[] } | null>(null);
  const [filtro, setFiltro] = useState("");
  const [mostraPw, setMostraPw] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const carica = useCallback(async () => {
    const trenta = new Date(Date.now() - 30 * 864e5).toISOString();
    const [p, r, e, i] = await Promise.all([
      db().from("accessi_profili").select("*").order("creato_il", { ascending: false }),
      db().from("richieste_accesso").select("*").order("creata_il", { ascending: false }).limit(500),
      db().from("registro_accessi").select("*").gte("quando", trenta).order("quando", { ascending: false }).limit(3000),
      db().from("impostazioni_admin").select("*"),
    ]);
    setProfili((p.data ?? []) as Profilo[]);
    setRichieste((r.data ?? []) as Richiesta[]);
    setEventi((e.data ?? []) as Evento[]);
    setImpostazioni(Object.fromEntries(((i.data ?? []) as { chiave: string; valore: string }[]).map((x) => [x.chiave, x.valore])));
    try { const m = await db().rpc("mappa_persone"); setPersone((m.data ?? []) as PersonaMappa[]); } catch { /* script della Mappa non ancora eseguito */ }
    try { const f = await gestione("fattori"); setConAuth(new Set((f["conAuthenticator"] as string[] | undefined) ?? [])); } catch { /* funzione non ancora pubblicata */ }
  }, []);
  useEffect(() => { void carica(); }, [carica]);

  const predefinite = (impostazioni["sezioni_predefinite"] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const inAttesa = richieste.filter((r) => r.stato === "in_attesa");
  const oggi = giorno(new Date());
  const accessi = eventi.filter((e) => e.evento === "accesso");
  const attivi30 = new Set(accessi.map((e) => e.utente)).size;
  const perUtente = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of accessi) m.set(e.email ?? "—", (m.get(e.email ?? "—") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [accessi]);

  async function azione(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setMsg("");
    try { await fn(); setMsg(ok); await carica(); } catch (e) { setMsg(e instanceof Error ? e.message : "Operazione non riuscita."); } finally { setBusy(false); }
  }
  async function salvaImpostazioni() {
    if (impostazioni["password_iniziale"] && impostazioni["password_iniziale"].length < 6) { setMsg("La password iniziale deve avere almeno 6 caratteri."); return; }
    await azione(async () => {
      const righe = Object.entries(impostazioni).map(([chiave, valore]) => ({ chiave, valore }));
      const { error } = await db().from("impostazioni_admin").upsert(righe);
      if (error) throw new Error(error.message);
    }, "Impostazioni salvate.");
  }
  const eventiFiltrati = eventi.filter((e) => !filtro || `${e.email} ${e.evento} ${NOMI_EVENTO[e.evento] ?? ""}`.toLowerCase().includes(filtro.toLowerCase())).slice(0, 300);

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-10">
      <div><h1 className="text-3xl font-bold">Amministrazione accessi</h1><p className="mt-2 text-white/90">Richieste, utenti, sezioni abilitate, registro degli accessi e impostazioni.</p></div>
      <Button variant="outline" onClick={() => void carica()} disabled={busy}><RefreshCw strokeWidth={1.5} />Aggiorna</Button>
    </div></section>
    <main className="mx-auto max-w-6xl px-4 py-8">
      {msg && <p role="status" className="mb-4 rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">{msg}</p>}
      {!impostazioni["password_iniziale"] && <p className="mb-4 rounded-lg border-l-4 border-[#b3261e] bg-[#fdecea] p-3 text-sm">Imposta la <strong>password iniziale comune</strong> nella scheda Impostazioni prima di approvare le richieste.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Kpi titolo="Richieste in attesa" valore={inAttesa.length} evidenzia={inAttesa.length > 0} />
        <Kpi titolo="Utenti attivi" valore={profili.filter((p) => p.stato === "attivo").length} nota={`${profili.filter((p) => p.ruolo === "admin").length} amministratori`} />
        <Kpi titolo="Accessi oggi" valore={accessi.filter((e) => e.quando.slice(0, 10) === oggi).length} />
        <Kpi titolo="Accessi 30 giorni" valore={accessi.length} />
        <Kpi titolo="Utenti attivi 30 gg" valore={attivi30} />
        <Kpi titolo="Senza Authenticator" valore={profili.filter((p) => !conAuth.has(p.utente)).length} nota="non hanno ancora completato il primo accesso" />
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border-[0.8px] border-bordo-scheda p-4"><h2 className="font-semibold">Accessi per giorno</h2><div className="mt-6"><GraficoAccessi eventi={eventi} /></div></div>
        <div className="rounded-lg border-[0.8px] border-bordo-scheda p-4"><h2 className="font-semibold">Utenti più attivi (30 gg)</h2>
          <ul className="mt-3 space-y-2">{perUtente.map(([email, n]) => <li key={email} className="text-sm"><div className="flex justify-between gap-2"><span className="truncate">{email}</span><span className="font-mono">{n}</span></div><div className="mt-0.5 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(n / (perUtente[0]?.[1] ?? 1)) * 100}%` }} /></div></li>)}</ul>
          {!perUtente.length && <p className="mt-3 text-sm text-muted-foreground">Nessun accesso registrato.</p>}
        </div>
      </section>

      <Tabs defaultValue={inAttesa.length ? "richieste" : "utenti"} className="mt-8">
        <TabsList className="h-auto flex-wrap"><TabsTrigger value="richieste">Richieste{inAttesa.length ? ` (${inAttesa.length})` : ""}</TabsTrigger><TabsTrigger value="utenti">Utenti ({profili.length})</TabsTrigger><TabsTrigger value="invita">Invita</TabsTrigger><TabsTrigger value="progetti">Progetti salvati</TabsTrigger><TabsTrigger value="registro">Registro accessi</TabsTrigger><TabsTrigger value="impostazioni">Impostazioni</TabsTrigger></TabsList>

        <TabsContent value="richieste" className="mt-4 space-y-4">
          {!inAttesa.length && <p className="text-sm text-muted-foreground">Nessuna richiesta in attesa.</p>}
          {inAttesa.map((r) => { const sez = sezioniRichiesta[r.id] ?? predefinite; return <div key={r.id} className="rounded-lg border-[0.8px] border-primary p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-semibold">{r.nome} <span className="font-normal text-muted-foreground">· {r.azienda || "azienda non indicata"}</span></p><p className="text-sm">{r.email} · {data(r.creata_il)}</p>{r.motivo && <p className="mt-2 max-w-3xl text-sm italic">“{r.motivo}”</p>}</div></div>
            <div className="mt-4"><p className="mb-2 text-sm font-semibold">Sezioni da abilitare</p><SceltaSezioni valore={sez} onChange={(v) => setSezioniRichiesta({ ...sezioniRichiesta, [r.id]: v })} /></div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void azione(() => gestione("approva", { richiesta: r.id, sezioni: sez }), `Accesso approvato per ${r.email}: comunicagli la password iniziale.`)}><UserCheck strokeWidth={1.5} />Approva</Button>
              <Button variant="outline" disabled={busy} onClick={() => void azione(() => gestione("rifiuta", { richiesta: r.id }), "Richiesta rifiutata.")}><UserX strokeWidth={1.5} />Rifiuta</Button>
            </div>
          </div>; })}
          {richieste.some((r) => r.stato !== "in_attesa") && <details className="rounded-lg border-[0.8px] border-bordo-scheda p-4"><summary className="cursor-pointer font-semibold">Richieste gestite</summary>
            <ul className="mt-3 divide-y text-sm">{richieste.filter((r) => r.stato !== "in_attesa").map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{r.nome} · {r.email}</span><span className={r.stato === "approvata" ? "text-[#1d7a45]" : "text-[#b3261e]"}>{r.stato} il {data(r.gestita_il)}</span></li>)}</ul>
          </details>}
        </TabsContent>

        <TabsContent value="utenti" className="mt-4">
          <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
            <thead><tr className="border-b text-left"><th className="p-2">Utente</th><th className="p-2">Ruolo</th><th className="p-2">Stato</th><th className="p-2">Sezioni</th><th className="p-2">Mappa carichi</th><th className="p-2">Authenticator</th><th className="p-2">Ultimo accesso</th><th className="p-2">Azioni</th></tr></thead>
            <tbody>{profili.map((p) => { const me = p.utente === io.profilo?.utente; return <tr key={p.utente} className="border-b align-top">
              <td className="p-2"><p className="font-semibold">{p.nome || "—"}</p><p className="text-xs text-muted-foreground">{p.email}{p.azienda ? ` · ${p.azienda}` : ""}</p>{p.deve_cambiare_password && <p className="text-xs text-[#9a6200]">deve cambiare la password</p>}</td>
              <td className="p-2"><select aria-label="Ruolo" className="rounded border px-2 py-1" disabled={busy || me} value={p.ruolo} onChange={(e) => void azione(() => gestione("aggiorna", { utente: p.utente, ruolo: e.target.value }), "Ruolo aggiornato.")}><option value="utente">Utente</option><option value="admin">Amministratore</option></select></td>
              <td className="p-2"><Button size="sm" variant={p.stato === "attivo" ? "outline" : "default"} disabled={busy || me} onClick={() => void azione(() => gestione("aggiorna", { utente: p.utente, stato: p.stato === "attivo" ? "sospeso" : "attivo" }), p.stato === "attivo" ? "Utente sospeso." : "Utente riattivato.")}>{p.stato === "attivo" ? "Attivo · sospendi" : "Sospeso · riattiva"}</Button></td>
              <td className="max-w-[260px] p-2 text-xs">{p.ruolo === "admin" || p.sezioni.includes("tutte") ? "Tutte" : p.sezioni.map((s) => SEZIONI.find((x) => x.id === s)?.nome ?? s).join(", ") || "Nessuna"}
                {p.ruolo !== "admin" && <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={() => setModifica({ utente: p.utente, sezioni: p.sezioni })}>Cambia sezioni</Button>}</td>
              <td className="p-2"><MappaUtente p={p} persone={persone} abilitata={p.ruolo === "admin" || p.sezioni.includes("tutte") || p.sezioni.includes("app_mappa")}
                onCambio={(m) => { setMsg(m); void carica(); }}
                onNuovaPersona={async (nome) => { const { error } = await db().rpc("mappa_aggiungi_persona", { nome }); if (error) throw new Error(error.message); }} /></td>
              <td className="p-2">{conAuth.has(p.utente) ? <span className="inline-flex items-center gap-1 text-[#1d7a45]"><ShieldCheck className="size-4" />Collegato</span> : <span className="inline-flex items-center gap-1 text-muted-foreground"><ShieldX className="size-4" />No</span>}</td>
              <td className="p-2 text-xs">{data(p.ultimo_accesso)}</td>
              <td className="p-2"><div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" disabled={busy} title="Rimette la password iniziale comune e chiede di cambiarla" onClick={() => { if (window.confirm(`Reimpostare la password di ${p.email} alla password iniziale comune?`)) void azione(() => gestione("reimposta", { utente: p.utente }), "Password reimpostata: comunica la password iniziale."); }}><KeyRound />Password</Button>
                <Button size="sm" variant="outline" disabled={busy} title="Password iniziale e nuovo collegamento dell'Authenticator (telefono cambiato)" onClick={() => { if (window.confirm(`Reimpostare password e Authenticator di ${p.email}?`)) void azione(() => gestione("reimposta", { utente: p.utente, authenticator: true }), "Password e Authenticator reimpostati."); }}><ShieldX />Authenticator</Button>
                {!me && <Button size="sm" variant="ghost" disabled={busy} aria-label="Elimina utente" onClick={() => { if (window.confirm(`Eliminare definitivamente l'account ${p.email}? I suoi progetti restano salvati e visibili nella scheda Progetti salvati.`)) void azione(() => gestione("elimina", { utente: p.utente }), "Utente eliminato."); }}><Trash2 /></Button>}
              </div></td>
            </tr>; })}</tbody>
          </table></div>
          {modifica && <div className="mt-4 rounded-lg border-[0.8px] border-primary p-4">
            <p className="font-semibold">Sezioni di {profili.find((x) => x.utente === modifica.utente)?.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">Puoi cambiarle quando vuoi: valgono dal prossimo caricamento della pagina dell'utente. I suoi progetti e dati salvati non vengono modificati né cancellati.</p>
            <div className="mt-3"><SceltaSezioni valore={modifica.sezioni} onChange={(v) => setModifica({ ...modifica, sezioni: v })} /></div>
            <div className="mt-3 flex gap-2"><Button disabled={busy} onClick={() => void azione(async () => { await gestione("aggiorna", { utente: modifica.utente, sezioni: modifica.sezioni }); setModifica(null); }, "Sezioni aggiornate.")}><Check />Salva</Button><Button variant="outline" onClick={() => setModifica(null)}><X />Annulla</Button></div>
          </div>}
        </TabsContent>

        <TabsContent value="invita" className="mt-4">
          <InvitaUtenti profili={profili} persone={persone} password={impostazioni["password_iniziale"] ?? ""} predefinite={predefinite} onFatto={carica}
            scelta={(v, f) => <SceltaSezioni valore={v} onChange={f} />} />
        </TabsContent>

        <TabsContent value="progetti" className="mt-4"><ProgettiAdmin profili={profili} /></TabsContent>

        <TabsContent value="registro" className="mt-4">
          <input aria-label="Filtra registro" className={`${inputCls} max-w-sm`} placeholder="Filtra per email o evento" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Quando</th><th className="p-2">Utente</th><th className="p-2">Evento</th><th className="p-2">Dettagli</th></tr></thead>
            <tbody>{eventiFiltrati.map((e) => <tr key={e.id} className="border-b"><td className="whitespace-nowrap p-2 font-mono text-xs">{data(e.quando)}</td><td className="p-2">{e.email ?? "—"}</td><td className="p-2">{NOMI_EVENTO[e.evento] ?? e.evento}</td><td className="p-2 text-xs text-muted-foreground">{Object.keys(e.dettagli ?? {}).length ? JSON.stringify(e.dettagli) : ""}</td></tr>)}</tbody></table></div>
          <p className="mt-2 text-xs text-muted-foreground">Ultimi 30 giorni, al massimo 300 righe mostrate.</p>
        </TabsContent>

        <TabsContent value="impostazioni" className="mt-4 max-w-2xl space-y-5">
          <Campo etichetta="Email che riceve le richieste di accesso"><input className={inputCls} type="email" value={impostazioni["email_admin"] ?? ""} onChange={(e) => setImpostazioni({ ...impostazioni, email_admin: e.target.value })} /></Campo>
          <Campo etichetta="Password iniziale comune (almeno 6 caratteri, da cambiare al primo accesso)">
            <span className="flex gap-2"><input className={inputCls} type={mostraPw ? "text" : "password"} autoComplete="off" value={impostazioni["password_iniziale"] ?? ""} onChange={(e) => setImpostazioni({ ...impostazioni, password_iniziale: e.target.value })} /><Button type="button" variant="outline" size="icon" aria-label={mostraPw ? "Nascondi" : "Mostra"} onClick={() => setMostraPw(!mostraPw)}>{mostraPw ? <EyeOff /> : <Eye />}</Button></span>
          </Campo>
          <div><p className="mb-2 text-sm font-semibold">Sezioni proposte per i nuovi utenti</p><SceltaSezioni valore={predefinite} onChange={(v) => setImpostazioni({ ...impostazioni, sezioni_predefinite: v.join(",") })} /></div>
          <Button size="lg" disabled={busy} onClick={() => void salvaImpostazioni()}><Save strokeWidth={1.5} />Salva impostazioni</Button>
          <p className="text-xs text-muted-foreground">La password iniziale è visibile solo agli amministratori. Ogni utente la cambia al primo accesso e collega Microsoft Authenticator: senza codice dell'app non si accede ai dati.</p>
        </TabsContent>
      </Tabs>
    </main>
  </>;
}
