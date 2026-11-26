/**
 * Edificio 3D – modifica a mano: pannello dell'elemento selezionato (asta, conduttore, dispersore) e sezione della
 * distanza di separazione con la ripartizione reale della corrente (potenziali ai nodi).
 */
import { useMemo, useState } from "react";
import { Cable, Copy, Link2, Trash2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import type { Asta, Conduttore, Corpo, Punto3 } from "@/calcoli/edificio/tipi";
import { ASTE_CATALOGO, astaCatalogoPer } from "@/calcoli/captazione/asteCatalogo";
import type { CatalogoCaptazione } from "@/calcoli/captazione/proponiCaptazione";
import { calataDaPunto, collegaAsta, copiaAsta, type Aggiunte } from "@/calcoli/captazione/modificaManuale";
import { coloreS, separazioneNodi, type RisultatoSeparazioneNodi } from "@/calcoli/calate/separazioneNodi";
import { KI, KM, distanzaSeparazione, kcSemplificato, type Livello } from "@/calcoli/calate/separazione";
import type { EtichettaViewer, SelezioneViewer, TrattoColorato } from "@/components/edificio/ViewerEdificio";

/** Spostamento preciso di un blocco: di quanti metri in X (est) e Y (nord), con frecce da 0,5 m. */
function SpostaBlocco({ onSposta }: { onSposta: (dx: number, dy: number) => void }) {
  const [dx, setDx] = useState(0), [dy, setDy] = useState(0), passo = 0.5;
  return <div className="mt-3 flex flex-wrap items-end gap-3">
    <Campo etichetta="Sposta in X (m, + verso est)"><input className={inputCls} type="number" step={0.1} value={dx} onChange={(e) => setDx(Number(e.target.value) || 0)} /></Campo>
    <Campo etichetta="Sposta in Y (m, + verso nord)"><input className={inputCls} type="number" step={0.1} value={dy} onChange={(e) => setDy(Number(e.target.value) || 0)} /></Campo>
    <Button disabled={!dx && !dy} onClick={() => { onSposta(dx, dy); setDx(0); setDy(0); }}>Sposta</Button>
    <div className="flex gap-1" role="group" aria-label="Sposta di 0,5 m">
      <Button size="sm" variant="outline" aria-label="Ovest 0,5 m" title="0,5 m verso ovest" onClick={() => onSposta(-passo, 0)}>←</Button>
      <Button size="sm" variant="outline" aria-label="Nord 0,5 m" title="0,5 m verso nord" onClick={() => onSposta(0, passo)}>↑</Button>
      <Button size="sm" variant="outline" aria-label="Sud 0,5 m" title="0,5 m verso sud" onClick={() => onSposta(0, -passo)}>↓</Button>
      <Button size="sm" variant="outline" aria-label="Est 0,5 m" title="0,5 m verso est" onClick={() => onSposta(passo, 0)}>→</Button>
    </div>
  </div>;
}

const f = (v: number, c = 2) => (Number.isFinite(v) ? v.toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }) : "—");
const lung = (p: Punto3[]) => p.slice(1).reduce((t, q, i) => t + Math.hypot(q[0] - p[i]![0], q[1] - p[i]![1], q[2] - p[i]![2]), 0);
export interface PicchettoMin { id: string; x: number; y: number; z: number; lunghezza: number; codiceOBO: string }

