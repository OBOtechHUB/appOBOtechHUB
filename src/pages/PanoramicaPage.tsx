import { Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowRight, Box, Boxes, Check, ClipboardList, Cpu, Download, Package, Ruler, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoLps, Messaggio } from "@/components/LogoLps";
import { PulsanteInstalla } from "@/components/InstallaApp";

const VANTAGGI = [
  "Tutto il progetto dell'LPS in un unico strumento, dal rischio al computo",
  "Calcoli secondo CEI EN IEC 62305:2024, con i valori sempre visibili e modificabili",
  "Proposte automatiche di aste, maglia, calate e impianto di terra in 3D",
  "Computo materiali con codici OBO, schede tecniche e particolari costruttivi",
  "Esportazione verso ZWCAD e AutoCAD, relazioni PDF ed Excel",
  "Funziona nel browser e si installa come app su PC, iPhone, iPad e Android",
];
const PASSI = [
  { n: 1, titolo: "Descrivi l'edificio", testo: "Dimensioni, posizione e fulminazione; importa la geometria da DXF, IFC o dalla mappa." },
  { n: 2, titolo: "Valuta e progetta", testo: "Analisi del rischio, captazione con sfera rotolante e maglia, calate, terra e SPD." },
  { n: 3, titolo: "Documenta", testo: "Computo, particolari, disegno CAD e relazione." },
];
const STRUMENTI = [
  { titolo: "Analisi del rischio", testo: "R1 con le sue componenti e livello di protezione minimo.", icona: ShieldAlert },
  { titolo: "Edificio 3D e captazione", testo: "Sfera rotolante, maglia e proposta automatica di aste e conduttori.", icona: Box },
  { titolo: "Calate e distanza di separazione", testo: "Numero di calate, kc e verifica dei punti critici.", icona: ArrowDownToLine },
  { titolo: "Scelta SPD", testo: "Iimp, Uc e Up con i prodotti OBO adatti.", icona: Cpu },
  { titolo: "Computo materiali", testo: "Quantità e codici OBO, Excel e relazione PDF.", icona: ClipboardList },
  { titolo: "Particolari costruttivi", testo: "Schede TBS, disegni 2D/3D e DWG.", icona: Ruler },
  { titolo: "Prodotti OBO", testo: "Catalogo con dati tecnici, foto, disegni e file 3D.", icona: Package },
  { titolo: "Modelli 3D e CAD", testo: "STEP in 3D, DXF per ZWCAD/AutoCAD, LPS.lsp.", icona: Boxes },
  { titolo: "App installabile", testo: "Su PC, iPhone, iPad e Android, anche senza rete.", icona: Download },
];

/** Panoramica pubblica dello strumento (visibile senza accesso). */
export function PanoramicaPage() {
  return <>
    <section className="relative overflow-hidden bg-ardesia text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[1fr_auto] md:items-center md:py-20">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Progettazione LPS – smart planning</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Progettare la protezione contro i fulmini non è mai stato così semplice.</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/90">Lo strumento per progettisti e installatori: rischio, protezione esterna, terra, SPD e documentazione secondo CEI EN IEC 62305:2024.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Accedi <ArrowRight strokeWidth={1.5} /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/richiesta-accesso">Richiedi l'accesso <ArrowRight strokeWidth={1.5} /></Link></Button>
          </div>
        </div>
        <LogoLps className="mx-auto hidden h-64 w-52 md:block" />
      </div>
    </section>
    <main className="mx-auto max-w-6xl px-4 py-12">
      <section className="grid gap-8 md:grid-cols-2" aria-label="Vantaggi">
        <div>
          <h2 className="text-[1.7rem] font-medium">Progettazione LPS – smart planning</h2>
          <p className="mt-3 text-muted-foreground">Una raccolta di strumenti di calcolo e disegno sviluppati per chi progetta e realizza impianti di protezione contro i fulmini e le sovratensioni.</p>
        </div>
        <div>
          <h2 className="text-[1.7rem] font-medium">I tuoi vantaggi</h2>
          <ul className="mt-3 space-y-2">{VANTAGGI.map((v) => <li key={v} className="flex gap-2"><Check className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2} />{v}</li>)}</ul>
        </div>
      </section>

      <section className="mt-14" aria-label="Come funziona">
        <h2 className="text-[1.7rem] font-medium">Passo dopo passo verso il progetto completo</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">{PASSI.map((p) => <div key={p.n} className="rounded-lg border-[0.8px] border-bordo-scheda p-5">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">{p.n}</span>
          <h3 className="mt-3 text-[1.3rem] font-medium">{p.titolo}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{p.testo}</p>
        </div>)}</div>
      </section>

      <section className="mt-14" aria-label="Strumenti">
        <h2 className="text-[1.7rem] font-medium">Tutti gli strumenti in sintesi</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{STRUMENTI.map((s) => <div key={s.titolo} className="rounded-lg border-[0.8px] border-bordo-scheda p-5">
          <s.icona className="size-8 text-primary" strokeWidth={1.25} />
          <h3 className="mt-3 text-[1.2rem] font-medium">{s.titolo}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{s.testo}</p>
        </div>)}</div>
      </section>

      <section className="mt-14 grid items-center gap-6 rounded-2xl bg-muted p-6 md:grid-cols-[1fr_auto]" aria-label="Accesso">
        <Messaggio><strong>Vuoi usare lo strumento?</strong> L'accesso è riservato: invia la richiesta, l'amministratore la approva e ti comunica la password iniziale. Al primo accesso scegli la tua password e colleghi Microsoft Authenticator.</Messaggio>
        <div className="flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/richiesta-accesso">Richiedi l'accesso</Link></Button><PulsanteInstalla /></div>
      </section>
    </main>
  </>;
}
