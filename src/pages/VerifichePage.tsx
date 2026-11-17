import { useMemo, useState } from "react";
import { ArrowRight, FileDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { aggiornaEsteso, useEsteso } from "@/lib/statoProgetto";
import { useDatiEdificio } from "@/lib/progettoStore";
import { scarica } from "@/lib/esportazioni";
import {
  INTERVALLI_SEVERI, INTERVALLI_TIPICI, prossimeScadenze, riepilogo, scaduta, verificaSchema, vociPerTipo,
  type Esito, type TipoVerifica, type Verifica,
} from "@/calcoli/verifiche/verifiche";

const oggi = () => new Date().toISOString().slice(0, 10);
const ETICHETTE: Record<Exclude<Esito, "">, string> = { C: "Conforme", NC: "Non conforme", NA: "N.A." };
const COLORI: Record<Exclude<Esito, "">, string> = { C: "border-[#1d7a45] bg-[#e3f4ea] text-[#1d7a45]", NC: "border-[#b3261e] bg-[#fdecea] text-[#b3261e]", NA: "border-input bg-muted text-muted-foreground" };
const nuova = (tipo: TipoVerifica = "visiva"): Verifica => verificaSchema.parse({ id: crypto.randomUUID(), data: oggi(), tipo });

function Distintivo({ esito }: { esito: ReturnType<typeof riepilogo>["esito"] }) {
  const cls = esito === "conforme" ? "bg-[#e3f4ea] text-[#1d7a45]" : esito === "non conforme" ? "bg-[#fdecea] text-[#b3261e]" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${cls}`}>{esito}</span>;
}

export function VerifichePage() {
  const s = useEsteso(), d = useDatiEdificio();
  const [bozza, setBozza] = useState<Verifica | null>(null);
  const [msg, setMsg] = useState("");
  const intervalli = s.pianoVerifiche.intervalli ?? INTERVALLI_TIPICI[s.lpl];
  const scadenze = useMemo(() => prossimeScadenze(s.verifiche, intervalli, s.pianoVerifiche.critico), [s.verifiche, intervalli, s.pianoVerifiche.critico]);
  const ordinate = useMemo(() => [...s.verifiche].sort((a, b) => b.data.localeCompare(a.data)), [s.verifiche]);

  const piano = (p: Partial<typeof s.pianoVerifiche>) => aggiornaEsteso({ pianoVerifiche: { ...s.pianoVerifiche, ...p } });
  const intervallo = (k: keyof typeof intervalli, v: number) => { if (v > 0) piano({ intervalli: { ...intervalli, [k]: v } }); };

  function salva() {
    if (!bozza) return;
    const ok = verificaSchema.safeParse(bozza);
    if (!ok.success) { setMsg("Controlla la data della verifica (formato AAAA-MM-GG)."); return; }
    aggiornaEsteso({ verifiche: [...s.verifiche.filter((v) => v.id !== bozza.id), ok.data] });
    setBozza(null); setMsg("Verifica salvata nel progetto.");
  }
  function elimina(id: string) {
    if (!window.confirm("Eliminare questa verifica dal registro?")) return;
    aggiornaEsteso({ verifiche: s.verifiche.filter((v) => v.id !== id) });
  }
  async function dossier() {
    try { const { creaDossier } = await import("@/lib/dossierVerifiche"); scarica(await creaDossier(d, s, intervalli, scadenze), `dossier-LPS-${d.nomeProgetto || "progetto"}.pdf`); }
    catch { setMsg("Creazione del dossier non riuscita."); }
  }
  const imposta = (id: string, esito: Esito) => bozza && setBozza({ ...bozza, esiti: { ...bozza.esiti, [id]: { esito: bozza.esiti[id]?.esito === esito ? "" : esito, nota: bozza.esiti[id]?.nota ?? "" } } });
  const nota = (id: string, testo: string) => bozza && setBozza({ ...bozza, esiti: { ...bozza.esiti, [id]: { esito: bozza.esiti[id]?.esito ?? "", nota: testo } } });

  const sezioni = bozza ? [...new Set(vociPerTipo(bozza.tipo).map((v) => v.sezione))] : [];
  const r = bozza ? riepilogo(bozza) : null;

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Verifiche e dossier</h1>
      <p className="mt-2 max-w-3xl text-white/90">Piano delle verifiche periodiche dell'LPS, registro con checklist e misure, dossier tecnico in PDF (CEI EN IEC 62305-3, allegato E).</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button size="lg" onClick={() => { setBozza(nuova()); setMsg(""); }}>Nuova verifica <ArrowRight strokeWidth={1.5} /></Button>
        <Button size="lg" variant="outline" onClick={() => void dossier()}><FileDown strokeWidth={1.5} />Scarica dossier PDF</Button>
      </div>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      {msg && <p role="status" className="mb-4 border-l-4 border-primary px-3 text-sm">{msg}</p>}

      <section aria-label="Piano delle verifiche">
        <h2 className="text-[1.7rem] font-medium">Piano delle verifiche · LPL {s.lpl}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Campo etichetta="Visiva ogni (anni)"><input className={inputCls} type="number" min={0.5} step={0.5} value={intervalli.visiva} onChange={(e) => intervallo("visiva", Number(e.target.value))} /></Campo>
          <Campo etichetta="Completa ogni (anni)"><input className={inputCls} type="number" min={0.5} step={0.5} value={intervalli.completa} onChange={(e) => intervallo("completa", Number(e.target.value))} /></Campo>
          <Campo etichetta="Completa, sistemi critici (anni)"><input className={inputCls} type="number" min={0.5} step={0.5} value={intervalli.critica} onChange={(e) => intervallo("critica", Number(e.target.value))} /></Campo>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.pianoVerifiche.critico} onChange={(e) => piano({ critico: e.target.checked })} />Sistema critico</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={intervalli.visiva === INTERVALLI_SEVERI.visiva && intervalli.completa === INTERVALLI_SEVERI.completa} onChange={(e) => piano({ intervalli: e.target.checked ? INTERVALLI_SEVERI : null })} />Condizioni ambientali severe</label>
            {s.pianoVerifiche.intervalli && <Button size="sm" variant="link" className="justify-start p-0" onClick={() => piano({ intervalli: null })}>Ripristina valori tipici</Button>}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Sistema critico: strutture a rischio di esplosione, con impianti sensibili, uffici, edifici commerciali o con molte persone (verifica completa ogni anno). Edizione 2024 (D.7.2.2): a vista ogni anno, completa ogni 3 anni, uguale per tutte le classi; in condizioni ambientali severe (atmosfera corrosiva, forti sollecitazioni) a vista ogni 6 mesi e completa ogni anno; se manca l'esame a vista annuale la completa va fatta ogni 2 anni. Modificabili per prescrizioni locali.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {([["Prossima verifica visiva", scadenze.visiva], ["Prossima verifica completa", scadenze.completa]] as const).map(([t, data]) =>
            <div key={t} className={`rounded-lg border-[0.8px] p-4 ${scaduta(data, oggi()) ? "border-[#b3261e]" : "border-bordo-scheda"}`}>
              <p className="text-sm text-muted-foreground">{t}</p>
              <p className="mt-1 text-xl font-medium">{data ? new Date(data).toLocaleDateString("it-IT") : "Da programmare"}{scaduta(data, oggi()) && <span className="ml-2 text-sm text-[#b3261e]">scaduta</span>}</p>
            </div>)}
        </div>
      </section>

      {bozza && <section className="mt-10 rounded-lg border-[0.8px] border-primary p-5" aria-label="Verifica in corso">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-[1.7rem] font-medium">Verifica in corso</h2>{r && <Distintivo esito={r.esito} />}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Campo etichetta="Data"><input className={inputCls} type="date" value={bozza.data} onChange={(e) => setBozza({ ...bozza, data: e.target.value })} /></Campo>
          <Campo etichetta="Tipo"><select className={inputCls} value={bozza.tipo} onChange={(e) => setBozza({ ...bozza, tipo: e.target.value as TipoVerifica })}><option value="visiva">Visiva</option><option value="completa">Completa (con misure)</option><option value="straordinaria">Straordinaria (dopo fulmine o modifiche)</option></select></Campo>
          <Campo etichetta="Verificatore"><input className={inputCls} maxLength={200} value={bozza.verificatore} onChange={(e) => setBozza({ ...bozza, verificatore: e.target.value })} /></Campo>
          {bozza.tipo !== "visiva" && <>
            <Campo etichetta="Resistenza di terra misurata (Ω)"><input className={inputCls} type="number" min={0} step={0.01} value={bozza.resistenzaTerra ?? ""} onChange={(e) => setBozza({ ...bozza, resistenzaTerra: e.target.value === "" ? null : Number(e.target.value) })} /></Campo>
            <Campo etichetta="Continuità: valore massimo (Ω)"><input className={inputCls} type="number" min={0} step={0.01} value={bozza.continuitaMax ?? ""} onChange={(e) => setBozza({ ...bozza, continuitaMax: e.target.value === "" ? null : Number(e.target.value) })} /></Campo>
          </>}
        </div>
        {sezioni.map((sez) => <div key={sez} className="mt-6">
          <h3 className="font-bold">{sez}</h3>
          <ul className="mt-2 divide-y border-y">{vociPerTipo(bozza.tipo).filter((v) => v.sezione === sez).map((v) => {
            const e = bozza.esiti[v.id]?.esito ?? "";
            return <li key={v.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3"><span className="max-w-xl text-sm">{v.testo}</span>
                <span className="flex gap-2" role="group" aria-label={`Esito: ${v.testo}`}>{(["C", "NC", "NA"] as const).map((k) => <button key={k} type="button" aria-pressed={e === k} onClick={() => imposta(v.id, k)} className={`rounded-full border px-3 py-1 text-xs ${e === k ? COLORI[k] : "border-input bg-background text-foreground hover:border-primary"}`}>{ETICHETTE[k]}</button>)}</span></div>
              {(e === "NC" || bozza.esiti[v.id]?.nota) && <input aria-label={`Nota: ${v.testo}`} className={`${inputCls} mt-2 py-1.5 text-sm`} placeholder="Descrivi il difetto e l'intervento" maxLength={1000} value={bozza.esiti[v.id]?.nota ?? ""} onChange={(ev) => nota(v.id, ev.target.value)} />}
            </li>;
          })}</ul>
        </div>)}
        <Campo etichetta="Note generali"><textarea className={`${inputCls} mt-1 min-h-24`} maxLength={5000} value={bozza.note} onChange={(e) => setBozza({ ...bozza, note: e.target.value })} /></Campo>
        <div className="mt-4 flex flex-wrap gap-3"><Button onClick={salva}>Salva verifica</Button><Button variant="outline" onClick={() => setBozza(null)}>Annulla</Button></div>
      </section>}

      <section className="mt-10" aria-label="Registro delle verifiche">
        <h2 className="text-[1.7rem] font-medium">Registro delle verifiche</h2>
        {!ordinate.length ? <p className="mt-3 text-sm text-muted-foreground">Nessuna verifica registrata. Le verifiche si salvano nel progetto attivo.</p> :
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b text-left"><th className="p-2">Data</th><th className="p-2">Tipo</th><th className="p-2">Verificatore</th><th className="p-2 text-right">R terra</th><th className="p-2">Esito</th><th className="p-2" /></tr></thead>
            <tbody>{ordinate.map((v) => <tr key={v.id} className="border-b">
              <td className="p-2 font-mono">{new Date(v.data).toLocaleDateString("it-IT")}</td><td className="p-2">{v.tipo}</td><td className="p-2">{v.verificatore || "—"}</td>
              <td className="p-2 text-right font-mono">{v.resistenzaTerra !== null ? `${v.resistenzaTerra.toFixed(2)} Ω` : "—"}</td><td className="p-2"><Distintivo esito={riepilogo(v).esito} /></td>
              <td className="p-2 text-right"><span className="inline-flex gap-1"><Button size="icon" variant="ghost" aria-label="Modifica" onClick={() => { setBozza(v); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /></Button><Button size="icon" variant="ghost" aria-label="Elimina" onClick={() => elimina(v.id)}><Trash2 /></Button></span></td>
            </tr>)}</tbody>
          </table></div>}
      </section>
    </main>
  </>;
}
