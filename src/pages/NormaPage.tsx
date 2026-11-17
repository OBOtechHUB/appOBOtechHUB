import { useState, type ReactNode } from "react";
import { Campo, inputCls } from "@/components/Campo";
import { useDatiEdificio } from "@/lib/progettoStore";
import {
  DIMENSIONI_DISPERSORI, LPL, NOMI_CONFIGURAZIONI, NOMI_MATERIALI, PARAMETRI_FULMINE, Q_INDOTTA, RESISTIVITA_SCHERMI, SEZIONI_CAPTATORI_CALATE, SEZIONI_EQUIPOTENZIALI, SPESSORI_LASTRE, USO_MATERIALI,
  cadutaCollegamenti, campoFulmineDiretto, campoFulmineVicino, correnteConduttoriCC, correnteMaxSchermoRame, distanzaImpatto, fattoreSchermatura, ksSchermo, livelloEffettivo,
  lunghezzaCavoSuolo, raggioSfera, requisitiEsplosione, sezioneMinima, sezioneMinimaSchermo, sezioneTondo, spdFotovoltaico, spdFotovoltaicoCommutazione, tensioneIndotta, verificaContattoPasso, verificaSpdDettagliata,
  type Configurazione, type Lpl, type Materiale, type UsoConduttore, type ZonaAtex,
} from "@/calcoli/norma/strumenti";

const f = (v: number, c = 2) => (Number.isFinite(v) ? v.toLocaleString("it-IT", { maximumFractionDigits: c }) : "—");
const N = ({ e, v, set, passo = 0.1, min = 0 }: { e: string; v: number; set: (n: number) => void; passo?: number; min?: number }) =>
  <Campo etichetta={e}><input className={inputCls} type="number" min={min} step={passo} value={Number.isFinite(v) ? v : ""} onChange={(ev) => set(Number(ev.target.value))} /></Campo>;
const Esito = ({ ok, children }: { ok: boolean; children: ReactNode }) =>
  <p className={`mt-3 rounded-md px-3 py-2 text-sm font-semibold ${ok ? "bg-[#e3f4ea] text-[#1d7a45]" : "bg-[#fdecea] text-[#b3261e]"}`}>{children}</p>;
const SelLpl = ({ v, set }: { v: Lpl; set: (l: Lpl) => void }) =>
  <Campo etichetta="Livello di protezione (LPL)"><select className={inputCls} value={v} onChange={(e) => set(e.target.value as Lpl)}>{LPL.map((l) => <option key={l} value={l}>LPL {l}</option>)}</select></Campo>;

function Sezione({ id, titolo, rif, children }: { id: string; titolo: string; rif: string; children: ReactNode }) {
  return <section id={id} className="mt-10 scroll-mt-20" aria-label={titolo}>
    <h2 className="text-[1.7rem] font-medium">{titolo}</h2>
    <p className="mt-1 text-xs text-muted-foreground">{rif}</p>
    <div className="mt-4 rounded-lg border-[0.8px] border-bordo-scheda p-4">{children}</div>
  </section>;
}
const Tabella = ({ testa, righe }: { testa: string[]; righe: (string | number)[][] }) =>
  <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead><tr className="border-b text-left">{testa.map((t) => <th key={t} className="p-2">{t}</th>)}</tr></thead>
    <tbody>{righe.map((r, i) => <tr key={i} className="border-b">{r.map((c, k) => <td key={k} className="p-2">{typeof c === "number" ? f(c, 3) : c}</td>)}</tr>)}</tbody></table></div>;

const INDICE = [
  ["fulmine", "Parametri del fulmine"], ["materiali", "Materiali e sezioni minime"], ["schermo-cavi", "Schermo dei cavi entranti"], ["contatto", "Tensioni di contatto e di passo"],
  ["esplosione", "Strutture con rischio di esplosione"], ["schermatura", "Schermatura magnetica"], ["spd", "SPD: livello di protezione effettivo"], ["indotta", "Tensione indotta"], ["fotovoltaico", "Impianti fotovoltaici"],
] as const;

