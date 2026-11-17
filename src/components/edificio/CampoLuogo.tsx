import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Building2, Crosshair, Landmark, LocateFixed, MapPin, Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { ErrorePosizione, anteprimaGoogleMaps, cercaLuoghi, fornitoreGeo, linkGoogleEarth, linkGoogleMaps, luogoDaCoordinate, posizioneDispositivo, type Luogo } from "@/lib/geo";

/** Parte scritta evidenziata in grassetto, come nei suggerimenti di Google Maps. */
function Evidenzia({ testo, cerca }: { testo: string; cerca: string }) {
  const parole = cerca.trim().toLowerCase().split(/\s+/).filter((p) => p.length > 1);
  if (!parole.length) return <>{testo}</>;
  const re = new RegExp(`(${parole.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return <>{testo.split(re).map((t, i) => (i % 2 ? <strong key={i} className="font-semibold text-foreground">{t}</strong> : <span key={i}>{t}</span>))}</>;
}
const IconaTipo = ({ tipo }: { tipo?: string | undefined }) => tipo === "comune" || tipo === "provincia" || tipo === "regione" ? <Landmark className="mt-0.5 size-4 shrink-0 text-primary" /> : tipo === "indirizzo" ? <Building2 className="mt-0.5 size-4 shrink-0 text-primary" /> : tipo === "via" ? <Navigation className="mt-0.5 size-4 shrink-0 text-primary" /> : tipo === "coordinate" ? <Crosshair className="mt-0.5 size-4 shrink-0 text-primary" /> : <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />;

export interface ValoreLuogo { comune: string; indirizzo?: string | undefined; lat?: number | null | undefined; lon?: number | null | undefined }

/** Comune o indirizzo del progetto: ricerca con suggerimenti, posizione del dispositivo, anteprima satellitare e collegamenti a Google Maps ed Earth. */
export function CampoLuogo({ valore, onChange }: { valore: ValoreLuogo; onChange: (v: ValoreLuogo) => void }) {
  const [testo, setTesto] = useState(valore.indirizzo || valore.comune || "");
  const [voci, setVoci] = useState<Luogo[]>([]);
  const [aperto, setAperto] = useState(false);
  const [msg, setMsg] = useState("");
  const [cerco, setCerco] = useState(false);
  const [attivo, setAttivo] = useState(-1);
  const [passi, setPassi] = useState<string[]>([]);
  const scritto = useRef(false);
  const haPosizione = typeof valore.lat === "number" && typeof valore.lon === "number";

  // quando si apre un altro progetto il campo segue i dati salvati
  useEffect(() => { if (!scritto.current) setTesto(valore.indirizzo || valore.comune || ""); }, [valore.indirizzo, valore.comune]);

  useEffect(() => {
    if (!scritto.current || testo.trim().length < 2) { setVoci([]); return; }
    const ctl = new AbortController();
    const vicino = typeof valore.lat === "number" && typeof valore.lon === "number" ? { lat: valore.lat, lon: valore.lon } : null;
    const t = setTimeout(() => {
      setCerco(true);
      cercaLuoghi(testo, ctl.signal, vicino).then((l) => { setVoci(l); setAttivo(-1); setAperto(true); setMsg(l.length ? "" : "Nessun luogo trovato: controlla il testo o scrivi solo il comune."); })
        .catch((e: unknown) => { if (!(e instanceof DOMException && e.name === "AbortError")) setMsg("Ricerca non disponibile in questo momento: puoi scrivere il comune a mano."); })
        .finally(() => setCerco(false));
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [testo]);

  function scegli(l: Luogo) {
    scritto.current = false;
    setTesto(l.etichetta); setVoci([]); setAperto(false); setMsg("");
    onChange({ comune: l.comune || valore.comune, indirizzo: l.etichetta, lat: l.lat, lon: l.lon });
  }
  async function miaPosizione() {
    setMsg("Cerco la posizione…"); setPassi([]);
    try {
      const p = await posizioneDispositivo();
      scegli(await luogoDaCoordinate(p.lat, p.lon));
      if (p.precisione && p.precisione > 500) setMsg(`Posizione approssimata (circa ${Math.round(p.precisione / 100) / 10} km): controlla l'indirizzo o scrivilo nella ricerca.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Posizione non disponibile.");
      setPassi(e instanceof ErrorePosizione ? e.passi : []);
    }
  }
  function tasto(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && voci.length) { e.preventDefault(); setAperto(true); setAttivo((a) => (a + 1) % voci.length); }
    else if (e.key === "ArrowUp" && voci.length) { e.preventDefault(); setAttivo((a) => (a <= 0 ? voci.length - 1 : a - 1)); }
    else if (e.key === "Enter" && aperto && voci.length) { e.preventDefault(); const v = voci[attivo >= 0 ? attivo : 0]; if (v) scegli(v); }
    else if (e.key === "Escape") { setAperto(false); setAttivo(-1); }
  }
  function scrivi(v: string) {
    scritto.current = true;
    setTesto(v);
    // il testo scritto a mano vale come comune finché non si sceglie un suggerimento
    onChange({ comune: v, indirizzo: undefined, lat: null, lon: null });
  }

  return <div className="sm:col-span-2">
    <Campo etichetta="Comune o indirizzo">
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input className={inputCls} value={testo} autoComplete="off" placeholder="Cerca indirizzo, luogo, comune o coordinate" role="combobox" aria-expanded={aperto && voci.length > 0} aria-controls="luoghi-trovati" aria-autocomplete="list"
              aria-activedescendant={attivo >= 0 ? `luogo-${attivo}` : undefined} enterKeyHint="search"
              onChange={(e) => scrivi(e.target.value)} onKeyDown={tasto} onFocus={() => setAperto(true)} onBlur={() => setTimeout(() => setAperto(false), 200)} />
            {testo && <button type="button" aria-label="Cancella" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { scritto.current = false; setTesto(""); setVoci([]); onChange({ comune: "", indirizzo: undefined, lat: null, lon: null }); }}><X className="size-4" /></button>}
          </div>
          <Button type="button" variant="outline" onClick={() => void miaPosizione()}><LocateFixed />La mia posizione</Button>
        </div>
        {aperto && voci.length > 0 && <ul id="luoghi-trovati" role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-auto rounded-md border bg-card py-1 shadow-lg">
          {voci.map((l, i) => <li key={`${l.lat},${l.lon},${i}`} id={`luogo-${i}`} role="option" aria-selected={i === attivo}>
            <button type="button" className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-muted ${i === attivo ? "bg-muted" : ""}`} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setAttivo(i)} onClick={() => scegli(l)}>
              <IconaTipo tipo={l.tipo} />
              <span className="min-w-0"><span className="block truncate text-muted-foreground"><Evidenzia testo={l.principale || l.etichetta} cerca={testo} /></span>
                {l.secondario && <span className="block truncate text-xs text-muted-foreground">{l.secondario}</span>}</span>
            </button>
          </li>)}
        </ul>}
      </div>
    </Campo>
    {passi.length > 0 && <div role="alert" className="mt-2 rounded-md border-l-4 border-accent bg-muted/50 p-3 text-sm">
      <p className="font-medium">{msg}</p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5">{passi.map((p) => <li key={p}>{p}</li>)}</ol>
      <p className="mt-1 text-xs text-muted-foreground">Intanto puoi scrivere l'indirizzo nella ricerca: funziona anche senza posizione.</p>
    </div>}
    <p role="status" className="mt-1 text-xs text-muted-foreground">{(passi.length ? "" : msg) || (cerco ? "Ricerca…" : `Scrivi e scegli dall'elenco (frecce e Invio), incolla coordinate, oppure usa la posizione del dispositivo. Ricerca: ${fornitoreGeo()}.`)}{fornitoreGeo() !== "Google Maps" && <> Dati © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">contributori OpenStreetMap</a>.</>}</p>
    {haPosizione && <div className="mt-3 rounded-lg border-[0.8px] border-bordo-scheda p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p><strong>{valore.comune || "Comune non indicato"}</strong> · <span className="font-mono">{valore.lat!.toFixed(5)}, {valore.lon!.toFixed(5)}</span></p>
        <p className="flex gap-3">
          <a className="font-medium text-primary underline" href={linkGoogleMaps(valore.lat!, valore.lon!)} target="_blank" rel="noreferrer">Apri in Google Maps</a>
          <a className="font-medium text-primary underline" href={linkGoogleEarth(valore.lat!, valore.lon!)} target="_blank" rel="noreferrer">Apri in Google Earth</a>
        </p>
      </div>
      <iframe title="Vista satellitare di Google Maps" src={anteprimaGoogleMaps(valore.lat!, valore.lon!)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="mt-2 h-64 w-full rounded-md border-0" />
      <Campo etichetta="Comune (per la relazione)"><input className={inputCls} value={valore.comune} onChange={(e) => onChange({ ...valore, comune: e.target.value })} /></Campo>
    </div>}
  </div>;
}
