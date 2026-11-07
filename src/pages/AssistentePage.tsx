import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEsteso, useAttivo } from "@/lib/statoProgetto";
import { useComputo, useDatiEdificio } from "@/lib/progettoStore";
import { applicaModifiche, generaComputo } from "@/calcoli/materiali/computo";
import { completamento, passiAssistente, prossimoPasso, type Passo, type StatoPasso } from "@/calcoli/assistente/passi";
import { INTERVALLI_TIPICI, prossimeScadenze, scaduta } from "@/calcoli/verifiche/verifiche";

const STILE: Record<StatoPasso, string> = {
  completo: "bg-[#e3f4ea] text-[#1d7a45]",
  "in corso": "bg-[#fff3dc] text-[#9a6200]",
  "da fare": "bg-muted text-foreground",
  "in arrivo": "bg-muted text-muted-foreground",
  facoltativo: "bg-muted text-muted-foreground",
};

function Cerchio({ n, stato, attuale }: { n: number; stato: StatoPasso; attuale: boolean }) {
  if (stato === "completo") return <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white"><Check className="size-5" strokeWidth={2} /></span>;
  return <span className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-base font-semibold ${attuale ? "border-primary bg-primary/10 text-primary" : stato === "in arrivo" ? "border-dashed border-input text-muted-foreground" : "border-bordo-scheda text-foreground"}`}>{n}</span>;
}

function VocePasso({ passo, n, attuale, ultimo }: { passo: Passo; n: number; attuale: boolean; ultimo: boolean }) {
  return <li className="relative flex gap-4">
    {!ultimo && <span aria-hidden="true" className={`absolute left-5 top-11 h-[calc(100%-2.5rem)] w-px ${passo.stato === "completo" ? "bg-primary" : "bg-border"}`} />}
    <Cerchio n={n} stato={passo.stato} attuale={attuale} />
    <div className={`mb-5 flex-1 rounded-lg border-[0.8px] p-4 ${attuale ? "border-primary" : "border-bordo-scheda"} ${passo.stato === "in arrivo" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[1.3rem] font-medium">{passo.titolo}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{passo.descrizione}</p>
        </div>
        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${STILE[passo.stato]}`}>{passo.stato}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{passo.motivo}</p>
        {passo.to && <Button size="sm" variant={attuale ? "default" : "outline"} asChild><Link to={passo.to}>{passo.stato === "completo" ? "Rivedi" : "Apri"} <ArrowRight strokeWidth={1.5} /></Link></Button>}
      </div>
    </div>
  </li>;
}

export function AssistentePage() {
  const s = useEsteso(), d = useDatiEdificio(), c = useComputo(), attivo = useAttivo();
  const passi = useMemo(() => {
    const computo = generaComputo(c.risultati, c.configurazione, d.copertura);
    const righe = applicaModifiche(computo.righe, c.modifiche, c.catalogo, c.manuali);
    const scad = prossimeScadenze(s.verifiche, s.pianoVerifiche.intervalli ?? INTERVALLI_TIPICI[s.lpl], s.pianoVerifiche.critico);
    const oggi = new Date().toISOString().slice(0, 10);
    return passiAssistente({
      edificio: { nome: d.nomeProgetto, comune: d.comune, L: d.L, W: d.W, H: d.H, lpl: d.lplProgetto || null, densita: d.densita },
      corpi: s.modello.corpi.length,
      aste: s.aste.length,
      conduttoriCaptazione: s.conduttori.filter((x) => x.tipo === "captazione").length,
      calate: s.conduttori.filter((x) => x.tipo === "calata").length,
      terraAccettata: s.terra !== null,
      conduttoriTerra: s.conduttori.filter((x) => x.tipo === "terra").length,
      picchetti: s.picchetti.length,
      componentiPosizionati: s.supporti.length + s.morsetti.length + s.compensatori.length,
      righeComputo: righe.length,
      mancantiComputo: computo.mancanti.length + righe.filter((r) => !r.codice).length,
      verifiche: s.verifiche.length,
      verificaScaduta: scaduta(scad.visiva, oggi) || scaduta(scad.completa, oggi),
    });
  }, [s, d, c]);
  const prossimo = prossimoPasso(passi);
  const comp = completamento(passi);

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Assistente di progetto</h1>
      <p className="mt-2 max-w-3xl text-white/90">Tutti i passi dall'edificio al dossier, nell'ordine giusto. Lo stato si aggiorna da solo con i dati del progetto{attivo ? ` “${attivo.nome}”` : ""}.</p>
      <div className="mt-5 max-w-xl">
        <div className="flex justify-between text-sm"><span>Completamento</span><span>{comp.completi} / {comp.totale} passi · {comp.percento}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${comp.percento}%` }} /></div>
      </div>
      {prossimo?.to && <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button size="lg" asChild><Link to={prossimo.to}>Prossimo passo: {prossimo.titolo} <ArrowRight strokeWidth={1.5} /></Link></Button>
        <span className="text-sm text-white/80">{prossimo.motivo}</span>
      </div>}
      {!prossimo && <p className="mt-6 text-lg">Tutti i passi disponibili sono completi. 🎉</p>}
    </div></section>
    <main className="mx-auto max-w-3xl px-4 py-10">
      <ol aria-label="Passi del progetto">{passi.map((p, i) => <VocePasso key={p.id} passo={p} n={i + 1} attuale={p.id === prossimo?.id} ultimo={i === passi.length - 1} />)}</ol>
      <p className="mt-2 text-xs text-muted-foreground">I passi “in arrivo” saranno attivati con i moduli di analisi del rischio e scelta SPD. Calcoli di supporto – da validare da tecnico abilitato.</p>
    </main>
  </>;
}