export function PannelloSelezione({ conImpianto = true, onConImpianto, onSpostaCorpo, selezione, aste, conduttori, picchetti, corpi, cat, parete, onAste, onConduttori, onPicchetti, onAggiungi, onChiudi }: {
  conImpianto?: boolean; onConImpianto?: (v: boolean) => void; onSpostaCorpo?: (id: string, dx: number, dy: number) => void;
  selezione: SelezioneViewer; aste: Asta[]; conduttori: Conduttore[]; picchetti: PicchettoMin[]; corpi: Corpo[]; cat: CatalogoCaptazione; parete: string;
  onAste: (a: Asta[]) => void; onConduttori: (c: Conduttore[]) => void; onPicchetti: (p: PicchettoMin[]) => void; onAggiungi: (a: Aggiunte, msg: string) => void; onChiudi: () => void;
}) {
  if (!selezione) return null;
  const testata = (t: string) => <div className="flex items-center justify-between"><h3 className="font-semibold">{t}</h3><Button size="icon" variant="ghost" aria-label="Chiudi" onClick={onChiudi}><X /></Button></div>;
  if (selezione.tipo === "corpo") {
    const k = corpi.find((x) => x.id === selezione.id); if (!k) return null;
    const top = (k.quotaBase ?? 0) + Math.max(k.altezzaGronda, k.tipoTetto === "falde" ? k.altezzaColmo : 0);
    return <section className="mt-3 rounded-lg border border-primary/50 bg-card p-4" aria-label="Blocco selezionato">
      {testata(`Blocco selezionato · ${k.nome || "Corpo"} · H ${f(top, 2)} m`)}
      <p className="text-xs text-muted-foreground">Trascina il blocco nel 3D per spostarlo: si aggancia ogni 10 cm e ai lati degli altri blocchi. Oppure scrivi di quanto spostarlo. Altezze e quote si cambiano in «Pianta 2D, altezze e blocchi sul tetto».</p>
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={conImpianto} onChange={(e) => onConImpianto?.(e.target.checked)} />Sposta anche aste, conduttori, supporti e dispersori che stanno sul blocco</label>
      {onSpostaCorpo && <SpostaBlocco onSposta={(dx, dy) => onSpostaCorpo(k.id, dx, dy)} />}
    </section>;
  }
  if (selezione.tipo === "asta") {
    const a = aste.find((x) => x.id === selezione.id); if (!a) return null;
    const set = (p: Partial<Asta>) => onAste(aste.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
    return <section className="mt-3 rounded-lg border border-primary/50 bg-card p-4" aria-label="Asta selezionata">
      {testata(`Asta selezionata · ${f(a.altezza, 1)} m${a.codiceOBO ? ` · ${a.codiceOBO}` : ""}`)}
      <p className="text-xs text-muted-foreground">Trascina l'asta nel 3D per spostarla (con «Seleziona e sposta» attivo), oppure scrivi le coordinate.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Campo etichetta="Asta a catalogo"><select className={inputCls} value={a.altezza} onChange={(e) => { const h = Number(e.target.value), c = astaCatalogoPer(h); set({ altezza: h, ...(c ? { diametro: c.diametro, codiceOBO: c.codice ?? "" } : {}) }); }}>{ASTE_CATALOGO.map((c) => <option key={c.posa + c.altezza} value={c.altezza}>{c.descrizione}{c.codice ? ` (${c.codice})` : ""}</option>)}</select></Campo>
        <Campo etichetta="X (m)"><input className={inputCls} type="number" step={0.1} value={Math.round(a.x * 100) / 100} onChange={(e) => set({ x: Number(e.target.value) })} /></Campo>
        <Campo etichetta="Y (m)"><input className={inputCls} type="number" step={0.1} value={Math.round(a.y * 100) / 100} onChange={(e) => set({ y: Number(e.target.value) })} /></Campo>
        <Campo etichetta="Quota della base (m)"><input className={inputCls} type="number" step={0.1} value={Math.round(a.z * 100) / 100} onChange={(e) => set({ z: Number(e.target.value) })} /></Campo>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onAste([...aste, copiaAsta(a, 1)])}><Copy />Copia</Button>
        <Button variant="outline" onClick={() => onAggiungi(calataDaPunto(corpi, [a.x, a.y, a.z], cat, parete as never), "Calata aggiunta dall'asta fino a terra, con supporti, connettore e dispersore.")}><Cable />Calata da qui</Button>
        <Button variant="outline" onClick={() => { const add = collegaAsta(a, conduttori, cat); if (add) onAggiungi(add, "Asta collegata al conduttore più vicino."); }}><Link2 />Collega alla captazione</Button>
        <Button variant="outline" onClick={() => { onAste(aste.filter((x) => x.id !== a.id)); onChiudi(); }}><Trash2 />Elimina</Button>
      </div>
    </section>;
  }
  if (selezione.tipo === "conduttore") {
    const c = conduttori.find((x) => x.id === selezione.id); if (!c) return null;
    const alto = c.punti.reduce((m, q) => (q[2] > m[2] ? q : m), c.punti[0]!);
    return <section className="mt-3 rounded-lg border border-primary/50 bg-card p-4" aria-label="Conduttore selezionato">
      {testata(`Conduttore di ${c.tipo === "captazione" ? "captazione" : c.tipo === "calata" ? "calata" : "terra"} · ${f(lung(c.punti), 2)} m`)}
      <p className="text-sm">{c.materiale} {c.sezione}{c.codiceOBO ? ` · ${c.codiceOBO}` : ""} · {c.punti.length} punti</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {c.tipo === "captazione" && <Button variant="outline" onClick={() => onAggiungi(calataDaPunto(corpi, alto, cat, parete as never), "Calata aggiunta dal conduttore fino a terra.")}><Cable />Calata dal punto più alto</Button>}
        <Button variant="outline" onClick={() => { onConduttori(conduttori.filter((x) => x.id !== c.id)); onChiudi(); }}><Trash2 />Elimina</Button>
      </div>
    </section>;
  }
  const p = picchetti.find((x) => x.id === selezione.id); if (!p) return null;
  return <section className="mt-3 rounded-lg border border-primary/50 bg-card p-4" aria-label="Dispersore selezionato">
    {testata(`Dispersore · ${f(p.lunghezza, 1)} m${p.codiceOBO ? ` · ${p.codiceOBO}` : ""}`)}
    <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => { onPicchetti(picchetti.filter((x) => x.id !== p.id)); onChiudi(); }}><Trash2 />Elimina</Button></div>
  </section>;
}

