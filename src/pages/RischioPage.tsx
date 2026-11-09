import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { aggiornaEsteso, useEsteso } from "@/lib/statoProgetto";
import { aggiornaComputo, aggiornaDati, useComputo, useDatiEdificio } from "@/lib/progettoStore";
import fattori from "@/dati/rischio/fattorePosizione.json";
import {
  AMBIENTE_LINEA, CATEGORIE, MISURE_CONTATTO, PAVIMENTO, POSA_LINEA, PROTEZIONE_INCENDIO, RISCHIO_INCENDIO, RT_R1, SCHERMATURE, TIPO_LINEA, TIPO_STRUTTURA,
  calcolaR1, categoriaDi, protezioneMinima, spdMinimoFrequenza, type ClasseLps, type DatiRischio, type Opzione, type Schermatura,
} from "@/calcoli/rischio/rischioR1";

const sci = (v: number) => (v === 0 ? "0" : v.toExponential(2).replace(".", ",").replace("e", " · 10^"));
const CLASSI: ClasseLps[] = ["nessuno", "IV", "III", "II", "I"];
const nomeClasse = (c: ClasseLps) => (c === "nessuno" ? "Nessuna" : `Livello ${c}`);

function Scelta({ etichetta, opzioni, valore, onChange }: { etichetta: string; opzioni: Opzione[]; valore: number; onChange: (v: number) => void }) {
  const id = opzioni.find((x) => x.valore === valore)?.id ?? opzioni[0]!.id;
  return <Campo etichetta={etichetta}><select className={inputCls} value={id} onChange={(e) => onChange(opzioni.find((x) => x.id === e.target.value)!.valore)}>{opzioni.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.valore}</option>)}</select></Campo>;
}

/** Scelta per voce (non per valore): serve dove voci diverse hanno lo stesso valore (es. rf). */
function SceltaId({ etichetta, opzioni, id, onChange }: { etichetta: string; opzioni: Opzione[]; id: string; onChange: (id: string) => void }) {
  return <Campo etichetta={etichetta}><select className={inputCls} value={id} onChange={(e) => onChange(e.target.value)}>{opzioni.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.valore}</option>)}</select></Campo>;
}
const UW = [1, 1.5, 2.5, 4, 6];

