import { risorsa } from "@/lib/base";
import { FileText } from "lucide-react";
import { IstruzioniDownload } from "@/components/IstruzioniDownload";
import { FILE_ISTRUZIONI, ISTRUZIONI } from "@/calcoli/cad/versioni";

const automatico = [
  "In Edificio 3D premi «Pacchetto AutoCAD / ZWCAD (.zip)» e estrai tutta la cartella dallo ZIP.",
  "Apri il file .dxf della cartella con AutoCAD o ZWCAD.",
  "Trascina LPS.lsp (è nella stessa cartella) dentro la finestra del disegno; all'avviso di sicurezza scegli «Carica una volta».",
  "Alla domanda «Costruire il disegno LPS…» premi Invio: il programma disegna il modello 3D accanto alla tavola con blocchi e codici OBO, inserisce la distinta dei materiali e salva il DWG nella stessa cartella (senza sovrascrivere file esistenti).",
  "Blocchi OBO ufficiali: mettili in una sottocartella «blocchi» accanto al disegno (file OBO_<codice>.dwg o <codice>.dwg) e vengono usati in automatico.",
];

const istruzioni = [
  "Scarica LPS.lsp e salvalo in una cartella fissa, per esempio C:\\OBO\\LPS.",
  "In ZWCAD o AutoCAD: comando APPLOAD, scegli LPS.lsp e premi Carica. Per caricarlo a ogni avvio aggiungilo a «Gruppo di avvio» (Startup Suite).",
  "Esporta il progetto dal sito con «Esporta per CAD» e in CAD lancia LPS-IMPORTA.",
  "Comandi: LPS (elenco), LPS-AUTO, LPS-IMPORTA, LPS-SFERA, LPS-ESPORTA, LPS-DISTINTA, LPS-BLOCCHI, LPS-VERSIONE.",
  "Blocchi OBO: con LPS-BLOCCHI indica la cartella con i blocchi chiamati OBO_<codice>.dwg (per esempio OBO_5218700.dwg), disegnati in millimetri. Se un blocco manca, il comando inserisce un segnaposto e lo elenca.",
  "AutoCAD LT (2024 e successivi): funziona senza solidi 3D, con linee e facce.",
  "Standard LPS OBO: layer LPS-* (captazione, calate, terra, supporti, morsetti, particolari, testi, legenda, cartiglio) con colori per la stampa CTB; simboli 2D chiamati OBO_<codice> con attributi CODICE, DESCRIZIONE e TIPO, sostituibili con i blocchi ufficiali OBO con lo stesso nome.",
  "Per tavole in scala 1:200 scrivi (setq *LPS-SCALA-SIMBOLI* 2.0) prima di LPS-IMPORTA: simboli, richiami e testi diventano grandi il doppio.",
];

export function DownloadCADPage() {
  const documenti = FILE_ISTRUZIONI.filter((f) => f.titolo);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold">Istruzioni e download</h1>
      <div className="mt-4"><IstruzioniDownload /></div>
      <section className="mt-5 rounded-lg border border-primary p-4" aria-labelledby="h-pacchetto">
        <h2 id="h-pacchetto" className="font-display text-lg font-semibold">Pacchetto completo sempre aggiornato</h2>
        <p className="mt-1 text-sm text-muted-foreground">Il pulsante «Pacchetto completo» qui sopra scarica un unico ZIP con le istruzioni d'uso e le istruzioni per AutoCAD e ZWCAD (PDF e Word), LPS.lsp e un progetto di prova. Si crea al momento dai file più recenti: estrailo e sostituisci i file vecchi.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{documenti.map((f) => <li key={f.file}>
          <a className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary" href={risorsa(f.file)} download><FileText className="size-4 text-primary" aria-hidden />{f.titolo}<span className="ml-auto text-xs text-muted-foreground">Rev. {ISTRUZIONI.revisione}</span></a></li>)}</ul>
      </section>

      <section className="mt-5 rounded-lg border border-accent p-4" aria-labelledby="h-auto">
        <h2 id="h-auto" className="font-display text-lg font-semibold">Uso automatico con il pacchetto CAD</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{automatico.map((t) => <li key={t}>{t}</li>)}</ol>
      </section>
      <p className="mt-3 text-muted-foreground">
        LPS.lsp è un programma per ZWCAD e AutoCAD che disegna in 3D il progetto esportato dal sito
        (file .lpsdati), disegna la sfera rotolante, esporta i contorni dell'edificio verso il sito
        e produce la distinta dei componenti con i codici OBO.
      </p>
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
