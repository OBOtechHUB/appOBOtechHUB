/**
 * Primo passo del progetto: documentazione ricevuta (planimetrie, prospetti, relazioni, zone ATEX, foto…)
 * trascinata o scelta dal dispositivo. I file restano nel progetto (anche per i colleghi con cui è condiviso);
 * un documento si nasconde dall'elenco ma non si cancella.
 */
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileUp, ExternalLink, EyeOff, Eye, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aggiornaEsteso, leggiEsteso, useAttivo, useEsteso, type DocumentoProgetto } from "@/lib/statoProgetto";
import { caricaDocumento, fileDocumento, linkDocumentoProgetto } from "@/lib/documentazione";
import { CATEGORIE_DOCUMENTO, dimensioneLeggibile, importabileNelModello, type CategoriaDocumento } from "@/calcoli/progetto/documentazione";

export function DocumentazioneProgetto({ onImportaModello }: { onImportaModello?: (f: File) => void }) {
  const attivo = useAttivo(), s = useEsteso();
  const docs = s.documentazione ?? [];
  const [trascina, setTrascina] = useState(false), [busy, setBusy] = useState(""), [msg, setMsg] = useState(""), [nascosti, setNascosti] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const salva = (lista: DocumentoProgetto[]) => aggiornaEsteso({ documentazione: lista });
  const cambia = (id: string, p: Partial<DocumentoProgetto>) => salva((leggiEsteso().documentazione ?? []).map((d) => (d.id === id ? { ...d, ...p } : d)));

  async function carica(files: File[]) {
    if (!attivo) { setMsg("Apri o crea prima un progetto (Progetti): i documenti si salvano nel progetto."); return; }
    setMsg(""); let ok = 0; const errori: string[] = [];
    for (const [i, f] of files.entries()) {
      setBusy(`Carico ${i + 1} di ${files.length}: ${f.name}`);
      try { const d = await caricaDocumento(attivo.id, f); salva([...(leggiEsteso().documentazione ?? []), d]); ok++; }
      catch (e) { errori.push(e instanceof Error ? e.message : `${f.name}: non caricato`); }
    }
    setBusy(""); setMsg([ok ? `${ok} ${ok === 1 ? "documento caricato" : "documenti caricati"}.` : "", ...errori].filter(Boolean).join(" "));
  }
  async function apri(d: DocumentoProgetto) { const u = await linkDocumentoProgetto(d.percorso); if (u) window.open(u, "_blank", "noopener"); else setMsg("Documento non disponibile."); }
  async function importa(d: DocumentoProgetto) {
    setBusy(`Apro ${d.nome}…`);
    try { const f = await fileDocumento(d); if (!f) throw new Error("Documento non scaricato."); onImportaModello?.(f); setMsg(`${d.nome}: segui l'importazione qui sotto.`); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Importazione non riuscita."); } finally { setBusy(""); }
  }
  const visibili = docs.filter((d) => nascosti || !d.nascosto), quantiNascosti = docs.filter((d) => d.nascosto).length;
  const atex = docs.some((d) => d.categoria === "atex" && !d.nascosto);

  return <section id="documentazione" aria-labelledby="h-doc" className="mt-6 rounded-lg border border-accent/60 bg-card p-5">
    <h2 id="h-doc" className="font-display text-lg font-semibold">1 · Documentazione del progetto</h2>
    <p className="mt-1 text-sm text-muted-foreground">Trascina qui planimetrie, prospetti e sezioni, relazioni, classificazione delle zone ATEX, foto e altri documenti ricevuti (fino a 50 MB a file). Restano nel progetto, anche per i colleghi con cui lo condividi.</p>
    <div role="button" tabIndex={0} aria-label="Trascina i documenti o scegli i file"
      className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center text-sm ${trascina ? "border-primary bg-primary/5" : "border-input"}`}
      onClick={() => input.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setTrascina(true); }} onDragLeave={() => setTrascina(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setTrascina(false); const l = [...e.dataTransfer.files]; if (l.length) void carica(l); }}>
      <FileUp className="size-7 text-primary" strokeWidth={1.5} />
      <span><b>Trascina qui i documenti</b> oppure tocca per sceglierli</span>
      <span className="text-xs text-muted-foreground">PDF, DWG, DXF, IFC, Word, Excel, immagini, ZIP…</span>
    </div>
    <input ref={input} type="file" multiple className="hidden" aria-label="Scegli i documenti" onChange={(e) => { const l = [...(e.target.files ?? [])]; e.currentTarget.value = ""; if (l.length) void carica(l); }} />
    {busy && <p role="status" className="mt-2 text-sm">{busy}</p>}
    {msg && <p role="status" className="mt-2 border-l-4 border-accent pl-3 text-sm">{msg}</p>}
    {atex && <p className="mt-3 rounded-md border-l-4 border-primary bg-muted px-3 py-2 text-sm">Ci sono zone ATEX: tienine conto nell'analisi del rischio (<Link to="/rischio" className="text-primary underline">Analisi del rischio</Link>) e nella posizione di aste, conduttori e distanze di separazione.</p>}
    {visibili.length > 0 && <ul className="mt-4 divide-y rounded-md border text-sm">{visibili.map((d) => <li key={d.id} className={`flex flex-wrap items-center gap-2 p-2 ${d.nascosto ? "opacity-60" : ""}`}>
      <span className="min-w-0 flex-1"><b className="break-all">{d.nome}</b><span className="block text-xs text-muted-foreground">{dimensioneLeggibile(d.dimensione)} · {d.data ? new Date(d.data).toLocaleDateString("it-IT") : ""}{d.autore ? ` · ${d.autore}` : ""}</span></span>
      <select className="h-8 rounded-md border bg-background px-2 text-xs" aria-label={`Tipo di ${d.nome}`} value={d.categoria} onChange={(e) => cambia(d.id, { categoria: e.target.value as CategoriaDocumento })}>{CATEGORIE_DOCUMENTO.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
      <Button size="sm" variant="outline" onClick={() => void apri(d)}><ExternalLink />Apri</Button>
      {onImportaModello && importabileNelModello(d.nome) && <Button size="sm" variant="outline" disabled={!!busy} title="Ricava l'edificio dal disegno" onClick={() => void importa(d)}><Boxes />Usa per l'edificio</Button>}
      <Button size="sm" variant="ghost" title={d.nascosto ? "Mostra di nuovo" : "Nascondi dall'elenco (il file resta)"} aria-label={d.nascosto ? `Mostra ${d.nome}` : `Nascondi ${d.nome}`} onClick={() => cambia(d.id, { nascosto: !d.nascosto })}>{d.nascosto ? <Eye /> : <EyeOff />}</Button>
    </li>)}</ul>}
    {quantiNascosti > 0 && <button type="button" className="mt-2 text-xs text-muted-foreground underline" onClick={() => setNascosti(!nascosti)}>{nascosti ? "Nascondi" : "Mostra"} i documenti nascosti ({quantiNascosti})</button>}
  </section>;
}