export function SezioneSeparazioneNodi({ aste, conduttori, corpi, lpl, cat, onAggiungi, onVista }: {
  aste: Asta[]; conduttori: Conduttore[]; corpi: Corpo[]; lpl: Livello; cat: CatalogoCaptazione;
  onAggiungi: (a: Aggiunte, msg: string) => void; onVista: (v: { tratti: TrattoColorato[]; etichette: EtichettaViewer[] } | null) => void;
}) {
  const [r, setR] = useState<RisultatoSeparazioneNodi | null>(null), [mostra, setMostra] = useState(true);
  const ki = KI[lpl];
  const calate = conduttori.filter((c) => c.tipo === "calata").length;
  const hMax = Math.max(0, ...conduttori.flatMap((c) => c.punti.map((q) => q[2])), ...aste.map((a) => a.z + a.altezza));
  const sSempl = calate ? distanzaSeparazione(ki, kcSemplificato(calate), KM.aria, hMax) : NaN;
  const vista = (res: RisultatoSeparazioneNodi, on: boolean) => {
    if (!on || !res.peggiore) { onVista(null); return; }
    const sMax = res.peggiore.sAria;
    const tratti = res.tratti.filter((t) => Number.isFinite(res.nodi[t.a]!.sAria) && Number.isFinite(res.nodi[t.b]!.sAria)).map((t) => ({ a: res.nodi[t.a]!.p, b: res.nodi[t.b]!.p, colore: coloreS(Math.max(res.nodi[t.a]!.sAria, res.nodi[t.b]!.sAria), sMax) }));
    const scelti = [...res.nodi].filter((n) => Number.isFinite(n.sAria) && !n.terra).sort((a, b) => b.sAria - a.sAria);
    const lista = [...scelti.filter((n) => n.punta), ...scelti.slice(0, 12)].filter((n, i, arr) => arr.findIndex((m) => m.id === n.id) === i).slice(0, 40);
    onVista({ tratti, etichette: lista.map((n) => ({ p: n.p, testo: `s ${f(n.sAria, 2)} m`, colore: coloreS(n.sAria, sMax) })) });
  };
  const calcola = () => { const res = separazioneNodi({ conduttori, aste, corpi, ki, kmSolido: KM.solido }); setR(res); vista(res, mostra); };
  const nonCollegateAste = useMemo(() => (r?.nonCollegate ?? []).filter((o) => o.startsWith("asta:")).map((o) => o.slice(5)), [r]);
  return <section className="mt-8 border-t pt-5" aria-label="Distanza di separazione ai nodi">
    <h2 className="font-display text-xl font-semibold">Distanza di separazione ai nodi</h2>
    <p className="mt-1 text-sm text-muted-foreground">La corrente di fulmine si divide davvero sulla rete di conduttori (maglia, aste, calate): per ogni nodo l'app calcola s = ki / km × Σ kc,i × li con il fulmine proprio in quel punto (CEI EN IEC 62305-3:2026-10, 6.3.1 e Allegato B). Di solito dà valori più bassi del metodo semplificato con un solo kc.</p>
    <div className="mt-3 flex flex-wrap items-center gap-3"><Button onClick={calcola} disabled={!conduttori.length && !aste.length}><Zap />Calcola ai nodi</Button>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mostra} onChange={(e) => { setMostra(e.target.checked); if (r) vista(r, e.target.checked); }} />Mostra nel 3D (colori da verde a rosso e valori ai nodi)</label></div>
    {r && <div className="mt-4 space-y-3">
      {r.avvisi.map((a) => <p key={a} className="border-l-4 border-accent pl-2 text-sm">{a}</p>)}
      {r.peggiore && <div className="rounded-lg border-l-4 border-primary bg-muted p-4" role="status">
        <p className="text-lg">s massima ai nodi: <strong>{f(r.peggiore.sAria, 3)} m in aria</strong> · {f(r.peggiore.sSolido, 3)} m nel solido (km {f(r.kmSolido, 1)}) · {r.nodi.length} nodi, {r.tratti.length} tratti</p>
        <p className="mt-1 text-sm">Metodo semplificato (kc = {f(kcSemplificato(calate || 1), 2)}, {calate} calate, l = {f(hMax, 1)} m): s = {f(sSempl, 3)} m{Number.isFinite(sSempl) && r.peggiore.sAria < sSempl ? ` → il calcolo ai nodi riduce s del ${Math.round((1 - r.peggiore.sAria / sSempl) * 100)} %.` : "."}</p>
      </div>}
      {r.violazioni.length > 0 && <div><h3 className="font-semibold">Impianti sul tetto troppo vicini alla rete</h3><ul className="mt-1 space-y-1 text-sm">{r.violazioni.map((v) => <li key={v.corpoId} className="text-exposed">{v.nome}: distanza {f(v.d, 2)} m &lt; s {f(v.s, 2)} m → allontanare, collegare all'LPS oppure isolare (isCon, aste isolate).</li>)}</ul></div>}
      {r.collegati.length > 0 && <p className="text-sm">Collegati direttamente all'LPS (nessuna distanza da rispettare): {r.collegati.join(", ")}.</p>}
      {nonCollegateAste.length > 0 && <div className="flex flex-wrap items-center gap-2 text-sm"><span>{nonCollegateAste.length} aste non collegate alla rete.</span>
        <Button size="sm" variant="outline" onClick={() => { const add: Aggiunte = { conduttori: [], supporti: [], morsetti: [], picchetti: [] }; for (const id of nonCollegateAste) { const a = aste.find((x) => x.id === id); const k = a ? collegaAsta(a, conduttori, cat) : null; if (k) { add.conduttori.push(...k.conduttori); add.supporti.push(...k.supporti); add.morsetti.push(...k.morsetti); } } onAggiungi(add, "Aste collegate alla captazione più vicina: ricalcola la separazione."); }}><Link2 />Collega le aste alla captazione</Button></div>}
      {r.peggiore && <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Nodo</th><th className="p-2">Posizione (x; y; z)</th><th className="p-2 text-right">Σ kc·l</th><th className="p-2 text-right">s aria</th><th className="p-2 text-right">s solido</th></tr></thead>
        <tbody>{[...r.nodi].filter((n) => Number.isFinite(n.sAria) && !n.terra).sort((a, b) => b.sAria - a.sAria).slice(0, 10).map((n) => <tr key={n.id} className="border-b"><td className="p-2">{n.punta ? "Punta d'asta" : "Nodo"}</td><td className="p-2 font-mono text-xs">{f(n.p[0], 1)}; {f(n.p[1], 1)}; {f(n.p[2], 1)}</td><td className="p-2 text-right font-mono">{f(n.V, 2)} m</td><td className="p-2 text-right font-mono">{f(n.sAria, 3)} m</td><td className="p-2 text-right font-mono">{f(n.sSolido, 3)} m</td></tr>)}</tbody></table>
        <p className="mt-1 text-xs text-muted-foreground">I 10 nodi con la s più alta. Tratti di pari lunghezza hanno la stessa impedenza; il collegamento equipotenziale è al piede delle calate. Valori da usare nella verifica dei punti critici in Calate.</p></div>}
    </div>}
  </section>;
}

/** Zone esposte della copertura raggruppate (celle vicine): un segnale per zona con la superficie, per il viewer. */
export function zoneEsposte(r: { griglia: { x0: number; y0: number; passo: number; nx: number; ny: number }; esposta: ArrayLike<number>; altezze: ArrayLike<number> }, stato?: ArrayLike<number>, minCelle = 2): { p: Punto3; area: number }[] {
  const g = r.griglia, n = g.nx * g.ny, es = (k: number) => (stato ? stato[k] === 3 : r.esposta[k] === 1), visto = new Uint8Array(n), out: { p: Punto3; area: number }[] = [];
  for (let k0 = 0; k0 < n; k0++) {
    if (visto[k0] || !es(k0)) continue;
    const st = [k0]; visto[k0] = 1; let cnt = 0, sx = 0, sy = 0, zMax = -Infinity;
    while (st.length) {
      const k = st.pop()!, i = k % g.nx, j = Math.floor(k / g.nx); cnt++; sx += i; sy += j; zMax = Math.max(zMax, Number(r.altezze[k] ?? 0));
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue; const kk = jj * g.nx + ii; if (!visto[kk] && es(kk)) { visto[kk] = 1; st.push(kk); } }
    }
    if (cnt >= minCelle) out.push({ p: [g.x0 + (sx / cnt) * g.passo, g.y0 + (sy / cnt) * g.passo, zMax], area: cnt * g.passo * g.passo });
  }
  return out.sort((a, b) => b.area - a.area).slice(0, 30);
}
