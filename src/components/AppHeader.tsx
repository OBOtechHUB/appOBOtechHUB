import { useEffect, useState, type ComponentType } from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine, ShieldCheck, Box, Boxes, Cpu, ShieldAlert, Building2, Package, ClipboardCheck, Compass, Gauge, ChevronLeft, ClipboardList, Download, FileText, FolderOpen, Info, LogIn, LogOut,
  Languages, LayoutGrid, ZoomIn, ZoomOut, Mail, Moon, Sun, SunMoon, Menu, Ruler, Search, Smartphone, Shield, SlidersHorizontal, User, UserPlus, Wrench, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { NOMI_TEMA, cambiaZoom, impostaTema, useTema, useZoom, type Tema } from "@/lib/tema";
import { impostaLingua, useLingua } from "@/lib/lingua";
import { supabase } from "@/integrations/supabase/client";
import { salvaAttivo, useStatoSalvataggio } from "@/components/ProjectSync";
import { SaettaFigura } from "@/components/Saetta";
import { RicercaGlobale } from "@/components/RicercaGlobale";
import { useAvanzamentoProgetto } from "@/lib/avanzamentoProgetto";
import { SEZIONE_PAGINA, URL_HUB, puoVedere, useAccesso } from "@/lib/accesso";
import { impostaAttivo, useAttivo } from "@/lib/statoProgetto";
import { useAzioneInstalla } from "@/components/InstallaApp";

type Icona = ComponentType<{ className?: string; strokeWidth?: number }>;
type Voce = { etichetta: string; to: string; icona: Icona } | { etichetta: string; azione: () => void; icona: Icona };

/** Icona con etichetta della barra in alto (come sul sito OBO). */
function IconaBarra({ etichetta, icona: I, to, onClick, badge, titolo, nascondiMobile, espanso }: { etichetta: string; icona: Icona; to?: string; onClick?: () => void; badge?: number | undefined; titolo?: string; nascondiMobile?: boolean; espanso?: boolean }) {
  const cls = `relative flex min-w-[52px] flex-col items-center justify-center gap-0.5 px-1.5 text-[11px] font-semibold text-foreground hover:text-primary sm:min-w-[72px] sm:px-2 sm:text-sm ${nascondiMobile ? "hidden md:flex" : "flex"}`;
  const corpo = <>
    <span className="relative"><I className="size-6 sm:size-7" strokeWidth={1.5} />{badge ? <span className="absolute -right-2 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-white">{badge}</span> : null}</span>
    <span>{etichetta}</span>
  </>;
  if (to) return <Link to={to as "/"} title={titolo ?? etichetta} className={cls} activeProps={{ className: "text-primary" }}>{corpo}</Link>;
  return <button type="button" title={titolo ?? etichetta} aria-expanded={espanso} aria-controls={espanso !== undefined ? "menu-principale" : undefined} onClick={onClick} className={cls}>{corpo}</button>;
}

