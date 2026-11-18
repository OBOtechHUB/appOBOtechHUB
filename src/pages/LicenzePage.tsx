import { useEffect, useState } from "react";
import { risorsa } from "@/lib/base";

interface Libreria { nome: string; versione: string; licenza: string; sito: string }
const SORGENTE = "https://github.com/OBOtechHUB/appOBOtechHUB";

/** Licenze delle librerie di terze parti (public/licenze.json, creato a ogni build) e note sui componenti GPL. */
export function LicenzePage() {
  const [lib, setLib] = useState<Libreria[] | null>(null), [err, setErr] = useState(false);
  useEffect(() => { void fetch(risorsa("licenze.json")).then((r) => (r.ok ? r.json() : Promise.reject())).then((d: { librerie: Libreria[] }) => setLib(d.librerie)).catch(() => setErr(true)); }, []);
  const gpl = (lib ?? []).filter((l) => /GPL/i.test(l.licenza) && !/LGPL/i.test(l.licenza));
  return <main className="mx-auto max-w-4xl px-4 py-8">
    <h1 className="font-display text-2xl font-bold">Licenze e componenti di terze parti</h1>
    <p className="mt-3 text-sm text-muted-foreground">Progettazione LPS usa librerie open source. Qui sotto l'elenco con la licenza di ciascuna, aggiornato a ogni pubblicazione dell'app.</p>
    <section className="mt-6 rounded-lg border border-accent p-4" aria-labelledby="h-gpl">
      <h2 id="h-gpl" className="font-display text-lg font-semibold">Lettore DWG (licenza GPL-3.0)</h2>
      <p className="mt-2 text-sm">La lettura dei file DWG usa <strong>LibreDWG</strong> nella versione per browser <code>@mlightcad/libredwg-web</code>, distribuita con licenza GNU GPL versione 3. Il lettore si carica solo quando si apre un file DWG.</p>
      <p className="mt-2 text-sm">Come richiesto dalla licenza, il codice sorgente completo dell'app è pubblico: <a className="text-accent underline-offset-2 hover:underline" href={SORGENTE}>{SORGENTE}</a>. Il sorgente di LibreDWG è disponibile presso il progetto GNU LibreDWG e il progetto libredwg-web.</p>
      {gpl.length > 1 && <p className="mt-2 text-sm">Altre librerie con licenza GPL: {gpl.filter((l) => l.nome !== "@mlightcad/libredwg-web").map((l) => l.nome).join(", ")}.</p>}
    </section>
    <section className="mt-6" aria-labelledby="h-elenco">
      <h2 id="h-elenco" className="font-display text-lg font-semibold">Librerie usate</h2>
      {err && <p className="mt-2 text-sm">Elenco non disponibile in questo momento.</p>}
      {!lib && !err && <p className="mt-2 text-sm text-muted-foreground">Caricamento…</p>}
      {lib && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
        <thead><tr className="border-b text-left"><th className="p-2">Libreria</th><th className="p-2">Versione</th><th className="p-2">Licenza</th></tr></thead>
        <tbody>{lib.map((l) => <tr key={l.nome} className="border-b"><td className="p-2">{l.sito ? <a className="text-accent underline-offset-2 hover:underline" href={l.sito} rel="noreferrer">{l.nome}</a> : l.nome}</td><td className="p-2 font-mono">{l.versione}</td><td className="p-2">{l.licenza}</td></tr>)}</tbody>
      </table></div>}
    </section>
    <section className="mt-6 text-sm text-muted-foreground">
      <p>Le norme CEI EN IEC 62305 restano di proprietà dei rispettivi editori: nell'app ci sono solo valori e riferimenti agli articoli, non i testi. Codici, descrizioni e immagini dei prodotti sono di OBO Bettermann.</p>
      <p className="mt-2">I calcoli sono di supporto: il progetto e le scelte finali vanno verificati e firmati da un tecnico abilitato.</p>
    </section>
  </main>;
}
