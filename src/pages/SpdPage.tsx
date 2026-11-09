import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { CodiceObo } from "@/components/prodotti/CodiceObo";
import { useEsteso } from "@/lib/statoProgetto";
import { aggiornaComputo, useComputo, useDatiEdificio } from "@/lib/progettoStore";
import { useCatalogoObo } from "@/lib/catalogoObo";
import { CORRENTE_LPL, UW_CATEGORIA, candidati, requisitiIngresso, type Candidato, type Fasi, type Livello, type Livello2, type Sistema } from "@/calcoli/spd/sceltaSpd";

const f = (v: number, c = 1) => v.toLocaleString("it-IT", { maximumFractionDigits: c });
const TITOLI: Record<Livello2, { titolo: string; descrizione: string }> = {
  ingresso: { titolo: "Quadro generale (ingresso della linea)", descrizione: "SPD tipo 1 o 1+2: scarica la corrente di fulmine (10/350 µs) all'ingresso nell'edificio, LPZ 0→1." },
  sottoquadro: { titolo: "Sottoquadri", descrizione: "SPD tipo 2 nei quadri a più di 10 m dall'SPD d'ingresso, LPZ 1→2." },
  apparecchio: { titolo: "Apparecchi sensibili", descrizione: "SPD tipo 3 vicino agli apparecchi (entro circa 5 m), LPZ 2→3." },
};

