import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, Eye, EyeOff, KeyRound, RefreshCw, Save, ShieldCheck, ShieldX, Trash2, UserCheck, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEZIONI, db, gestione, useAccesso, type Profilo } from "@/lib/accesso";
import { ProgettiAdmin } from "@/components/accesso/ProgettiAdmin";
import { MappaUtente, type PersonaMappa } from "@/components/accesso/MappaUtente";
import { InvitaUtenti } from "@/components/accesso/InvitaUtenti";
import { VisitatoriMappa } from "@/components/accesso/VisitatoriMappa";
import { ErroriAdmin } from "@/components/accesso/ErroriAdmin";
import { UsoAdmin } from "@/components/accesso/UsoAdmin";
import { CopiaSicurezza, giorniDallaCopia } from "@/components/accesso/CopiaSicurezza";

interface Richiesta { id: string; email: string; nome: string; azienda: string; motivo: string; stato: "in_attesa" | "approvata" | "rifiutata"; sezioni: string[]; creata_il: string; gestita_il: string | null }
interface Evento { id: number; utente: string | null; email: string | null; evento: string; quando: string; dettagli: Record<string, unknown> }

const data = (d: string | null) => (d ? new Date(d).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "—");
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
// ---------- statistiche accessi: periodo scelto, barre con i numeri, persone attive, CSV ----------
type Periodo = "settimana" | "mese" | "2mesi" | "semestre" | "anno";
const PERIODI: { id: Periodo; nome: string }[] = [
  { id: "settimana", nome: "Settimana lavorativa" }, { id: "mese", nome: "Mese" }, { id: "2mesi", nome: "Due mesi" }, { id: "semestre", nome: "Semestre" }, { id: "anno", nome: "Anno" },
];
const chiaveGiorno = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; // data locale, non UTC
/** Numero della settimana ISO (la settimana inizia il lunedì; la prima è quella con il primo giovedì dell'anno). */
const numeroSettimana = (d: Date) => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const g = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - g); const inizio = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x.getTime() - inizio.getTime()) / 864e5 + 1) / 7); };
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

/** Inizio del periodo e barre (per giorno, settimana o mese). */
function barrePeriodo(periodo: Periodo): { inizio: Date; barre: { da: Date; a: Date; etichetta: string; titolo: string }[] } {
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const piu = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const barre: { da: Date; a: Date; etichetta: string; titolo: string }[] = [];
  const perGiorno = (da: Date, n: number, soloFeriali: boolean) => {
    for (let i = 0; i < n; i++) { const d = piu(da, i); if (soloFeriali && (d.getDay() === 0 || d.getDay() === 6)) continue;
      barre.push({ da: d, a: piu(d, 1), etichetta: n <= 7 ? `${GIORNI[d.getDay()]} ${d.getDate()}` : String(d.getDate()), titolo: d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }) }); }
  };
  if (periodo === "settimana") { const lun = piu(oggi, -((oggi.getDay() + 6) % 7)); perGiorno(lun, 5, true); return { inizio: lun, barre }; }
  if (periodo === "mese" || periodo === "2mesi") { const n = periodo === "mese" ? 30 : 60; const da = piu(oggi, -(n - 1)); perGiorno(da, n, false); return { inizio: da, barre }; }
  if (periodo === "semestre") { // per settimana (lunedì)
    const lun = piu(oggi, -((oggi.getDay() + 6) % 7)); const da = piu(lun, -25 * 7);
    for (let i = 0; i < 26; i++) { const d = piu(da, i * 7); barre.push({ da: d, a: piu(d, 7), etichetta: `S${numeroSettimana(d)}`, titolo: `settimana ${numeroSettimana(d)} (dal ${d.toLocaleDateString("it-IT")})` }); }
    return { inizio: da, barre };
  }
  const da = new Date(oggi.getFullYear(), oggi.getMonth() - 11, 1); // anno: per mese
  for (let i = 0; i < 12; i++) { const d = new Date(da.getFullYear(), da.getMonth() + i, 1); barre.push({ da: d, a: new Date(d.getFullYear(), d.getMonth() + 1, 1), etichetta: MESI[d.getMonth()]!, titolo: d.toLocaleDateString("it-IT", { month: "long", year: "numeric" }) }); }
  return { inizio: da, barre };
}

