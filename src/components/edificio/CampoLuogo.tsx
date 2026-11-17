import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { anteprimaGoogleMaps, cercaLuoghi, fornitoreGeo, linkGoogleEarth, linkGoogleMaps, luogoDaCoordinate, posizioneDispositivo, type Luogo } from "@/lib/geo";

export interface ValoreLuogo { comune: string; indirizzo?: string | undefined; lat?: number | null | undefined; lon?: number | null | undefined }

/** Comune o indirizzo del progetto: ricerca con suggerimenti, posizione del dispositivo, anteprima satellitare e collegamenti a Google Maps ed Earth. */
export function CampoLuogo({ valore, onChange }: { valore: ValoreLuogo; onChange: (v: ValoreLuogo) => void }) {
  const [testo, setTesto] = useState(valore.indirizzo || valore.comune || "");
  const [voci, setVoci] = useState<Luogo[]>([]);
  const [aperto, setAperto] = useState(false);
  const [msg, setMsg] = useState("");
  const [cerco, setCerco] = useState(false);
  const scritto = useRef(false);
  const haPosizione = typeof valore.lat === "number" && typeof valore.lon === "number";

  // quando si apre un altro progetto il campo segue i dati salvati
  useEffect(() => { if (!scritto.current) setTesto(valore.indirizzo || valore.comune || ""); }, [valore.indirizzo, valore.comune]);

  useEffect(() => {
    if (!scritto.current || testo.trim().length < 3) { setVoci([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setCerco(true);
      cercaLuoghi(testo, ctl.signal).then((l) => { setVoci(l); setAperto(true); setMsg(l.length ? "" : "Nessun luogo trovato: controlla il testo o scrivi solo il comune."); })
        .catch((e: unknown) => { if (!(e instanceof DOMException && e.name === "AbortError")) setMsg("Ricerca non disponibile in questo momento: puoi scrivere il comune a mano."); })
        .finally(() => setCerco(false));
    }, 700);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [testo]);

  function scegli(l: Luogo) {
    scritto.current = false;
    setTesto(l.etichetta); setVoci([]); setAperto(false); setMsg("");
    onChange({ comune: l.comune || valore.comune, indirizzo: l.etichetta, lat: l.lat, lon: l.lon });
  }
  async function miaPosizione() {
    setMsg("Cerco la posizione…");
    try {
      const p = await posizioneDispositivo();
      scegli(await luogoDaCoordinate(p.lat, p.lon));
    } catch (e) { setMsg(e instanceof Error ? e.message : "Posizione non disponibile."); }
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
            <input className={inputCls} value={testo} autoComplete="off" placeholder="Es. Via Roma 1, Bergamo" role="combobox" aria-expanded={aperto && voci.length > 0} aria-controls="luoghi-trovati" aria-autocomplete="list"
              onChange={(e) => scrivi(e.target.value)} onFocus={() => setAperto(true)} onBlur={() => setTimeout(() => setAperto(false), 200)} />
            {testo && <button type="button" aria-label="Cancella" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { scritto.current = false; setTesto(""); setVoci([]); onChange({ comune: "", indirizzo: undefined, lat: null, lon: null }); }}><X className="size-4" /></button>}
          </div>
          <Button type="button" variant="outline" onClick={() => void miaPosizione()}><LocateFixed />La mia posizione</Button>
        </div>
        {aperto && voci.length > 0 && <ul id="luoghi-trovati" role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-md border bg-card shadow-lg">
          {voci.map((l) => <li key={`${l.lat},${l.lon}`} role="option" aria-selected={false}>
            <button type="button" className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={(e) => e.preventDefault()} onClick={() => scegli(l)}><MapPin className="mt-0.5 size-4 shrink-0 text-primary" /><span>{l.etichetta}</span></button>
          </li>)}
        </ul>}
      </div>
    </Campo>
    <p role="status" className="mt-1 text-xs text-muted-foreground">{msg || (cerco ? "Ricerca…" : `Scrivi almeno 3 lettere e scegli dall'elenco, oppure usa la posizione del dispositivo. Ricerca: ${fornitoreGeo()}.`)}{fornitoreGeo() !== "Google Maps" && <> Dati © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">contributori OpenStreetMap</a>.</>}</p>
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
