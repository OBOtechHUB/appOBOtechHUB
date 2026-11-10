import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { SchemaKc } from "@/components/schemi/SchemiLps";
import { aggiornaEsteso, useEsteso } from "@/lib/statoProgetto";
import { aggiornaComputo, useComputo, useDatiEdificio } from "@/lib/progettoStore";
import {
  KI, KM, NOMI_MATERIALE, distanzaSeparazione, kcDettagliato, kcDettagliatoNelCampo, kcSemplificato, numeroCalate, passoCalate, perimetro, verificaPunti,
  type Livello, type Materiale,
} from "@/calcoli/calate/separazione";

const f = (v: number, c = 2) => (Number.isFinite(v) ? v.toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }) : "—");
const lunghezza = (p: [number, number, number][]) => p.slice(1).reduce((t, q, i) => { const a = p[i]!; return t + Math.hypot(q[0] - a[0], q[1] - a[1], q[2] - a[2]); }, 0);

export function CalatePage() {
  const s = useEsteso(), d = useDatiEdificio(), c = useComputo();
  const lpl: Livello = (d.lplProgetto ?? s.lpl) as Livello;
  const sep = s.separazione;
  const aggiorna = (p: Partial<typeof sep>) => aggiornaEsteso({ separazione: { ...sep, ...p } });

  const dalModello = useMemo(() => {
    const per = s.modello.corpi.reduce((t, b) => t + perimetro(b.impronta as [number, number][]), 0);
    const H = s.modello.corpi.reduce((m, b) => Math.max(m, b.altezzaGronda - b.quotaBase), 0);
    const calate = s.conduttori.filter((x) => x.tipo === "calata");
    return { perimetro: per || 2 * (d.L + d.W), H: H || d.H, calate: calate.length, metri: calate.reduce((t, x) => t + lunghezza(x.punti as [number, number, number][]), 0) };
  }, [s.modello, s.conduttori, d.L, d.W, d.H]);

  const [per, setPer] = useState<number | null>(null);
  const [H, setH] = useState<number | null>(null);
  const perimetroUsato = per ?? dalModello.perimetro;
  const altezza = H ?? dalModello.H;
  const nNorma = numeroCalate(perimetroUsato, lpl);
  const n = dalModello.calate || nNorma;
  const passo = n > 0 ? perimetroUsato / n : 0;
  const ki = sep.ki ?? KI[lpl];
  const km = { aria: KM.aria, solido: sep.kmSolido ?? KM.solido, frp: KM.frp };
  let kc = kcSemplificato(n), erroreKc = "";
  if (sep.modoKc === "dettagliato") { try { kc = kcDettagliato(n, passo, altezza); } catch (e) { erroreKc = e instanceof Error ? e.message : ""; } }
  const sTetto = altezza > 0 ? distanzaSeparazione(ki, kc, km.aria, altezza) : NaN;
  const esiti = verificaPunti(sep.punti, ki, kc, km);
  const [msg, setMsg] = useState("");

  function aggiungiPunto() { aggiorna({ punti: [...sep.punti, { id: crypto.randomUUID(), descrizione: "Impianto sul tetto", l: Math.round(altezza * 10) / 10 || 10, d: 0.5, materiale: "aria" }] }); }
  function punto(id: string, p: Partial<(typeof sep.punti)[number]>) { aggiorna({ punti: sep.punti.map((x) => (x.id === id ? { ...x, ...p } : x)) }); }
  function salva() {
    const sMax = Math.max(sTetto || 0, ...esiti.map((e) => e.s));
    aggiornaComputo({ risultati: { ...c.risultati, calate: { lunghezzaConduttori: dalModello.metri || n * altezza, numero: n, distanzaSeparazione: Math.round(sMax * 1000) / 1000 } } });
    setMsg("Risultato salvato nel progetto: il computo materiali usa numero e lunghezza delle calate.");
  }

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Calate e distanza di separazione</h1>
      <p className="mt-2 max-w-3xl text-white/90">Numero e passo delle calate, coefficiente kc e distanza di separazione s = ki · kc / km · l, con la verifica dei punti critici (CEI EN IEC 62305-3).</p>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">Valori della CEI EN IEC 62305-3:2024: ki (Tab. 11), km (Tab. 12, anche distanziatori FRP 0,7), kc (Tab. 13: 2 calate 0,66, 3 o più 0,44; Allegato B per il metodo dettagliato) e distanze tra le calate (Tab. 5).</p>

      <section className="mt-8" aria-label="Calate">
        <h2 className="text-[1.7rem] font-medium">1 · Calate · LPL {lpl}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Campo etichetta="Perimetro dell'edificio (m)"><input className={inputCls} type="number" min={0} step={1} value={Math.round(perimetroUsato * 10) / 10} onChange={(e) => setPer(Number(e.target.value))} /></Campo>
          <Campo etichetta="Altezza h (m)"><input className={inputCls} type="number" min={0} step={0.5} value={altezza} onChange={(e) => setH(Number(e.target.value))} /></Campo>
          <div className="rounded-lg border-[0.8px] border-bordo-scheda p-3 text-sm">
            <p>Passo tipico per LPL {lpl}: <strong>{passoCalate(lpl)} m</strong></p>
            <p>Calate richieste: <strong>{nNorma}</strong></p>
            <p>Calate nel progetto: <strong>{dalModello.calate || "nessuna"}</strong></p>
          </div>
        </div>
        {dalModello.calate > 0 && dalModello.calate < nNorma && <p className="mt-3 text-sm text-[#b3261e]">Il progetto ha meno calate di quelle richieste dal passo tipico ({dalModello.calate} su {nNorma}).</p>}
        {!dalModello.calate && <p className="mt-3 text-sm text-muted-foreground">Le calate vengono create dalla <Link to="/edificio-3d" className="text-primary underline">proposta di captazione</Link>; per ora si usa il numero richiesto ({nNorma}).</p>}
      </section>

      <section className="mt-10" aria-label="Coefficienti">
        <h2 className="text-[1.7rem] font-medium">2 · Coefficienti</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Campo etichetta={`ki (LPL ${lpl}, tipico ${KI[lpl]})`}><input className={inputCls} type="number" min={0.01} max={1} step={0.01} value={ki} onChange={(e) => aggiorna({ ki: Number(e.target.value) || null })} /></Campo>
          <Campo etichetta="km aria"><input className={inputCls} type="number" value={1} disabled /></Campo>
          <Campo etichetta={`km materiale solido (tipico ${KM.solido})`}><input className={inputCls} type="number" min={0.1} max={1} step={0.05} value={km.solido} onChange={(e) => aggiorna({ kmSolido: Number(e.target.value) || null })} /></Campo>
          <Campo etichetta="Calcolo di kc"><select className={inputCls} value={sep.modoKc} onChange={(e) => aggiorna({ modoKc: e.target.value as "semplificato" | "dettagliato" })}><option value="semplificato">Semplificato (1 · 0,66 · 0,44)</option><option value="dettagliato">Dettagliato (anello / fondazione)</option></select></Campo>
        </div>
        {(sep.ki !== null || sep.kmSolido !== null) && <Button variant="link" className="mt-1 p-0" onClick={() => aggiorna({ ki: null, kmSolido: null })}>Ripristina valori tipici</Button>}
        <div className="mt-4 rounded-lg border-l-4 border-primary bg-muted p-4" role="status">
          <p className="text-lg">kc = <strong>{f(kc, 3)}</strong> · s (in aria, l = h = {f(altezza, 1)} m) = <strong>{f(sTetto, 3)} m</strong></p>
          <p className="mt-1 text-xs text-muted-foreground">{sep.modoKc === "dettagliato" ? `kc = 1/(2n) + 0,1 + 0,2·(c/h)^(1/3) con n = ${n}, c = ${f(passo, 1)} m, h = ${f(altezza, 1)} m` : `kc semplificato per ${n} calate`}{erroreKc && ` · ${erroreKc}`}</p>
          {sep.modoKc === "dettagliato" && !erroreKc && !kcDettagliatoNelCampo(n, passo, altezza) && <p className="mt-1 text-xs font-medium text-[#b3261e]">Formula valida per almeno 4 calate e per c e h tra 3 e 20 m: fuori da questo campo usa il kc semplificato.</p>}
        </div>
        <div className="mt-4"><SchemaKc n={n} c={passo} h={altezza} kc={kc} /></div>
      </section>

      <section className="mt-10" aria-label="Punti critici">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-[1.7rem] font-medium">3 · Punti critici</h2><Button variant="outline" onClick={aggiungiPunto}><Plus />Aggiungi punto</Button></div>
        <p className="mt-1 text-sm text-muted-foreground">Parti metalliche o impianti vicini all'LPS (antenne, condizionatori, canali, impianti FV). l = lunghezza lungo l'LPS dal punto al più vicino collegamento equipotenziale; d = distanza reale.</p>
        {sep.punti.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">Descrizione</th><th className="p-2">l (m)</th><th className="p-2">Materiale</th><th className="p-2">d reale (m)</th><th className="p-2 text-right">s (m)</th><th className="p-2">Esito</th><th className="p-2" /></tr></thead>
          <tbody>{esiti.map((e) => <tr key={e.id} className="border-b">
            <td className="p-2"><input aria-label="Descrizione" className={`${inputCls} py-1.5`} value={e.descrizione} maxLength={200} onChange={(ev) => punto(e.id, { descrizione: ev.target.value })} /></td>
            <td className="p-2"><input aria-label="l" className={`${inputCls} w-24 py-1.5`} type="number" min={0} step={0.5} value={e.l} onChange={(ev) => punto(e.id, { l: Number(ev.target.value) })} /></td>
            <td className="p-2"><select aria-label="Materiale" className={`${inputCls} py-1.5`} value={e.materiale} onChange={(ev) => punto(e.id, { materiale: ev.target.value as Materiale })}>{(Object.keys(NOMI_MATERIALE) as Materiale[]).map((m) => <option key={m} value={m}>{m === "aria" ? "Aria" : m === "frp" ? "Distanziatore FRP (0,7)" : "Solido (0,5)"}</option>)}</select></td>
            <td className="p-2"><input aria-label="d" className={`${inputCls} w-24 py-1.5`} type="number" min={0} step={0.05} value={e.d} onChange={(ev) => punto(e.id, { d: Number(ev.target.value) })} /></td>
            <td className="p-2 text-right font-mono">{f(e.s, 3)}</td>
            <td className="p-2"><span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${e.conforme ? "bg-[#e3f4ea] text-[#1d7a45]" : "bg-[#fdecea] text-[#b3261e]"}`}>{e.conforme ? "d ≥ s" : "d < s"}</span></td>
            <td className="p-2"><Button size="icon" variant="ghost" aria-label="Elimina punto" onClick={() => aggiorna({ punti: sep.punti.filter((x) => x.id !== e.id) })}><Trash2 /></Button></td>
          </tr>)}</tbody>
        </table></div>}
        {esiti.some((e) => !e.conforme) && <p className="mt-3 text-sm">Dove d &lt; s: allontanare l'impianto, collegarlo all'LPS con un collegamento equipotenziale diretto, oppure usare un sistema isolato (es. conduttore isCon, aste isolate).</p>}
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-3"><Button size="lg" onClick={salva}><Save strokeWidth={1.5} />Salva nel progetto</Button>{msg && <span role="status" className="text-sm">{msg}</span>}</div>
    </main>
  </>;
}
