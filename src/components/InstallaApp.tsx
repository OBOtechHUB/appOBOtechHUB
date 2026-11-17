import { useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SaettaFigura } from "@/components/Saetta";
import { piattaforma, useInstallazione } from "@/lib/installazione";

/** Istruzioni per installare l'app quando il browser non lo propone da solo (iPhone, iPad, Safari, Firefox). */
function Istruzioni() {
  const p = piattaforma();
  if (p === "ios") return <ol className="list-decimal space-y-2 pl-5 text-sm">
    <li>Apri questa pagina con <strong>Safari</strong>.</li>
    <li>Tocca <strong>Condividi</strong> <Share className="inline size-4 align-text-bottom" /> (in basso su iPhone, in alto a destra su iPad).</li>
    <li>Scegli <strong>Aggiungi alla schermata Home</strong> <SquarePlus className="inline size-4 align-text-bottom" /> e conferma con <strong>Aggiungi</strong>.</li>
    <li>Saetta compare tra le app: aprila da lì, si apre a tutto schermo.</li>
  </ol>;
  if (p === "mac-safari") return <ol className="list-decimal space-y-2 pl-5 text-sm">
    <li>In Safari apri il menu <strong>File</strong> (o il pulsante <strong>Condividi</strong>).</li>
    <li>Scegli <strong>Aggiungi al Dock</strong> e conferma.</li>
  </ol>;
  if (p === "android") return <ol className="list-decimal space-y-2 pl-5 text-sm">
    <li>In Chrome tocca il menu <strong>⋮</strong> in alto a destra.</li>
    <li>Scegli <strong>Installa app</strong> (o <strong>Aggiungi a schermata Home</strong>).</li>
  </ol>;
  return <ol className="list-decimal space-y-2 pl-5 text-sm">
    <li>Usa <strong>Chrome</strong> o <strong>Edge</strong> su Windows o Mac.</li>
    <li>Clicca l'icona <strong>Installa</strong> <Download className="inline size-4 align-text-bottom" /> a destra nella barra degli indirizzi, oppure menu <strong>⋮ → Trasmetti, salva e condividi → Installa pagina come app</strong> (Edge: <strong>App → Installa questo sito come app</strong>).</li>
    <li>L'app si apre in una sua finestra e compare nel menu Start / nel Launchpad.</li>
  </ol>;
}

export function InstallaAppDialogo({ aperto, onChiudi }: { aperto: boolean; onChiudi: () => void }) {
  return <Dialog open={aperto} onOpenChange={(o) => { if (!o) onChiudi(); }}>
    <DialogContent aria-describedby={undefined} className="max-w-md">
      <DialogHeader><DialogTitle>Installa l'app LPS</DialogTitle></DialogHeader>
      <div className="flex items-start gap-4"><SaettaFigura className="h-20 w-16 shrink-0" saluto /><Istruzioni /></div>
      <p className="text-xs text-muted-foreground">L'app installata si aggiorna da sola e le pagine già aperte restano disponibili anche senza rete. I progetti si salvano su Supabase quando sei collegato.</p>
    </DialogContent>
  </Dialog>;
}

/** Voce "Installa l'app": usa la richiesta del browser se disponibile, altrimenti mostra le istruzioni. */
export function useAzioneInstalla() {
  const { stato, installa } = useInstallazione();
  const [istruzioni, setIstruzioni] = useState(false);
  const avvia = () => { if (stato === "pronta") void installa(); else setIstruzioni(true); };
  return { stato, avvia, dialogo: <InstallaAppDialogo aperto={istruzioni} onChiudi={() => setIstruzioni(false)} /> };
}

export function PulsanteInstalla({ className = "" }: { className?: string }) {
  const { stato, avvia, dialogo } = useAzioneInstalla();
  if (stato === "installata") return null;
  return <>{<Button variant="outline" size="lg" className={className} onClick={avvia}><Download strokeWidth={1.5} />Installa l'app</Button>}{dialogo}</>;
}
