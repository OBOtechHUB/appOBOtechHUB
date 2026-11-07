import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { risorsa } from "@/lib/base";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { AuthProvider, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ProjectSync } from "@/components/ProjectSync";
import { BarraAvanzamento } from "@/components/BarraAvanzamento";
import { impostaAttivo,ripristinaLocale,aggiornaEsteso } from "@/lib/statoProgetto";
import {aggiornaComputo} from "@/lib/progettoStore";
import {validaCatalogo} from "@/lib/catalogo";
import {particolareSchema} from "@/calcoli/particolari/selezione";
import {impostaVerificati} from "@/lib/verificaParticolari";
import {sostituisciParametriCaptazione} from "@/lib/parametri";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href={risorsa("")}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Progettazione LPS" },
      { name: "description", content: "Progettazione impianti LPS secondo CEI EN IEC 62305:2024." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <HeadContent />
      <AuthProvider><PortalShell /></AuthProvider>
    </QueryClientProvider>
  );
}

function PortalShell(){
  const {setUser,setPronto}=useAuth();const router=useRouter();const {queryClient}=Route.useRouteContext();
  const previous=useRef<string|null>(null);
  useEffect(()=>{
    const libreria=(id:string)=>{void supabase.from("librerie_lps").select().eq("utente",id).maybeSingle().then(({data})=>{if(!data||previous.current!==id)return;impostaVerificati(data.particolari_verificati);try{aggiornaComputo({catalogo:validaCatalogo(data.catalogo as unknown[])});aggiornaEsteso({particolari:(data.particolari as unknown[]).map((p)=>particolareSchema.parse(p))});if(data.parametri)sostituisciParametriCaptazione(data.parametri);}catch{}});};
    void supabase.auth.getUser().then(({data})=>{previous.current=data.user?.id??null;setUser(data.user);setPronto(true);if(data.user)libreria(data.user.id);});
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{
      if(!["SIGNED_IN","SIGNED_OUT","USER_UPDATED"].includes(event))return;
      if(previous.current!==(session?.user.id??null)){impostaAttivo(null);ripristinaLocale();queryClient.clear();}previous.current=session?.user.id??null;
      setUser(session?.user??null);setPronto(true);void router.invalidate();
      if(event==="SIGNED_OUT"){impostaAttivo(null);ripristinaLocale();queryClient.clear();}else {void queryClient.invalidateQueries();if(session)libreria(session.user.id);}
    });return()=>data.subscription.unsubscribe();
  },[router,queryClient,setUser,setPronto]);
  return <><AppHeader/><ProjectSync/><BarraAvanzamento/><Outlet/><AppFooter/></>;
}
