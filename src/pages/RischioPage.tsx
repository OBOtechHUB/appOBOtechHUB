import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { SchemaAreeRaccolta, SchemaZone } from "@/components/schemi/SchemiRischio";
import { aggiornaEsteso, useEsteso } from "@/lib/statoProgetto";
import { aggiornaComputo, aggiornaDati, useComputo, useDatiEdificio } from "@/lib/progettoStore";
import fattori from "@/dati/rischio/fattorePosizione.json";
import {
  AMBIENTE_LINEA, AMBIENTI_CIRCOSTANTI, CABLAGGIO, SCENARI_AMBIENTE, CATEGORIE, CONNESSIONI, MISURE_CONTATTO, PAVIMENTO, POSA_LINEA, PROTEZIONE_INCENDIO, RISCHIO_INCENDIO, RT_R1, SCHERMATURE, TIPO_LINEA, TIPO_STRUTTURA,
  calcolaZone, protezioneMinimaZone, protezionePerZona, spdMinimoZona, spdMinimoZone, zonaUnica,
  type ClasseLps, type DatiRischio, type Linea, type Opzione, type Schermatura, type Struttura, type Zona,
} from "@/calcoli/rischio/rischioR1";

const sci = (v: number) => (v === 0 ? "0" : v.toExponential(2).replace(".", ",").replace("e", " · 10^"));
const CLASSI: ClasseLps[] = ["nessuno", "IV", "III", "II", "I"];
const nomeClasse = (c: ClasseLps) => (c === "nessuno" ? "Nessuna" : `Livello ${c}`);
const UW = [1, 1.5, 2.5, 4, 6];
const nuovoId = () => Math.random().toString(36).slice(2, 9);