function GraficoAccessi({ accessi, periodo }: { accessi: Evento[]; periodo: Periodo }) {
  const { barre } = useMemo(() => barrePeriodo(periodo), [periodo]);
  const valori = useMemo(() => barre.map((b) => accessi.filter((e) => { const t = new Date(e.quando); return t >= b.da && t < b.a; }).length), [barre, accessi]);
  const max = Math.max(1, ...valori);
  const tutti = barre.length <= 31; // con tante barre il numero si scrive solo dove c'è almeno un accesso
  return <div>
    <div className="flex h-44 items-end gap-[3px]" role="img" aria-label="Accessi nel periodo">
      {barre.map((b, i) => { const n = valori[i] ?? 0; return <div key={i} title={`${b.titolo}: ${n} accessi`} className="relative flex h-full flex-1 flex-col items-center justify-end">
        {(tutti || n > 0) && <span className={`mb-0.5 font-mono leading-none ${barre.length > 31 ? "text-[9px]" : "text-[11px]"} ${n ? "text-foreground" : "text-muted-foreground"}`}>{n}</span>}
        <div className="w-full rounded-t bg-primary" style={{ height: `${(n / max) * 82}%`, minHeight: n ? 3 : 1, opacity: n ? 1 : 0.25 }} />
      </div>; })}
    </div>
    <div className="mt-1 flex gap-[3px] text-[10px] text-muted-foreground">
      {barre.map((b, i) => <span key={i} className="flex-1 truncate text-center">{barre.length <= 31 ? (barre.length === 26 && i % 2 ? "" : b.etichetta) : i % 7 === 0 ? b.etichetta : ""}</span>)}
    </div>
  </div>;
}

/** Tipi di risultato della ricerca di OBO Hub (impostazione "ricerca", letta da stato_manutenzione()). */
const TIPI_RICERCA: [string, string, string][] = [
  ["app", "App e sezioni", "Le app di OBO Hub e le sezioni di Progettazione LPS"],
  ["prodotti", "Prodotti OBO", "Catalogo di obo.it, con numero d'articolo"],
  ["notizie", "Notizie OBO", "Notizie e comunicati di obo.it"],
  ["progetti", "Progetti salvati", "I propri progetti di Progettazione LPS"],
];
/** Tipi scelti: senza impostazione tutti; "nessuno" = ricerca nascosta. */
export function tipiRicerca(v: string | undefined): string[] {
  if (v === undefined || v === "") return TIPI_RICERCA.map(([id]) => id);
  return v.split(",").map((x) => x.trim()).filter((x) => TIPI_RICERCA.some(([id]) => id === x));
}

