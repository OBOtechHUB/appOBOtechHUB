import { useEffect, useState, type ComponentType } from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Box, Boxes, Building2, Package, ClipboardCheck, Compass, Gauge, ChevronLeft, ClipboardList, Download, FileText, FolderOpen, Info, LogIn, LogOut,
  Mail, Menu, Ruler, Smartphone, Shield, SlidersHorizontal, User, UserPlus, Wrench, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { salvaAttivo } from "@/components/ProjectSync";
import { impostaAttivo } from "@/lib/statoProgetto";
import { useAzioneInstalla } from "@/components/InstallaApp";

type Icona = ComponentType<{ className?: string; strokeWidth?: number }>;
type Voce = { etichetta: string; to: string; icona: Icona } | { etichetta: string; azione: () => void; icona: Icona };

/** Barra superiore arancione (freccia indietro · nome dell'app · menu) con pannello laterale a sezioni. */
export function AppHeader() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const percorso = useRouterState({ select: (s) => s.location.pathname });
  const [aperto, setAperto] = useState(false);
  const installa = useAzioneInstalla();

  useEffect(() => { setAperto(false); }, [percorso]);
  useEffect(() => {
    if (!aperto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAperto(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aperto]);

  async function esci() {
    try {
      await salvaAttivo(); await qc.cancelQueries(); qc.clear(); impostaAttivo(null);
      await supabase.auth.signOut(); await navigate({ to: "/auth", replace: true });
    } catch {
      window.alert("Salvataggio non riuscito. Riprova prima di uscire.");
    }
  }

  const sezioni: { titolo: string; voci: Voce[] }[] = [
    {
      titolo: "Il mio progetto",
      voci: user
        ? [
            { etichetta: "I miei progetti", to: "/progetti", icona: FolderOpen },
            { etichetta: "Profilo", to: "/profilo", icona: User },
            { etichetta: "Esci", azione: () => void esci(), icona: LogOut },
          ]
        : [
            { etichetta: "Accedi", to: "/auth", icona: LogIn },
            { etichetta: "Registrati", to: "/auth", icona: UserPlus },
          ],
    },
    {
      titolo: "Strumenti",
      voci: [
        { etichetta: "Assistente di progetto", to: "/assistente", icona: Compass },
        { etichetta: "Panoramica strumenti", to: "/strumenti", icona: Wrench },
        { etichetta: "Dati edificio", to: "/dati-edificio", icona: Building2 },
        { etichetta: "Dati normativi", to: "/dati-normativi", icona: SlidersHorizontal },
        { etichetta: "Edificio 3D", to: "/edificio-3d", icona: Box },
        { etichetta: "Resistenza di terra", to: "/resistenza-terra", icona: Gauge },
        { etichetta: "Computo materiali", to: "/computo-materiali", icona: ClipboardList },
        { etichetta: "Particolari costruttivi", to: "/particolari", icona: Ruler },
        { etichetta: "Verifiche e dossier", to: "/verifiche", icona: ClipboardCheck },
        { etichetta: "Prodotti OBO", to: "/prodotti", icona: Package },
        { etichetta: "Modelli 3D prodotti", to: "/modelli-3d", icona: Boxes },
        { etichetta: "Download CAD", to: "/download-cad", icona: Download },
      ],
    },
    {
      titolo: "Aiuto",
      voci: [
        { etichetta: "Guida", to: "/guida", icona: Info },
        { etichetta: "Contatti", to: "/contatti", icona: Mail },
      ],
    },
    {
      titolo: "Informazioni",
      voci: [
        ...(installa.stato !== "installata" ? [{ etichetta: "Installa l'app", azione: () => { setAperto(false); installa.avvia(); }, icona: Smartphone }] : []),
        { etichetta: "Termini d'uso", to: "/termini", icona: FileText },
        { etichetta: "Privacy", to: "/privacy", icona: Shield },
      ],
    },
  ];

  const classeVoce = "flex w-full items-center gap-4 py-3 text-base text-foreground hover:text-primary";

  return (
    <>
      <header className="sticky top-0 z-40 h-[50px] bg-primary text-primary-foreground shadow-[0_0_19px_-7px_rgba(0,0,0,0.15)]">
        <div className="relative flex h-full items-center justify-between px-3 sm:px-6">
          <button type="button" aria-label="Indietro" onClick={() => router.history.back()} className="flex h-[50px] w-12 items-center justify-start">
            <ChevronLeft className="size-9" strokeWidth={1.25} />
          </button>
          <Link to="/" aria-label="Progettazione LPS – home" className="absolute left-1/2 -translate-x-1/2 select-none whitespace-nowrap text-lg font-black uppercase tracking-[0.06em] sm:text-xl">
            <span className="text-white">LPS</span> <span className="text-[#1d1d1b]">Progettazione</span>
          </Link>
          <button type="button" aria-label={aperto ? "Chiudi menu" : "Apri menu"} aria-expanded={aperto} aria-controls="menu-principale" onClick={() => setAperto((v) => !v)} className="flex h-[50px] w-12 items-center justify-end">
            {aperto ? <X className="size-10" strokeWidth={1.25} /> : <Menu className="size-10" strokeWidth={1.25} />}
          </button>
        </div>
      </header>

      {aperto && <div className="fixed inset-0 top-[50px] z-30" aria-hidden="true" onClick={() => setAperto(false)} />}
      <nav
        id="menu-principale"
        aria-label="Menu principale"
        className={`fixed right-0 top-[50px] z-40 max-h-[calc(100dvh-50px)] w-[min(100vw,300px)] overflow-y-auto bg-background px-6 pb-6 pt-4 shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform duration-200 sm:right-4 ${aperto ? "translate-x-0" : "pointer-events-none translate-x-[110%]"}`}
      >
        {sezioni.map((sez) => (
          <div key={sez.titolo} className="mt-4 first:mt-2">
            <p className="text-base font-bold">{sez.titolo}</p>
            <ul className="mt-1">
              {sez.voci.map((v) => (
                <li key={v.etichetta}>
                  {"to" in v
                    ? <Link to={v.to as "/"} className={classeVoce} activeProps={{ className: "text-primary" }}><v.icona className="size-6 shrink-0" strokeWidth={1.25} />{v.etichetta}</Link>
                    : <button type="button" onClick={v.azione} className={classeVoce}><v.icona className="size-6 shrink-0" strokeWidth={1.25} />{v.etichetta}</button>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {installa.dialogo}
    </>
  );
}