/** Barra superiore bianca (Saetta, nome, stato del progetto · icone con etichetta) con filo di avanzamento e menu laterale a sezioni. */
export function AppHeader() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const percorso = useRouterState({ select: (s) => s.location.pathname });
  const [aperto, setAperto] = useState(false);
  const installa = useAzioneInstalla();
  const tema = useTema();
  const lingua = useLingua();
  const zoom = useZoom();
  const cambiaTema = () => { const ordine: Tema[] = ["auto", "light", "dark"]; impostaTema(ordine[(ordine.indexOf(tema) + 1) % 3]!); };
  const iconaTema = tema === "dark" ? Moon : tema === "light" ? Sun : SunMoon;
  const [ricerca, setRicerca] = useState(false);
  const { comp, prossimo, mancanti } = useAvanzamentoProgetto();
  const attivo = useAttivo();
  const statoSalvataggio = useStatoSalvataggio();
  const accesso = useAccesso();
  const abilitato = accesso.stato === "abilitato";
  const admin = abilitato && accesso.profilo?.ruolo === "admin";
  const visibile = (to: string) => { const sez = SEZIONE_PAGINA[to]; return abilitato ? !sez || puoVedere(accesso, sez) : ["/", "/auth", "/richiesta-accesso", "/guida", "/contatti", "/termini", "/privacy"].includes(to); };

  useEffect(() => { setAperto(false); }, [percorso]);
  useEffect(() => {
    if (!aperto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAperto(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aperto]);

  async function esci() {
    try { await salvaAttivo(); } catch {
      if (!window.confirm("Il progetto aperto non è stato salvato. Uscire lo stesso?")) return;
    }
    try { await qc.cancelQueries(); qc.clear(); impostaAttivo(null); } catch { /* niente */ }
    try { await supabase.auth.signOut(); } catch { /* niente */ }
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* esce comunque da questo dispositivo */ }
    window.location.assign(URL_HUB); // si torna alla pagina iniziale di OBO Hub
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
            { etichetta: "Richiedi l'accesso", to: "/richiesta-accesso", icona: UserPlus },
          ],
    },
    ...(admin ? [{ titolo: "Amministrazione", voci: [{ etichetta: "Accessi e utenti", to: "/admin", icona: ShieldCheck } as Voce] }] : []),
    {
      titolo: "Strumenti",
      voci: [
        { etichetta: "Cerca", azione: () => { setAperto(false); setRicerca(true); }, icona: Search },
        { etichetta: "Assistente di progetto", to: "/assistente", icona: Compass },
        { etichetta: "Panoramica strumenti", to: "/strumenti", icona: Wrench },
        { etichetta: "Dati edificio", to: "/dati-edificio", icona: Building2 },
        { etichetta: "Dati normativi", to: "/dati-normativi", icona: SlidersHorizontal },
        { etichetta: "Analisi del rischio", to: "/rischio", icona: ShieldAlert },
        { etichetta: "Edificio 3D", to: "/edificio-3d", icona: Box },
        { etichetta: "Calate e distanza di separazione", to: "/calate", icona: ArrowDownToLine },
        { etichetta: "Scelta SPD", to: "/spd", icona: Cpu },
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
        { etichetta: `Aspetto: ${NOMI_TEMA[tema]}`, azione: cambiaTema, icona: iconaTema },
        { etichetta: `Testo più piccolo (${Math.round(zoom * 100)}%)`, azione: () => cambiaZoom(-1), icona: ZoomOut },
        { etichetta: `Testo più grande (${Math.round(zoom * 100)}%)`, azione: () => cambiaZoom(1), icona: ZoomIn },
        { etichetta: lingua === "en" ? "Lingua: English → Italiano" : "Lingua: Italiano → English", azione: () => impostaLingua(lingua === "en" ? "it" : "en"), icona: Languages },
        { etichetta: "OBO Hub · tutte le app", azione: () => { window.location.assign(URL_HUB); }, icona: LayoutGrid },
        ...(installa.stato !== "installata" ? [{ etichetta: "Installa l'app", azione: () => { setAperto(false); installa.avvia(); }, icona: Smartphone }] : []),
        { etichetta: "Termini d'uso", to: "/termini", icona: FileText },
        { etichetta: "Privacy", to: "/privacy", icona: Shield },
      ],
    },
  ];

  const classeVoce = "flex w-full items-center gap-4 py-3 text-base text-foreground hover:text-primary";
  const home = percorso.replace(/\/+$/, "").endsWith("/Lighting") || percorso === "/" || percorso === "";

  return (
    <>
      <header className="sticky top-0 z-40 bg-background shadow-[0_2px_14px_rgba(0,0,0,0.07)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:h-[76px] sm:gap-3 sm:px-6">
          {!home && <button type="button" aria-label="Indietro" onClick={() => router.history.back()} className="-ml-1 flex size-9 shrink-0 items-center justify-center text-foreground hover:text-primary sm:hidden">
            <ChevronLeft className="size-7" strokeWidth={1.5} />
          </button>}
          <Link to="/" aria-label="Progettazione LPS – home" className="flex min-w-0 items-center gap-2">
            <SaettaFigura className="h-10 w-8 shrink-0 sm:h-12 sm:w-10" />
            <span className="hidden min-w-0 sm:block">
              <span className="block whitespace-nowrap text-lg font-bold leading-tight sm:text-xl">Progettazione <span className="text-primary">LPS</span></span>
              <span className="block max-w-[46vw] truncate text-[11px] text-muted-foreground sm:max-w-[320px] sm:text-xs">{!abilitato ? "CEI EN IEC 62305:2024 · smart planning" : attivo ? `${attivo.codice ? attivo.codice + " · " : ""}${attivo.nome} · ${statoSalvataggio || "salvato"}` : "Lavoro locale · nessun progetto aperto"}</span>
            </span>
          </Link>
          <nav aria-label="Accessi rapidi" className="ml-auto flex items-stretch">
            <IconaBarra etichetta="OBO Hub" icona={LayoutGrid} titolo="Torna a OBO Hub (tutte le app)" onClick={() => window.location.assign(URL_HUB)} />
            <IconaBarra etichetta={lingua === "en" ? "IT" : "EN"} icona={Languages} titolo={lingua === "en" ? "Passa all'italiano" : "Switch to English"} onClick={() => impostaLingua(lingua === "en" ? "it" : "en")} nascondiMobile />
            <IconaBarra etichetta={NOMI_TEMA[tema]} icona={iconaTema} titolo="Aspetto: automatico, chiaro o scuro" onClick={cambiaTema} nascondiMobile />
            {abilitato ? <>
              {visibile("/assistente") && <IconaBarra to="/assistente" etichetta="Assistente" icona={Compass} badge={mancanti.length || undefined} titolo={prossimo ? `Prossimo passo: ${prossimo.titolo}` : "Progetto completo"} nascondiMobile />}
              {visibile("/prodotti") && <IconaBarra to="/prodotti" etichetta="Prodotti" icona={Package} nascondiMobile />}
              <IconaBarra etichetta="Cerca" icona={Search} onClick={() => setRicerca(true)} nascondiMobile />
              {visibile("/progetti") && <IconaBarra to="/progetti" etichetta="Progetti" icona={ClipboardList} />}
              {admin && <IconaBarra to="/admin" etichetta="Admin" icona={ShieldCheck} nascondiMobile />}
              <IconaBarra to="/profilo" etichetta="Profilo" icona={User} nascondiMobile />
            </> : <>
              <IconaBarra to="/richiesta-accesso" etichetta="Richiedi" icona={UserPlus} nascondiMobile />
              {accesso.stato === "anonimo" && <IconaBarra to="/auth" etichetta="Accedi" icona={LogIn} />}
            </>}
            <IconaBarra etichetta={aperto ? "Chiudi" : "Menu"} icona={aperto ? X : Menu} onClick={() => setAperto((v) => !v)} espanso={aperto} />
          </nav>
        </div>
        {abilitato && <div className="h-[3px] w-full bg-muted" role="progressbar" aria-label="Avanzamento del progetto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={comp.percento} title={`Progetto al ${comp.percento}%`}>
          <div className="h-full bg-primary transition-all" style={{ width: `${comp.percento}%` }} />
        </div>}
      </header>
      <RicercaGlobale aperta={ricerca} onChiudi={() => setRicerca(false)} />

      {aperto && <div className="fixed inset-0 top-[67px] z-30 sm:top-[79px]" aria-hidden="true" onClick={() => setAperto(false)} />}
      <nav
        id="menu-principale"
        aria-label="Menu principale"
        className={`fixed right-0 top-[67px] z-40 max-h-[calc(100dvh-67px)] sm:top-[79px] sm:max-h-[calc(100dvh-79px)] w-[min(100vw,300px)] overflow-y-auto bg-background px-6 pb-6 pt-4 shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform duration-200 sm:right-4 ${aperto ? "translate-x-0" : "pointer-events-none translate-x-[110%]"}`}
      >
        {sezioni.filter((sez) => sez.voci.some((v) => !("to" in v) || visibile(v.to))).map((sez) => (
          <div key={sez.titolo} className="mt-4 first:mt-2">
            <p className="text-base font-bold">{sez.titolo}</p>
            <ul className="mt-1">
              {sez.voci.filter((v) => !("to" in v) || visibile(v.to)).map((v) => (
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
