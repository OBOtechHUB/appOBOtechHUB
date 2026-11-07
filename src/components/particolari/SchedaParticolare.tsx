import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trovaSchedaPdf, type SchedaPdf } from "@/lib/schedeParticolari";

export interface DatiSchedaParticolare {
  id: string;
  nome: string;
  immagine?: string | null | undefined;
  note?: string | null | undefined;
  componenti: {
    codiceOBO: string | null;
    descrizione: string;
    quantita: number | null;
    unitaQuantita: string;
    nota?: string | undefined;
  }[];
}

export function SchedaParticolare({ particolare, open, onOpenChange }: {
  particolare: DatiSchedaParticolare;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pdf, setPdf] = useState<SchedaPdf | null>(null);
  useEffect(() => {
    setPdf(null);
    if (!open) return;
    let attivo = true;
    void trovaSchedaPdf(particolare.immagine).then((risultato) => {
      if (attivo) setPdf(risultato);
    });
    return () => { attivo = false; };
  }, [open, particolare.id, particolare.immagine]);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent aria-describedby={undefined} className="max-h-[95dvh] w-[calc(100vw-2rem)] min-w-0 max-w-5xl overflow-x-hidden overflow-y-auto p-4 sm:p-6">
      <DialogHeader><DialogTitle className="break-words pr-8 leading-snug tracking-normal">{particolare.id} · {particolare.nome}</DialogTitle></DialogHeader>
      {!pdf && <p role="status" className="text-sm text-muted-foreground">Caricamento scheda…</p>}
      {pdf?.tipo === "locale" && <>
        <iframe src={pdf.url} title={`PDF ${particolare.id}`} className="h-[70vh] w-full border" />
        <Button variant="outline" asChild><a href={pdf.url} target="_blank" rel="noopener noreferrer"><ExternalLink />Apri PDF</a></Button>
      </>}
      {pdf?.tipo === "cartella" && <>
        <p role="status" className="break-words text-sm">Scheda non disponibile: {pdf.fileAtteso}</p>
        <Button variant="outline" className="h-auto whitespace-normal" asChild><a href={pdf.url} target="_blank" rel="noopener noreferrer"><ExternalLink />Apri cartella TYPICAL DATASHEET</a></Button>
      </>}
      <section className="min-w-0" aria-label="Componenti del particolare">
        <h3 className="font-semibold">Componenti</h3>
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[540px] text-sm">
          <thead><tr className="border-b text-left">{["Codice OBO", "Descrizione", "Quantità", "Unità"].map((titolo) => <th key={titolo} className="p-2">{titolo}</th>)}</tr></thead>
          <tbody>{particolare.componenti.map((c, i) => <tr key={i} className="border-b">
            <td className="p-2 font-mono">{c.codiceOBO ?? "Da definire"}</td>
            <td className="p-2">{c.descrizione}{c.nota && <p className="mt-1 text-xs text-muted-foreground">{c.nota}</p>}</td>
            <td className="p-2 font-mono">{c.quantita?.toLocaleString("it-IT") ?? "Da verificare"}</td><td className="p-2">{c.unitaQuantita}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
      {particolare.note && <section><h3 className="font-semibold">Note</h3><p className="mt-2 whitespace-pre-line text-sm">{particolare.note}</p></section>}
    </DialogContent>
  </Dialog>;
}