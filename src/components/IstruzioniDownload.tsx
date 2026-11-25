/** Riquadro «Istruzioni e download» per AutoCAD/ZWCAD: avviso di versione e pacchetto ZIP sempre aggiornato. */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { risorsa } from "@/lib/base";
import { ISTRUZIONI, LSP_VERSIONE } from "@/calcoli/cad/versioni";
import { aggiornamentoDisponibile, creaPacchettoIstruzioni, segnaScaricato, versioneScaricata } from "@/lib/istruzioni";

export function IstruzioniDownload({ compatto = false }: { compatto?: boolean }) {
  const [busy, setBusy] = useState(""), [msg, setMsg] = useState(""), [scaricata, setScaricata] = useState<string | null>(null), [nuova, setNuova] = useState(false);
  const leggi = () => { setScaricata(versioneScaricata()); setNuova(aggiornamentoDisponibile()); };
  useEffect(() => { leggi(); addEventListener("lps-pacchetto", leggi); return () => removeEventListener("lps-pacchetto", leggi); }, []);
  async function pacchetto() {
    setMsg("");
    try {
      const b = await creaPacchettoIstruzioni((n, t) => setBusy(`Preparo il pacchetto: file ${n + 1} di ${t}…`));
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `Istruzioni_Progettazione_LPS_${LSP_VERSIONE}_Rev${ISTRUZIONI.revisione}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      segnaScaricato();
      setMsg("Pacchetto scaricato: estrailo e sostituisci il vecchio LPS.lsp con quello nuovo (anche nel Gruppo di avvio di APPLOAD).");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Pacchetto non creato: riprova."); } finally { setBusy(""); }
  }
  return <section aria-labelledby="h-istr-dl" role="alert" className={`flex gap-3 rounded-lg border-2 p-4 ${nuova ? "border-[#c0392b] bg-[#fdecea] text-[#7a1f16]" : "border-[#f39b00] bg-[#fff6e5] text-[#5c3b00]"} dark:bg-[#2a2418] dark:text-inherit`}>
    <AlertTriangle className="mt-0.5 size-6 shrink-0 text-[#f39b00]" aria-hidden />
    <div className="min-w-0 flex-1 text-sm">
      <h2 id="h-istr-dl" className="text-base font-semibold">{nuova ? "Nuova versione per AutoCAD / ZWCAD: scaricala e sostituisci quella vecchia" : "AutoCAD / ZWCAD: usa sempre l'ultima versione"}</h2>
      <p className="mt-1">Ultima versione: <b>LPS.lsp {LSP_VERSIONE}</b> · istruzioni <b>Rev. {ISTRUZIONI.revisione}</b> del {ISTRUZIONI.data}.
        {scaricata ? <> Su questo dispositivo hai scaricato <b>{scaricata.replace("-", " · Rev. ")}</b>.</> : " Su questo dispositivo non l'hai ancora scaricata."}</p>
      {!compatto && <p className="mt-1">In CAD il comando <b>LPS-VERSIONE</b> mostra la versione caricata; da LPS.lsp 3.6, aprendo un progetto dell'app, se il programma è vecchio compare un avviso.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void pacchetto()} disabled={!!busy}><Package />Pacchetto completo (.zip): istruzioni PDF e Word, LPS.lsp, progetto di prova</Button>
        <Button size="sm" variant="outline" asChild><a href={risorsa("cad/LPS.lsp")} download="LPS.lsp" onClick={() => segnaScaricato()}><Download />Solo LPS.lsp {LSP_VERSIONE}</a></Button>
        {compatto && <Button size="sm" variant="ghost" asChild><Link to="/download-cad">Istruzioni e download</Link></Button>}
      </div>
      {busy && <p role="status" className="mt-2">{busy}</p>}
      {msg && <p role="status" className="mt-2 border-l-4 border-primary pl-3">{msg}</p>}
    </div>
  </section>;
}