export function SpdPage() {
  const s = useEsteso(), d = useDatiEdificio(), c = useComputo();
  const { catalogo, pronto } = useCatalogoObo();
  const lpl = (d.lplProgetto ?? s.lpl) as Livello;
  const [sistema, setSistema] = useState<Sistema>("TN-S");
  const [fasi, setFasi] = useState<Fasi>("trifase");
  const [servizi, setServizi] = useState(1);
  const [categoria, setCategoria] = useState<keyof typeof UW_CATEGORIA>("II");
  const [lps, setLps] = useState(true);
  const [sotto, setSotto] = useState(1);
  const [app, setApp] = useState(0);
  const [scelti, setScelti] = useState<Partial<Record<Livello2, string>>>({});
  const [msg, setMsg] = useState("");

  const req = requisitiIngresso(lpl, servizi, sistema, fasi, UW_CATEGORIA[categoria]);
  const prodotti = useMemo(() => (catalogo?.catalogo ?? []).filter((p) => p.categorie[0] === "surge-protection" && p.categorie[1] === "ac-power-supplies" && p.codice).map((p) => ({ codice: p.codice!, nome: p.nome, datiTecnici: p.datiTecnici })), [catalogo]);
  const elenco = useMemo(() => {
    const r: Partial<Record<Livello2, Candidato[]>> = {};
    for (const l of ["ingresso", "sottoquadro", "apparecchio"] as Livello2[]) r[l] = candidati(prodotti, l === "ingresso" && !lps ? "sottoquadro" : l, req, sistema, fasi);
    return r;
  }, [prodotti, req.iimpPolo, req.upMax, req.ucMin, sistema, fasi, lps]); // eslint-disable-line react-hooks/exhaustive-deps

  const quantita: Record<Livello2, number> = { ingresso: 1, sottoquadro: sotto, apparecchio: app };
  function salva() {
    const dispositivi = (["ingresso", "sottoquadro", "apparecchio"] as Livello2[]).flatMap((l) => {
      const scelto = elenco[l]?.find((x) => x.prodotto.codice === (scelti[l] ?? elenco[l]?.[0]?.prodotto.codice));
      return scelto && quantita[l] > 0 ? [{ codice: scelto.prodotto.codice, descrizione: `${scelto.prodotto.nome} – ${TITOLI[l].titolo}`, quantita: quantita[l] }] : [];
    });
    aggiornaComputo({ risultati: { ...c.risultati, spd: { dispositivi, descrizione: `Rete ${sistema} ${fasi}, LPL ${lpl}, Iimp ${f(req.iimpPolo)} kA/polo, Up ≤ ${f(req.upMax)} kV` } } });
    setMsg(`${dispositivi.length} tipi di SPD salvati nel progetto (computo materiali).`);
  }

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Scelta SPD</h1>
      <p className="mt-2 max-w-3xl text-white/90">Requisiti degli SPD per la linea di alimentazione (Iimp, Uc, Up) e scelta dei prodotti OBO adatti dal catalogo (CEI EN IEC 62305-4, CEI EN 61643-12).</p>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">Regola n. 1 della CEI EN IEC 62305-4:2024 (Allegato C): 50 % della corrente di fulmine dell'LPL nell'impianto di terra, divisa tra i servizi entranti e i conduttori della linea (CEI EN IEC 62305-1:2024, E.2). Con una linea e 4 conduttori si ottengono 12,5 / 18,75 / 25 kA (10/350) per LPL III-IV / II / I, come in Tab. B.7 della 62305-2. Da confrontare con lo schema reale dell'impianto.</p>

      <section className="mt-8" aria-label="Dati della rete">
        <h2 className="text-[1.7rem] font-medium">1 · Rete e apparecchi</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Campo etichetta="Sistema di distribuzione"><select className={inputCls} value={sistema} onChange={(e) => setSistema(e.target.value as Sistema)}>{(["TN-C", "TN-S", "TN-C-S", "TT"] as Sistema[]).map((x) => <option key={x}>{x}</option>)}</select></Campo>
          <Campo etichetta="Alimentazione"><select className={inputCls} value={fasi} onChange={(e) => setFasi(e.target.value as Fasi)}><option value="trifase">Trifase 230/400 V</option><option value="monofase">Monofase 230 V</option></select></Campo>
          <Campo etichetta="Servizi metallici entranti (energia, acqua, gas, telecom…)"><input className={inputCls} type="number" min={1} max={10} step={1} value={servizi} onChange={(e) => setServizi(Math.max(1, Number(e.target.value)))} /></Campo>
          <Campo etichetta="Categoria di tenuta degli apparecchi"><select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value as keyof typeof UW_CATEGORIA)}>{(Object.keys(UW_CATEGORIA) as (keyof typeof UW_CATEGORIA)[]).map((k) => <option key={k} value={k}>Categoria {k} · Uw {f(UW_CATEGORIA[k])} kV</option>)}</select></Campo>
          <Campo etichetta="Sottoquadri a più di 10 m"><input className={inputCls} type="number" min={0} step={1} value={sotto} onChange={(e) => setSotto(Math.max(0, Number(e.target.value)))} /></Campo>
          <Campo etichetta="Apparecchi sensibili da proteggere"><input className={inputCls} type="number" min={0} step={1} value={app} onChange={(e) => setApp(Math.max(0, Number(e.target.value)))} /></Campo>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={lps} onChange={(e) => setLps(e.target.checked)} />Edificio con LPS esterno o linea aerea entrante (serve SPD tipo 1 all'ingresso)</label>
      </section>

      <section className="mt-8 rounded-lg border-l-4 border-primary bg-muted p-4" role="status" aria-label="Requisiti">
        <p className="text-lg">LPL {lpl}: corrente di fulmine {CORRENTE_LPL[lpl]} kA → {lps ? <>Iimp ≥ <strong>{f(req.iimpPolo)} kA per polo</strong> ({f(req.iimpTotale)} kA sulla linea, {req.conduttori} conduttori)</> : "nessun SPD tipo 1 richiesto"}</p>
        <p className="mt-1">Uc ≥ <strong>{f(req.ucMin, 0)} V</strong> · Up ≤ <strong>{f(req.upMax)} kV</strong> (0,8 · Uw)</p>
      </section>

      {!pronto && <p className="mt-6 text-sm text-muted-foreground">Caricamento del catalogo OBO…</p>}
      {pronto && !catalogo && <p className="mt-6 text-sm">Catalogo OBO non disponibile.</p>}
      {catalogo && (["ingresso", "sottoquadro", "apparecchio"] as Livello2[]).filter((l) => quantita[l] > 0).map((l, i) => {
        const lista = (elenco[l] ?? []).slice(0, 6);
        const titolo = l === "ingresso" && !lps ? { titolo: "Quadro generale", descrizione: "Senza LPS né linee aeree: SPD tipo 2 all'ingresso." } : TITOLI[l];
        const sel = scelti[l] ?? lista[0]?.prodotto.codice;
        return <section key={l} className="mt-10" aria-label={titolo.titolo}>
          <h2 className="text-[1.7rem] font-medium">{i + 2} · {titolo.titolo} <span className="text-base text-muted-foreground">× {quantita[l]}</span></h2>
          <p className="mt-1 text-sm text-muted-foreground">{titolo.descrizione}</p>
          {!lista.length ? <p className="mt-3 text-sm text-[#b3261e]">Nessun prodotto del catalogo soddisfa tutti i requisiti: verificare le esecuzioni (poli, Iimp) o usare SPD coordinati su più livelli.</p> :
            <ul className="mt-3 space-y-2">{lista.map((x) => <li key={x.prodotto.codice}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-[0.8px] p-3 ${sel === x.prodotto.codice ? "border-primary bg-primary/5" : "border-bordo-scheda"}`}>
                <input type="radio" name={`spd-${l}`} className="mt-1" checked={sel === x.prodotto.codice} onChange={() => setScelti({ ...scelti, [l]: x.prodotto.codice })} />
                <span className="min-w-0 flex-1"><span className="font-medium">{x.prodotto.nome}</span> · <CodiceObo codice={x.prodotto.codice} /><span className="mt-1 block text-xs text-muted-foreground">{x.dati.tipo} · {x.dati.poli ?? "poli —"} · {x.note.join(" · ")}</span></span>
              </label>
            </li>)}</ul>}
        </section>;
      })}

      <div className="mt-8 flex flex-wrap items-center gap-3"><Button size="lg" onClick={salva} disabled={!catalogo}><Save strokeWidth={1.5} />Salva nel progetto</Button>{msg && <span role="status" className="text-sm">{msg}</span>}</div>
      <p className="mt-4 text-xs text-muted-foreground">Per linee dati, telecomunicazioni e impianti fotovoltaici usare le relative famiglie del catalogo Prodotti OBO (protezione MCR, dati, FV).</p>
    </main>
  </>;
}
