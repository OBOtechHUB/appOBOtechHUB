import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { useEsteso } from "@/lib/statoProgetto";
import {
  OBIETTIVO_RACCOMANDATO, TERRENI_TIPICI, pratiche, resistenzaMaglia, resistenzaOrizzontale, resistenzaPicchetto,
  resistivitaWenner, stimaImpianto, diametroEquivalentePiatto,
} from "@/calcoli/terra/resistenzaTerra";

const fmt = (v: number | null | undefined, cifre = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("it-IT", { maximumFractionDigits: cifre, minimumFractionDigits: cifre }));
const lunghezza = (punti: [number, number, number][]) => punti.slice(1).reduce((s, p, i) => { const q = punti[i]!; return s + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }, 0);

function Numero({ etichetta, valore, onChange, passo = 0.1, min = 0 }: { etichetta: string; valore: number; onChange: (v: number) => void; passo?: number; min?: number }) {
  return <Campo etichetta={etichetta}><input className={inputCls} type="number" min={min} step={passo} value={Number.isFinite(valore) ? valore : ""} onChange={(e) => onChange(Number(e.target.value))} /></Campo>;
}

function Esito({ r }: { r: number }) {
  if (!Number.isFinite(r)) return <span className="text-muted-foreground">—</span>;
  const ok = r <= OBIETTIVO_RACCOMANDATO;
  return <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${ok ? "bg-[#e3f4ea] text-[#1d7a45]" : "bg-[#fdecea] text-[#b3261e]"}`}>{fmt(r)} Ω · {ok ? `≤ ${OBIETTIVO_RACCOMANDATO} Ω` : `> ${OBIETTIVO_RACCOMANDATO} Ω`}</span>;
}

export function ResistenzaTerraPage() {
  const s = useEsteso();
  const [rho, setRho] = useState(100);
  const [eta, setEta] = useState(0.8);
  // impianto
  const [metri, setMetri] = useState(60), [piatto, setPiatto] = useState(true), [larghezza, setLarghezza] = useState(0.03), [tondo, setTondo] = useState(0.01), [prof, setProf] = useState(0.7);
  const [nPicchetti, setNPicchetti] = useState(0), [lPicchetto, setLPicchetto] = useState(3), [dPicchetto, setDPicchetto] = useState(0.02);
  // calcoli singoli
  const [maglia, setMaglia] = useState({ A: 400, L: 120 });
  const [wenner, setWenner] = useState({ a: 2, R: 8 });

  const dalProgetto = useMemo(() => {
    const terra = s.conduttori.filter((c) => c.tipo === "terra" && c.sottotipo !== "uscita");
    return { metri: terra.reduce((t, c) => t + lunghezza(c.punti as [number, number, number][]), 0), picchetti: s.picchetti };
  }, [s.conduttori, s.picchetti]);
  const haProgetto = dalProgetto.metri > 0 || dalProgetto.picchetti.length > 0;

  function usaProgetto() {
    setMetri(Math.round(dalProgetto.metri * 10) / 10);
    setNPicchetti(dalProgetto.picchetti.length);
    if (dalProgetto.picchetti[0]) { setLPicchetto(dalProgetto.picchetti[0].lunghezza); setDPicchetto(dalProgetto.picchetti[0].diametro ?? 0.02); }
    if (s.terra) setProf(s.terra.profondita);
  }

  const stima = useMemo(() => {
    try {
      return stimaImpianto(rho, { metriOrizzontali: metri, larghezzaPiatto: piatto ? larghezza : null, diametroTondo: tondo, profondita: prof, picchetti: Array.from({ length: Math.max(0, Math.floor(nPicchetti)) }, () => ({ lunghezza: lPicchetto, diametro: dPicchetto })) }, eta);
    } catch (e) { return e instanceof Error ? e.message : "Dati non validi."; }
  }, [rho, metri, piatto, larghezza, tondo, prof, nPicchetti, lPicchetto, dPicchetto, eta]);

  const prova = (f: () => number) => { try { return f(); } catch { return Number.NaN; } };
  const dEq = piatto ? prova(() => diametroEquivalentePiatto(larghezza)) : tondo;

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Resistenza di terra</h1>
      <p className="mt-2 max-w-3xl text-white/90">Stima della resistenza del dispersore (picchetti, anello, fondazione, maglia) e resistività del terreno dalla misura Wenner. Valore raccomandato dalla CEI EN IEC 62305-3: indicativamente inferiore a {OBIETTIVO_RACCOMANDATO} Ω.</p>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <section aria-label="Terreno">
        <h2 className="text-[1.7rem] font-medium">1 · Terreno</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Numero etichetta="Resistività ρ (Ω·m)" valore={rho} onChange={setRho} passo={10} />
          <Campo etichetta="Valore indicativo"><select className={inputCls} value="" onChange={(e) => { const v = Number(e.target.value); if (v) setRho(v); }}>
            <option value="">Scegli un tipo di terreno…</option>
            {TERRENI_TIPICI.map((t) => <option key={t.nome} value={t.rho}>{t.nome} · {t.rho} Ω·m ({t.intervallo})</option>)}
          </select></Campo>
          <Numero etichetta="Coefficiente di utilizzo η (0–1)" valore={eta} onChange={setEta} passo={0.05} />
        </div>
        <div className="mt-4 rounded-lg border-[0.8px] border-bordo-scheda p-4">
          <h3 className="font-semibold">Misura Wenner</h3>
          <div className="mt-3 grid items-end gap-4 sm:grid-cols-4">
            <Numero etichetta="Distanza tra i picchetti a (m)" valore={wenner.a} onChange={(a) => setWenner({ ...wenner, a })} />
            <Numero etichetta="Resistenza letta R (Ω)" valore={wenner.R} onChange={(R) => setWenner({ ...wenner, R })} />
            <p className="text-lg">ρ = <strong>{fmt(prova(() => resistivitaWenner(wenner.a, wenner.R)), 1)}</strong> Ω·m</p>
            <Button variant="outline" onClick={() => { const v = prova(() => resistivitaWenner(wenner.a, wenner.R)); if (Number.isFinite(v)) setRho(Math.round(v)); }}>Usa questo valore</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Quattro picchetti allineati ed equidistanti (a); la profondità indagata è circa pari ad a.</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">I valori per tipo di terreno sono solo indicativi: la resistività varia con umidità, temperatura e stagione. Usa quando possibile un valore misurato.</p>
      </section>

      <section className="mt-10" aria-label="Impianto di terra">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[1.7rem] font-medium">2 · Impianto di terra</h2>
          {haProgetto
            ? <Button variant="outline" onClick={usaProgetto}>Usa l'impianto del progetto ({fmt(dalProgetto.metri, 1)} m · {dalProgetto.picchetti.length} picchetti)</Button>
            : <Link to="/edificio-3d" className="text-sm text-primary underline">Proponi l'impianto di terra in Edificio 3D</Link>}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Numero etichetta="Conduttore interrato / anello (m)" valore={metri} onChange={setMetri} passo={1} />
          <Numero etichetta="Profondità di posa (m)" valore={prof} onChange={setProf} passo={0.1} />
          <Campo etichetta="Conduttore"><select className={inputCls} value={piatto ? "piatto" : "tondo"} onChange={(e) => setPiatto(e.target.value === "piatto")}><option value="piatto">Piatto</option><option value="tondo">Tondo</option></select></Campo>
          {piatto
            ? <Numero etichetta="Larghezza piatto (m)" valore={larghezza} onChange={setLarghezza} passo={0.005} />
            : <Numero etichetta="Diametro tondo (m)" valore={tondo} onChange={setTondo} passo={0.001} />}
          <Numero etichetta="Numero picchetti" valore={nPicchetti} onChange={setNPicchetti} passo={1} />
          <Numero etichetta="Lunghezza picchetto (m)" valore={lPicchetto} onChange={setLPicchetto} passo={0.5} />
          <Numero etichetta="Diametro picchetto (m)" valore={dPicchetto} onChange={setDPicchetto} passo={0.001} />
        </div>
        <div className="mt-5 rounded-lg border-l-4 border-primary bg-muted p-4" role="status">
          {typeof stima === "string" ? <p className="text-destructive">{stima}</p> : <>
            <p className="flex flex-wrap items-center gap-3 text-lg">Resistenza stimata: <Esito r={stima.rTotale} /></p>
            <ul className="mt-2 space-y-1 text-sm">{stima.dettaglio.map((d) => <li key={d}>{d}</li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">Diametro equivalente del conduttore: {fmt(dEq, 3)} m. Formule: Sunde (conduttore interrato), Dwight (picchetto); elementi in parallelo ridotti con η per l'influenza reciproca.</p>
            {!stima.conforme && <p className="mt-2 text-sm">Per ridurre la resistenza: aggiungere picchetti (distanza ≥ 2 volte la lunghezza), allungare il dispersore o usare picchetti più profondi.</p>}
          </>}
        </div>
      </section>

      <section className="mt-10" aria-label="Calcoli singoli">
        <h2 className="text-[1.7rem] font-medium">3 · Calcoli singoli e confronto</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">Dispersore</th><th className="p-2">Dati</th><th className="p-2 text-right">Formula analitica</th><th className="p-2 text-right">Formula pratica</th></tr></thead>
          <tbody>
            <tr className="border-b"><td className="p-2">Picchetto</td><td className="p-2">L = {lPicchetto} m, Ø {dPicchetto * 1000} mm</td><td className="p-2 text-right font-mono">{fmt(prova(() => resistenzaPicchetto(rho, lPicchetto, dPicchetto)))} Ω</td><td className="p-2 text-right font-mono">{fmt(prova(() => pratiche.picchetto(rho, lPicchetto)))} Ω</td></tr>
            <tr className="border-b"><td className="p-2">Conduttore orizzontale</td><td className="p-2">L = {metri} m, h = {prof} m</td><td className="p-2 text-right font-mono">{fmt(prova(() => resistenzaOrizzontale(rho, metri, dEq, prof)))} Ω</td><td className="p-2 text-right font-mono">{fmt(prova(() => pratiche.orizzontale(rho, metri)))} Ω</td></tr>
            <tr className="border-b"><td className="p-2">Anello equivalente</td><td className="p-2">D = {fmt(metri / Math.PI, 1)} m</td><td className="p-2 text-right font-mono">{fmt(prova(() => resistenzaOrizzontale(rho, metri, dEq, prof)))} Ω</td><td className="p-2 text-right font-mono">{fmt(prova(() => pratiche.anello(rho, metri / Math.PI)))} Ω</td></tr>
            <tr className="border-b"><td className="p-2">Maglia</td><td className="p-2"><span className="inline-flex flex-wrap items-center gap-2">A <input aria-label="Area maglia" className="w-20 rounded border px-2 py-1" type="number" value={maglia.A} onChange={(e) => setMaglia({ ...maglia, A: Number(e.target.value) })} /> m² · L <input aria-label="Lunghezza maglia" className="w-20 rounded border px-2 py-1" type="number" value={maglia.L} onChange={(e) => setMaglia({ ...maglia, L: Number(e.target.value) })} /> m</span></td><td className="p-2 text-right font-mono">{fmt(prova(() => resistenzaMaglia(rho, maglia.A, maglia.L)))} Ω</td><td className="p-2 text-right font-mono">{fmt(prova(() => pratiche.maglia(rho, Math.sqrt((4 * maglia.A) / Math.PI))))} Ω</td></tr>
          </tbody>
        </table></div>
        <p className="mt-2 text-xs text-muted-foreground">Formule pratiche di confronto: EN 50522, allegato J. Le stime valgono per terreno omogeneo; il valore va confermato con misura in opera.</p>
      </section>
    </main>
  </>;
}
