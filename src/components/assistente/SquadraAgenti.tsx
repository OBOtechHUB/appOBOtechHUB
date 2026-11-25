/**
 * Progetto automatico a passi: una "squadra" di agenti, ognuno fa una cosa sola, in ordine.
 * Il lettore dei documenti legge davvero relazioni e tavole (PDF, Word) e propone i dati con la frase da cui
 * vengono; gli altri agenti eseguono il passo automatico della loro pagina (es. proposta della captazione).
 * Ogni risultato va approvato: niente si applica da solo.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileSearch, Building2, ShieldAlert, Zap, ArrowDownToLine, Calculator, FileText, Play, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aggiornaEsteso, useAttivo, useEsteso } from "@/lib/statoProgetto";
import { aggiornaDati, useDatiEdificio, type DatiEdificio } from "@/lib/progettoStore";
import { fileDocumento } from "@/lib/documentazione";
import { risorsa } from "@/lib/base";
import { estraiDati, migliori, nomeCampo, type DatoTrovato } from "@/calcoli/progetto/estraiDati";
import { importabileNelModello } from "@/calcoli/progetto/documentazione";
import type { Passo } from "@/calcoli/assistente/passi";

type Agente = { id: string; nome: string; compito: string; icona: typeof Zap; passi: string[]; azione: string; pagina: string; vai: string };
const AGENTI: Agente[] = [
  { id: "lettore", nome: "Lettore dei documenti", compito: "Legge relazioni, capitolati e tavole (PDF, Word) e trova comune, indirizzo, committente, dimensioni, altezza, struttura, copertura, zone ATEX.", icona: FileSearch, passi: ["documentazione"], azione: "Leggi i documenti", pagina: "/dati-edificio", vai: "dati-edificio#documentazione" },
  { id: "geometra", nome: "Geometra", compito: "Ricostruisce l'edificio: dalla pianta o dall'IFC dei documenti, dalla mappa in automatico, oppure con la pianta 2D e i blocchi sul tetto.", icona: Building2, passi: ["edificio", "modello"], azione: "Ricostruisci l'edificio", pagina: "/edificio-3d", vai: "edificio-3d" },
  { id: "rischio", nome: "Analista del rischio", compito: "Valuta il rischio secondo la 62305-2 e indica il livello di protezione (LPL).", icona: ShieldAlert, passi: ["rischio"], azione: "Valuta il rischio", pagina: "/rischio", vai: "rischio" },
  { id: "captazione", nome: "Progettista della captazione", compito: "Propone aste e maglia con la sfera rotolante; tu accetti o modifichi la proposta.", icona: Zap, passi: ["captazione"], azione: "Proponi la captazione", pagina: "/edificio-3d", vai: "edificio-3d?auto=proponi" },
  { id: "calate", nome: "Calate e terra", compito: "Controlla calate, distanza di separazione e dispersore.", icona: ArrowDownToLine, passi: ["calate", "terra"], azione: "Controlla calate e terra", pagina: "/calate", vai: "calate" },
  { id: "computista", nome: "Computista", compito: "Prepara il computo con i codici OBO, le confezioni METEL e i prezzi del listino; segnala i dati mancanti.", icona: Calculator, passi: ["particolari", "computo"], azione: "Prepara il computo", pagina: "/computo-materiali", vai: "computo-materiali" },
  { id: "redattore", nome: "Redattore della relazione", compito: "Scrive la relazione tecnica Word e prepara il pacchetto CAD 2D e 3D.", icona: FileText, passi: ["computo", "cad"], azione: "Scrivi la relazione", pagina: "/computo-materiali", vai: "computo-materiali" },
];

export function SquadraAgenti({ passi }: { passi: Passo[] }) {
  const attivo = useAttivo(), s = useEsteso(), d = useDatiEdificio();
  const [lettura, setLettura] = useState<{ dati: DatoTrovato[]; scelti: Set<number> } | null>(null), [busy, setBusy] = useState(""), [msg, setMsg] = useState(""), [azioneMsg, setAzioneMsg] = useState<"progetto" | "documenti" | null>(null);
  const statoDi = (a: Agente) => { const p = passi.filter((x) => a.passi.includes(x.id)); return p.length && p.every((x) => x.stato === "completo") ? "fatto" : p.some((x) => x.stato === "completo" || x.stato === "in corso") ? "in corso" : "da fare"; };
  const docs = (s.documentazione ?? []).filter((x) => !x.nascosto);

  async function leggi() {
    setAzioneMsg(null);
    if (!attivo) { setMsg("Per leggere i documenti serve un progetto aperto: aprilo o creane uno nuovo, poi carica i PDF e i Word in Dati edificio → Documentazione del progetto."); setAzioneMsg("progetto"); return; }
    const leggibili = docs.filter((x) => /\.(pdf|docx|txt)$/i.test(x.nome));
    if (!leggibili.length) { setMsg("Nessun PDF o Word nella documentazione del progetto: trascinali in Dati edificio → Documentazione del progetto, poi torna qui e premi di nuovo «Leggi i documenti»."); setAzioneMsg("documenti"); return; }
    const { testoDocumento } = await import("@/lib/testoDocumenti");
    const tutti: DatoTrovato[] = []; let letti = 0;
    for (const [i, doc] of leggibili.entries()) {
      setBusy(`Leggo ${i + 1} di ${leggibili.length}: ${doc.nome}`);
      try { const f = await fileDocumento(doc); if (!f) continue; const t = await testoDocumento(f, doc.nome); if (t.trim()) { letti++; tutti.push(...estraiDati(t, doc.nome)); } } catch { /* documento illeggibile: si va avanti */ }
    }
    setBusy("");
    const m = migliori(tutti);
    setLettura({ dati: m, scelti: new Set(m.map((_, i) => i).filter((i) => !["atex", "fotovoltaico", "struttura", "piani", "codice"].includes(m[i]!.campo))) });
    setMsg(m.length ? `${letti} documenti letti: ${m.length} dati trovati. Controlla e applica quelli giusti.` : `${letti} documenti letti, nessun dato riconosciuto (le tavole scansionate non contengono testo).`);
  }
  function applica() {
    if (!lettura) return;
    const v = (c: string) => lettura.dati.find((x, i) => x.campo === c && lettura.scelti.has(i));
    const pd: Partial<DatiEdificio> = {};
    if (v("comune")) pd.comune = v("comune")!.valore;
    if (v("indirizzo")) pd.indirizzo = v("indirizzo")!.valore + (v("comune") ? `, ${v("comune")!.valore}` : "");
    if (v("altezza")?.numero) pd.H = v("altezza")!.numero!;
    if (v("lunghezza")?.numero) pd.L = v("lunghezza")!.numero!;
    if (v("larghezza")?.numero) pd.W = v("larghezza")!.numero!;
    if (v("copertura")) pd.copertura = /falde|tegol|coppi/i.test(v("copertura")!.valore) ? "A falde" : /piana|guaina|calcestruzzo/i.test(v("copertura")!.valore) ? "Piana" : d.copertura;
    aggiornaDati(pd);
    const rel = { ...s.relazione };
    if (v("committente")) rel.committente = v("committente")!.valore;
    if (v("provincia")) rel.provincia = v("provincia")!.valore;
    const des = v("destinazione")?.valore ?? "";
    if (/abitativ|residenz/.test(des)) rel.destinazione = "abitativa"; else if (/ricettiv|alberghier/.test(des)) rel.destinazione = "ricettiva"; else if (/promiscu/.test(des)) rel.destinazione = "promiscua";
    aggiornaEsteso({ relazione: rel } as Parameters<typeof aggiornaEsteso>[0]); // i campi mancanti li completa lo schema
    const atex = lettura.dati.some((x) => x.campo === "atex");
    setMsg(`Dati applicati al progetto${atex ? ". Attenzione: i documenti citano zone ATEX, tienine conto nel rischio e nelle distanze di separazione" : ""}. Prossimo: il geometra ricostruisce l'edificio.`);
    setLettura(null);
  }
  const azione = (a: Agente) => {
    if (a.id === "lettore") return void leggi();
    if (a.id === "geometra") { const doc = docs.find((x) => importabileNelModello(x.nome) && /planimetria|prospetti/.test(x.categoria)); location.href = risorsa(doc && !s.modello.corpi.length ? "dati-edificio#documentazione" : "edificio-3d"); return; }
    location.href = risorsa(a.vai);
  };
  const prossimo = AGENTI.find((a) => statoDi(a) !== "fatto");

  return <section aria-labelledby="h-squadra" className="mb-10 rounded-xl border border-primary/60 bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="h-squadra" className="font-display text-xl font-bold">Progetto automatico a passi</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Una squadra di sette agenti: ognuno fa una cosa sola e passa il lavoro al successivo. Tu approvi o correggi ogni passo.</p></div>
      {prossimo && <Button onClick={() => azione(prossimo)} disabled={!!busy}><Play />Avvia: {prossimo.nome.toLowerCase()}</Button>}
    </div>
    {busy && <p role="status" className="mt-3 text-sm">{busy}</p>}
    {msg && <div role="status" className="mt-3 rounded-md border-l-4 border-primary bg-primary/10 p-3 text-sm">
      <p>{msg}</p>
      {azioneMsg === "progetto" && <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" asChild><Link to="/progetti">Apri o crea un progetto</Link></Button></div>}
      {azioneMsg === "documenti" && <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => { location.href = risorsa("dati-edificio#documentazione"); }}>Carica i documenti</Button></div>}
    </div>}
    {lettura && lettura.dati.length > 0 && <div className="mt-4 rounded-md border p-3">
      <h3 className="font-semibold">Dati trovati nei documenti</h3>
      <ul className="mt-2 divide-y text-sm">{lettura.dati.map((x, i) => <li key={i} className="flex gap-3 py-2">
        <input type="checkbox" className="mt-1" aria-label={`Applica ${nomeCampo(x.campo)}`} checked={lettura.scelti.has(i)} onChange={(e) => { const sc = new Set(lettura.scelti); if (e.target.checked) sc.add(i); else sc.delete(i); setLettura({ ...lettura, scelti: sc }); }} />
        <div className="min-w-0"><b>{nomeCampo(x.campo)}:</b> {x.valore}<p className="text-xs text-muted-foreground">«…{x.frase}…» — {x.documento}</p></div></li>)}</ul>
      <div className="mt-2 flex gap-2"><Button size="sm" onClick={applica} disabled={!lettura.scelti.size}>Applica i dati scelti</Button><Button size="sm" variant="outline" onClick={() => setLettura(null)}>Chiudi</Button></div>
      <p className="mt-2 text-xs text-muted-foreground">Comune, indirizzo, dimensioni e copertura vanno in Dati edificio; committente, provincia e destinazione d'uso in Dati della relazione. ATEX, struttura, piani e fotovoltaico sono segnalati per controllo.</p>
    </div>}
    <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {AGENTI.map((a, i) => { const st = statoDi(a), I = a.icona, corrente = a === prossimo;
        return <li key={a.id} className={`agente relative flex flex-col gap-2 rounded-lg border p-3 ${corrente ? "border-primary ring-1 ring-primary" : ""}`} style={{ animationDelay: `${i * 70}ms` }}>
          <div className="flex items-center gap-2">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${st === "fatto" ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>{st === "fatto" ? <Check className="size-5" /> : <I className="size-5" />}</span>
            <div className="min-w-0"><p className="text-xs text-muted-foreground">Agente {i + 1}</p><h3 className="font-semibold leading-tight">{a.nome}</h3></div>
            <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st === "fatto" ? "bg-[#e3f4ea] text-[#1d7a45]" : st === "in corso" ? "bg-[#fff3dc] text-[#9a6200]" : "bg-muted"}`}>{st}</span>
          </div>
          <p className="text-sm text-muted-foreground">{a.compito}</p>
          <div className="mt-auto flex flex-wrap gap-2">
            <Button size="sm" variant={corrente ? "default" : "outline"} disabled={!!busy} onClick={() => azione(a)}>{a.azione}</Button>
            {a.id !== "lettore" && <Button size="sm" variant="ghost" asChild><Link to={a.pagina as "/rischio"}>Apri la pagina</Link></Button>}
          </div>
        </li>; })}
    </ol>
  </section>;
}