function Scelta({ etichetta, opzioni, valore, onChange }: { etichetta: string; opzioni: Opzione[]; valore: number; onChange: (v: number) => void }) {
  const id = opzioni.find((x) => x.valore === valore)?.id ?? opzioni[0]!.id;
  return <Campo etichetta={etichetta}><select className={inputCls} value={id} onChange={(e) => onChange(opzioni.find((x) => x.id === e.target.value)!.valore)}>{opzioni.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.valore}</option>)}</select></Campo>;
}
function SceltaId({ etichetta, opzioni, id, onChange }: { etichetta: string; opzioni: { id: string; nome: string; valore?: number; extra?: string }[]; id: string; onChange: (id: string) => void }) {
  return <Campo etichetta={etichetta}><select className={inputCls} value={id} onChange={(e) => onChange(e.target.value)}>{opzioni.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.valore !== undefined && <> · {x.valore}</>}{x.extra && <> · {x.extra}</>}</option>)}</select></Campo>;
}
function Barra({ nome, valore, max }: { nome: string; valore: number; max: number }) {
  const w = valore > 0 && max > 0 ? Math.max(2, (Math.log10(valore) - Math.log10(max) + 6) / 6 * 100) : 0;
  return <div className="grid grid-cols-[3rem_1fr_7rem] items-center gap-2 text-sm"><span className="font-mono">{nome}</span><span className="h-2 rounded-full bg-muted"><span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, w)}%` }} /></span><span className="text-right font-mono text-xs">{sci(valore)}</span></div>;
}

/** Dati salvati nel progetto (versione con le zone). */
interface StatoRischio { versione: 2; k: number; Uw: number; PS: number; PTWS: number; danniMateriali: boolean; linee: Linea[]; zone: Zona[] }

const lineaNuova = (nome: string): Linea => ({ nome, lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 1, schermata: false, connessione: "interrata-ns", schermatura: "no", adiacente: null });
const zonaNuova = (nome: string, esterna = false): Zona => ({ id: nuovoId(), nome, oreAnno: 8760, rt: 1e-2, rp: 1, rfId: "ordinario", categoria: "normale", misureContatto: 1, esterna, esposti: false, LD: 0.1, impiantiCritici: false, serviziCritici: false, linee: null, wm1: null, wm2: null, ks3: 1, oreApparecchi: 8760 });

function leggiStato(raw: Record<string, unknown> | null): StatoRischio {
  if (raw && raw["versione"] === 2) return raw as unknown as StatoRischio;
  if (raw && Array.isArray(raw["linee"])) { // prima versione a zona unica
    const base: DatiRischio = { L: 1, W: 1, H: 1, NG: 1, CD: 1, LF: 5e-2, rt: 1e-2, rp: 1, rf: 1e-2, misureContatto: 1, impiantiCritici: false, frazionePresenza: 1, linee: [] };
    const { st, zona } = zonaUnica(Object.assign(base, raw as Partial<DatiRischio>));
    return { versione: 2, k: st.k ?? 2, Uw: st.Uw ?? 2.5, PS: st.PS ?? 1, PTWS: 1, danniMateriali: st.danniMateriali !== false, linee: st.linee, zone: [zona] };
  }
  return { versione: 2, k: 2, Uw: 2.5, PS: 1, PTWS: 1, danniMateriali: true, linee: [lineaNuova("Energia"), lineaNuova("Telecomunicazioni")], zone: [zonaNuova("Struttura", true)] };
}

export function RischioPage() {
  const s = useEsteso(), d = useDatiEdificio(), c = useComputo();
  const CD = fattori.find((f) => f.id === d.posizioneId)?.valore ?? 1;
  const stato = leggiStato(s.datiRischio);
  const salva = (p: Partial<StatoRischio>) => aggiornaEsteso({ datiRischio: { ...stato, ...p } as unknown as Record<string, unknown> });
  const st: Struttura = { L: d.L || 20, W: d.W || 10, H: d.H || 8, NG: d.densita || 2, CD, k: stato.k, Uw: stato.Uw, PS: stato.PS, PTWS: stato.PTWS, danniMateriali: stato.danniMateriali, linee: stato.linee };
  const [prot, setProt] = useState<{ lps: ClasseLps; spd: ClasseLps }>({ lps: "nessuno", spd: "nessuno" });
  const [aperta, setAperta] = useState(stato.zone[0]?.id ?? "");
  const [msg, setMsg] = useState("");
  const chiave = JSON.stringify([st, stato.zone]);
  const senza = useMemo(() => calcolaZone(st, stato.zone, { lps: "nessuno", spd: "nessuno" }), [chiave]); // eslint-disable-line react-hooks/exhaustive-deps
  const con = useMemo(() => calcolaZone(st, stato.zone, prot), [chiave, prot]); // eslint-disable-line react-hooks/exhaustive-deps
  const minima = useMemo(() => protezioneMinimaZone(st, stato.zone), [chiave]); // eslint-disable-line react-hooks/exhaustive-deps
  const spdF = useMemo(() => spdMinimoZone(st, stato.zone, prot.lps), [chiave, prot.lps]); // eslint-disable-line react-hooks/exhaustive-deps
  const perZona = useMemo(() => protezionePerZona(st, stato.zone), [chiave]); // eslint-disable-line react-hooks/exhaustive-deps
  const spdZona = useMemo(() => Object.fromEntries(stato.zone.map((z) => [z.id, spdMinimoZona(st, z, prot.lps)])), [chiave, prot.lps]); // eslint-disable-line react-hooks/exhaustive-deps

  const zona = (id: string, p: Partial<Zona>) => salva({ zone: stato.zone.map((z) => (z.id === id ? { ...z, ...p } : z)) });
  const linea = (i: number, p: Partial<Linea>) => salva({ linee: stato.linee.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const za = stato.zone.find((z) => z.id === aperta) ?? stato.zone[0]!;

  function usaLivello() {
    const riepilogoZone = (e: typeof senza) => e.zone.map((z) => `${z.zona.nome}: R = ${sci(z.R)}, F = ${sci(z.F)}, SPD ${z.spd === "nessuno" ? "nessuno" : z.spd}`).join("; ");
    if (!minima || minima.protezione.lps === "nessuno") {
      aggiornaComputo({ risultati: { ...c.risultati, rischio: { esito: `R ≤ RT in tutte le zone senza protezione (${riepilogoZone(senza)})`, lpl: (d.lplProgetto ?? "IV") } } });
      setMsg("Esito salvato: per il rischio R la protezione non è necessaria.");
      return;
    }
    const lpl = minima.protezione.lps as "I" | "II" | "III" | "IV";
    aggiornaDati({ lplProgetto: lpl });
    aggiornaEsteso({ lpl });
    aggiornaComputo({ risultati: { ...c.risultati, rischio: { esito: `Senza protezione R max = ${sci(senza.Rmax)} → LPS e SPD di livello ${lpl}: ${riepilogoZone(minima.esito)}`, lpl } } });
    setMsg(`LPL ${lpl} impostato nel progetto: captazione, calate e SPD useranno questo livello.`);
  }

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Analisi del rischio</h1>
      <p className="mt-2 max-w-3xl text-white/90">Rischio R (vite umane L1 + danni materiali L2) e frequenza del danno agli impianti interni F, per una o più zone della struttura, con il livello di protezione minimo (CEI EN IEC 62305-2:2024).</p>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">Metodo dell'edizione 2024 con i valori tipici degli Allegati A, B, C ed E. Il numero di eventi è comune a tutta la struttura; probabilità, perdite e SPD si scelgono per ogni zona e ogni zona va confrontata da sola con RT e FT. Se il danno può coinvolgere l'ambiente circostante, la zona aggiunge le perdite esterne LE.</p>

      <section className="mt-8" aria-label="Struttura">
        <h2 className="text-[1.7rem] font-medium">1 · Struttura</h2>
        <p className="mt-1 text-sm text-muted-foreground">Dimensioni, densità di fulminazione e posizione vengono da <Link to="/dati-edificio" className="text-primary underline">Dati edificio</Link>.</p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          <p>L × W × H: <strong>{st.L} × {st.W} × {st.H} m</strong></p>
          <p>NG: <strong>{st.NG}</strong> fulmini/km²·anno</p>
          <p>CD: <strong>{CD}</strong></p>
          <p>AD: <strong>{Math.round(senza.AD).toLocaleString("it-IT")} m²</strong></p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Campo etichetta="Coefficiente k (NSG = k · NG)"><input className={inputCls} type="number" min={1} max={4} step={0.1} value={stato.k} onChange={(e) => salva({ k: Math.max(1, Number(e.target.value) || 2) })} /></Campo>
          <Campo etichetta="Tensione di tenuta Uw degli impianti (kV)"><select className={inputCls} value={stato.Uw} onChange={(e) => salva({ Uw: Number(e.target.value) })}>{UW.map((u) => <option key={u} value={u}>{u.toLocaleString("it-IT")} kV</option>)}</select></Campo>
          <Scelta etichetta="Tipo di struttura senza LPS (PS)" opzioni={TIPO_STRUTTURA} valore={stato.PS} onChange={(v) => salva({ PS: v })} />
          <Campo etichetta="Sistema di allerta temporali (PTWS)"><input className={inputCls} type="number" min={0} max={1} step={0.05} value={stato.PTWS} onChange={(e) => salva({ PTWS: Math.min(1, Math.max(0, Number(e.target.value))) })} /></Campo>
          <p className="self-end text-sm">NSG = <strong>{senza.NSG.toLocaleString("it-IT")}</strong> · ND = <strong>{sci(senza.ND)}</strong> · NM = <strong>{sci(senza.NM)}</strong></p>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={stato.danniMateriali} onChange={(e) => salva({ danniMateriali: e.target.checked })} />Considera anche i danni materiali alla struttura e al contenuto (L2): R = RL1 + RL2</label>
        <div className="mt-4"><SchemaAreeRaccolta rM={350 / stato.Uw} rI={2000 / Math.pow(stato.Uw, 1.8)} /></div>
      </section>

      <section className="mt-10" aria-label="Linee entranti">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-[1.7rem] font-medium">2 · Linee entranti</h2><Button variant="outline" onClick={() => salva({ linee: [...stato.linee, lineaNuova("Linea")] })}><Plus />Aggiungi linea</Button></div>
        <div className="mt-4 space-y-4">{stato.linee.map((l, i) => <div key={i} className="rounded-lg border-[0.8px] border-bordo-scheda p-3">
          <div className="grid items-end gap-3 sm:grid-cols-4">
            <Campo etichetta="Nome"><input className={inputCls} value={l.nome} maxLength={60} onChange={(e) => linea(i, { nome: e.target.value })} /></Campo>
            <Campo etichetta="Lunghezza (m)"><input className={inputCls} type="number" min={0} max={2000} step={50} value={l.lunghezza} onChange={(e) => linea(i, { lunghezza: Math.min(2000, Math.max(0, Number(e.target.value))) })} /></Campo>
            <Scelta etichetta="Posa (CI)" opzioni={POSA_LINEA} valore={l.posa} onChange={(v) => linea(i, { posa: v })} />
            <Scelta etichetta="Ambiente (CE)" opzioni={AMBIENTE_LINEA} valore={l.ambiente} onChange={(v) => linea(i, { ambiente: v })} />
            <Scelta etichetta="Tipo (CT)" opzioni={TIPO_LINEA} valore={l.tipo} onChange={(v) => linea(i, { tipo: v })} />
            <SceltaId etichetta="Tipo di linea e collegamento (CLD, CLI)" opzioni={CONNESSIONI.map((x) => ({ id: x.id, nome: x.nome, extra: `${x.CLD}/${x.CLI}` }))} id={l.connessione ?? "interrata-ns"} onChange={(id) => linea(i, { connessione: id, schermata: id === "sch-coll" })} />
            {(l.connessione === "sch-coll") && <Campo etichetta="Schermatura (PLD)"><select className={inputCls} value={l.schermatura ?? "1-5"} onChange={(e) => linea(i, { schermatura: e.target.value as Schermatura })}>{SCHERMATURE.filter((x) => x.id !== "no").map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></Campo>}
            <div className="flex justify-end"><Button size="icon" variant="ghost" aria-label="Elimina linea" onClick={() => salva({ linee: stato.linee.filter((_, k) => k !== i), zone: stato.zone.map((z) => ({ ...z, linee: z.linee ? z.linee.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)) : null })) })}><Trash2 /></Button></div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!l.adiacente} onChange={(e) => linea(i, { adiacente: e.target.checked ? { L: 10, W: 10, H: 6, CDJ: 1 } : null })} />Struttura adiacente all'altra estremità della linea (NDJ)</label>
          {l.adiacente && <div className="mt-2 grid gap-3 sm:grid-cols-4">
            {(["L", "W", "H"] as const).map((k) => <Campo key={k} etichetta={`${k} struttura adiacente (m)`}><input className={inputCls} type="number" min={0} step={1} value={l.adiacente![k]} onChange={(e) => linea(i, { adiacente: { ...l.adiacente!, [k]: Math.max(0, Number(e.target.value)) } })} /></Campo>)}
            <Campo etichetta="Posizione struttura adiacente (CDJ)"><select className={inputCls} value={l.adiacente.CDJ} onChange={(e) => linea(i, { adiacente: { ...l.adiacente!, CDJ: Number(e.target.value) } })}>{fattori.map((f) => <option key={f.id} value={f.valore}>{f.descrizione} · {f.valore}</option>)}</select></Campo>
          </div>}
        </div>)}</div>
        <p className="mt-2 text-xs text-muted-foreground">Lunghezza fino al primo nodo (1000 m se sconosciuta, al massimo 2000 m realistici per le linee di energia).</p>
      </section>

      <section className="mt-10" aria-label="Zone">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-[1.7rem] font-medium">3 · Zone di rischio</h2>
          <div className="flex gap-2"><Button variant="outline" onClick={() => { const z = zonaNuova(`Zona ${stato.zone.length + 1}`); salva({ zone: [...stato.zone, z] }); setAperta(z.id); }}><Plus />Aggiungi zona</Button>
            <Button variant="outline" onClick={() => { const z = { ...za, id: nuovoId(), nome: `${za.nome} (copia)` }; salva({ zone: [...stato.zone, z] }); setAperta(z.id); }}><Copy />Duplica zona</Button></div></div>
        <div className="mt-3"><SchemaZone /></div>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist">{stato.zone.map((z) => { const e = senza.zone.find((x) => x.zona.id === z.id); return <button key={z.id} role="tab" aria-selected={z.id === za.id} onClick={() => setAperta(z.id)}
          className={`rounded-full border-[0.8px] px-3 py-1 text-sm ${z.id === za.id ? "border-primary bg-primary text-primary-foreground" : "border-bordo-scheda"}`}>{z.nome}{e && <span className="ml-1 opacity-80">· {e.conforme ? "✓" : "!"}</span>}</button>; })}</div>
        <div className="mt-4 rounded-lg border-[0.8px] border-bordo-scheda p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etichetta="Nome della zona"><input className={inputCls} value={za.nome} maxLength={60} onChange={(e) => zona(za.id, { nome: e.target.value })} /></Campo>
            <Campo etichetta="Presenza di persone (ore/anno, PP = ore/8760)"><input className={inputCls} type="number" min={0} max={8760} step={10} value={za.oreAnno} onChange={(e) => zona(za.id, { oreAnno: Math.min(8760, Math.max(0, Number(e.target.value))) })} /></Campo>
            <SceltaId etichetta="Categoria della struttura (perdite LF, LO)" opzioni={CATEGORIE.map((x) => ({ id: x.id, nome: x.nome, extra: `LF ${x.LF}` }))} id={za.categoria} onChange={(id) => zona(za.id, { categoria: id })} />
            <Scelta etichetta="Pavimento esterno/interno (rt)" opzioni={PAVIMENTO} valore={za.rt} onChange={(v) => zona(za.id, { rt: v })} />
            <SceltaId etichetta="Rischio d'incendio o di esplosione (rf)" opzioni={RISCHIO_INCENDIO} id={za.rfId} onChange={(id) => zona(za.id, { rfId: id })} />
            <Scelta etichetta="Protezione antincendio (rp)" opzioni={PROTEZIONE_INCENDIO} valore={za.rp} onChange={(v) => zona(za.id, { rp: v })} />
            <Scelta etichetta="Misure contro tensioni di contatto e passo (PAM)" opzioni={MISURE_CONTATTO} valore={za.misureContatto} onChange={(v) => zona(za.id, { misureContatto: v })} />
            <Scelta etichetta="Cablaggio interno (KS3)" opzioni={CABLAGGIO} valore={za.ks3 ?? 1} onChange={(v) => zona(za.id, { ks3: v })} />
            <Campo etichetta="Lato maglia schermo esterno wm1 (m, KS1)"><input className={inputCls} type="number" min={0} step={0.5} placeholder="nessuno" value={za.wm1 ?? ""} onChange={(e) => zona(za.id, { wm1: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} /></Campo>
            <Campo etichetta="Lato maglia schermi interni wm2 (m, KS2)"><input className={inputCls} type="number" min={0} step={0.5} placeholder="nessuno" value={za.wm2 ?? ""} onChange={(e) => zona(za.id, { wm2: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} /></Campo>
            <Campo etichetta="Apparecchiature esposte (ore/anno, Pe)"><input className={inputCls} type="number" min={0} max={8760} step={10} value={za.oreApparecchi ?? 8760} onChange={(e) => zona(za.id, { oreApparecchi: Math.min(8760, Math.max(0, Number(e.target.value))) })} /></Campo>
            <Campo etichetta="SPD della zona (PSPD, PEB)"><select className={inputCls} value={za.spd ?? ""} onChange={(e) => zona(za.id, { spd: e.target.value === "" ? null : e.target.value as ClasseLps })}><option value="">Come la protezione scelta nei risultati</option>{CLASSI.map((x) => <option key={x} value={x}>{x === "nessuno" ? "Nessun SPD" : `SPD di livello ${x}`}</option>)}</select></Campo>
            {za.esposti && <Campo etichetta="Perdita per fulmine diretto su persone esposte (LD)"><select className={inputCls} value={za.LD ?? 0.1} onChange={(e) => zona(za.id, { LD: Number(e.target.value) })}>{[0.1, 0.05, 0.01].map((v) => <option key={v} value={v}>{v}</option>)}</select></Campo>}
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={za.esterna} onChange={(e) => zona(za.id, { esterna: e.target.checked })} />Persone fino a 3 m dalle calate (tensioni di contatto e passo, RAT)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={za.esposti} onChange={(e) => zona(za.id, { esposti: e.target.checked })} />Persone esposte al fulmine diretto: tetto, terrazza, parcheggio in copertura (RAD)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={za.impiantiCritici} onChange={(e) => zona(za.id, { impiantiCritici: e.target.checked })} />Guasti degli impianti interni mettono in pericolo la vita (RC, RM, RW, RZ)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={za.serviziCritici} onChange={(e) => zona(za.id, { serviziCritici: e.target.checked })} />Impianti interni critici per il servizio (FT = 0,1)</label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!za.ambiente} onChange={(e) => zona(za.id, { ambiente: e.target.checked ? { scenario: "fumi", fuoriSito: false, tE: 1 } : null })} />Il danno può coinvolgere l'ambiente circostante o le strutture vicine: esplosione, fumi tossici, inquinamento (LE, Allegato E)</label>
          {za.ambiente && <div className="mt-2 grid gap-4 sm:grid-cols-3">
            <SceltaId etichetta="Scenario (LF1E, LO1E · LF2E, LO2E)" opzioni={SCENARI_AMBIENTE.map((x) => { const v = za.ambiente!.fuoriSito ? x.esterno : x.interno; return { id: x.id, nome: x.nome, extra: `${v.LF1E}/${v.LO1E} · ${x.LF2E}/${x.LO2E}` }; })} id={za.ambiente.scenario} onChange={(id) => zona(za.id, { ambiente: { ...za.ambiente!, scenario: id } })} />
            <Campo etichetta="Estensione del danno (Tab. E.3)"><select className={inputCls} value={za.ambiente.fuoriSito ? "fuori" : "dentro"} onChange={(e) => zona(za.id, { ambiente: { ...za.ambiente!, fuoriSito: e.target.value === "fuori" } })}><option value="dentro">Contenuto dentro la recinzione del sito</option><option value="fuori">Si diffonde fuori dalla recinzione del sito</option></select></Campo>
            <Scelta etichetta="Ambiente circostante (PPE = tE/8760)" opzioni={AMBIENTI_CIRCOSTANTI} valore={za.ambiente.tE} onChange={(v) => zona(za.id, { ambiente: { ...za.ambiente!, tE: v } })} />
          </div>}
          {stato.linee.length > 0 && <div className="mt-3 text-sm"><p className="font-medium">Linee che alimentano gli impianti della zona</p>
            <div className="mt-1 flex flex-wrap gap-3">{stato.linee.map((l, i) => <label key={i} className="flex items-center gap-2"><input type="checkbox" checked={za.linee == null || za.linee.includes(i)} onChange={(e) => { const tutte = stato.linee.map((_, k) => k); const att = za.linee ?? tutte; const nuove = e.target.checked ? [...new Set([...att, i])].sort() : att.filter((x) => x !== i); zona(za.id, { linee: nuove.length === tutte.length ? null : nuove }); }} />{l.nome}</label>)}</div></div>}
          {stato.zone.length > 1 && <Button variant="ghost" className="mt-3 text-[#b3261e]" onClick={() => { const resto = stato.zone.filter((z) => z.id !== za.id); salva({ zone: resto }); setAperta(resto[0]!.id); }}><Trash2 />Elimina zona</Button>}
        </div>
      </section>

      <section className="mt-10" aria-label="Risultati">
        <h2 className="text-[1.7rem] font-medium">4 · Risultati</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-5">
          <p>ND = <strong>{sci(senza.ND)}</strong></p><p>NM = <strong>{sci(senza.NM)}</strong></p><p>NL = <strong>{sci(senza.NL)}</strong></p><p>NDJ = <strong>{sci(senza.NDJ)}</strong></p><p>NI = <strong>{sci(senza.NI)}</strong></p>
        </div>
        <div className="mt-4 rounded-lg border-[0.8px] border-bordo-scheda p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etichetta="LPS (PLPS)"><select className={inputCls} value={prot.lps} onChange={(e) => setProt({ ...prot, lps: e.target.value as ClasseLps })}>{CLASSI.map((x) => <option key={x} value={x}>{nomeClasse(x)}</option>)}</select></Campo>
            <Campo etichetta="SPD coordinati (PEB, PSPD)"><select className={inputCls} value={prot.spd} onChange={(e) => setProt({ ...prot, spd: e.target.value as ClasseLps })}>{CLASSI.map((x) => <option key={x} value={x}>{nomeClasse(x)}</option>)}</select></Campo>
          </div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b text-left"><th className="p-2">Zona</th><th className="p-2">R senza protezione</th><th className="p-2">R con la protezione scelta</th><th className="p-2">F con la protezione scelta</th><th className="p-2">SPD minimo della zona</th></tr></thead>
            <tbody>{con.zone.map((z, i) => { const s0 = senza.zone[i]!; return <tr key={z.zona.id} className="border-b">
              <td className="p-2 font-medium">{z.zona.nome}</td>
              <td className={`p-2 font-mono ${s0.conforme ? "text-[#1d7a45]" : "text-[#b3261e]"}`}>{sci(s0.R)}</td>
              <td className={`p-2 font-mono ${z.conforme ? "text-[#1d7a45]" : "text-[#b3261e]"}`}>{sci(z.R)} {z.conforme ? "≤" : ">"} RT</td>
              <td className={`p-2 font-mono ${z.frequenzaConforme ? "text-[#1d7a45]" : "text-[#b3261e]"}`}>{sci(z.F)} {z.frequenzaConforme ? "≤" : ">"} {z.FT.toLocaleString("it-IT")}</td>
              <td className="p-2">{(() => { const m = spdZona[z.zona.id]; return m === null || m === undefined ? <span className="text-[#b3261e]">non basta il livello I</span> : <>{m === "nessuno" ? "nessuno" : `livello ${m}`}{z.zona.spd ? <span className="text-muted-foreground"> · scelti {z.spd === "nessuno" ? "nessuno" : z.spd}</span> : null}</>; })()}</td>
            </tr>; })}</tbody>
          </table></div>
        </div>
        {(() => { const e = con.zone.find((z) => z.zona.id === za.id) ?? con.zone[0]!; const max = Math.max(...Object.values(e.componenti), RT_R1); return <div className="mt-4 rounded-lg border-[0.8px] border-bordo-scheda p-4">
          <p className="font-semibold">Componenti della zona "{e.zona.nome}" con la protezione scelta</p>
          <p className="text-sm">RL1 (vite umane) = {sci(e.RL1)} · RL2 (danni materiali) = {sci(e.RL2)}{e.RE1 + e.RE2 > 0 && <> · di cui ambiente circostante RE = {sci(e.RE1 + e.RE2)}</>}</p>
          <div className="mt-3 space-y-1.5">{Object.entries(e.componenti).filter(([, v]) => v > 0).map(([k, v]) => <Barra key={k} nome={k} valore={v} max={max} />)}<Barra nome="RT" valore={RT_R1} max={max} /></div>
          <p className="mt-2 text-xs text-muted-foreground">FC {sci(e.frequenze.FC)} · FM {sci(e.frequenze.FM)} · FW {sci(e.frequenze.FW)} · FZ {sci(e.frequenze.FZ)}</p>
        </div>; })()}
        <div className="mt-6 rounded-lg border-l-4 border-primary bg-muted p-4" role="status">
          {minima
            ? <p className="text-lg">Protezione minima per tutte le zone: <strong>{minima.protezione.lps === "nessuno" ? "non necessaria" : `LPS e SPD di livello ${minima.protezione.lps}`}</strong>{minima.protezione.lps !== "nessuno" && <> · R max = {sci(minima.esito.Rmax)}</>}</p>
            : <p className="text-lg text-[#b3261e]">Nemmeno LPS e SPD di livello I bastano in tutte le zone: servono misure aggiuntive nella zona peggiore (antincendio, misure contro le tensioni di contatto, schermature).</p>}
          <p className="mt-1 text-sm">Frequenza del danno (con l'LPS scelto sopra): {spdF === null ? <strong className="text-[#b3261e]">nemmeno SPD di livello I bastano: servono schermature, interfacce di separazione o cablaggi migliori</strong> : spdF === "nessuno" ? <strong>F ≤ FT anche senza SPD</strong> : <strong>servono SPD coordinati di livello {spdF}</strong>}.</p>
          {perZona && stato.zone.length > 1 && <div className="mt-3 text-sm">
            <p>Con SPD diversi per zona: <strong>{perZona.lps === "nessuno" ? "nessun LPS" : `LPS di livello ${perZona.lps}`}</strong> e {stato.zone.map((z) => `${z.nome}: ${perZona.spd[z.id] === "nessuno" ? "nessun SPD" : `SPD ${perZona.spd[z.id]}`}`).join(" · ")} (R ≤ RT e F ≤ FT in tutte le zone).</p>
            <Button variant="outline" className="mt-2" onClick={() => { salva({ zone: stato.zone.map((z) => ({ ...z, spd: perZona.spd[z.id] ?? null })) }); setProt({ ...prot, lps: perZona.lps }); setMsg("SPD per zona applicati: li vedi in ogni zona e nella tabella."); }}>Applica gli SPD per zona</Button>
          </div>}
          <div className="mt-3 flex flex-wrap items-center gap-3"><Button onClick={usaLivello} disabled={!minima}><Save strokeWidth={1.5} />{minima && minima.protezione.lps !== "nessuno" ? `Usa LPL ${minima.protezione.lps} nel progetto` : "Salva l'esito nel progetto"}</Button>{msg && <span className="text-sm">{msg}</span>}</div>
        </div>
      </section>
    </main>
  </>;
}
