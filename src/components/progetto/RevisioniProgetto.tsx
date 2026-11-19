/**
 * Revisioni del progetto: stato (bozza / emesso), elenco delle revisioni, emissione della revisione successiva.
 * Ogni emissione viene copiata nell'archivio (supabase/revisioni.sql), dove non si può modificare né cancellare.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { useAuth } from "@/lib/auth";
import { aggiornaEsteso, caricaSnapshot, leggiAttivo, snapshot, useAttivo, useEsteso } from "@/lib/statoProgetto";
import { archiviaRevisione, leggiProgetto, leggiRevisione } from "@/lib/progetti.functions";
import { documentiRevisione, linkDocumento, type DocumentoArchiviato } from "@/lib/archivioDocumenti";
import { salvaAttivo } from "@/components/ProjectSync";
import { apriRevisione, emetti, modificatoDopoEmissione, revSuccessiva } from "@/calcoli/progetto/revisioni";

const dataIt = (iso: string) => { try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return iso; } };

function nomeAutore(email: string | null | undefined): string {
  let nome = "";
  try { nome = localStorage.getItem("obo-nome") ?? ""; } catch { /* nessun nome salvato */ }
  return nome || (email ?? "");
}

/** Pannello delle revisioni (pagina Dati edificio). `controlli` = esito del controllo di completezza, se disponibile. */
export function RevisioniProgetto({ problemi = 0 }: { problemi?: number }) {
  const s = useEsteso(), attivo = useAttivo(), { user } = useAuth();
  const [descrizione, setDescrizione] = useState(""), [autore, setAutore] = useState(""), [msg, setMsg] = useState(""), [occupato, setOccupato] = useState(false);
  useEffect(() => { setAutore((a) => a || nomeAutore(user?.email)); }, [user]);
  const e = s.emissione, prossima = revSuccessiva(s.revisioni.at(-1)?.rev);
  const [documenti, setDocumenti] = useState<Record<string, DocumentoArchiviato[] | "carico">>({});
  async function mostraDocumenti(rev: string) {
    const a = leggiAttivo(); if (!a) return;
    if (documenti[rev] && documenti[rev] !== "carico") { setDocumenti((x) => { const y = { ...x }; delete y[rev]; return y; }); return; }
    setDocumenti((x) => ({ ...x, [rev]: "carico" }));
    const lista = await documentiRevisione(a.proprietario || user?.id || "", a.id, rev);
    setDocumenti((x) => ({ ...x, [rev]: lista }));
  }
  async function apriDocumento(percorso: string) { const u = await linkDocumento(percorso); if (u) window.open(u, "_blank", "noopener"); else setMsg("Documento non disponibile."); }

  async function emettiOra() {
    if (problemi > 0 && !window.confirm(`Il controllo del progetto segnala ${problemi} ${problemi === 1 ? "punto aperto" : "punti aperti"}. Emettere comunque la Rev. ${prossima}?`)) return;
    setOccupato(true); setMsg("");
    try {
      const r = emetti(s.revisioni, snapshot(), { autore, descrizione });
      aggiornaEsteso({ revisioni: r.revisioni, emissione: r.emissione });
      const a = leggiAttivo();
      if (a) {
        const ok = await archiviaRevisione({ progetto: a.id, rev: r.revisione.rev, autore: r.revisione.autore, descrizione: r.revisione.descrizione, impronta: r.revisione.impronta, dati: snapshot() });
        if (ok) aggiornaEsteso({ revisioni: r.revisioni.map((x) => (x.rev === r.revisione.rev ? { ...x, archiviata: true } : x)) });
        await salvaAttivo();
        setMsg(ok ? `Rev. ${r.revisione.rev} emessa e archiviata. I documenti che crei ora (relazione, dichiarazione, verbali, offerta, pacchetto CAD) vengono copiati nella revisione.` : `Rev. ${r.revisione.rev} emessa. Archivio non ancora attivo: l'amministratore deve eseguire supabase/revisioni.sql.`);
      } else setMsg(`Rev. ${r.revisione.rev} emessa. Apri o salva il progetto nel cloud per archiviarne la copia.`);
      setDescrizione("");
    } catch (err) { setMsg(err instanceof Error ? err.message : "Emissione non riuscita."); }
    finally { setOccupato(false); }
  }

  async function scarica(rev: string) {
    const a = leggiAttivo(); if (!a) return;
    const r = await leggiRevisione(a.id, rev);
    if (!r) { setMsg("Copia della revisione non trovata nell'archivio."); return; }
    const blob = new Blob([JSON.stringify(r.dati, null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = `${(a.codice || a.nome || "progetto").replace(/[^\w.-]+/g, "_")}-Rev${rev}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return <section className="mt-6 rounded-lg border p-4" aria-labelledby="h-revisioni">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="h-revisioni" className="font-display text-lg font-semibold">Revisioni del progetto</h2>
      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${e.stato === "emesso" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
        {e.stato === "emesso" ? `Emesso · Rev. ${e.rev}` : s.revisioni.length ? `Bozza della Rev. ${prossima}` : "Bozza"}
      </span>
    </div>
    {s.revisioni.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
      <thead><tr className="border-b text-left"><th className="p-2">Rev.</th><th className="p-2">Data</th><th className="p-2">Autore</th><th className="p-2">Descrizione</th><th className="p-2">Copia</th><th className="p-2">Documenti</th></tr></thead>
      <tbody>{s.revisioni.slice().reverse().map((r) => <tr key={r.rev} className="border-b">
        <td className="p-2 font-mono font-semibold">{r.rev}</td><td className="p-2">{dataIt(r.data)}</td><td className="p-2">{r.autore}</td><td className="p-2">{r.descrizione}</td>
        <td className="p-2">{r.archiviata && attivo ? <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => void scarica(r.rev)}>Scarica</button> : <span className="text-muted-foreground">solo nel progetto</span>}</td>
        <td className="p-2">{attivo ? <button type="button" className="text-accent underline-offset-2 hover:underline" aria-expanded={!!documenti[r.rev]} onClick={() => void mostraDocumenti(r.rev)}>{documenti[r.rev] ? "Chiudi" : "Mostra"}</button> : "—"}
          {documenti[r.rev] === "carico" && <span className="ml-2 text-muted-foreground">…</span>}
          {Array.isArray(documenti[r.rev]) && <ul className="mt-1 space-y-0.5">{(documenti[r.rev] as DocumentoArchiviato[]).map((dd) => <li key={dd.percorso}><button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => void apriDocumento(dd.percorso)}>{dd.nome}</button> <span className="text-xs text-muted-foreground">{dd.data ? new Date(dd.data).toLocaleString("it-IT") : ""}</span></li>)}
            {!(documenti[r.rev] as DocumentoArchiviato[]).length && <li className="text-xs text-muted-foreground">Nessun documento: quelli creati mentre la revisione è emessa (relazione, dichiarazione, verbali, offerta, pacchetto CAD) vengono copiati qui.</li>}</ul>}</td>
      </tr>)}</tbody></table></div>}
    {e.stato === "bozza"
      ? <div className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <Campo etichetta="Autore"><input className={inputCls} value={autore} maxLength={200} onChange={(x) => setAutore(x.target.value)} /></Campo>
          <Campo etichetta={`Descrizione della Rev. ${prossima}`}><input className={inputCls} value={descrizione} maxLength={1000} placeholder={prossima === "A" ? "Prima emissione" : "Cosa cambia rispetto alla revisione precedente"} onChange={(x) => setDescrizione(x.target.value)} /></Campo>
          <Button type="button" disabled={occupato} onClick={() => void emettiOra()}>{occupato ? "Emissione…" : `Emetti Rev. ${prossima}`}</Button>
        </div>
      : <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">Il progetto emesso non si modifica: per cambiarlo apri la revisione successiva. Lo storico resta.</p>
          <Button type="button" variant="outline" onClick={() => { aggiornaEsteso({ emissione: apriRevisione(e) }); setMsg(`Rev. ${prossima} aperta in bozza.`); }}>Apri Rev. {prossima}</Button>
        </div>}
    {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
  </section>;
}

/** Avviso globale: progetto emesso modificato. Il salvataggio automatico resta fermo finché non si sceglie. */
export function AvvisoEmissione() {
  const s = useEsteso(), attivo = useAttivo();
  const [modificato, setModificato] = useState(false), [msg, setMsg] = useState("");
  useEffect(() => {
    if (s.emissione.stato !== "emesso") { setModificato(false); return; }
    const verifica = () => setModificato(modificatoDopoEmissione(s.emissione, snapshot()));
    verifica();
    const t = setInterval(verifica, 3000);
    return () => clearInterval(t);
  }, [s]);
  if (!modificato) return null;
  const prossima = revSuccessiva(s.revisioni.at(-1)?.rev);
  async function annulla() {
    setMsg("");
    const a = leggiAttivo(); if (!a || !s.emissione.rev) { setMsg("Progetto non salvato nel cloud: annulla le modifiche a mano o apri la revisione."); return; }
    const copia = await leggiRevisione(a.id, s.emissione.rev);
    try {
      if (copia) caricaSnapshot(copia.dati);
      else caricaSnapshot((await leggiProgetto({ data: { id: a.id } })).dati); // il salvataggio era fermo: sul server c'è la versione emessa
      a.salvato = JSON.stringify(snapshot());
    } catch { setMsg("Ripristino non riuscito."); }
  }
  return <div role="alert" className="sticky top-[var(--altezza-header,64px)] z-30 border-b border-accent bg-secondary px-4 py-2 text-sm">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
      <span><strong>Progetto emesso (Rev. {s.emissione.rev}) modificato.</strong> Le modifiche non vengono salvate finché non scegli.</span>
      <Button type="button" size="sm" onClick={() => aggiornaEsteso({ emissione: apriRevisione(s.emissione) })}>Apri Rev. {prossima} con queste modifiche</Button>
      {attivo && <Button type="button" size="sm" variant="outline" onClick={() => void annulla()}>Annulla le modifiche</Button>}
      {msg && <span>{msg}</span>}
    </div>
  </div>;
}
