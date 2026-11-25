import { useEffect, useState, type ComponentType } from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine, ShieldCheck, Box, Boxes, Cpu, ShieldAlert, Building2, Package, ClipboardCheck, Compass, Gauge, ChevronLeft, ClipboardList, Download, FileText, FolderOpen, Info, LogIn, LogOut,
  Languages, LayoutGrid, Sparkles, ZoomIn, ZoomOut, Mail, Moon, Sun, SunMoon, Menu, Ruler, Search, Shield, SlidersHorizontal, User, UserPlus, Wrench, X,
  BookOpen, Inbox, BarChart3, Camera, Wind } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { NOMI_TEMA, cambiaZoom, impostaTema, useTema, useZoom, type Tema } from "@/lib/tema";
import { impostaLingua, useLingua } from "@/lib/lingua";
import { supabase } from "@/integrations/supabase/client";
import { salvaAttivo, useStatoSalvataggio } from "@/components/ProjectSync";
import { SaettaFigura } from "@/components/Saetta";
import { RicercaGlobale } from "@/components/RicercaGlobale";
import { useAvanzamentoProgetto } from "@/lib/avanzamentoProgetto";
import { SEZIONE_PAGINA, URL_HUB, esciVisitatore, puoVedere, useAccesso } from "@/lib/accesso";
import { impostaAttivo, useAttivo } from "@/lib/statoProgetto";

type Icona = ComponentType<{ className?: string; strokeWidth?: number }>;
type Voce = { etichetta: string; to: string; icona: Icona } | { etichetta: string; azione: () => void; icona: Icona };