export function NormaPage() {
  const d = useDatiEdificio();
  const lplProgetto = (d.lplProgetto ?? "III") as Lpl;
  const [lpl, setLpl] = useState<Lpl>(lplProgetto);
  const p = PARAMETRI_FULMINE[lpl];
  // fulmine
  const [Ipicco, setIpicco] = useState(10);
  // materiali
  const [uso, setUso] = useState<UsoConduttore>("captatore-calata");
  const [mat, setMat] = useState<Materiale>("acciaio-zincato");
  const [conf, setConf] = useState<Configurazione>("tondo");
  const [diam, setDiam] = useState(8);
  const [sez, setSez] = useState(50);
  const [usaDiam, setUsaDiam] = useState(true);
  const sezEff = usaDiam && (conf === "tondo" || conf === "tondo-asta") ? sezioneTondo(diam) : sez;
  const minimo = sezioneMinima(uso, mat, conf);
  // schermo cavi
  const [IF, setIF] = useState(10), [schermo, setSchermo] = useState("rame"), [nelSuolo, setNelSuolo] = useState(true), [rhoSuolo, setRhoSuolo] = useState(250), [Lc, setLc] = useState(50), [UwC, setUwC] = useState(2.5), [Sc, setSc] = useState(16);
  const LcEff = nelSuolo ? lunghezzaCavoSuolo(rhoSuolo) : Lc;
  const scMin = sezioneMinimaSchermo(IF, RESISTIVITA_SCHERMI.find((x) => x.id === schermo)!.rho, LcEff, UwC);
  // contatto
  const [c3m, setC3m] = useState(false), [c10, setC10] = useState(false), [cSuolo, setCSuolo] = useState(false);
  const vc = verificaContattoPasso({ nessunoEntro3m: c3m, calateNaturali10: c10, suoloIsolante: cSuolo });
  // esplosione
  const [atex, setAtex] = useState<ZonaAtex>("1-21");
  // schermatura
  const [wm, setWm] = useState(2), [Ls, setLs] = useState(10), [Ws, setWs] = useState(10), [Hs, setHs] = useState(10), [mats, setMats] = useState<"rame-alluminio" | "acciaio">("rame-alluminio"), [rc, setRc] = useState(0.004), [rete, setRete] = useState(false);
  const I0 = p.primoPositivo.I * 1000;
  const dir = campoFulmineDiretto(I0, wm, Math.max(0.01, Math.min(Ls, Ws) / 2), Hs / 2, rete);
  const dirParete = campoFulmineDiretto(I0, wm, Math.max(wm, 0.01), Hs / 2, rete);
  const SF25 = fattoreSchermatura(mats, wm, rc, "25kHz", rete), SF1 = fattoreSchermatura(mats, wm, rc, "1MHz", rete);
  const sa = distanzaImpatto(raggioSfera(I0 / 1000), Hs, Math.min(Ls, Ws)); // caso peggiore: distanza minima
  const vicPos = campoFulmineVicino(I0, sa, SF25, wm), vicSucc = campoFulmineVicino(p.successivo.I * 1000, sa, SF1, wm);
  // spd
  const [Up, setUp] = useState(1.5), [Ispd, setIspd] = useState(5), [lungh, setLungh] = useState(0.5), [tipoSpd, setTipoSpd] = useState<"limitatore" | "commutazione">("limitatore"), [UwS, setUwS] = useState(2.5), [Ui, setUi] = useState(0), [kr, setKr] = useState(2);
  const DU = cadutaCollegamenti(Ispd, lungh), Upf = livelloEffettivo(Up, DU, tipoSpd), vs = verificaSpdDettagliata(Upf, UwS, Ui, kr);
  // indotta
  const [dI, setDI] = useState(1), [wI, setWI] = useState(0.1), [lp, setLp] = useState(3), [lo, setLo] = useState(5), [calate, setCalate] = useState(4), [sch1, setSch1] = useState<"nessuno" | "maglia" | "pieno">("nessuno"), [w1, setW1] = useState(5), [sch2, setSch2] = useState<"nessuno" | "maglia" | "pieno">("nessuno"), [w2, setW2] = useState(1);
  const ks1 = ksSchermo(sch1, w1), ks2 = ksSchermo(sch2, w2);
  const kcI = sch1 !== "nessuno" ? ks1 / 2 : calate <= 1 ? 1 : calate === 2 ? 0.66 : 0.44;
  const ui = tensioneIndotta({ lpl, d: dI, w: wI, lp, lo, kc: kcI, ks1, ks2 });
  // fotovoltaico
  const [nCC, setNCC] = useState(4), [calFV, setCalFV] = useState(4);
  const kcFV = calFV <= 1 ? 1 : calFV === 2 ? 0.66 : 0.44;
  const fv = spdFotovoltaico(lpl, calFV);

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Norma CEI EN IEC 62305:2024</h1>
      <p className="mt-2 max-w-3xl text-white/90">Calcoli e verifiche delle quattro parti della norma che non hanno una pagina propria: parametri del fulmine, materiali, schermi, tensioni di contatto, aree con rischio di esplosione, schermatura magnetica, SPD, tensioni indotte e fotovoltaico.</p>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-4 sm:grid-cols-[16rem_1fr] sm:items-end">
        <SelLpl v={lpl} set={setLpl} />
        <p className="text-sm text-muted-foreground">Il livello vale per tutti i calcoli della pagina{d.lplProgetto ? ` (nel progetto: LPL ${d.lplProgetto})` : ""}.</p>
      </div>
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Indice">{INDICE.map(([id, t]) => <a key={id} href={`#${id}`} className="rounded-full border-[0.8px] border-bordo-scheda px-3 py-1 text-sm hover:bg-muted">{t}</a>)}</nav>

      <Sezione id="fulmine" titolo="Parametri del fulmine" rif="CEI EN IEC 62305-1:2024, 8.2, Tab. 3 e Tab. 4, A.4">
        <Tabella testa={["Parametro", ...LPL.map((l) => `LPL ${l}`)]} righe={[
          ["Primo colpo positivo: picco (kA), 10/350 µs", ...LPL.map((l) => PARAMETRI_FULMINE[l].primoPositivo.I)],
          ["Primo colpo positivo: carica (C)", ...LPL.map((l) => PARAMETRI_FULMINE[l].primoPositivo.Q)],
          ["Primo colpo positivo: energia specifica (MJ/Ω)", ...LPL.map((l) => PARAMETRI_FULMINE[l].primoPositivo.WR)],
          ["Primo colpo negativo: picco (kA), 1/200 µs", ...LPL.map((l) => PARAMETRI_FULMINE[l].primoNegativo.I)],
          ["Primo colpo negativo: pendenza (kA/µs)", ...LPL.map((l) => PARAMETRI_FULMINE[l].primoNegativo.didt)],
          ["Colpo successivo: picco (kA), 0,25/100 µs", ...LPL.map((l) => PARAMETRI_FULMINE[l].successivo.I)],
          ["Colpo successivo: pendenza (kA/µs)", ...LPL.map((l) => PARAMETRI_FULMINE[l].successivo.didt)],
          ["Colpo lungo: carica (C), 0,5 s", ...LPL.map((l) => PARAMETRI_FULMINE[l].QLungo)],
          ["Fulmine completo: carica (C)", ...LPL.map((l) => PARAMETRI_FULMINE[l].QFulmine)],
          ["Corrente minima di picco (kA)", ...LPL.map((l) => PARAMETRI_FULMINE[l].Imin)],
          ["Raggio della sfera rotolante (m)", ...LPL.map((l) => PARAMETRI_FULMINE[l].r)],
        ]} />
        <div className="mt-4 grid gap-4 sm:grid-cols-3 sm:items-end">
          <N e="Corrente di picco I (kA)" v={Ipicco} set={setIpicco} passo={1} />
          <p className="text-sm sm:col-span-2">Raggio della sfera rotolante r = 10 · I<sup>0,65</sup> = <strong>{f(raggioSfera(Ipicco), 1)} m</strong>. I fulmini con corrente minore della minima del livello possono colpire dentro la zona protetta.</p>
        </div>
      </Sezione>

      <Sezione id="materiali" titolo="Materiali e sezioni minime" rif="CEI EN IEC 62305-3:2024, 5.6, Tab. 3, 6, 7, 8, 9 e 10">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etichetta="Uso del conduttore"><select className={inputCls} value={uso} onChange={(e) => setUso(e.target.value as UsoConduttore)}>
            <option value="captatore-calata">Captatore, asta o calata (Tab. 7)</option><option value="dispersore">Dispersore (Tab. 8)</option>
            <option value="equipotenziale-barre">Equipotenziale tra barre o verso i dispersori (Tab. 9)</option><option value="equipotenziale-interno">Equipotenziale verso corpi metallici interni (Tab. 10)</option></select></Campo>
          <Campo etichetta="Materiale"><select className={inputCls} value={mat} onChange={(e) => setMat(e.target.value as Materiale)}>{(Object.keys(NOMI_MATERIALI) as Materiale[]).filter((m) => !["piombo", "titanio", "zinco"].includes(m)).map((m) => <option key={m} value={m}>{NOMI_MATERIALI[m]}</option>)}</select></Campo>
          <Campo etichetta="Configurazione"><select className={inputCls} value={conf} onChange={(e) => setConf(e.target.value as Configurazione)}>{(["nastro", "tondo", "cordato", "tondo-asta"] as Configurazione[]).map((c) => <option key={c} value={c}>{NOMI_CONFIGURAZIONI[c]}</option>)}</select></Campo>
          {(conf === "tondo" || conf === "tondo-asta") && <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={usaDiam} onChange={(e) => setUsaDiam(e.target.checked)} />Inserisco il diametro</label>}
          {usaDiam && (conf === "tondo" || conf === "tondo-asta") ? <N e="Diametro (mm)" v={diam} set={setDiam} passo={0.5} /> : <N e="Sezione del conduttore (mm²)" v={sez} set={setSez} passo={1} />}
        </div>
        {minimo === null ? <Esito ok={false}>Combinazione non prevista dalla norma per questo uso (es. alluminio nel suolo).</Esito>
          : <Esito ok={sezEff >= minimo}>Sezione {f(sezEff, 1)} mm² {sezEff >= minimo ? "≥" : "<"} minimo {minimo} mm²{uso === "captatore-calata" && conf === "tondo" ? " (28 mm², Ø 6 mm, se la resistenza meccanica non conta; 75 mm² se contano effetti termici e meccanici)" : ""}</Esito>}
        <details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Captatori, aste e calate (Tab. 7)</summary>
          <div className="mt-2"><Tabella testa={["Materiale", "Configurazione", "Sezione minima (mm²)"]} righe={SEZIONI_CAPTATORI_CALATE.map((x) => [NOMI_MATERIALI[x.materiale], NOMI_CONFIGURAZIONI[x.configurazione], x.sezione])} /></div>
          <p className="mt-1 text-xs text-muted-foreground">Le aste da 176 mm² (Ø 15 mm) si possono ridurre a Ø 9,5 mm × 1 m dove vento e sollecitazioni non sono critiche. I conduttori cordati in Francia non sono ammessi come calate.</p></details>
        <details className="mt-2"><summary className="cursor-pointer text-sm font-medium">Dispersori (Tab. 8)</summary>
          <div className="mt-2"><Tabella testa={["Materiale", "Configurazione", "Ø asta (mm)", "Conduttore (mm²)", "Piastra (mm)"]} righe={DIMENSIONI_DISPERSORI.map((x) => [NOMI_MATERIALI[x.materiale], NOMI_CONFIGURAZIONI[x.configurazione], x.diametro ?? "—", x.sezione ?? "—", x.piastra ?? "—"])} /></div>
          <p className="mt-1 text-xs text-muted-foreground">Acciaio nudo solo nel calcestruzzo (copriferro ≥ 50 mm). Rame interrato non a contatto con acciaio di pali o tubazioni. Griglie equipotenziali: maglia 250–500 mm, conduttore Ø 4 mm. Ammesso anche il profilato in acciaio zincato da 290 mm², spessore 3 mm.</p></details>
        <details className="mt-2"><summary className="cursor-pointer text-sm font-medium">Collegamenti equipotenziali (Tab. 9 e 10)</summary>
          <div className="mt-2"><Tabella testa={["Materiale", "Tra barre o verso i dispersori (mm²)", "Verso corpi metallici interni (mm²)"]} righe={Object.entries(SEZIONI_EQUIPOTENZIALI).map(([m, v]) => [m[0]!.toUpperCase() + m.slice(1), v.traBarre, v.corpiInterni])} /></div></details>
        <details className="mt-2"><summary className="cursor-pointer text-sm font-medium">Lastre e tubazioni come captatori naturali (Tab. 3)</summary>
          <div className="mt-2"><Tabella testa={["Materiale", "t contro la perforazione (mm)", "t' senza problemi di perforazione (mm)"]} righe={SPESSORI_LASTRE.map((x) => [NOMI_MATERIALI[x.materiale], x.t ?? "—", x.t1])} /></div></details>
        <details className="mt-2"><summary className="cursor-pointer text-sm font-medium">Dove si possono usare i materiali (Tab. 6, in sintesi)</summary>
          <div className="mt-2"><Tabella testa={["Materiale", "All'aperto", "Nel suolo", "Nel calcestruzzo", "Corrosione galvanica con"]} righe={USO_MATERIALI.map((x) => [NOMI_MATERIALI[x.materiale], x.aperto, x.suolo, x.calcestruzzo, x.galvanica])} /></div>
          <p className="mt-1 text-xs text-muted-foreground">Alluminio mai a contatto con terra, ghiaia, calcare o malta. Acciaio zincato nel calcestruzzo non deve proseguire nel terreno; i trefoli zincati non sono consigliati per la dispersione.</p></details>
      </Sezione>

      <Sezione id="schermo-cavi" titolo="Schermo dei cavi entranti" rif="CEI EN IEC 62305-3:2024, Allegato A (A.1, Tab. A.1)">
        <div className="grid gap-4 sm:grid-cols-3">
          <N e="Corrente sullo schermo IF (kA)" v={IF} set={setIF} passo={0.5} />
          <Campo etichetta="Materiale dello schermo (ρC)"><select className={inputCls} value={schermo} onChange={(e) => setSchermo(e.target.value)}>{RESISTIVITA_SCHERMI.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.rho.toExponential(2)} Ω·m</option>)}</select></Campo>
          <N e="Tensione di tenuta Uw (kV)" v={UwC} set={setUwC} passo={0.5} />
          <Campo etichetta="Posa dello schermo"><select className={inputCls} value={nelSuolo ? "s" : "a"} onChange={(e) => setNelSuolo(e.target.value === "s")}><option value="s">A contatto con il suolo</option><option value="a">Isolato dal suolo o in aria</option></select></Campo>
          {nelSuolo ? <N e="Resistività del suolo ρ (Ω·m)" v={rhoSuolo} set={setRhoSuolo} passo={10} /> : <N e="Distanza dal punto di dispersione LC (m)" v={Lc} set={setLc} passo={5} />}
          <N e="Sezione dello schermo SC (mm²)" v={Sc} set={setSc} passo={1} />
        </div>
        <p className="mt-3 text-sm">LC = {f(LcEff, 1)} m{nelSuolo ? " (8 · √ρ)" : ""} · SCmin = IF · ρC · LC · 10⁶ / Uw = <strong>{f(scMin, 2)} mm²</strong></p>
        <Esito ok={Sc >= scMin}>{Sc >= scMin ? "Schermo sufficiente: niente scariche pericolose tra schermo e conduttori" : "Schermo insufficiente: servono SPD tra schermo e conduttori attivi"}</Esito>
        {schermo === "rame" && <p className="mt-2 text-sm">Limite termico per schermi in rame: IF ≤ 8 · SC = {f(correnteMaxSchermoRame(Sc), 0)} kA ({IF <= correnteMaxSchermoRame(Sc) ? "rispettato" : "superato"}).</p>}
      </Sezione>

      <Sezione id="contatto" titolo="Tensioni di contatto e di passo" rif="CEI EN IEC 62305-3:2024, 8.1 e 8.2">
        <div className="grid gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={c3m} onChange={(e) => setC3m(e.target.checked)} />In condizioni normali nessuno si trova entro 3 m dalle calate</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={c10} onChange={(e) => setC10(e.target.checked)} />Calate naturali: almeno 10 colonne o pilastri metallici interconnessi, continuità garantita</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={cSuolo} onChange={(e) => setCSuolo(e.target.checked)} />Entro 3 m dalla calata il suolo ha resistenza di contatto ≥ 100 kΩ (es. 5 cm di asfalto)</label>
        </div>
        <Esito ok={vc.tollerabile}>{vc.tollerabile ? `Pericolo tollerabile: ${vc.motivo}` : "Servono misure di protezione"}</Esito>
        {!vc.tollerabile && <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <div><p className="font-medium">Contro le tensioni di contatto</p><ul className="mt-1 list-disc pl-5">{vc.misureContatto.map((m) => <li key={m}>{m}</li>)}</ul></div>
          <div><p className="font-medium">Contro le tensioni di passo</p><ul className="mt-1 list-disc pl-5">{vc.misurePasso.map((m) => <li key={m}>{m}</li>)}</ul></div>
        </div>}
        <p className="mt-2 text-xs text-muted-foreground">Obiettivo delle misure contro il passo: al massimo 25 kV per un passo di 1 m con corrente 10/350 µs. Nell'analisi del rischio queste misure corrispondono al fattore PAM.</p>
      </Sezione>

      <Sezione id="esplosione" titolo="Strutture con rischio di esplosione" rif="CEI EN IEC 62305-3:2024, Allegato C">
        <Campo etichetta="Area pericolosa più critica"><select className={inputCls} value={atex} onChange={(e) => setAtex(e.target.value as ZonaAtex)}>
          <option value="0-20">Zone 0 e 20</option><option value="1-21">Zone 1 e 21</option><option value="2-22">Zone 2 e 22</option><option value="esplosivi-solidi">Materiali esplosivi solidi</option></select></Campo>
        <ul className="mt-3 space-y-1.5 text-sm">{requisitiEsplosione(atex).map((r) => <li key={r} className="flex gap-2"><input type="checkbox" aria-label={r} /><span>{r}</span></li>)}</ul>
        <p className="mt-2 text-xs text-muted-foreground">Lista di controllo da spuntare durante il progetto; le spunte non vengono salvate.</p>
      </Sezione>

      <Sezione id="schermatura" titolo="Schermatura magnetica" rif="CEI EN IEC 62305-4:2024, Allegato A (A.1–A.17, Tab. A.4)">
        <div className="grid gap-4 sm:grid-cols-4">
          <N e="Lato maglia dello schermo wm (m)" v={wm} set={setWm} passo={0.1} />
          <Campo etichetta="Materiale dello schermo"><select className={inputCls} value={mats} onChange={(e) => setMats(e.target.value as "rame-alluminio" | "acciaio")}><option value="rame-alluminio">Rame o alluminio</option><option value="acciaio">Acciaio (ferri d'armatura)</option></select></Campo>
          {mats === "acciaio" && <N e="Raggio dei tondini rc (m)" v={rc} set={setRc} passo={0.001} />}
          <N e="Lunghezza L (m)" v={Ls} set={setLs} passo={1} /><N e="Larghezza W (m)" v={Ws} set={setWs} passo={1} /><N e="Altezza H (m)" v={Hs} set={setHs} passo={1} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={rete} onChange={(e) => setRete(e.target.checked)} />Rete di collegamento equipotenziale magliata (5.3): campo diretto dimezzato, SF + 6 dB</label>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md bg-muted p-3"><p className="font-medium">Fulmine sullo schermo (I0 = {f(I0 / 1000, 0)} kA)</p>
            <p>H1 al centro = <strong>{f(dir.H1, 0)} A/m</strong> · vicino alla parete = <strong>{f(dirParete.H1, 0)} A/m</strong></p>
            <p className="text-xs">Volume sicuro a distanza dDF = wm = {f(dir.dDF, 2)} m dallo schermo.</p></div>
          <div className="rounded-md bg-muted p-3"><p className="font-medium">Fulmine nelle vicinanze (sa = {f(sa, 1)} m)</p>
            <p>SF = {f(SF25, 1)} dB (25 kHz) · {f(SF1, 1)} dB (1 MHz)</p>
            <p>Primo colpo: H0 = {f(vicPos.H0, 0)} → H1 = <strong>{f(vicPos.H1, 0)} A/m</strong> · successivi: {f(vicSucc.H0, 0)} → <strong>{f(vicSucc.H1, 0)} A/m</strong></p>
            <p className="text-xs">Volume sicuro a distanza dSF = {f(vicPos.dSF, 2)} m dallo schermo.</p></div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Confronta H1 con la tenuta al campo magnetico delle apparecchiature. Formule semplificate: per volumi piccoli o fulmini molto vicini serve un calcolo numerico del campo.</p>
      </Sezione>

      <Sezione id="spd" titolo="SPD: livello di protezione effettivo" rif="CEI EN IEC 62305-4:2024, Allegato C (C.1–C.5, regola n. 2)">
        <div className="grid gap-4 sm:grid-cols-4">
          <N e="Livello di protezione Up (kV)" v={Up} set={setUp} passo={0.1} />
          <Campo etichetta="Tipo di SPD"><select className={inputCls} value={tipoSpd} onChange={(e) => setTipoSpd(e.target.value as "limitatore" | "commutazione")}><option value="limitatore">Limitatore di tensione</option><option value="commutazione">A commutazione</option></select></Campo>
          <N e="Corrente nell'SPD (kA)" v={Ispd} set={setIspd} passo={0.5} />
          <N e="Lunghezza dei collegamenti (m)" v={lungh} set={setLungh} passo={0.1} />
          <N e="Tenuta Uw dell'apparecchiatura (kV)" v={UwS} set={setUwS} passo={0.5} />
          <N e="Tensione indotta Ui (kV)" v={Ui} set={setUi} passo={0.1} />
          <N e="Coefficiente di riflessione kr" v={kr} set={(v) => setKr(Math.min(2, Math.max(1, v)))} passo={0.1} min={1} />
        </div>
        <p className="mt-3 text-sm">ΔU = 0,1 · {f(Ispd, 1)} kA · {f(lungh, 2)} m = {f(DU, 2)} kV · Up/f = <strong>{f(Upf, 2)} kV</strong> · ammesso (Uw − Ui)/kr = <strong>{f(vs.ammesso, 2)} kV</strong></p>
        <Esito ok={vs.ok}>{vs.ok ? "Protezione verificata" : "Protezione insufficiente: SPD con Up più basso, collegamenti più corti (≤ 0,5 m), secondo SPD vicino all'apparecchiatura o meno tensione indotta"}</Esito>
        <p className="mt-2 text-xs text-muted-foreground">Con l'SPD all'ingresso dell'apparecchiatura la propagazione è trascurabile (kr = 1); con circuiti lunghi o aperti la tensione può raddoppiare (kr = 2). La tensione indotta si stima nella sezione seguente.</p>
      </Sezione>

      <Sezione id="indotta" titolo="Tensione indotta nel circuito protetto" rif="CEI EN IEC 62305-4:2024, Allegato H (H.1–H.3, Tab. H.1–H.3)">
        <div className="grid gap-4 sm:grid-cols-4">
          <N e="Distanza circuito–calata d (m)" v={dI} set={setDI} passo={0.1} />
          <N e="Distanza conduttori attivi–PE w (m)" v={wI} set={setWI} passo={0.01} />
          <N e="Tratto verticale lp (m)" v={lp} set={setLp} passo={0.5} />
          <N e="Tratto orizzontale lo (m)" v={lo} set={setLo} passo={0.5} />
          <N e="Numero di calate" v={calate} set={(v) => setCalate(Math.max(1, Math.round(v)))} passo={1} min={1} />
          <Campo etichetta="Schermo della struttura (ks1)"><select className={inputCls} value={sch1} onChange={(e) => setSch1(e.target.value as "nessuno" | "maglia" | "pieno")}><option value="nessuno">Nessuno</option><option value="maglia">A maglia</option><option value="pieno">Pieno ≥ 1 mm</option></select></Campo>
          {sch1 === "maglia" && <N e="Lato maglia esterna (m)" v={w1} set={setW1} passo={0.5} />}
          <Campo etichetta="Schermi interni (ks2)"><select className={inputCls} value={sch2} onChange={(e) => setSch2(e.target.value as "nessuno" | "maglia" | "pieno")}><option value="nessuno">Nessuno</option><option value="maglia">A maglia</option><option value="pieno">Pieno ≥ 1 mm</option></select></Campo>
          {sch2 === "maglia" && <N e="Lato maglia interna (m)" v={w2} set={setW2} passo={0.1} />}
        </div>
        <p className="mt-3 text-sm">kc = {f(kcI, 3)} · ks1 = {f(ks1, 4)} · ks2 = {f(ks2, 4)} · h = {f(ui.h, 2)} kV/m · leq = {f(ui.leq, 2)} m · q = {Q_INDOTTA[lpl]} V/m²</p>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <p className="rounded-md bg-muted p-3">Fulmine sulla struttura<br />Ui1 = <strong>{f(ui.Ui1, 2)} kV</strong></p>
          <p className="rounded-md bg-muted p-3">Fulmine vicino<br />Ui2 = <strong>{f(ui.Ui2 * 1000, 1)} V</strong></p>
          <p className="rounded-md bg-muted p-3">Fulmine sul servizio<br />Ui3 = <strong>{f(ui.Ui3, 2)} kV</strong></p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Ui è trascurabile (h = 0, q = 0) con struttura o locale schermato con maglia ≤ 0,1 m, circuito schermato o in condotto metallico chiuso collegato alle due estremità, fibra ottica senza parti metalliche, conduttore attivo e PE intrecciati.</p>
      </Sezione>

      <Sezione id="fotovoltaico" titolo="Impianti fotovoltaici sul tetto" rif="CEI EN IEC 62305-4:2024, Allegato F (F.1, Tab. F.1)">
        <div className="grid gap-4 sm:grid-cols-3">
          <N e="Calate esterne" v={calFV} set={(v) => setCalFV(Math.max(1, Math.round(v)))} passo={1} min={1} />
          <N e="Conduttori CC ed equipotenziali n'" v={nCC} set={(v) => setNCC(Math.max(1, Math.round(v)))} passo={1} min={1} />
        </div>
        <p className="mt-3 text-sm">Senza distanza di separazione, corrente in ogni conduttore CC: Idc = ILPL · kc / (2 · n') = {p.primoPositivo.I} · {kcFV} / (2 · {nCC}) = <strong>{f(correnteConduttoriCC(lpl, kcFV, nCC), 2)} kA</strong></p>
        <Tabella testa={["SPD limitatori lato CC (Tab. F.1)", "Iimp 10/350 (kA)", "In 8/20 (kA)"]} righe={[["Per polo verso terra (I1 = I2)", fv.singolo.Iimp, fv.singolo.In], ["Totale (I1 + I2)", fv.totale.Iimp, fv.totale.In]]} />
        <div className="mt-3"><Tabella testa={["SPD a commutazione lato CC (Tab. F.2)", "Iimp 10/350 (kA)"]} righe={[["Per polo verso terra (I1 = I2)", spdFotovoltaicoCommutazione(lpl, calFV).singolo], ["Totale (I1 + I2)", spdFotovoltaicoCommutazione(lpl, calFV).totale]]} /></div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>Distanza di separazione s rispettata: SPD di classe II sul lato CC (In ≥ 5 kA 8/20 con LPL III) per moduli e inverter.</li>
          <li>Distanza non rispettata: SPD di classe I sul lato CC, collegamento equipotenziale tra LPS e telaio e, consigliato, cablaggio CC schermato o in canale metallico collegato alle due estremità.</li>
        </ul>
      </Sezione>
    </main>
  </>;
}
