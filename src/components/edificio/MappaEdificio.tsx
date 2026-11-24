/**
 * Edificio dalla mappa: cerca tutti gli edifici del riquadro su OpenStreetMap (contorni, parti e altezze),
 * li colora per altezza, si scelgono con un tocco (o tutti insieme) e si importano come corpi.
 * Fondo: mappa OSM, ortofoto Esri o PCN. Si può anche disegnare un'impronta a mano.
 */
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/Campo";
import { locale } from "@/calcoli/edificio/geometria";
import type { ModelloEdificio } from "@/calcoli/edificio/tipi";
import { corpiDaOsm, edificiDaOverpass, queryOverpass, type EdificioOSM } from "@/calcoli/edificio/osmEdifici";

const SERVER = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const colore = (h: number | null) => (h == null ? "#7694a4" : h < 6 ? "#f9c66b" : h < 12 ? "#f39b00" : h < 25 ? "#d9480f" : "#a61e4d");

export default function MappaEdificio({ onImport, centro, indirizzoIniziale }: { onImport: (m: ModelloEdificio) => void; centro?: { lat: number; lon: number } | null; indirizzoIniziale?: string }) {
  const div = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null), library = useRef<typeof Leaflet | null>(null);
  const draw = useRef<[number, number][]>([]), drawing = useRef(false), polygon = useRef<Leaflet.Polyline | null>(null);
  const strato = useRef<Leaflet.LayerGroup | null>(null), forme = useRef(new Map<string, Leaflet.Polygon>());
  const [indirizzo, setIndirizzo] = useState(indirizzoIniziale ?? ""), [msg, setMsg] = useState(""), [altezza, setAltezza] = useState(9), [disegna, setDisegna] = useState(false);
  const [edifici, setEdifici] = useState<EdificioOSM[]>([]), [scelti, setScelti] = useState<Set<string>>(new Set()), [busy, setBusy] = useState(false);
  const sceltiRef = useRef(scelti); sceltiRef.current = scelti;

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !div.current) return;
      library.current = L;
      const m = L.map(div.current).setView(centro ? [centro.lat, centro.lon] : [41.9, 12.5], centro ? 18 : 6);
      map.current = m;
      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 20 }).addTo(m);
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Esri, Maxar, Earthstar Geographics", maxZoom: 20 });
      const orto = L.tileLayer.wms("https://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/ortofoto_colore_12.map", { layers: "OI.ORTOIMMAGINI.2012.32,OI.ORTOIMMAGINI.2012.33", format: "image/png", transparent: false, version: "1.3.0", attribution: "Geoportale Nazionale PCN — ortofoto 2012" });
      orto.on("tileerror", () => setMsg("Ortofoto PCN non disponibile per questo riquadro."));
      L.control.layers({ Mappa: osm, Satellite: sat, "Ortofoto PCN 2012": orto }).addTo(m);
      strato.current = L.layerGroup().addTo(m);
      m.on("click", (e) => { if (!drawing.current) return; draw.current.push([e.latlng.lat, e.latlng.lng]); polygon.current?.remove(); polygon.current = L.polyline(draw.current, { color: "#e2001a" }).addTo(m); });
    });
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // colori della selezione
  useEffect(() => {
    for (const e of edifici) { const f = forme.current.get(e.id); if (!f) continue; const s = scelti.has(e.id); f.setStyle({ color: s ? "#e2001a" : "#41525d", weight: s ? 3 : 1, fillColor: s ? "#e2001a" : colore(e.altezza), fillOpacity: s ? 0.45 : 0.35 }); }
  }, [scelti, edifici]);

  async function cerca() {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(indirizzo)}`);
      if (!r.ok) throw new Error();
      const d = (await r.json()) as { lat: string; lon: string }[];
      const p = d[0]; if (!p) { setMsg("Indirizzo non trovato."); return; }
      map.current?.setView([Number(p.lat), Number(p.lon)], 18);
    } catch { setMsg("Ricerca indirizzi temporaneamente non disponibile."); }
  }

  async function trova() {
    const m = map.current, L = library.current, g = strato.current; if (!m || !L || !g) return;
    const b = m.getBounds();
    if (b.getNorth() - b.getSouth() > 0.012) { setMsg("Avvicina la mappa (zona più piccola) prima di cercare gli edifici."); return; }
    setBusy(true); setMsg("Cerco gli edifici della zona…");
    const q = queryOverpass(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
    let dati: unknown = null;
    for (const s of SERVER) { try { const r = await fetch(s, { method: "POST", body: new URLSearchParams({ data: q }) }); if (r.ok) { dati = await r.json(); break; } } catch { /* prova il server successivo */ } }
    setBusy(false);
    if (!dati) { setMsg("Servizio degli edifici (Overpass) non disponibile: riprova tra poco o disegna l'impronta a mano."); return; }
    const lista = edificiDaOverpass(dati as Parameters<typeof edificiDaOverpass>[0]);
    g.clearLayers(); forme.current.clear();
    for (const e of lista) {
      const f = L.polygon(e.punti, { color: "#41525d", weight: 1, fillColor: colore(e.altezza), fillOpacity: 0.35 }).addTo(g);
      const h = e.altezza == null ? `altezza non indicata (si usano ${altezza} m)` : `${e.altezza.toLocaleString("it-IT")} m${e.stimata ? " (stimata dai piani)" : ""}`;
      f.bindTooltip(`${e.nome}<br>${h}${e.parti.length ? `<br>${e.parti.length} parti con altezze diverse` : ""}`);
      f.on("click", () => { if (drawing.current) return; const s = new Set(sceltiRef.current); if (s.has(e.id)) s.delete(e.id); else s.add(e.id); setScelti(s); });
      forme.current.set(e.id, f);
    }
    setEdifici(lista); setScelti(new Set());
    const conH = lista.filter((e) => e.altezza != null).length;
    setMsg(`${lista.length} edifici trovati (${conH} con altezza). Tocca quelli da importare oppure «Seleziona tutti».`);
  }

  function importaScelti() {
    const sel = edifici.filter((e) => scelti.has(e.id)); const p0 = sel[0]?.punti[0]; if (!p0) return;
    const origine = { lat: p0[0], lon: p0[1] };
    const corpi = corpiDaOsm(sel, origine, altezza);
    onImport({ origineGeo: origine, corpi });
    setMsg(`${corpi.length} corpi importati da ${sel.length} edifici. Controlla le altezze in «Pianta 2D, altezze e blocchi sul tetto».`);
    setScelti(new Set());
  }
  function importaDisegno() {
    if (draw.current.length < 3) { setMsg("Seleziona almeno tre punti."); return; }
    const first = draw.current[0]!, origine = { lat: first[0], lon: first[1] };
    onImport({ origineGeo: origine, corpi: [{ id: crypto.randomUUID(), nome: "Impronta da mappa", impronta: draw.current.map(([lat, lon]) => locale(lat, lon, origine)), quotaBase: 0, altezzaGronda: altezza, tipoTetto: "piano", altezzaColmo: altezza }] });
    setMsg("Impronta importata.");
  }

  return <div>
    <div className="flex flex-wrap items-end gap-2">
      <input aria-label="Indirizzo" placeholder="Indirizzo o luogo" className={`${inputCls} max-w-xs`} value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void cerca(); }} />
      <Button variant="outline" onClick={cerca}>Vai</Button>
      <Button onClick={trova} disabled={busy}>{busy ? "Cerco…" : "Trova tutti gli edifici della zona"}</Button>
      <label className="text-xs">Altezza se manca (m)<input aria-label="Altezza se manca (m)" className={`${inputCls} w-24`} type="number" min={0.1} step={0.5} value={altezza} onChange={(e) => setAltezza(Number(e.target.value) || 9)} /></label>
    </div>
    {edifici.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setScelti(new Set(edifici.map((e) => e.id)))}>Seleziona tutti ({edifici.length})</Button>
      <Button size="sm" variant="outline" disabled={!scelti.size} onClick={() => setScelti(new Set())}>Deseleziona</Button>
      <Button size="sm" disabled={!scelti.size} onClick={importaScelti}>Importa selezionati ({scelti.size})</Button>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">Altezza: {[["< 6 m", "#f9c66b"], ["6–12", "#f39b00"], ["12–25", "#d9480f"], ["> 25", "#a61e4d"], ["non indicata", "#7694a4"]].map(([t, c]) => <span key={t} className="inline-flex items-center gap-1"><i className="inline-block size-3 rounded-sm" style={{ background: c }} />{t}</span>)}</span>
    </div>}
    <div className="mt-2 flex flex-wrap gap-2">
      <Button size="sm" variant={disegna ? "default" : "outline"} onClick={() => { drawing.current = !disegna; setDisegna(!disegna); draw.current = []; polygon.current?.remove(); }}>{disegna ? "Fine disegno" : "Disegna impronta a mano"}</Button>
      {disegna && <Button size="sm" onClick={importaDisegno}>Importa impronta</Button>}
    </div>
    <p role="status" className="my-2 text-sm">{msg}</p>
    <div ref={div} className="relative z-0 h-[480px] w-full rounded-md border" />
    <p className="mt-1 text-xs text-muted-foreground">Edifici e altezze da OpenStreetMap (dove mancano si usa l'altezza indicata sopra; le parti dell'edificio con altezze diverse diventano corpi separati). Immagini satellitari Esri solo come fondo.</p>
  </div>;
}
