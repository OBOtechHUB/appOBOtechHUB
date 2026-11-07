import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { aggiornaEsteso, useEsteso } from "@/lib/statoProgetto";
import { aggiornaComputo, aggiornaDati, useComputo, useDatiEdificio } from "@/lib/progettoStore";
import fattori from "@/dati/rischio/fattorePosizione.json";
import {
  AMBIENTE_LINEA, DESTINAZIONE, MISURE_CONTATTO, PAVIMENTO, PERICOLO_SPECIALE, POSA_LINEA, PROTEZIONE_INCENDIO, RISCHIO_INCENDIO, RT_R1, TIPO_LINEA,
  calcolaR1, protezioneMinima, type ClasseLps, type DatiRischio, type Opzione,
} from "@/calcoli/rischio/rischioR1";

const sci = (v: number) => (v === 0 ? "0" : v.toExponential(2).replace(".", ",").replace("e", " · 10^"));
const CLASSI: ClasseLps[] = ["nessuno", "IV", "III", "II", "I"];
const nomeClasse = (c: ClasseLps) => (c === "nessuno" ? "Nessuna" : `Livello ${c}`);

function Scelta({ etichetta, opzioni, valore, onChange }: { etichetta: string; opzioni: Opzione[]; valore: number; onChange: (v: number) => void }) {
  const id = opzioni.find((x) => x.valore === valore)?.id ?? opzioni[0]!.id;
  return <Campo etichetta={etichetta}><select className={inputCls} value={id} onChange={(e) => onChange(opzioni.find((x) => x.id === e.target.value)!.valore)}>{opzioni.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.valore}</option>)}</select></Campo>;
}

