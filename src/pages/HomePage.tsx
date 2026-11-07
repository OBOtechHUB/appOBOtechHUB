import { ArrowRight, Building2, ShieldAlert, Radio, ArrowDownToLine, Grid3x3, Cpu, ClipboardList } from "lucide-react";
import { ModuleCard } from "@/components/ModuleCard";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useComputo, useDatiEdificio } from "@/lib/progettoStore";
import { applicaModifiche, generaComputo } from "@/calcoli/materiali/computo";
import { avanzamento } from "@/calcoli/materiali/avanzamento";
import { useAuth } from "@/lib/auth";
import { useEsteso } from "@/lib/statoProgetto";

export function HomePage() {
  const {user}=useAuth();
  const s = useEsteso();
  const d = useDatiEdificio(); const c = useComputo();
  const computo = generaComputo(c.risultati, c.configurazione, d.copertura);
  const righe = applicaModifiche(computo.righe, c.modifiche, c.catalogo, c.manuali);
  const base = avanzamento(d, c.risultati, righe, computo.mancanti);
  const edificioCompleto = d.L > 0 && d.W > 0 && d.H > 0 && Boolean(d.lplProgetto);
  const edificioIniziato = Boolean(d.nomeProgetto || d.comune || d.L || d.W || d.H || d.densita || d.lplProgetto);
  const moduli = base.moduli.map((m) => m.nome === "Dati edificio" ? { ...m, stato: (edificioCompleto ? "completo" : edificioIniziato ? "dati mancanti" : "da fare") as typeof m.stato } : m.nome === "Terra" && s.terra ? { ...m, stato: "completo" as const } : m);
  const completi = moduli.filter((m) => m.stato === "completo").length;
  const progresso = { moduli, completi, percento: Math.round(completi / moduli.length * 100) };
  return (
    <>
    <section className="bg-ardesia text-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Progettazione LPS – protezione contro i fulmini</h1>
        <p className="mt-3 max-w-2xl text-lg text-white/90">Dall’edificio al progetto: rischio, protezione esterna e documentazione tecnica secondo CEI EN IEC 62305:2024.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {!user && <Button asChild variant="outline" size="lg"><Link to="/auth">Accedi <ArrowRight strokeWidth={1.5} /></Link></Button>}
          <Button asChild size="lg"><Link to="/dati-edificio">Inizia il progetto <ArrowRight strokeWidth={1.5} /></Link></Button>
        </div>
      </div>
    </section>
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h2 className="text-[1.7rem] font-medium">Panoramica degli strumenti</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">{[{titolo:"Valutare il rischio",to:"/dati-edificio",icona:ShieldAlert},{titolo:"Progettare l’LPS",to:"/strumenti",icona:Radio},{titolo:"Disegnare in CAD",to:"/edificio-3d",icona:Building2}].map((p)=><Link key={p.titolo} to={p.to as "/dati-edificio"|"/strumenti"|"/edificio-3d"} className="rounded-lg border-[0.8px] border-bordo-scheda bg-card p-5 transition-colors hover:border-primary"><p.icona className="size-8 text-primary" strokeWidth={1.25}/><h3 className="mt-3 text-[1.3rem] font-medium">{p.titolo}</h3></Link>)}</div>
      <section className="mt-6 border-y py-5" aria-label="Avanzamento progetto">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="font-display font-semibold">Avanzamento progetto</h2><span className="font-mono text-sm">{progresso.completi} / 7 completi · {progresso.percento}%</span></div>
        <progress aria-label="Moduli completi" className="mt-3 h-2 w-full overflow-hidden rounded bg-muted accent-accent" value={progresso.completi} max={7} />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{progresso.moduli.map((m) => <div key={m.nome} className="flex items-center justify-between gap-3 text-xs"><span>{m.nome}</span><span className={m.stato === "dati mancanti" ? "text-accent" : "text-muted-foreground"}>{m.stato}</span></div>)}</div>
      </section>
      {user&&<div className="mt-5 flex justify-end"><Button variant="outline" asChild><Link to="/dati-normativi">Dati normativi · Catalogo</Link></Button></div>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCard titolo="Dati edificio" descrizione="Geometria, copertura, materiali e area di raccolta." icona={Building2} to="/dati-edificio" />
        <ModuleCard titolo="Analisi rischio" descrizione="Valutazione del rischio R1–R4 (parte 2)." icona={ShieldAlert} />
        <ModuleCard titolo="Captazione" descrizione="Sfera rotolante e maglia di captazione." icona={Radio} to="/edificio-3d" />
        <ModuleCard titolo="Calate e distanza di sicurezza" descrizione="Numero calate e distanza s." icona={ArrowDownToLine} />
        <ModuleCard titolo="Impianto di terra" descrizione="Dispersori tipo A, B e fondazione." icona={Grid3x3} to="/edificio-3d" />
        <ModuleCard titolo="Scelta SPD" descrizione="Coordinamento SPD (parte 4)." icona={Cpu} />
        <ModuleCard titolo="Computo materiali" descrizione="Elenco e quantità componenti." icona={ClipboardList} to="/computo-materiali" />
        <ModuleCard titolo="Edificio 3D" descrizione="Modello geometrico, superfici e import CAD." icona={Building2} to="/edificio-3d" />
        <ModuleCard titolo="Particolari costruttivi" descrizione="Componenti e raccordi per le superfici." icona={ClipboardList} to="/particolari" />
      </div>
      <section className="mt-8 border-y py-5"><h2 className="font-display font-semibold">Norme di riferimento</h2><ul className="mt-3 space-y-1 text-sm text-muted-foreground"><li>CEI EN IEC 62305-1/2/3/4:2024</li><li>CEI EN 61643-12</li></ul><p className="mt-4 text-sm">Calcoli di supporto – da validare da tecnico abilitato</p></section>
    </main>
    </>
  );
}
