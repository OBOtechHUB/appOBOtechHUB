import { useEffect, useState } from "react";
import { trovaSchedaPdf, type SchedaPdf } from "@/lib/schedeParticolari";

/** Anteprima del disegno del particolare (prima pagina del PDF), mostrata dentro il dettaglio. */
export function AnteprimaDisegno({ immagine, titolo }: { immagine: string | null | undefined; titolo: string }) {
  const [pdf, setPdf] = useState<SchedaPdf | null>(null);
  useEffect(() => {
    let ok = true;
    setPdf(null);
    void trovaSchedaPdf(immagine).then((r) => { if (ok) setPdf(r); });
    return () => { ok = false; };
  }, [immagine]);
  if (!pdf) return <div className="mt-3 flex h-80 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">Caricamento disegno…</div>;
  if (pdf.tipo !== "locale") return <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">Disegno non disponibile ({pdf.fileAtteso || "file non indicato"}): accedi per vedere le schede dell'archivio.</p>;
  return <div className="mt-3">
    <iframe src={`${pdf.url}#toolbar=0&navpanes=0&view=FitH`} title={`Disegno ${titolo}`} className="h-80 w-full rounded-lg border-[0.8px] border-bordo-scheda bg-white sm:h-[26rem]" />
    <a href={pdf.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline">Apri il disegno a schermo intero</a>
  </div>;
}
