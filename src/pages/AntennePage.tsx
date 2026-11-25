/**
 * Progetto per antenne radiomobili (5G, stazioni radio base): asta di captazione sopra le antenne, distanza di
 * separazione, calata isolata isCon, misure su schermi dei cavi, SPD e terra. Prima versione, da completare con
 * i documenti tecnici in arrivo.
 */
import { Link } from "@tanstack/react-router";
import { RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { aggiornaEsteso, useEsteso } from "@/lib/statoProgetto";
import { useDatiEdificio } from "@/lib/progettoStore";
import { calcolaAntenne, DATI_INIZIALI, NOMI_SITO, type DatiAntenne, type TipoSito } from "@/calcoli/antenne/antenne";
import { ACCESSORI_ISCON, ISCON, ORDINE_ISCON, verificaIscon } from "@/calcoli/calate/iscon";
import type { Livello } from "@/calcoli/calate/separazione";

const f = (v: number, c = 2) => (Number.isFinite(v) ? v.toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }) : "—");

export function AntennePage() {
  const s = useEsteso(), de = useDatiEdificio();
  const d: DatiAntenne = { ...DATI_INIZIALI, lpl: ((de.lplProgetto ?? s.lpl) as Livello) || "III", ...(s.antenne ?? {}) };
  const set = (p: Partial<DatiAntenne>) => aggiornaEsteso({ antenne: { ...d, ...p }, tipologia: "antenne" });
  const r = calcolaAntenne(d);
  const num = (k: keyof DatiAntenne, etichetta: string, step = 0.1, min = 0) =>
    <Campo etichetta={etichetta}><input className={inputCls} type="number" min={min} step={step} value={d[k] as number} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<DatiAntenne>)} /></Campo>;

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><RadioTower className="size-5" />Antenne radiomobili · 5G · stazioni radio base</p>
      <h1 className="mt-2 text-3xl font-bold">Protezione contro i fulmini delle antenne</h1>
      <p className="mt-2 max-w-3xl text-white/90">Asta di captazione sopra le antenne con la sfera rotolante, distanza di separazione, calata isolata isCon, schermi dei cavi, SPD e terra (CEI EN IEC 62305-3 e 62305-4).</p>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">Sezione nuova, prima versione: i calcoli usano i metodi della CEI EN IEC 62305 già presenti nell'app (sfera rotolante, s = ki · kc / km · l). Sarà completata con i documenti tecnici specifici per le stazioni radio base.</p>

      <section className="mt-8" aria-label="Sito">
        <h2 className="text-[1.7rem] font-medium">1 · Sito e antenne</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Campo etichetta="Tipo di installazione"><select className={inputCls} value={d.tipo} onChange={(e) => set({ tipo: e.target.value as TipoSito })}>{(Object.keys(NOMI_SITO) as TipoSito[]).map((t) => <option key={t} value={t}>{NOMI_SITO[t]}</option>)}</select></Campo>
          <Campo etichetta="Livello di protezione (LPL)"><select className={inputCls} value={d.lpl} onChange={(e) => set({ lpl: e.target.value as Livello })}>{(["I", "II", "III", "IV"] as Livello[]).map((l) => <option key={l}>{l}</option>)}</select></Campo>
          {num("sommita", d.tipo === "tetto" ? "Sommità delle antenne sul tetto (m)" : "Sommità delle antenne da terra (m)", 0.5)}
          {num("sbraccio", "Bordo esterno delle antenne dall'asse dell'asta (m)", 0.05)}
          <Campo etichetta="Punta dell'asta sul piano (m, vuoto = calcolata)"><input className={inputCls} type="number" min={0} step={0.1} value={d.astaPunta ?? ""} placeholder={f(r.astaMinima, 1)} onChange={(e) => set({ astaPunta: e.target.value === "" ? null : Number(e.target.value) })} /></Campo>
          {d.tipo === "tetto" && <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={d.lpsEdificio} onChange={(e) => set({ lpsEdificio: e.target.checked })} />L'edificio ha già un LPS</label>}
        </div>
        <div className={`mt-4 rounded-lg border-l-4 p-4 ${r.protette ? "border-[#1d7a45] bg-[#e3f4ea] text-[#14532d]" : "border-[#b3261e] bg-[#fdecea] text-[#7a1f16]"}`} role="status">
          <p className="text-lg">Sfera r = {r.r} m · punta minima <strong>{f(r.astaMinima)} m</strong> sul piano ({f(r.astaMinima - d.sommita)} m sopra le antenne)</p>
          <p className="mt-1 text-sm">Con la punta a {f(r.asta)} m le antenne sono {r.protette ? "protette dalla fulminazione diretta" : "ESPOSTE: alza l'asta o avvicinala alle antenne"}.</p>
          <p className="mt-1 text-xs opacity-80">Bordo delle antenne a {f(d.sbraccio)} m dall'asse. Oltre l'altezza della sfera la sfera può toccare il palo di lato: per strutture alte la punta deve stare più in alto.</p>
        </div>
      </section>

      <section className="mt-10" aria-label="Separazione">
        <h2 className="text-[1.7rem] font-medium">2 · Asta isolata e calata isCon</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {num("lunghezzaCalata", "l: dalla punta al collegamento equipotenziale (m)", 0.5)}
          {num("numeroCalate", "Calate", 1, 1)}
          {num("distanzaReale", "Distanza reale asta–antenne (m)", 0.05)}
          <Campo etichetta={`ki (LPL ${d.lpl})`}><input className={inputCls} type="number" min={0.01} max={1} step={0.01} value={r.ki} onChange={(e) => set({ ki: Number(e.target.value) || null })} /></Campo>
        </div>
        <div className={`mt-4 rounded-lg border-l-4 p-4 ${r.separazioneOk ? "border-[#1d7a45] bg-[#e3f4ea] text-[#14532d]" : "border-[#b3261e] bg-[#fdecea] text-[#7a1f16]"}`} role="status">
          <p className="text-lg">s = {f(r.ki, 2)} · {f(r.kc, 2)} / 1 · {f(d.lunghezzaCalata, 1)} = <strong>{f(r.s, 3)} m</strong> in aria · distanza reale {f(d.distanzaReale)} m: {r.separazioneOk ? "verificata" : "NON verificata"}</p>
        </div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">Conduttore isolato</th><th className="p-2">Codici</th><th className="p-2 text-right">s equivalente in aria</th><th className="p-2">Esito con s = {f(r.s, 3)} m</th></tr></thead>
          <tbody>{ORDINE_ISCON.map((v) => { const e = verificaIscon(v, r.s); return <tr key={v} className={`border-b ${r.isconConsigliato === v ? "bg-primary/10 font-medium" : ""}`}>
            <td className="p-2">{ISCON[v].nome} ({ISCON[v].sigla}){r.isconConsigliato === v ? " · consigliato" : ""}</td>
            <td className="p-2 font-mono text-xs">{ISCON[v].codici.map((c) => `${c.codice} ${c.colore}`).join(", ")}</td>
            <td className="p-2 text-right font-mono">{f(e.sEq)} m</td>
            <td className="p-2"><span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${e.conforme ? "bg-[#e3f4ea] text-[#1d7a45]" : "bg-[#fdecea] text-[#b3261e]"}`}>{e.conforme ? "sufficiente" : "non sufficiente"}</span></td>
          </tr>; })}</tbody>
        </table></div>
        <p className="mt-2 text-xs text-muted-foreground">Distanze equivalenti dei conduttori isCon da confermare con le schede tecniche OBO. Accessori: {ACCESSORI_ISCON.map((a) => `${a.descrizione} (${a.codice})`).join(" · ")}.</p>
      </section>

      <section className="mt-10" aria-label="Linee e terra">
        <h2 className="text-[1.7rem] font-medium">3 · Cavi, SPD e terra</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {([["coassiali", "Cavi coassiali verso le antenne"], ["fibraDielettrica", "Fibra ottica dielettrica"], ["fibraMetallica", "Fibra con parti metalliche"], ["alimentazione", "Linea di alimentazione degli apparati"]] as const).map(([k, t]) =>
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={d.cavi[k]} onChange={(e) => set({ cavi: { ...d.cavi, [k]: e.target.checked } })} />{t}</label>)}
        </div>
        <ol className="mt-4 space-y-2">{r.misure.map((m, i) => <li key={i} className="flex gap-3 rounded-md border p-3 text-sm">
          <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.obbligatoria ? "bg-primary text-white" : "bg-muted"}`}>{m.obbligatoria ? "da fare" : "consiglio"}</span>
          <div><p>{m.testo}</p><p className="mt-0.5 text-xs text-muted-foreground">CEI EN IEC {m.rif}</p></div></li>)}</ol>
        <Campo etichetta="Note del progetto"><textarea className={`${inputCls} min-h-24`} maxLength={5000} value={d.note ?? ""} onChange={(e) => set({ note: e.target.value })} /></Campo>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link to="/rischio">Valutazione del rischio</Link></Button>
        <Button asChild variant="outline"><Link to="/spd">Scelta SPD</Link></Button>
        <Button asChild variant="outline"><Link to="/resistenza-terra">Impianto di terra</Link></Button>
      </div>
    </main>
  </>;
}
