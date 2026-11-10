import { CampoLuogo } from "@/components/edificio/CampoLuogo";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { aggiornaEsteso } from "@/lib/statoProgetto";
import { ArrowLeft } from "lucide-react";
import opzioni from "@/dati/opzioniEdificio.json";
import fattoriPosizione from "@/dati/rischio/fattorePosizione.json";
import { areaRaccolta } from "@/calcoli/rischio/areaRaccolta";
import { eventiPericolosi } from "@/calcoli/rischio/eventiPericolosi";
import { aggiornaDati, useDatiEdificio } from "@/lib/progettoStore";
import { Campo, inputCls } from "@/components/Campo";

const fmt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const fmtND = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4, minimumFractionDigits: 4 });

export function DatiEdificioPage() {
  const d = useDatiEdificio();
  const navigate = useNavigate();
  function caricaEsempio() {
    if (!window.confirm("Caricare l'esempio di prova? I dati edificio e il modello 3D attuali saranno sostituiti.")) return;
    aggiornaDati({ nomeProgetto: "Prova capannone", comune: "Torino", L: 60, W: 40, H: 8, copertura: "Piana", materiale: "Cemento armato", lplProgetto: "II" });
    aggiornaEsteso({ lpl: "II", aste: [], conduttori: [], supporti: [], morsetti: [], compensatori: [], distinta: [], picchetti: [], terra: null, modello: { corpi: [{ id: "corpo-prova", nome: "Capannone", impronta: [[0, 0], [60, 0], [60, 40], [0, 40]], quotaBase: 0, altezzaGronda: 8, tipoTetto: "piano", altezzaColmo: 8 }] } });
    void navigate({ to: "/edificio-3d" });
  }
  const num = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);
  const AD = areaRaccolta(d.L, d.W, d.H);
  const posizione = fattoriPosizione.find((f) => f.id === d.posizioneId)
    ?? { id: "isolata", descrizione: "Isolata, nessun oggetto nelle vicinanze", valore: 1, riferimentoNorma: "" };
  const ND = eventiPericolosi(2 * d.densita, AD, posizione.valore); // NSG = k·NG con k = 2 (CEI EN IEC 62305-2:2024, A.1)

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-32 md:pb-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent">
        <ArrowLeft className="h-4 w-4" /> Moduli
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl font-bold">Dati edificio</h1><Button type="button" variant="outline" onClick={caricaEsempio}>Carica esempio di prova</Button></div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_300px]">
        <form className="space-y-6 rounded-lg border bg-card p-5" onSubmit={(e) => e.preventDefault()}>
          <section className="grid gap-4 sm:grid-cols-2">
            <Campo etichetta="Nome progetto">
              <input className={inputCls} value={d.nomeProgetto} onChange={(e) => aggiornaDati({ nomeProgetto: e.target.value })} />
            </Campo>
            <CampoLuogo valore={{ comune: d.comune, indirizzo: d.indirizzo, lat: d.lat, lon: d.lon }} onChange={(v) => aggiornaDati({ comune: v.comune, indirizzo: v.indirizzo, lat: v.lat ?? null, lon: v.lon ?? null })} />
          </section>
          <section className="grid grid-cols-3 gap-3">
            {(["L", "W", "H"] as const).map((k) => (
              <Campo key={k} etichetta={`${k === "L" ? "Lunghezza" : k === "W" ? "Larghezza" : "Altezza"} ${k} (m)`}>
                <input className={`${inputCls} font-mono`} type="number" inputMode="decimal" min={0} step="0.1"
                  value={d[k] || ""} onChange={(e) => aggiornaDati({ [k]: num(e.target.value) })} />
              </Campo>
            ))}
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            <Campo etichetta="Tipo di copertura">
              <select className={inputCls} value={d.copertura} onChange={(e) => aggiornaDati({ copertura: e.target.value })}>
                {opzioni.coperture.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Campo>
            <Campo etichetta="Materiale della struttura">
              <select className={inputCls} value={d.materiale} onChange={(e) => aggiornaDati({ materiale: e.target.value })}>
                {opzioni.materiali.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Campo>
          </section>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" className="h-5 w-5 accent-accent" checked={d.impiantiTetto}
              onChange={(e) => aggiornaDati({ impiantiTetto: e.target.checked })} />
            Presenza di impianti sul tetto
          </label>

          <fieldset className="space-y-4 border-t pt-5">
            <legend className="font-display text-base font-semibold">Posizione e fulminazione</legend>
            <Campo etichetta="Posizione della struttura">
              <select className={inputCls} value={d.posizioneId} onChange={(e) => aggiornaDati({ posizioneId: e.target.value })}>
                {fattoriPosizione.map((f) => (
                  <option key={f.id} value={f.id}>{f.descrizione} (C<sub>D</sub> = {f.valore})</option>
                ))}
              </select>
            </Campo>
            <Campo etichetta="Densità di fulminazione al suolo (fulmini/km²·anno)">
              <input className={`${inputCls} font-mono`} type="number" inputMode="decimal" min={0} step="0.1"
                value={d.densita || ""} onChange={(e) => aggiornaDati({ densita: num(e.target.value) })} />
              <p className="mt-1 text-xs text-muted-foreground">
                Valore da ricavare per il comune di progetto dalla mappa ufficiale di riferimento
              </p>
            </Campo>
          </fieldset>

          <p className="text-xs text-muted-foreground">I dati vengono salvati automaticamente su questo dispositivo.</p>
          <fieldset className="space-y-2 border-t pt-5">
            <legend className="font-display text-base font-semibold">Livello di protezione (LPL)</legend>
            <div role="group" aria-label="Livello di protezione (LPL)" className="grid grid-cols-4 gap-2">
              {(["I", "II", "III", "IV"] as const).map((l) => (
                <Button key={l} type="button" variant={d.lplProgetto === l ? "default" : "outline"} aria-pressed={d.lplProgetto === l}
                  onClick={() => { aggiornaDati({ lplProgetto: l }); aggiornaEsteso({ lpl: l }); }}>{l}</Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Scelta manuale finché l'Analisi del rischio non è attiva</p>
          </fieldset>
        </form>

        <aside className="fixed inset-x-0 bottom-0 z-10 border-t-4 border-primary bg-ardesia p-4 text-white md:static md:rounded-lg md:border-t-0 md:border-l-4 md:self-start">
          <div className="font-mono text-xs uppercase tracking-wider opacity-70">Area di raccolta A<sub>D</sub></div>
          <div className="mt-1 font-mono text-3xl font-bold text-accent">{fmt.format(AD)} <span className="text-base">m²</span></div>
          <div className="mt-2 hidden font-mono text-xs opacity-70 md:block">A<sub>D</sub> = L·W + 2·(3H)·(L+W) + π·(3H)²</div>

          <div className="mt-4 border-t border-primary-foreground/20 pt-3">
            <div className="font-mono text-xs uppercase tracking-wider opacity-70">Fattore di posizione C<sub>D</sub></div>
            <div className="mt-1 font-mono text-xl font-bold">{posizione.valore}</div>

            <div className="mt-3 font-mono text-xs uppercase tracking-wider opacity-70">Eventi pericolosi N<sub>D</sub> · N<sub>SG</sub> = 2 · N<sub>G</sub></div>
            <div className="mt-1 font-mono text-xl font-bold text-accent">{fmtND.format(ND)} <span className="text-sm">eventi/anno</span></div>
            {ND > 0 && (
              <div className="mt-1 font-mono text-sm opacity-80">1 fulmine ogni {Math.round(1 / ND)} anni</div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
