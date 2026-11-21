/**
 * Staffaggi OBO: progetto con più tratte; per ogni tratta tipologia, misure, piani di passerelle e carichi,
 * verifiche con le tabelle OBO, sezione quotata, vista 3D, distinta con codici e prezzi, uscite (Excel, Word, DXF, PDF).
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Copy, FolderOpen, Plus, Save, Trash2, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampoNumero } from "@/components/CampoNumero";
import { useAccesso } from "@/lib/accesso";
import { calcolaTratta, suggerimenti, type RisultatoTratta } from "@/calcoli/staffaggi/calcolo";
import { sezioneSupporto } from "@/calcoli/staffaggi/disegno";
import { FINITURE, SERIE_PASSERELLE, TIPOLOGIE, nuovaTratta, pianoSchema, type ProgettoStaffaggi, type Tipologia, type Tratta } from "@/calcoli/staffaggi/tipi";
import { apriProgetto, archiviaProgetto, elencoProgetti, leggiBozza, salvaBozza, salvaProgetto, type RigaProgetto } from "@/lib/staffaggi";
import { useCatalogoStaffaggi } from "@/lib/catalogoStaffaggi";
import { VistaSezione } from "@/components/staffaggi/VistaSezione";
import { Distinta } from "@/components/staffaggi/Distinta";
import { IconaTipologia } from "@/components/staffaggi/IconaTipologia";

const Vista3D = lazy(() => import("@/components/staffaggi/Vista3D"));
const cls = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
const fmt = (v: number, d = 2) => v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

function Campo({ etichetta, children, aiuto }: { etichetta: string; children: React.ReactNode; aiuto?: string }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium" title={aiuto}>{etichetta}</span>{children}</label>;
}

export function StaffaggiPage() {
  const accesso = useAccesso();
  const conAccount = accesso.stato === "abilitato" && !accesso.profilo?.visitatore;
  const iniziale = useMemo(() => leggiBozza(), []);
  const [id, setId] = useState<string | null>(iniziale.id);
  const [pr, setPr] = useState<ProgettoStaffaggi>(() => (iniziale.progetto.tratte.length ? iniziale.progetto : { ...iniziale.progetto, tratte: [nuovaTratta(1)] }));
  const [sel, setSel] = useState(0);
  const [vista, setVista] = useState<"sezione" | "3d">("sezione");
  const [msg, setMsg] = useState(""), [salvando, setSalvando] = useState(false);
  const [elenco, setElenco] = useState<RigaProgetto[] | null>(null);
  const catalogo = useCatalogoStaffaggi();
  const t = pr.tratte[Math.min(sel, pr.tratte.length - 1)]!;
  const risultati = useMemo(() => pr.tratte.map((x) => calcolaTratta(x, catalogo.datiPasserella)), [pr.tratte, catalogo]);
  const r = risultati[Math.min(sel, pr.tratte.length - 1)]!;
  const sezione = useMemo(() => sezioneSupporto(t, r), [t, r]);

  useEffect(() => { salvaBozza(id, pr); }, [id, pr]);
  // salvataggio automatico nel cloud dopo 3 s di pausa, per i progetti già salvati
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!id || !conAccount) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void salvaProgetto(id, pr).then(() => setMsg("Salvato"), (e: Error) => setMsg(e.message)); }, 3000);
    return () => window.clearTimeout(timer.current);
  }, [id, pr, conAccount]);

  const setT = (p: Partial<Tratta>) => setPr((v) => ({ ...v, tratte: v.tratte.map((x, i) => (i === sel ? { ...x, ...p } : x)) }));
  const setPiano = (k: number, p: Partial<Tratta["piani"][number]>) => setT({ piani: t.piani.map((x, i) => (i === k ? { ...x, ...p } : x)) });

  async function salva() {
    setSalvando(true); setMsg("");
    try { const nuovo = await salvaProgetto(id, pr); setId(nuovo); setMsg("Progetto salvato nel cloud."); } catch (e) { setMsg((e as Error).message); } finally { setSalvando(false); }
  }
  async function mostraElenco() {
    try { setElenco(await elencoProgetti()); } catch (e) { setMsg((e as Error).message); }
  }
  async function apri(r2: RigaProgetto) {
    try { const p = await apriProgetto(r2.id); setPr(p.tratte.length ? p : { ...p, tratte: [nuovaTratta(1)] }); setId(r2.id); setSel(0); setElenco(null); setMsg(`Aperto: ${r2.nome}`); } catch (e) { setMsg((e as Error).message); }
  }
  function nuovo() {
    if (!window.confirm("Iniziare un nuovo progetto? Il progetto attuale resta salvato (nel cloud se l'hai salvato).")) return;
    setPr({ ...pr, nome: "", codice: "", cliente: "", comune: "", tratte: [nuovaTratta(1)] }); setId(null); setSel(0); setMsg("");
  }

  const ko = risultati.filter((x) => x.esito === "ko").length;
  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Staffaggi OBO</h1>
          <p className="text-sm text-muted-foreground">Binari MS, mensole e passerelle KTS: configura il supporto, verifica i carichi con le tabelle OBO e scarica distinta, offerta, relazione e disegni.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={nuovo}><Plus />Nuovo</Button>
          {conAccount && <Button variant="outline" onClick={() => void mostraElenco()}><FolderOpen />I miei progetti</Button>}
          {conAccount && <Button onClick={() => void salva()} disabled={salvando}><Save />{id ? "Salva" : "Salva nel cloud"}</Button>}
        </div>
      </section>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {elenco && (
        <section className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">I miei progetti di staffaggio</h2><Button size="sm" variant="ghost" onClick={() => setElenco(null)}>Chiudi</Button></div>
          {!elenco.length ? <p className="text-sm text-muted-foreground">Nessun progetto salvato.</p> : (
            <ul className="divide-y">{elenco.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><b>{x.codice ? `${x.codice} · ` : ""}{x.nome}</b>{x.cliente ? ` · ${x.cliente}` : ""} <span className="text-muted-foreground">· {new Date(x.modificato_il).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</span></span>
                <span className="flex gap-1"><Button size="sm" onClick={() => void apri(x)}>Apri</Button><Button size="sm" variant="ghost" title="Archivia (non si cancella)" onClick={() => void archiviaProgetto(x.id).then(mostraElenco)}><Archive /></Button></span>
              </li>))}</ul>)}
        </section>
      )}

      {/* dati del progetto */}
      <section className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Campo etichetta="Progetto"><input className={cls} value={pr.nome} maxLength={200} placeholder="es. Capannone logistico" onChange={(e) => setPr({ ...pr, nome: e.target.value })} /></Campo>
        <Campo etichetta="Numero CRM"><input className={cls} value={pr.codice} maxLength={60} onChange={(e) => setPr({ ...pr, codice: e.target.value })} /></Campo>
        <Campo etichetta="Cliente"><input className={cls} value={pr.cliente} maxLength={200} onChange={(e) => setPr({ ...pr, cliente: e.target.value })} /></Campo>
        <Campo etichetta="Comune"><input className={cls} value={pr.comune} maxLength={120} onChange={(e) => setPr({ ...pr, comune: e.target.value })} /></Campo>
        <Campo etichetta="Progettista"><input className={cls} value={pr.progettista} maxLength={120} onChange={(e) => setPr({ ...pr, progettista: e.target.value })} /></Campo>
      </section>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* tratte */}
        <nav aria-label="Tratte" className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tratte</h2>
          {pr.tratte.map((x, i) => {
            const e = risultati[i]!.esito;
            return (
              <button key={x.id} type="button" onClick={() => setSel(i)} className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${i === sel ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"}`}>
                {e === "ok" ? <CheckCircle2 className="size-4 shrink-0 text-green-600" /> : e === "ko" ? <XCircle className="size-4 shrink-0 text-red-600" /> : <HelpCircle className="size-4 shrink-0 text-amber-600" />}
                <span className="min-w-0 flex-1 truncate">{x.nome}</span><span className="text-xs text-muted-foreground">{fmt(x.lunghezza, 0)} m</span>
              </button>);
          })}
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => { setPr({ ...pr, tratte: [...pr.tratte, nuovaTratta(pr.tratte.length + 1)] }); setSel(pr.tratte.length); }}><Plus />Nuova</Button>
            <Button size="sm" variant="outline" title="Duplica la tratta" onClick={() => { setPr({ ...pr, tratte: [...pr.tratte, { ...t, id: nuovaTratta().id, nome: `${t.nome} (copia)` }] }); setSel(pr.tratte.length); }}><Copy /></Button>
            {pr.tratte.length > 1 && <Button size="sm" variant="ghost" title="Togli la tratta dal progetto" onClick={() => { if (window.confirm(`Togliere "${t.nome}" dal progetto?`)) { setPr({ ...pr, tratte: pr.tratte.filter((_, i) => i !== sel) }); setSel(0); } }}><Trash2 /></Button>}
          </div>
          {ko > 0 && <p className="text-xs text-red-700">{ko} {ko === 1 ? "tratta non verificata" : "tratte non verificate"}</p>}
        </nav>

        <div className="min-w-0 space-y-5">
          {/* tipologia */}
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3"><input className={`${cls} max-w-xs font-semibold`} value={t.nome} maxLength={120} aria-label="Nome della tratta" onChange={(e) => setT({ nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Tipologia di staffaggio">
              {(Object.keys(TIPOLOGIE) as Tipologia[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={t.tipologia === k} onClick={() => setT({ tipologia: k })} className={`rounded-lg border p-2 text-left text-xs transition-colors ${t.tipologia === k ? "border-primary bg-primary/10" : "hover:bg-muted"}`}>
                  <IconaTipologia tipo={k} className="mb-1 h-14 w-full" />
                  <b className="block text-[13px] leading-tight">{TIPOLOGIE[k].nome}</b>
                </button>))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Campo etichetta="Lunghezza tratta (m)"><CampoNumero className={cls} valore={t.lunghezza} min={0.5} max={5000} onValore={(v) => v != null && setT({ lunghezza: v })} /></Campo>
              <Campo etichetta="Interasse supporti (m)" aiuto="Distanza tra due supporti consecutivi"><CampoNumero className={cls} valore={t.interasse} min={0.3} max={6} onValore={(v) => v != null && setT({ interasse: v })} /></Campo>
              <Campo etichetta={t.tipologia === "pavimento" || t.tipologia === "portale" ? "Altezza primo piano (m)" : t.tipologia === "parete-mensola" ? "Quota (informativa, m)" : "Distanza dal soffitto (m)"}><CampoNumero className={cls} valore={t.altezzaStaffa} min={0.1} max={10} onValore={(v) => v != null && setT({ altezzaStaffa: v })} /></Campo>
              <Campo etichetta="Distanza tra piani (mm)"><CampoNumero className={cls} valore={t.distanzaPiani} min={100} max={1500} onValore={(v) => v != null && setT({ distanzaPiani: v })} /></Campo>
              <Campo etichetta="Profilato"><select className={cls} value={t.profilato} onChange={(e) => setT({ profilato: e.target.value as Tratta["profilato"] })}><option value="MS4121">MS 41x21</option><option value="MSL4141">MSL 41x41</option><option value="MS4141">MS 41x41</option></select></Campo>
              <Campo etichetta="Finitura"><select className={cls} value={t.finitura} onChange={(e) => setT({ finitura: e.target.value as Tratta["finitura"] })}>{Object.entries(FINITURE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
            </div>
          </section>

          {/* piani */}
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Piani di passerelle (dall'alto)</h2>
              {t.piani.length < 6 && <Button size="sm" variant="outline" onClick={() => setT({ piani: [...t.piani, pianoSchema.parse({})] })}><Plus />Piano</Button>}</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-1">N.</th><th className="p-1">Passerella</th><th className="p-1">Larghezza (mm)</th><th className="p-1">Bordo (mm)</th><th className="p-1">Cavi (kg/m)</th><th className="p-1">Coperchio</th><th className="p-1">Carico su supporto</th><th /></tr></thead>
                <tbody>{t.piani.map((p, k) => (
                  <tr key={k} className="border-b">
                    <td className="p-1 font-semibold">{k + 1}</td>
                    <td className="p-1"><select className={cls} value={p.serie} onChange={(e) => setPiano(k, { serie: e.target.value as typeof p.serie })}>{Object.entries(SERIE_PASSERELLE).map(([s, v]) => <option key={s} value={s}>{v.nome}</option>)}</select></td>
                    <td className="p-1"><select className={cls} value={p.larghezza} onChange={(e) => setPiano(k, { larghezza: Number(e.target.value) })}>{[50, 75, 100, 150, 200, 300, 400, 500, 600].map((w) => <option key={w} value={w}>{w}</option>)}</select></td>
                    <td className="p-1"><select className={cls} value={p.altezza} onChange={(e) => setPiano(k, { altezza: Number(e.target.value) })}>{[35, 60, 85, 110].map((h) => <option key={h} value={h}>{h}</option>)}</select></td>
                    <td className="p-1"><CampoNumero className={cls} valore={p.caricoCavi} min={0} max={500} onValore={(v) => v != null && setPiano(k, { caricoCavi: v })} /></td>
                    <td className="p-1 text-center"><input type="checkbox" className="size-5" checked={p.coperchio} onChange={(e) => setPiano(k, { coperchio: e.target.checked })} aria-label={`Coperchio piano ${k + 1}`} /></td>
                    <td className="p-1 font-mono text-xs">{fmt(r.carichi[k]?.F ?? 0)} kN{r.carichi[k]?.pesoStimato ? " *" : ""}</td>
                    <td className="p-1">{t.piani.length > 1 && <Button size="sm" variant="ghost" aria-label={`Togli il piano ${k + 1}`} onClick={() => setT({ piani: t.piani.filter((_, i) => i !== k) })}><Trash2 /></Button>}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Campo etichetta="Carico extra per supporto (kg)" aiuto="Es. tubazioni o apparecchi appesi al piano più basso"><CampoNumero className={cls} valore={t.caricoExtra} min={0} max={500} onValore={(v) => v != null && setT({ caricoExtra: v })} /></Campo>
              <Campo etichetta="Note della tratta"><input className={cls} value={t.note} maxLength={1000} onChange={(e) => setT({ note: e.target.value })} /></Campo>
            </div>
            {r.avvisi.map((a) => <p key={a} className="mt-2 text-xs text-muted-foreground">* {a}</p>)}
          </section>

          {/* risultati */}
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Verifiche</h2>
                <span className={`rounded px-2 py-0.5 text-sm font-semibold ${r.esito === "ok" ? "bg-green-600/15 text-green-800" : r.esito === "ko" ? "bg-red-600/15 text-red-800" : "bg-amber-500/20 text-amber-900"}`}>
                  {r.esito === "ok" ? "Verificato" : r.esito === "ko" ? "Non verificato" : "Da completare"} · {r.supporti} supporti · {fmt(r.Ftotale)} kN per supporto
                </span>
              </div>
              <ul className="space-y-2">{r.verifiche.map((v, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2"><span><b>{v.elemento}</b> <span className="text-muted-foreground">· {v.grandezza}</span></span>
                    <span className="whitespace-nowrap font-mono text-xs">{fmt(v.valore)}{v.ammesso != null ? ` / ${fmt(v.ammesso)}` : ""} {v.unita}</span></div>
                  <div className="mt-1 h-2 rounded bg-muted" aria-hidden="true">{v.sfruttamento != null && <div className={`h-2 rounded ${v.esito === "ok" ? (v.sfruttamento > 0.85 ? "bg-amber-500" : "bg-green-600") : "bg-red-600"}`} style={{ width: `${Math.min(100, v.sfruttamento * 100)}%` }} />}</div>
                  <p className="text-xs text-muted-foreground">{v.esito === "nd" ? "Da verificare: " : v.sfruttamento != null ? `Sfruttamento ${Math.round(v.sfruttamento * 100)} % · ` : ""}{v.fonte}{v.nota ? ` · ${v.nota}` : ""}</p>
                </li>))}</ul>
              {suggerimenti(t, r).map((s) => <p key={s} className="mt-3 rounded border-l-4 border-primary bg-primary/10 px-3 py-2 text-sm">{s}</p>)}
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center gap-2" role="tablist">
                <Button size="sm" role="tab" aria-selected={vista === "sezione"} variant={vista === "sezione" ? "default" : "outline"} onClick={() => setVista("sezione")}>Sezione quotata</Button>
                <Button size="sm" role="tab" aria-selected={vista === "3d"} variant={vista === "3d" ? "default" : "outline"} onClick={() => setVista("3d")}>Vista 3D</Button>
              </div>
              {vista === "sezione" ? <VistaSezione sezione={sezione} /> : <Suspense fallback={<p className="p-8 text-center text-sm text-muted-foreground">Caricamento della vista 3D…</p>}><Vista3D tratta={t} risultato={r} /></Suspense>}
            </div>
          </section>

          <Distinta progetto={pr} risultati={risultati} catalogo={catalogo} />
        </div>
      </div>
    </main>
  );
}

export type { RisultatoTratta };
