import { risorsa } from "@/lib/base";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const istruzioni = [
  "Scarica LPS.lsp e salvalo in una cartella fissa, per esempio C:\\OBO\\LPS.",
  "In ZWCAD o AutoCAD: comando APPLOAD, scegli LPS.lsp e premi Carica. Per caricarlo a ogni avvio aggiungilo a «Gruppo di avvio» (Startup Suite).",
  "Esporta il progetto dal sito con «Esporta per CAD» e in CAD lancia LPS-IMPORTA.",
  "Comandi: LPS (elenco), LPS-IMPORTA, LPS-SFERA, LPS-ESPORTA, LPS-DISTINTA, LPS-BLOCCHI.",
  "Blocchi OBO: con LPS-BLOCCHI indica la cartella con i blocchi chiamati OBO_<codice>.dwg (per esempio OBO_5218700.dwg), disegnati in millimetri. Se un blocco manca, il comando inserisce un segnaposto e lo elenca.",
  "AutoCAD LT (2024 e successivi): funziona senza solidi 3D, con linee e facce.",
  "Standard LPS OBO: layer LPS-* (captazione, calate, terra, supporti, morsetti, particolari, testi, legenda, cartiglio) con colori per la stampa CTB; simboli 2D chiamati OBO_<codice> con attributi CODICE, DESCRIZIONE e TIPO, sostituibili con i blocchi ufficiali OBO con lo stesso nome.",
  "Per tavole in scala 1:200 scrivi (setq *LPS-SCALA-SIMBOLI* 2.0) prima di LPS-IMPORTA: simboli, richiami e testi diventano grandi il doppio.",
];

export function DownloadCADPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold">Download CAD</h1>
      <p className="mt-3 text-muted-foreground">
        LPS.lsp è un programma per ZWCAD e AutoCAD che disegna in 3D il progetto esportato dal sito
        (file .lpsdati), disegna la sfera rotolante, esporta i contorni dell'edificio verso il sito
        e produce la distinta dei componenti con i codici OBO.
      </p>
      <div className="mt-5">
        <Button asChild>
          <a href={risorsa("cad/LPS.lsp")} download="LPS.lsp"><Download />Scarica LPS.lsp</a>
        </Button>
      </div>
      <section className="mt-8 border-t pt-5">
        <h2 className="font-display text-lg font-semibold">Installazione e utilizzo</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          {istruzioni.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      </section>
      <section className="mt-8 border-t pt-5">
        <h2 className="font-display text-lg font-semibold">Flusso di lavoro</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Dal modulo Edificio 3D: «Esporta per CAD (.lpsdati)» scarica il progetto per LPS-IMPORTA;
          il file edificio_da_CAD.json scritto da LPS-ESPORTA si importa dalla scheda «CAD JSON».
          Il DXF del sito (formato R12, si apre in tutti i CAD) contiene la tavola completa: pianta coperture in scala con squadratura, legenda con codici OBO e quantità, richiami ai particolari costruttivi, calate numerate e cartiglio; a destra il modello 3D sui layer LPS-3D-* (da non stampare).
        </p>
      </section>
    </main>
  );
}