function Barra({ nome, valore, max }: { nome: string; valore: number; max: number }) {
  const w = valore > 0 && max > 0 ? Math.max(2, (Math.log10(valore) - Math.log10(max) + 6) / 6 * 100) : 0;
  return <div className="grid grid-cols-[3rem_1fr_7rem] items-center gap-2 text-sm"><span className="font-mono">{nome}</span><span className="h-2 rounded-full bg-muted"><span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, w)}%` }} /></span><span className="text-right font-mono text-xs">{sci(valore)}</span></div>;
}

export function RischioPage() {
  const s = useEsteso(), d = useDatiEdificio(), c = useComputo();
  const CD = fattori.find((f) => f.id === d.posizioneId)?.valore ?? 1;
  const iniziali: DatiRischio = {
    L: d.L || 20, W: d.W || 10, H: d.H || 8, NG: d.densita || 2, CD,
    k: 2, Uw: 2.5,
    linee: [{ nome: "Energia", lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 1, schermata: false, schermatura: "no" }, { nome: "Telecomunicazioni", lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 1, schermata: false, schermatura: "no" }],
    rt: 1e-2, LF: 5e-2, categoria: "normale", rp: 1, rf: 1e-2, rfId: "ordinario", PS: 1, misureContatto: 1, impiantiCritici: false, danniMateriali: true, serviziCritici: false, frazionePresenza: 1,
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
  const spdF = useMemo(() => spdMinimoFrequenza(dati, prot.lps), [JSON.stringify(dati), prot.lps]); // eslint-disable-line react-hooks/exhaustive-deps
  const rfId = dati.rfId ?? RISCHIO_INCENDIO.find((x) => x.valore === dati.rf && !x.id.startsWith("esplosione-"))?.id ?? "ordinario";

  function usaLivello() {
    if (!minima || minima.protezione.lps === "nessuno") {
      aggiornaComputo({ risultati: { ...c.risultati, rischio: { esito: `R = ${sci(senza.R1)} ≤ RT: protezione non necessaria · F = ${sci(senza.F)} (FT = ${senza.FT})`, lpl: (d.lplProgetto ?? "IV") } } });
      setMsg("Esito salvato: per il rischio R la protezione non è necessaria.");
      return;
    }
    const lpl = minima.protezione.lps as "I" | "II" | "III" | "IV";
    aggiornaDati({ lplProgetto: lpl });
    aggiornaEsteso({ lpl });
    aggiornaComputo({ risultati: { ...c.risultati, rischio: { esito: `R = ${sci(senza.R1)} senza protezione → LPS e SPD di livello ${lpl}: R = ${sci(minima.esito.R1)} ≤ RT · F = ${sci(minima.esito.F)} (FT = ${minima.esito.FT})`, lpl } } });
    setMsg(`LPL ${lpl} impostato nel progetto: captazione, calate e SPD useranno questo livello.`);
  }

  const linea = (i: number, p: Partial<DatiRischio["linee"][number]>) => aggiorna({ linee: dati.linee.map((x, k) => (k === i ? { ...x, ...p } : x)) });

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Analisi del rischio</h1>
      <p className="mt-2 max-w-3xl text-white/90">Rischio R (vite umane L1 + danni materiali L2) con le sue componenti, confronto con RT = 10⁻⁵, frequenza del danno agli impianti interni F e livello di protezione minimo (CEI EN IEC 62305-2:2024).</p>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">Metodo dell'edizione 2024, struttura a <strong>zona unica</strong>, con i valori tipici delle tabelle della norma (Allegati A, B, C). Non sono considerate le persone esposte sul tetto (RAD) né le strutture adiacenti (NDJ). Per strutture complesse servono più zone e la valutazione completa.</p>

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
          <Campo etichetta="Coefficiente k (NSG = k · NG)"><input className={inputCls} type="number" min={1} max={4} step={0.1} value={dati.k ?? 2} onChange={(e) => aggiorna({ k: Math.max(1, Number(e.target.value) || 2) })} /></Campo>
          <Campo etichetta="Tensione di tenuta Uw degli impianti (kV)"><select className={inputCls} value={dati.Uw ?? 2.5} onChange={(e) => aggiorna({ Uw: Number(e.target.value) })}>{UW.map((u) => <option key={u} value={u}>{u.toLocaleString("it-IT")} kV</option>)}</select></Campo>
          <p className="self-end text-sm">NSG = <strong>{senza.NSG.toLocaleString("it-IT")}</strong> punti/km²·anno</p>
          <Campo etichetta="Categoria della struttura (perdite LF, LO)"><select className={inputCls} value={categoriaDi(dati).id} onChange={(e) => aggiorna({ categoria: e.target.value, LF: CATEGORIE.find((x) => x.id === e.target.value)!.LF })}>{CATEGORIE.map((x) => <option key={x.id} value={x.id}>{x.nome} · LF {x.LF}</option>)}</select></Campo>
          <Scelta etichetta="Pavimento esterno/interno (rt)" opzioni={PAVIMENTO} valore={dati.rt} onChange={(v) => aggiorna({ rt: v })} />
          <SceltaId etichetta="Rischio d'incendio o di esplosione (rf)" opzioni={RISCHIO_INCENDIO} id={rfId} onChange={(id) => aggiorna({ rfId: id, rf: RISCHIO_INCENDIO.find((x) => x.id === id)!.valore })} />
          <Scelta etichetta="Protezione antincendio (rp)" opzioni={PROTEZIONE_INCENDIO} valore={dati.rp} onChange={(v) => aggiorna({ rp: v })} />
          <Scelta etichetta="Tipo di struttura senza LPS (PS)" opzioni={TIPO_STRUTTURA} valore={dati.PS ?? 1} onChange={(v) => aggiorna({ PS: v })} />
          <Scelta etichetta="Misure contro tensioni di contatto e passo (PAM)" opzioni={MISURE_CONTATTO} valore={dati.misureContatto} onChange={(v) => aggiorna({ misureContatto: v })} />
          <Campo etichetta="Presenza di persone (ore/anno, PP = ore/8760)"><input className={inputCls} type="number" min={0} max={8760} step={10} value={Math.round(dati.frazionePresenza * 8760)} onChange={(e) => aggiorna({ frazionePresenza: Math.min(1, Math.max(0, Number(e.target.value) / 8760)) })} /></Campo>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={dati.danniMateriali !== false} onChange={(e) => aggiorna({ danniMateriali: e.target.checked })} />Considera anche i danni materiali alla struttura e al contenuto (L2): R = RL1 + RL2</label>
        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={dati.impiantiCritici} onChange={(e) => aggiorna({ impiantiCritici: e.target.checked })} />Guasti degli impianti interni mettono in pericolo la vita (ospedali, rischio di esplosione): include RC, RM, RW, RZ</label>
        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!dati.serviziCritici} onChange={(e) => aggiorna({ serviziCritici: e.target.checked })} />Impianti interni critici per il servizio (frequenza tollerabile FT = 0,1 invece di 1 all'anno)</label>
      </section>

      <section className="mt-10" aria-label="Linee entranti">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-[1.7rem] font-medium">2 · Linee entranti</h2><Button variant="outline" onClick={() => aggiorna({ linee: [...dati.linee, { nome: "Linea", lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 1, schermata: false, schermatura: "no" }] })}><Plus />Aggiungi linea</Button></div>
        <div className="mt-4 space-y-4">{dati.linee.map((l, i) => <div key={i} className="grid items-end gap-3 rounded-lg border-[0.8px] border-bordo-scheda p-3 sm:grid-cols-6">
          <Campo etichetta="Nome"><input className={inputCls} value={l.nome} maxLength={60} onChange={(e) => linea(i, { nome: e.target.value })} /></Campo>
          <Campo etichetta="Lunghezza (m)"><input className={inputCls} type="number" min={0} max={1000} step={50} value={l.lunghezza} onChange={(e) => linea(i, { lunghezza: Math.min(1000, Number(e.target.value)) })} /></Campo>
          <Scelta etichetta="Posa (CI)" opzioni={POSA_LINEA} valore={l.posa} onChange={(v) => linea(i, { posa: v })} />
          <Scelta etichetta="Ambiente (CE)" opzioni={AMBIENTE_LINEA} valore={l.ambiente} onChange={(v) => linea(i, { ambiente: v })} />
          <Scelta etichetta="Tipo (CT)" opzioni={TIPO_LINEA} valore={l.tipo} onChange={(v) => linea(i, { tipo: v })} />
          <div className="flex items-end justify-between gap-2"><Campo etichetta="Schermatura (PLD)"><select className={inputCls} value={l.schermatura ?? (l.schermata ? "1-5" : "no")} onChange={(e) => linea(i, { schermatura: e.target.value as Schermatura, schermata: e.target.value !== "no" })}>{SCHERMATURE.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></Campo><Button size="icon" variant="ghost" aria-label="Elimina linea" onClick={() => aggiorna({ linee: dati.linee.filter((_, k) => k !== i) })}><Trash2 /></Button></div>
        </div>)}</div>
        <p className="mt-2 text-xs text-muted-foreground">Lunghezza della linea fino al primo nodo (1000 m se sconosciuta). Schermatura: schermo collegato alla stessa barra equipotenziale delle apparecchiature.</p>
      </section>

      <section className="mt-10" aria-label="Risultati">
        <h2 className="text-[1.7rem] font-medium">3 · Risultati</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          <p>ND = <strong>{sci(senza.ND)}</strong></p><p>NM = <strong>{sci(senza.NM)}</strong></p><p>NL = <strong>{sci(senza.NL)}</strong></p><p>NI = <strong>{sci(senza.NI)}</strong></p>
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className={`rounded-lg border-l-4 p-4 ${senza.conforme ? "border-[#1d7a45] bg-[#e3f4ea]" : "border-[#b3261e] bg-[#fdecea]"}`}>
            <p className="font-semibold">Senza protezione: R = {sci(senza.R1)}</p>
            <p className="text-sm">RL1 (vite umane) = {sci(senza.RL1)} · RL2 (danni materiali) = {sci(senza.RL2)}</p>
            <p className="text-sm">{senza.conforme ? "R ≤ RT: la protezione non è necessaria per il rischio R." : "R > RT: la struttura va protetta."}</p>
            <div className="mt-3 space-y-1.5">{Object.entries(senza.componenti).filter(([, v]) => v > 0).map(([k, v]) => <Barra key={k} nome={k} valore={v} max={max} />)}<Barra nome="RT" valore={RT_R1} max={max} /></div>
          </div>
          <div className="rounded-lg border-[0.8px] border-bordo-scheda p-4">
            <p className="font-semibold">Con protezione</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Campo etichetta="LPS (PLPS)"><select className={inputCls} value={prot.lps} onChange={(e) => setProt({ ...prot, lps: e.target.value as ClasseLps })}>{CLASSI.map((x) => <option key={x} value={x}>{nomeClasse(x)}</option>)}</select></Campo>
              <Campo etichetta="SPD coordinati (PEB, PSPD)"><select className={inputCls} value={prot.spd} onChange={(e) => setProt({ ...prot, spd: e.target.value as ClasseLps })}>{CLASSI.map((x) => <option key={x} value={x}>{nomeClasse(x)}</option>)}</select></Campo>
            </div>
            <p className={`mt-3 font-semibold ${con.conforme ? "text-[#1d7a45]" : "text-[#b3261e]"}`}>R = {sci(con.R1)} {con.conforme ? "≤" : ">"} RT</p>
            <p className={`mt-1 text-sm font-semibold ${con.frequenzaConforme ? "text-[#1d7a45]" : "text-[#b3261e]"}`}>F = {sci(con.F)} {con.frequenzaConforme ? "≤" : ">"} FT = {con.FT.toLocaleString("it-IT")} all'anno</p>
            <p className="text-xs text-muted-foreground">FC {sci(con.frequenze.FC)} · FM {sci(con.frequenze.FM)} · FW {sci(con.frequenze.FW)} · FZ {sci(con.frequenze.FZ)}</p>
          </div>
        </div>
        <div className="mt-6 rounded-lg border-l-4 border-primary bg-muted p-4" role="status">
          {minima
            ? <p className="text-lg">Protezione minima: <strong>{minima.protezione.lps === "nessuno" ? "non necessaria" : `LPS e SPD di livello ${minima.protezione.lps}`}</strong>{minima.protezione.lps !== "nessuno" && <> · R = {sci(minima.esito.R1)}</>}</p>
            : <p className="text-lg text-[#b3261e]">Nemmeno LPS e SPD di livello I bastano: servono misure aggiuntive (antincendio, misure contro le tensioni di contatto, schermature).</p>}
          <p className="mt-1 text-sm">Frequenza del danno agli impianti interni (con l'LPS scelto a destra): {spdF === null ? <strong className="text-[#b3261e]">nemmeno SPD di livello I bastano: servono schermature, interfacce di separazione o percorsi dei cavi migliori</strong> : spdF === "nessuno" ? <strong>F ≤ FT anche senza SPD</strong> : <strong>servono SPD coordinati di livello {spdF}</strong>}.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3"><Button onClick={usaLivello} disabled={!minima}><Save strokeWidth={1.5} />{minima && minima.protezione.lps !== "nessuno" ? `Usa LPL ${minima.protezione.lps} nel progetto` : "Salva l'esito nel progetto"}</Button>{msg && <span className="text-sm">{msg}</span>}</div>
        </div>
      </section>
    </main>
  </>;
}
