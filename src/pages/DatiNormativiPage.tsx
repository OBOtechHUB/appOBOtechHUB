import { useRef, useState } from "react";
import { Upload, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/Campo";
import { PageTitle } from "@/components/PageTitle";
import { aggiornaComputo, useComputo } from "@/lib/progettoStore";
import { importaCatalogo, validaCatalogo } from "@/lib/catalogo";
import { categorie, type Articolo } from "@/calcoli/materiali/tipi";
import {salvaLibreria} from "@/lib/libreria";
import {aggiornaParametriCaptazione,useParametriCaptazione} from "@/lib/parametri";
import parametriLPL from "@/dati/captazione/parametriLPL.json";

export function DatiNormativiPage() {
  const c = useComputo(); const fileRef = useRef<HTMLInputElement>(null);
  const parametri = useParametriCaptazione();
  const [pendenza, setPendenza] = useState<string>(parametri.pendenzaMassimaMaglia == null ? "" : String(parametri.pendenzaMassimaMaglia));
  const [bozza, setBozza] = useState<Articolo[] | null>(null);
  const [messaggio, setMessaggio] = useState(""); const [errore, setErrore] = useState(false); const [busy, setBusy] = useState(false);
  const righe = bozza ?? c.catalogo;
  const modifica = (i: number, patch: Partial<Articolo>) => setBozza(righe.map((r, n) => n === i ? { ...r, ...patch } : r));
  async function importa(file?: File) {
    if (!file) return; setBusy(true); setMessaggio("");
    try { const nuove = await importaCatalogo(file); setBozza(nuove); setErrore(false); setMessaggio(`${nuove.length} articoli importati: verifica e salva il catalogo.`); }
    catch (e) { setErrore(true); setMessaggio(e instanceof Error ? e.message : "Importazione non riuscita."); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function salva() {
    try { const catalogo=validaCatalogo(righe);await salvaLibreria({catalogo});aggiornaComputo({ catalogo }); setBozza(null); setErrore(false); setMessaggio("Catalogo personale salvato in Cloud."); }
    catch (e) { setErrore(true); setMessaggio(e instanceof Error ? e.message : "Dati non validi."); }
  }
  async function salvaParametri() {
    const valore = pendenza.trim() === "" ? null : Number(pendenza);
    if (valore !== null && (!(valore > 0) || !Number.isFinite(valore))) { setErrore(true); setMessaggio("La pendenza massima deve essere un numero positivo (Δz/Δx), oppure vuota."); return; }
    const parametriNuovi = { pendenzaMassimaMaglia: valore };
    aggiornaParametriCaptazione(parametriNuovi);
    try { await salvaLibreria({ parametri: parametriNuovi }); setErrore(false); setMessaggio("Parametri di captazione salvati in Cloud."); }
    catch (e) { setErrore(true); setMessaggio(`${e instanceof Error ? e.message : "Salvataggio in Cloud non riuscito."} Il valore resta salvato solo su questo dispositivo.`); }
  }
  return <main className="mx-auto max-w-5xl px-4 py-6"><PageTitle titolo="Dati normativi" />
    <p className="mt-3 text-sm text-muted-foreground">Il catalogo personale non costituisce una fonte normativa. Codici, prezzi e particolari richiedono verifica; le righe ESEMPIO non sono dati di progetto validati.</p>
    <section className="mt-6 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold">Catalogo <span className="font-mono text-sm text-muted-foreground">({righe.length})</span></h2>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label="File catalogo" onChange={(e) => importa(e.target.files?.[0])} />
          <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><Upload />{busy ? "Importazione…" : "Importa Excel/CSV"}</Button>
          <Button variant="outline" onClick={() => setBozza([...righe, { codice: "", descrizione: "", categoria: "accessori", unita: "pz", materiale: "", sezione: "" }])}><Plus />Articolo</Button>
          <Button disabled={bozza === null} onClick={salva}><Check />Salva catalogo</Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Intestazioni: codice, descrizione, categoria, unita, materiale, sezione, prezzo (opzionale). L’importazione sostituisce il catalogo solo dopo il salvataggio. Prezzi in €.</p>
      {messaggio && <p role={errore ? "alert" : "status"} className={`mt-3 text-sm ${errore ? "text-destructive" : "text-foreground"}`}>{messaggio}</p>}
      {bozza !== null && <p className="mt-2 text-sm text-accent">Modifiche non salvate <Button variant="link" onClick={() => { setBozza(null); setMessaggio(""); }}>Annulla</Button></p>}
      {!righe.length ? <p className="my-10 text-center text-muted-foreground">Catalogo vuoto.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1060px] text-sm"><thead><tr className="border-b text-left">{["Codice", "Descrizione", "Categoria", "Unità", "Materiale", "Sezione", "Prezzo (€)", ""].map((h) => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>
        {righe.map((r, i) => <tr key={i} className="border-b">
          {(["codice", "descrizione"] as const).map((k) => <td className="p-2" key={k}><input aria-label={`${k} articolo ${i + 1}`} className={`${inputCls} ${k === "descrizione" ? "min-w-56" : "min-w-28"}`} maxLength={k === "codice" ? 100 : 500} value={r[k]} onChange={(e) => modifica(i, { [k]: e.target.value })} /></td>)}
          <td className="p-2"><select aria-label={`Categoria articolo ${i + 1}`} className={inputCls} value={r.categoria} onChange={(e) => modifica(i, { categoria: e.target.value as Articolo["categoria"] })}>{categorie.map((v) => <option key={v}>{v}</option>)}</select></td>
          <td className="p-2"><select aria-label={`Unità articolo ${i + 1}`} className={inputCls} value={r.unita} onChange={(e) => modifica(i, { unita: e.target.value as "m" | "pz" })}><option>m</option><option>pz</option></select></td>
          {(["materiale", "sezione"] as const).map((k) => <td className="p-2" key={k}><input aria-label={`${k} articolo ${i + 1}`} className={`${inputCls} min-w-28`} maxLength={100} value={r[k]} onChange={(e) => modifica(i, { [k]: e.target.value })} /></td>)}
          <td className="p-2"><input aria-label={`Prezzo articolo ${i + 1}`} className={`${inputCls} w-28`} type="number" min="0" step="0.01" value={r.prezzo ?? ""} onChange={(e) => modifica(i, { prezzo: e.target.value === "" ? undefined : Number(e.target.value) })} /></td>
          <td><Button variant="ghost" size="icon" aria-label={`Elimina articolo ${i + 1}`} title="Elimina articolo" onClick={() => setBozza(righe.filter((_, n) => n !== i))}><Trash2 /></Button></td>
        </tr>)}
      </tbody></table></div>}
    </section>
    <section className="mt-6 border-t pt-5">
      <h2 className="font-display text-xl font-semibold">Parametri di captazione</h2>
      <p className="mt-2 text-xs text-muted-foreground">Raggio della sfera rotolante e lato massimo della maglia per livello di protezione (CEI EN IEC 62305-3:2024 – da verificare).</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full max-w-md text-sm"><thead><tr className="border-b text-left"><th className="p-2">LPL</th><th className="p-2">Raggio sfera (m)</th><th className="p-2">Lato maglia (m)</th></tr></thead><tbody>
        {(["I", "II", "III", "IV"] as const).map((l) => <tr key={l} className="border-b"><td className="p-2 font-semibold">LPL {l}</td><td className="p-2 font-mono">{parametriLPL[l].raggio}</td><td className="p-2 font-mono">{parametriLPL[l].latoMaglia}</td></tr>)}
      </tbody></table></div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm">Pendenza massima maglia (Δz/Δx)
          <input aria-label="Pendenza massima maglia" className={`${inputCls} mt-1 w-40`} type="number" min="0" step="0.01" placeholder="non impostata" value={pendenza} onChange={(e) => setPendenza(e.target.value)} />
        </label>
        <Button variant="outline" onClick={salvaParametri}><Check />Salva parametri</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Oltre questa pendenza il metodo della maglia non si applica ({parametriLPL.pendenzaMassimaMaglia.riferimentoNorma}). Lascia vuoto per nessun limite. Valore personale, non verificato: richiede validazione.</p>
    </section></main>;
}