function Barra({ nome, valore, max }: { nome: string; valore: number; max: number }) {
  const w = valore > 0 && max > 0 ? Math.max(2, (Math.log10(valore) - Math.log10(max) + 6) / 6 * 100) : 0;
  return <div className="grid grid-cols-[3rem_1fr_7rem] items-center gap-2 text-sm"><span className="font-mono">{nome}</span><span className="h-2 rounded-full bg-muted"><span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, w)}%` }} /></span><span className="text-right font-mono text-xs">{sci(valore)}</span></div>;
}

export function RischioPage() {
  const s = useEsteso(), d = useDatiEdificio(), c = useComputo();
  const CD = fattori.find((f) => f.id === d.posizioneId)?.valore ?? 1;
  const iniziali: DatiRischio = {
    L: d.L || 20, W: d.W || 10, H: d.H || 8, NG: d.densita || 2, CD,
    linee: [{ nome: "Energia", lunghezza: 1000, posa: 0.5, ambiente: 0.5, tipo: 1, schermata: false }, { nome: "Telecomunicazioni", lunghezza: 1000, posa: 0.5, ambiente: 0.5, tipo: 1, schermata: false }],
    rt: 1e-2, LF: 1e-2, rp: 0.5, rf: 1e-2, hz: 1, misureContatto: 1, impiantiCritici: false, frazionePresenza: 1,
  };
  const salvati = (s.datiRischio ?? {}) as Partial<DatiRischio>;
  const dati: DatiRischio = { ...iniziali, ...salvati, L: d.L || salvati.L || iniziali.L, W: d.W || salvati.W || iniziali.W, H: d.H || salvati.H || iniziali.H, NG: d.densita || salvati.NG || iniziali.NG, CD };
  const aggiorna = (p: Partial<DatiRischio>) => aggiornaEsteso({ datiRischio: { ...dati, ...p } as unknown as Record<string, unknown> });
  const [prot, setProt] = useState<{ lps: ClasseLps; spd: ClasseLps }>({ lps: "nessuno", spd: "nessuno" });
  const [msg, setMsg] = useState("");

  const senza = useMemo(() => calcolaR1(dati, { lps: "nessuno", spd: "nessuno" }), [JSON.stringify(dati)]); // eslint-disable-line react-hooks/exhaustive-deps
  const con = useMemo(() => calcolaR1(dati, prot), [JSON.stringify(dati), prot]); // eslint-disable-line react-hooks/exhaustive-deps
  const minima = useMemo(() => protezioneMinima(dati), [JSON.stringify(dati)]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(...Object.values(senza.componenti), RT_R1);

  function usaLivello() {
    if (!minima || minima.protezione.lps === "nessuno") {
      aggiornaComputo({ risultati: { ...c.risultati, rischio: { esito: `R1 = ${sci(senza.R1)} ≤ RT: protezione non necessaria`, lpl: (d.lplProgetto ?? "IV") } } });
      setMsg("Esito salvato: per il rischio R1 la protezione non è necessaria.");
      return;
    }
    const lpl = minima.protezione.lps as "I" | "II" | "III" | "IV";
    aggiornaDati({ lplProgetto: lpl });
    aggiornaEsteso({ lpl });
    aggiornaComputo({ risultati: { ...c.risultati, rischio: { esito: `R1 = ${sci(senza.R1)} senza protezione → LPS e SPD di livello ${lpl}: R1 = ${sci(minima.esito.R1)} ≤ RT`, lpl } } });
    setMsg(`LPL ${lpl} impostato nel progetto: captazione, calate e SPD useranno questo livello.`);
  }

  const linea = (i: number, p: Partial<DatiRischio["linee"][number]>) => aggiorna({ linee: dati.linee.map((x, k) => (k === i ? { ...x, ...p } : x)) });

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Analisi del rischio</h1>
      <p className="mt-2 max-w-3xl text-white/90">Rischio di perdita di vite umane R1 con le sue componenti, confronto con il rischio tollerabile RT = 10⁻⁵ e livello di protezione minimo (CEI EN IEC 62305-2).</p>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">Struttura a zona unica, valori tipici delle tabelle della norma (modificabili). <strong>Da verificare con l'edizione 2024</strong>, che ha rivisto parte dell'impostazione: per strutture complesse servono più zone e la valutazione completa.</p>

      <section className="mt-8" aria-label="Struttura">
        <h2 className="text-[1.7rem] font-medium">1 · Struttura</h2>
        <p className="mt-1 text-sm text-muted-foreground">Dimensioni, densità di fulminazione e posizione vengono da <Link to="/dati-edificio" className="text-primary underline">Dati edificio</Link>.</p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          <p>L × W × H: <strong>{dati.L} × {dati.W} × {dati.H} m</strong></p>
          <p>NG: <strong>{dati.NG}</strong> fulmini/km²·anno</p>
          <p>CD: <strong>{CD}</strong></p>
          <p>AD: <strong>{Math.round(senza.AD).toLocaleString("it-IT")} m²</strong></p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Scelta etichetta="Destinazione d'uso (LF)" opzioni={DESTINAZIONE} valore={dati.LF} onChange={(v) => aggiorna({ LF: v })} />
          <Scelta etichetta="Pavimento esterno/interno (rt)" opzioni={PAVIMENTO} valore={dati.rt} onChange={(v) => aggiorna({ rt: v })} />
          <Scelta etichetta="Rischio d'incendio (rf)" opzioni={RISCHIO_INCENDIO} valore={dati.rf} onChange={(v) => aggiorna({ rf: v })} />
          <Scelta etichetta="Protezione antincendio (rp)" opzioni={PROTEZIONE_INCENDIO} valore={dati.rp} onChange={(v) => aggiorna({ rp: v })} />
          <Scelta etichetta="Pericolo particolare (hz)" opzioni={PERICOLO_SPECIALE} valore={dati.hz} onChange={(v) => aggiorna({ hz: v })} />
          <Scelta etichetta="Misure contro tensioni di contatto e passo" opzioni={MISURE_CONTATTO} valore={dati.misureContatto} onChange={(v) => aggiorna({ misureContatto: v })} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={dati.impiantiCritici} onChange={(e) => aggiorna({ impiantiCritici: e.target.checked })} />Guasti degli impianti interni mettono subito in pericolo la vita (ospedali, rischio di esplosione): include RC, RM, RW, RZ</label>
      </section>

      <section className="mt-10" aria-label="Linee entranti">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-[1.7rem] font-medium">2 · Linee entranti</h2><Button variant="outline" onClick={() => aggiorna({ linee: [...dati.linee, { nome: "Linea", lunghezza: 1000, posa: 0.5, ambiente: 0.5, tipo: 1, schermata: false }] })}><Plus />Aggiungi linea</Button></div>
        <div className="mt-4 space-y-4">{dati.linee.map((l, i) => <div key={i} className="grid items-end gap-3 rounded-lg border-[0.8px] border-bordo-scheda p-3 sm:grid-cols-6">
          <Campo etichetta="Nome"><input className={inputCls} value={l.nome} maxLength={60} onChange={(e) => linea(i, { nome: e.target.value })} /></Campo>
          <Campo etichetta="Lunghezza (m)"><input className={inputCls} type="number" min={0} max={1000} step={50} value={l.lunghezza} onChange={(e) => linea(i, { lunghezza: Math.min(1000, Number(e.target.value)) })} /></Campo>
          <Scelta etichetta="Posa (CI)" opzioni={POSA_LINEA} valore={l.posa} onChange={(v) => linea(i, { posa: v })} />
          <Scelta etichetta="Ambiente (CE)" opzioni={AMBIENTE_LINEA} valore={l.ambiente} onChange={(v) => linea(i, { ambiente: v })} />
          <Scelta etichetta="Tipo (CT)" opzioni={TIPO_LINEA} valore={l.tipo} onChange={(v) => linea(i, { tipo: v })} />
          <div className="flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={l.schermata} onChange={(e) => linea(i, { schermata: e.target.checked })} />Schermata</label><Button size="icon" variant="ghost" aria-label="Elimina linea" onClick={() => aggiorna({ linee: dati.linee.filter((_, k) => k !== i) })}><Trash2 /></Button></div>
        </div>)}</div>
        <p className="mt-2 text-xs text-muted-foreground">Lunghezza della linea fino al primo nodo (massimo 1000 m, valore cautelativo se sconosciuta).</p>
      </section>

      <section className="mt-10" aria-label="Risultati">
        <h2 className="text-[1.7rem] font-medium">3 · Risultati</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          <p>ND = <strong>{sci(senza.ND)}</strong></p><p>NM = <strong>{sci(senza.NM)}</strong></p><p>NL = <strong>{sci(senza.NL)}</strong></p><p>NI = <strong>{sci(senza.NI)}</strong></p>
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className={`rounded-lg border-l-4 p-4 ${senza.conforme ? "border-[#1d7a45] bg-[#e3f4ea]" : "border-[#b3261e] bg-[#fdecea]"}`}>
            <p className="font-semibold">Senza protezione: R1 = {sci(senza.R1)}</p>
            <p className="text-sm">{senza.conforme ? "R1 ≤ RT: la protezione non è necessaria per il rischio R1." : "R1 > RT: la struttura va protetta."}</p>
            <div className="mt-3 space-y-1.5">{Object.entries(senza.componenti).filter(([, v]) => v > 0).map(([k, v]) => <Barra key={k} nome={k} valore={v} max={max} />)}<Barra nome="RT" valore={RT_R1} max={max} /></div>
          </div>
          <div className="rounded-lg border-[0.8px] border-bordo-scheda p-4">
            <p className="font-semibold">Con protezione</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Campo etichetta="LPS (PB)"><select className={inputCls} value={prot.lps} onChange={(e) => setProt({ ...prot, lps: e.target.value as ClasseLps })}>{CLASSI.map((x) => <option key={x} value={x}>{nomeClasse(x)}</option>)}</select></Campo>
              <Campo etichetta="SPD coordinati (PEB, PSPD)"><select className={inputCls} value={prot.spd} onChange={(e) => setProt({ ...prot, spd: e.target.value as ClasseLps })}>{CLASSI.map((x) => <option key={x} value={x}>{nomeClasse(x)}</option>)}</select></Campo>
            </div>
            <p className={`mt-3 font-semibold ${con.conforme ? "text-[#1d7a45]" : "text-[#b3261e]"}`}>R1 = {sci(con.R1)} {con.conforme ? "≤" : ">"} RT</p>
          </div>
        </div>
        <div className="mt-6 rounded-lg border-l-4 border-primary bg-muted p-4" role="status">
          {minima
            ? <p className="text-lg">Protezione minima: <strong>{minima.protezione.lps === "nessuno" ? "non necessaria" : `LPS e SPD di livello ${minima.protezione.lps}`}</strong>{minima.protezione.lps !== "nessuno" && <> · R1 = {sci(minima.esito.R1)}</>}</p>
            : <p className="text-lg text-[#b3261e]">Nemmeno LPS e SPD di livello I bastano: servono misure aggiuntive (antincendio, misure contro le tensioni di contatto, schermature).</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3"><Button onClick={usaLivello} disabled={!minima}><Save strokeWidth={1.5} />{minima && minima.protezione.lps !== "nessuno" ? `Usa LPL ${minima.protezione.lps} nel progetto` : "Salva l'esito nel progetto"}</Button>{msg && <span className="text-sm">{msg}</span>}</div>
        </div>
      </section>
    </main>
  </>;
}