export function AdminPage() {
  const io = useAccesso();
  const [profili, setProfili] = useState<Profilo[]>([]);
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [impostazioni, setImpostazioni] = useState<Record<string, string>>({});
  const [conAuth, setConAuth] = useState<Set<string> | null>(null); // null = dato non disponibile
  const [erroreRegistro, setErroreRegistro] = useState("");
  const [persone, setPersone] = useState<PersonaMappa[]>([]);
  const [sezioniRichiesta, setSezioniRichiesta] = useState<Record<string, string[]>>({});
  const [modifica, setModifica] = useState<{ utente: string; sezioni: string[] } | null>(null);
  const [filtro, setFiltro] = useState("");
  const [mostraPw, setMostraPw] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const carica = useCallback(async () => {
    const anno = new Date(Date.now() - 370 * 864e5).toISOString();
    const leggiRegistro = async () => { // a pagine: il server ne dà al massimo 1000 per volta
      const tutti: Evento[] = []; let errore: { message: string } | null = null;
      for (let da = 0; da < 50000; da += 1000) {
        const r = await db().from("registro_accessi").select("*").gte("quando", anno).order("quando", { ascending: false }).range(da, da + 999);
        if (r.error) { errore = r.error; break; }
        tutti.push(...((r.data ?? []) as Evento[])); if ((r.data ?? []).length < 1000) break;
      }
      return { data: tutti, error: errore };
    };
    const [p, r, e, i] = await Promise.all([
      db().from("accessi_profili").select("*").order("creato_il", { ascending: false }),
      db().from("richieste_accesso").select("*").order("creata_il", { ascending: false }).limit(500),
      leggiRegistro(),
      db().from("impostazioni_admin").select("*"),
    ]);
    setProfili((p.data ?? []) as Profilo[]);
    setRichieste((r.data ?? []) as Richiesta[]);
    setEventi((e.data ?? []) as Evento[]);
    setErroreRegistro(e.error ? e.error.message : "");
    setImpostazioni(Object.fromEntries(((i.data ?? []) as { chiave: string; valore: string }[]).map((x) => [x.chiave, x.valore])));
    try { const m = await db().rpc("mappa_persone"); setPersone((m.data ?? []) as PersonaMappa[]); } catch { /* script della Mappa non ancora eseguito */ }
    // chi ha Authenticator: prima dal database (statistiche-admin.sql), poi dalla funzione gestione-accessi; se nessuna risponde il dato resta "non disponibile"
    let ids: string[] | null = null;
    try { const a = await db().rpc("admin_con_authenticator"); if (!a.error) ids = ((a.data ?? []) as unknown[]).map((x) => typeof x === "string" ? x : String((x as Record<string, unknown>)["admin_con_authenticator"] ?? "")); } catch { /* script non ancora eseguito */ }
    if (!ids) { try { const f = await gestione("fattori"); const l = f["conAuthenticator"]; if (Array.isArray(l)) ids = l as string[]; } catch { /* funzione non pubblicata */ } }
    setConAuth(ids ? new Set(ids) : null);
  }, []);
  useEffect(() => { void carica(); }, [carica]);

  const predefinite = (impostazioni["sezioni_predefinite"] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const inAttesa = richieste.filter((r) => r.stato === "in_attesa");
  const [periodo, setPeriodo] = useState<Periodo>("mese");
  const settimanaOra = numeroSettimana(new Date());
  const nomePeriodo = periodo === "settimana" ? (() => { const { barre } = barrePeriodo("settimana"); const f = (d: Date) => `${d.getDate()} ${MESI[d.getMonth()]}`; return `settimana lavorativa ${settimanaOra} (${f(barre[0]!.da)} – ${f(barre[barre.length - 1]!.da)})`; })() : PERIODI.find((x) => x.id === periodo)!.nome.toLowerCase();
  // nei conteggi solo gli utenti: gli accessi degli amministratori non contano (restano nel registro completo)
  const admin = useMemo(() => { const ids = new Set<string>(), mail = new Set<string>(); for (const p of profili) if (p.ruolo === "admin") { ids.add(p.utente); if (p.email) mail.add(p.email.toLowerCase()); } return { ids, mail }; }, [profili]);
  const accessiTutti = eventi.filter((e) => e.evento === "accesso" && !(e.utente && admin.ids.has(e.utente)) && !(e.email && admin.mail.has(e.email.toLowerCase())));
  const inizioPeriodo = useMemo(() => barrePeriodo(periodo).inizio, [periodo]);
  const accessi = accessiTutti.filter((e) => new Date(e.quando) >= inizioPeriodo);
  const nomePersona = useCallback((utente: string | null, email: string | null) => {
    const p = profili.find((x) => x.utente === utente);
    return (p?.nome || p?.mappa_persona || "").trim() || (email ?? "").split("@")[0]!.split(/[._-]/).filter(Boolean).reverse().map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(" ") || "—";
  }, [profili]);
  const perUtente = useMemo(() => {
    const m = new Map<string, { nome: string; n: number; ultimo: string }>();
    for (const e of accessi) { const k = e.utente ?? e.email ?? "—"; const x = m.get(k) ?? { nome: nomePersona(e.utente, e.email), n: 0, ultimo: e.quando }; x.n++; if (e.quando > x.ultimo) x.ultimo = e.quando; m.set(k, x); }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [accessi, nomePersona]);
  function esportaCsv() {
    const c = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const righe = [["Data", "Ora", "Giorno", "Settimana", "Persona", "Email", "App"].map(c).join(";")];
    for (const e of [...accessi].reverse()) { const d = new Date(e.quando); const app = (e.dettagli as Record<string, unknown> | null)?.["app"];
      righe.push([d.toLocaleDateString("it-IT"), d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }), GIORNI[d.getDay()], numeroSettimana(d), nomePersona(e.utente, e.email), e.email, app === "obo-hub" ? "OBO Hub" : app === "lps" ? "Progettazione LPS" : app ?? ""].map(c).join(";")); }
    righe.push("", [c("Persona"), c(`Accessi (${nomePeriodo})`), c("Ultimo accesso")].join(";"));
    for (const p of perUtente) righe.push([p.nome, p.n, data(p.ultimo)].map(c).join(";"));
    const blob = new Blob(["\ufeff" + righe.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `accessi-obo-hub-${periodo === "settimana" ? `settimana-${settimanaOra}` : periodo}-${chiaveGiorno(new Date())}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function azione(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setMsg("");
    try { await fn(); setMsg(ok); await carica(); } catch (e) { setMsg(e instanceof Error ? e.message : "Operazione non riuscita."); } finally { setBusy(false); }
  }
  async function salvaImpostazioni() {
    if (impostazioni["password_iniziale"] && impostazioni["password_iniziale"].length < 6) { setMsg("La password iniziale deve avere almeno 6 caratteri."); return; }
    await azione(async () => {
      const righe = Object.entries(impostazioni).filter(([chiave]) => !["manutenzione", "ultima_copia_sicurezza", "cartella_copie"].includes(chiave)).map(([chiave, valore]) => ({ chiave, valore })); // la manutenzione si gestisce da OBO Hub → Manutenzione app
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
      {erroreRegistro && <p className="mb-4 rounded-lg border-l-4 border-[#b3261e] bg-[#fdecea] p-3 text-sm">Il registro accessi non si legge ({erroreRegistro}): i conteggi degli accessi restano a 0. Esegui supabase/statistiche-admin.sql.</p>}
      {(() => { const g = giorniDallaCopia(impostazioni["ultima_copia_sicurezza"]); return g === null || g > 7 ? <p className="mb-4 rounded-lg border-l-4 border-[#b3261e] bg-[#fdecea] p-3 text-sm">{g === null ? "Non è ancora stata fatta una copia di sicurezza dei dati." : `L'ultima copia di sicurezza è di ${g} giorni fa.`} Scaricala dalla scheda <strong>Copia di sicurezza</strong> e salvala nella cartella SharePoint.</p> : null; })()}
      {!impostazioni["password_iniziale"] && <p className="mb-4 rounded-lg border-l-4 border-[#b3261e] bg-[#fdecea] p-3 text-sm">Imposta la <strong>password iniziale comune</strong> nella scheda Impostazioni prima di approvare le richieste.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Kpi titolo="Richieste in attesa" valore={inAttesa.length} evidenzia={inAttesa.length > 0} />
        <Kpi titolo="Utenti attivi" valore={profili.filter((p) => p.stato === "attivo" && p.ruolo !== "admin").length} nota={`più ${profili.filter((p) => p.ruolo === "admin").length} amministratori`} />
        <Kpi titolo="Accessi oggi" valore={accessiTutti.filter((e) => chiaveGiorno(new Date(e.quando)) === chiaveGiorno(new Date())).length} />
        <Kpi titolo="Accessi nel periodo" valore={accessi.length} nota={nomePeriodo} />
        <Kpi titolo="Persone attive nel periodo" valore={perUtente.length} nota={nomePeriodo} />
        <Kpi titolo="Senza Authenticator" valore={conAuth ? profili.filter((p) => !conAuth.has(p.utente)).length : "?"} nota={conAuth ? "non hanno ancora completato il primo accesso" : "dato non disponibile: esegui supabase/statistiche-admin.sql"} />
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border-[0.8px] border-bordo-scheda p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Accessi degli utenti · {nomePeriodo} <span className="font-normal text-muted-foreground">({accessi.length}, amministratori esclusi)</span></h2>
            <Button variant="outline" size="sm" disabled={!accessi.length} onClick={esportaCsv}><Download strokeWidth={1.5} />Esporta CSV</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Periodo">
            {PERIODI.map((x) => <button key={x.id} type="button" onClick={() => setPeriodo(x.id)} aria-pressed={periodo === x.id}
              className={`rounded-full border-[0.8px] px-3 py-1 text-sm ${periodo === x.id ? "border-primary bg-primary text-primary-foreground" : "border-bordo-scheda hover:border-primary"}`}>{x.id === "settimana" ? `${x.nome} ${settimanaOra}` : x.nome}</button>)}
          </div>
          <div className="mt-5"><GraficoAccessi accessi={accessiTutti} periodo={periodo} /></div>
        </div>
        <div className="rounded-lg border-[0.8px] border-bordo-scheda p-4"><h2 className="font-semibold">Persone attive · {nomePeriodo}</h2>
          <ul className="mt-3 space-y-2">{perUtente.map((p) => <li key={p.nome + p.ultimo} className="text-sm"><div className="flex justify-between gap-2"><span className="truncate">{p.nome}</span><span className="font-mono">{p.n}</span></div><div className="mt-0.5 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(p.n / (perUtente[0]?.n ?? 1)) * 100}%` }} /></div><p className="mt-0.5 text-xs text-muted-foreground">ultimo accesso {data(p.ultimo)}</p></li>)}</ul>
          {!perUtente.length && <p className="mt-3 text-sm text-muted-foreground">Nessun accesso nel periodo.</p>}
        </div>
      </section>

      <Tabs defaultValue={inAttesa.length ? "richieste" : "utenti"} className="mt-8">
        <TabsList className="h-auto flex-wrap"><TabsTrigger value="richieste">Richieste{inAttesa.length ? ` (${inAttesa.length})` : ""}</TabsTrigger><TabsTrigger value="utenti">Utenti ({profili.length})</TabsTrigger><TabsTrigger value="invita">Invita</TabsTrigger><TabsTrigger value="progetti">Progetti salvati</TabsTrigger><TabsTrigger value="registro">Registro accessi</TabsTrigger><TabsTrigger value="uso">Uso delle app</TabsTrigger><TabsTrigger value="errori">Errori</TabsTrigger><TabsTrigger value="copia">Copia di sicurezza</TabsTrigger><TabsTrigger value="impostazioni">Impostazioni</TabsTrigger></TabsList>

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
              <td className="p-2">{!conAuth ? <span className="text-muted-foreground">?</span> : conAuth.has(p.utente) ? <span className="inline-flex items-center gap-1 text-[#1d7a45]"><ShieldCheck className="size-4" />Collegato</span> : <span className="inline-flex items-center gap-1 text-muted-foreground"><ShieldX className="size-4" />No</span>}</td>
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

        <TabsContent value="uso" className="mt-4"><UsoAdmin /></TabsContent>
        <TabsContent value="errori" className="mt-4"><ErroriAdmin nomePersona={nomePersona} /></TabsContent>
        <TabsContent value="copia" className="mt-4"><CopiaSicurezza ultima={impostazioni["ultima_copia_sicurezza"]} cartella={impostazioni["cartella_copie"]} onFatto={() => void carica()} /></TabsContent>

        <TabsContent value="impostazioni" className="mt-4 max-w-2xl space-y-5">
          <Campo etichetta="Email che riceve le richieste di accesso"><input className={inputCls} type="email" value={impostazioni["email_admin"] ?? ""} onChange={(e) => setImpostazioni({ ...impostazioni, email_admin: e.target.value })} /></Campo>
          <Campo etichetta="Password iniziale comune (almeno 6 caratteri, da cambiare al primo accesso)">
            <span className="flex gap-2"><input className={inputCls} type={mostraPw ? "text" : "password"} autoComplete="off" value={impostazioni["password_iniziale"] ?? ""} onChange={(e) => setImpostazioni({ ...impostazioni, password_iniziale: e.target.value })} /><Button type="button" variant="outline" size="icon" aria-label={mostraPw ? "Nascondi" : "Mostra"} onClick={() => setMostraPw(!mostraPw)}>{mostraPw ? <EyeOff /> : <Eye />}</Button></span>
          </Campo>
          <div><p className="mb-2 text-sm font-semibold">Sezioni proposte per i nuovi utenti</p><SceltaSezioni valore={predefinite} onChange={(v) => setImpostazioni({ ...impostazioni, sezioni_predefinite: v.join(",") })} /></div>
          <fieldset className="rounded-lg border-[0.8px] border-bordo-scheda p-4">
            <legend className="px-1 text-sm font-semibold">Cosa compare nella ricerca di OBO Hub</legend>
            <p className="mb-3 text-xs text-muted-foreground">Vale per tutti gli utenti e i visitatori; ognuno vede comunque solo le app, le sezioni e i progetti per cui è abilitato.</p>
            <div className="grid gap-2 sm:grid-cols-2">{TIPI_RICERCA.map(([id, nome, nota]) => { const scelti = tipiRicerca(impostazioni["ricerca"]); return <label key={id} className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={scelti.includes(id)} onChange={(e) => setImpostazioni({ ...impostazioni, ricerca: (e.target.checked ? [...scelti, id] : scelti.filter((x) => x !== id)).join(",") || "nessuno" })} />
              <span><span className="font-semibold">{nome}</span><span className="block text-xs text-muted-foreground">{nota}</span></span></label>; })}</div>
          </fieldset>
          <Button size="lg" disabled={busy} onClick={() => void salvaImpostazioni()}><Save strokeWidth={1.5} />Salva impostazioni</Button>
          <VisitatoriMappa />
          <p className="text-xs text-muted-foreground">La password iniziale è visibile solo agli amministratori. Ogni utente la cambia al primo accesso e collega Microsoft Authenticator: senza codice dell'app non si accede ai dati.</p>
        </TabsContent>
      </Tabs>
    </main>
  </>;
}