/** Icona con etichetta della barra in alto (come sul sito OBO). */
function IconaBarra({ etichetta, icona: I, to, onClick, badge, titolo, nascondiMobile, espanso }: { etichetta: string; icona: Icona; to?: string; onClick?: () => void; badge?: number | undefined; titolo?: string; nascondiMobile?: boolean; espanso?: boolean }) {
  const cls = `relative flex min-w-[46px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold text-foreground hover:text-primary sm:min-w-[60px] sm:px-1.5 sm:text-xs ${nascondiMobile ? "hidden md:flex" : "flex"}`;
  const corpo = <>
    <span className="relative"><I className="size-5 sm:size-[22px]" strokeWidth={1.5} />{badge ? <span className="absolute -right-2 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-white">{badge}</span> : null}</span>
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
  const visitatore = abilitato && !!accesso.profilo?.visitatore;
  const visibile = (to: string) => { const sez = SEZIONE_PAGINA[to]; return abilitato ? !sez || puoVedere(accesso, sez) : ["/", "/auth", "/richiesta-accesso", "/guida", "/contatti", "/termini", "/privacy"].includes(to); };

  useEffect(() => { setAperto(false); }, [percorso]);
  useEffect(() => {
    if (!aperto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAperto(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aperto]);

  async function esci() {
    if (visitatore) { esciVisitatore(); window.location.assign(URL_HUB + "?visitatore"); return; }
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
      voci: visitatore
        ? [{ etichetta: "Esci (visitatore)", azione: () => void esci(), icona: LogOut }]
        : user
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
    ...(admin ? [{ titolo: "Amministrazione", voci: [{ etichetta: "Accessi e utenti", to: "/admin", icona: ShieldCheck } as Voce, { etichetta: "Cruscotto di direzione", to: "/cruscotto", icona: BarChart3 } as Voce] }] : []),
    {
      titolo: "Strumenti",
      voci: [
        { etichetta: "Istruzioni e download", to: "/download-cad", icona: Download },
        { etichetta: "Assistente di progetto", to: "/assistente", icona: Compass },
        { etichetta: "Panoramica strumenti", to: "/strumenti", icona: Wrench },
        { etichetta: "Richieste all'ufficio tecnico", to: "/richieste", icona: Inbox },
        { etichetta: "Sopralluogo (foto)", to: "/sopralluogo", icona: Camera },
        { etichetta: "Dati edificio", to: "/dati-edificio", icona: Building2 },
        { etichetta: "Dati normativi", to: "/dati-normativi", icona: SlidersHorizontal },
        { etichetta: "Analisi del rischio", to: "/rischio", icona: ShieldAlert },
        { etichetta: "Norma 62305: calcoli e tabelle", to: "/norma", icona: BookOpen },
        { etichetta: "Edificio 3D", to: "/edificio-3d", icona: Box },
        { etichetta: "Vento e zavorre delle aste", to: "/vento", icona: Wind },
        { etichetta: "Calate e distanza di separazione", to: "/calate", icona: ArrowDownToLine },
        { etichetta: "Scelta SPD", to: "/spd", icona: Cpu },
        { etichetta: "Resistenza di terra", to: "/resistenza-terra", icona: Gauge },
        { etichetta: "Computo materiali", to: "/computo-materiali", icona: ClipboardList },
        { etichetta: "Particolari costruttivi", to: "/particolari", icona: Ruler },
        { etichetta: "Verifiche e dossier", to: "/verifiche", icona: ClipboardCheck },
        { etichetta: "Prodotti OBO", to: "/prodotti", icona: Package },
        { etichetta: "Modelli 3D prodotti", to: "/modelli-3d", icona: Boxes },
      ],
    },
    {
      titolo: "Aiuto",
      voci: [
        { etichetta: "Guida", to: "/guida", icona: Info },
        { etichetta: "Novità delle app", azione: () => { setAperto(false); window.location.assign(`${URL_HUB}novita.html?app=lps`); }, icona: Sparkles },
        { etichetta: "Contatti", to: "/contatti", icona: Mail },
      ],
    },
    {
      titolo: "Informazioni",
      voci: [
        { etichetta: "Termini d'uso", to: "/termini", icona: FileText },
        { etichetta: "Privacy", to: "/privacy", icona: Shield },
      ],
    },
  ];

  const home = percorso.replace(/\/+$/, "").endsWith("/Lighting") || percorso === "/" || percorso === "";
  const sezioniVisibili = sezioni.map((sez) => ({ ...sez, voci: sez.voci.filter((v) => !("to" in v) || visibile(v.to)) })).filter((sez) => sez.voci.length);
  const ritardo = (i: number) => ({ transitionDelay: aperto ? `${60 + Math.min(i, 24) * 18}ms` : "0ms" });
  const entrata = `transition-[opacity,transform] duration-300 ease-out ${aperto ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0"}`;
  const classeVoce = "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[15px] text-foreground transition-colors hover:bg-primary/10 hover:text-primary";
  const pastiglia = "flex flex-col items-center justify-center gap-1 rounded-xl border-[0.8px] border-bordo-scheda bg-card px-1 py-2.5 text-[11px] font-semibold text-foreground transition-[transform,background-color,color] sm:text-xs hover:-translate-y-0.5 hover:bg-primary/10 hover:text-primary";
  let n = 0;

  return (
    <>
      <header className="sticky top-0 z-40 bg-background shadow-[0_2px_14px_rgba(0,0,0,0.07)]">
        <div className="mx-auto flex h-[52px] max-w-6xl items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-6">
          {!home && <button type="button" aria-label="Indietro" onClick={() => router.history.back()} className="-ml-1 flex size-9 shrink-0 items-center justify-center text-foreground hover:text-primary sm:hidden">
            <ChevronLeft className="size-7" strokeWidth={1.5} />
          </button>}
          <Link to="/" aria-label="Progettazione LPS – home" className="flex min-w-0 items-center gap-2">
            <SaettaFigura className="h-8 w-7 shrink-0 sm:h-9 sm:w-8" />
            <span className="hidden min-w-0 sm:block">
              <span className="block whitespace-nowrap text-base font-bold leading-tight sm:text-lg">Progettazione <span className="text-primary">LPS</span></span>
              <span className="block max-w-[46vw] truncate text-[11px] text-muted-foreground sm:max-w-[320px] sm:text-xs">{!abilitato ? "CEI EN IEC 62305:2026-10 · smart planning" : visitatore ? `Visitatore · ${accesso.profilo?.nome ?? ""} · niente salvataggi nel cloud` : attivo ? `${attivo.codice ? attivo.codice + " · " : ""}${attivo.nome} · ${statoSalvataggio || "salvato"}` : "Lavoro locale · nessun progetto aperto"}</span>
            </span>
          </Link>
          <nav aria-label="Accessi rapidi" className="ml-auto flex items-stretch">
            <a href={URL_HUB} title="Torna a OBO Hub (tutte le app)" aria-label="Torna alla pagina iniziale di OBO Hub" className="mr-1 flex min-w-[46px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-bold text-primary hover:text-[#d98a00] sm:min-w-[60px] sm:px-1.5 sm:text-xs"><LayoutGrid className="size-5 sm:size-[22px]" strokeWidth={2.2} /><span>OBO Hub</span></a>
            {abilitato ? <>
              {visibile("/assistente") && <IconaBarra to="/assistente" etichetta="Assistente" icona={Compass} badge={mancanti.length || undefined} titolo={prossimo ? `Prossimo passo: ${prossimo.titolo}` : "Progetto completo"} nascondiMobile />}
              {visibile("/progetti") && !visitatore && <IconaBarra to="/progetti" etichetta="Progetti" icona={ClipboardList} />}
              {!visitatore && <IconaBarra to="/sopralluogo" etichetta="Sopralluogo" icona={Camera} titolo="Sopralluogo: foto di particolari e impianti esistenti" />}
            </> : accesso.stato === "anonimo" && <IconaBarra to="/auth" etichetta="Accedi" icona={LogIn} />}
            <IconaBarra etichetta={aperto ? "Chiudi" : "Menu"} icona={aperto ? X : Menu} onClick={() => setAperto((v) => !v)} espanso={aperto} />
          </nav>
        </div>
        {abilitato && <div className="h-[3px] w-full bg-muted" role="progressbar" aria-label="Avanzamento del progetto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={comp.percento} title={`Progetto al ${comp.percento}%`}>
          <div className="h-full bg-primary transition-all" style={{ width: `${comp.percento}%` }} />
        </div>}
      </header>
      <RicercaGlobale aperta={ricerca} onChiudi={() => setRicerca(false)} />

      <div aria-hidden="true" onClick={() => setAperto(false)}
        className={`fixed inset-0 top-[55px] z-30 bg-black/30 backdrop-blur-[3px] transition-opacity duration-300 sm:top-[59px] ${aperto ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <nav
        id="menu-principale"
        aria-label="Menu principale"
        aria-hidden={!aperto}
        inert={!aperto}
        className={`fixed inset-x-0 top-[55px] z-40 max-h-[calc(100dvh-55px)] origin-top overflow-y-auto overscroll-contain rounded-b-2xl border-[0.8px] border-t-0 border-bordo-scheda bg-background/95 px-4 pb-5 pt-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.2)] sm:inset-x-auto sm:right-6 sm:top-[64px] sm:max-h-[calc(100dvh-80px)] sm:w-[600px] sm:origin-top-right sm:rounded-2xl sm:border-t-[0.8px] ${aperto ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-3 scale-[0.97] opacity-0"}`}
      >
        <div className={`grid grid-cols-5 gap-2 ${entrata}`} style={ritardo(n++)}>
          <button type="button" className={pastiglia} onClick={() => { setAperto(false); setRicerca(true); }}><Search className="size-5" strokeWidth={1.5} />Cerca</button>
          <button type="button" className={pastiglia} onClick={() => window.location.assign(URL_HUB)} title="Torna a OBO Hub (tutte le app)"><LayoutGrid className="size-5" strokeWidth={1.5} />OBO Hub</button>
          <button type="button" className={pastiglia} onClick={() => impostaLingua(lingua === "en" ? "it" : "en")} title={lingua === "en" ? "Passa all'italiano" : "Switch to English"}><Languages className="size-5" strokeWidth={1.5} />{lingua === "en" ? "Italiano" : "English"}</button>
          <button type="button" className={pastiglia} onClick={cambiaTema} title="Aspetto: automatico, chiaro o scuro">{(() => { const I = iconaTema; return <I className="size-5" strokeWidth={1.5} />; })()}<span>Tema<span className="hidden sm:inline"> · {NOMI_TEMA[tema]}</span></span></button>
          <div className={`${pastiglia} hover:translate-y-0`} role="group" aria-label="Dimensione del testo">
            <span className="flex items-center gap-1">
              <button type="button" aria-label="Testo più piccolo" disabled={zoom <= 0.85} onClick={() => cambiaZoom(-1)} className="rounded-full p-0.5 hover:text-primary disabled:opacity-40"><ZoomOut className="size-5" strokeWidth={1.5} /></button>
              <button type="button" aria-label="Testo più grande" disabled={zoom >= 1.45} onClick={() => cambiaZoom(1)} className="rounded-full p-0.5 hover:text-primary disabled:opacity-40"><ZoomIn className="size-5" strokeWidth={1.5} /></button>
            </span>
            <span aria-live="polite">Testo<span className="hidden sm:inline"> {Math.round(zoom * 100)}%</span></span>
          </div>
        </div>
        <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {sezioniVisibili.map((sez) => (
            <section key={sez.titolo} className={`mt-3 ${sez.voci.length > 6 ? "sm:col-span-2" : ""} ${entrata}`} style={ritardo(n++)}>
              <p className="px-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{sez.titolo}</p>
              <ul className={`mt-1 ${sez.voci.length > 6 ? "sm:grid sm:grid-cols-2 sm:gap-x-6" : ""}`}>
                {sez.voci.map((v) => (
                  <li key={v.etichetta}>
                    {"to" in v
                      ? <Link to={v.to as "/"} className={classeVoce} activeProps={{ className: "bg-primary/10 text-primary" }}><v.icona className="size-5 shrink-0 transition-transform group-hover:scale-110" strokeWidth={1.4} />{v.etichetta}</Link>
                      : <button type="button" onClick={v.azione} className={classeVoce}><v.icona className="size-5 shrink-0 transition-transform group-hover:scale-110" strokeWidth={1.4} />{v.etichetta}</button>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>
    </>
  );
}
