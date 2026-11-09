import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Client senza tipi generati per le tabelle del controllo accessi (non presenti in types.ts). */
export const db = () => supabase as unknown as SupabaseClient;
import { BASE } from "@/lib/base";

export type Sezione = "assistente" | "progetti" | "edificio" | "rischio" | "captazione" | "calate" | "terra" | "spd" | "computo" | "particolari" | "verifiche" | "prodotti" | "modelli3d" | "cad" | "app_mappa";
export const SEZIONI: { id: Sezione; nome: string }[] = [
  { id: "assistente", nome: "Assistente di progetto" },
  { id: "progetti", nome: "Progetti salvati" },
  { id: "edificio", nome: "Dati edificio e normativi" },
  { id: "rischio", nome: "Analisi del rischio" },
  { id: "captazione", nome: "Edificio 3D e captazione" },
  { id: "calate", nome: "Calate e distanza di separazione" },
  { id: "terra", nome: "Impianto e resistenza di terra" },
  { id: "spd", nome: "Scelta SPD" },
  { id: "computo", nome: "Computo materiali" },
  { id: "particolari", nome: "Particolari costruttivi" },
  { id: "verifiche", nome: "Verifiche e dossier" },
  { id: "prodotti", nome: "Prodotti OBO" },
  { id: "modelli3d", nome: "Modelli 3D prodotti" },
  { id: "cad", nome: "Download CAD" },
  { id: "app_mappa", nome: "OBO Hub · Mappa carichi ufficio tecnico" },
];

/** Indirizzo di OBO Hub (schermata iniziale con tutte le app), sullo stesso sito GitHub Pages. */
// sul vecchio indirizzo personale OBO Hub sta in /obo-hub/, nell'organizzazione è la radice del sito
export const URL_HUB = typeof location !== "undefined" && location.hostname.startsWith("loveteremarco1981-coder.") ? "/obo-hub/" : "/";
/** Indirizzo completo di OBO Hub, da mettere nei messaggi. */
export const urlHubCompleto = () => (typeof location !== "undefined" ? location.origin : "") + URL_HUB;

/** Pagina a cui tornare dopo l'accesso completo (es. OBO Hub): solo percorsi interni allo stesso sito. */
export function salvaRitorno(valore: string | null) {
  try { if (valore && valore.startsWith("/") && !valore.startsWith("//")) sessionStorage.setItem("lps-ritorno", valore); } catch { /* niente */ }
}
export function prendiRitorno(): string | null {
  try { const v = sessionStorage.getItem("lps-ritorno"); if (v) sessionStorage.removeItem("lps-ritorno"); return v; } catch { return null; }
}

/** Pagine pubbliche (visibili senza accesso). */
export const PUBBLICHE = ["/", "/auth", "/reset-password", "/richiesta-accesso", "/privacy", "/termini", "/contatti", "/guida"];
/** Sezione richiesta da ogni pagina; le pagine non elencate sono libere per gli utenti abilitati. */
export const SEZIONE_PAGINA: Record<string, Sezione | "admin"> = {
  "/assistente": "assistente", "/progetti": "progetti", "/dati-edificio": "edificio", "/dati-normativi": "edificio",
  "/rischio": "rischio", "/edificio-3d": "captazione", "/calate": "calate", "/resistenza-terra": "terra", "/spd": "spd",
  "/computo-materiali": "computo", "/particolari": "particolari", "/verifiche": "verifiche", "/prodotti": "prodotti",
  "/modelli-3d": "modelli3d", "/download-cad": "cad", "/admin": "admin",
};

/** Percorso interno dell'app (senza la cartella di pubblicazione, es. /Lighting). */
export function percorsoApp(pathname: string): string {
  const base = BASE.replace(/\/$/, "");
  const p = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return (p.replace(/\/+$/, "") || "/");
}

export interface Profilo { utente: string; email: string; nome: string; azienda: string; ruolo: "utente" | "admin"; stato: "attivo" | "sospeso"; sezioni: string[]; deve_cambiare_password: boolean; ultimo_accesso: string | null; mappa_ruolo?: "admin" | "guest" | "visitor"; mappa_persona?: string; visitatore?: boolean }
export type StatoAccesso = "caricamento" | "anonimo" | "non-approvato" | "sospeso" | "cambia-password" | "attiva-authenticator" | "verifica-authenticator" | "abilitato";
export interface Accesso { stato: StatoAccesso; profilo: Profilo | null; email: string | null }

let accesso: Accesso = { stato: "caricamento", profilo: null, email: null };
const ascoltatori = new Set<() => void>();
const imposta = (a: Accesso) => { accesso = a; ascoltatori.forEach((f) => f()); };
let registrato = "";

/** Accesso visitatori di OBO Hub: sessione salvata dal Hub (stessa chiave in tutte le app). */
export const CHIAVE_VISITATORE = "obo-visitatore";
export function leggiVisitatore(): { token: string; name: string } | null {
  try { const v = JSON.parse(localStorage.getItem(CHIAVE_VISITATORE) || "null"); return v && typeof v.token === "string" ? { token: v.token, name: String(v.name || "Visitatore") } : null; } catch { return null; }
}
export function esciVisitatore() { try { localStorage.removeItem(CHIAVE_VISITATORE); } catch { /* niente */ } }

/** Ricalcola lo stato di accesso (da chiamare all'avvio e a ogni cambio di sessione). */
export async function aggiornaAccesso(): Promise<void> {
  const { data: s } = await supabase.auth.getSession();
  const sessione = s.session;
  if (!sessione) {
    registrato = "";
    // visitatore di OBO Hub (nome + password visitatori, senza account): vede tutto tranne Admin, senza salvare nel cloud
    const v = leggiVisitatore();
    if (v) {
      const { data } = await db().rpc("app_visitatore_valido", { p: { token: v.token } });
      if ((data as { ok?: boolean } | null)?.ok) {
        imposta({ stato: "abilitato", email: null, profilo: { utente: "", email: "", nome: v.name, azienda: "", ruolo: "utente", stato: "attivo", sezioni: ["tutte"], deve_cambiare_password: false, ultimo_accesso: null, visitatore: true } });
        return;
      }
      esciVisitatore();
    }
    imposta({ stato: "anonimo", profilo: null, email: null }); return;
  }
  const email = sessione.user.email ?? null;
  const { data: profilo } = await db().from("accessi_profili").select("*").eq("utente", sessione.user.id).maybeSingle<Profilo>();
  if (!profilo) { imposta({ stato: "non-approvato", profilo: null, email }); return; }
  if (profilo.stato === "sospeso") { imposta({ stato: "sospeso", profilo, email }); return; }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (profilo.deve_cambiare_password && aal?.currentLevel !== "aal2" && aal?.nextLevel !== "aal2") { imposta({ stato: "cambia-password", profilo, email }); return; }
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") { imposta({ stato: "verifica-authenticator", profilo, email }); return; }
  if (aal?.currentLevel !== "aal2") { imposta({ stato: "attiva-authenticator", profilo, email }); return; }
  if (profilo.deve_cambiare_password) { imposta({ stato: "cambia-password", profilo, email }); return; }
  if (registrato !== sessione.user.id) { registrato = sessione.user.id; db().rpc("registra_accesso", { evento: "accesso", dettagli: { app: "lps" } }).then(() => {}, () => {}); // .then: senza, la chiamata non parte }
  imposta({ stato: "abilitato", profilo, email });
}

export function useAccesso(): Accesso {
  return useSyncExternalStore((f) => { ascoltatori.add(f); return () => ascoltatori.delete(f); }, () => accesso, () => accesso);
}

export function puoVedere(a: Accesso, sezione: Sezione | "admin" | undefined): boolean {
  if (a.stato !== "abilitato" || !a.profilo) return false;
  if (a.profilo.ruolo === "admin") return true;
  if (!sezione) return true;
  if (sezione === "admin") return false;
  return a.profilo.sezioni.includes("tutte") || a.profilo.sezioni.includes(sezione);
}

/** Chiamata alla funzione Supabase di gestione (solo amministratori). */
export async function gestione(azione: string, dati: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("gestione-accessi", { body: { azione, ...dati } });
  if (error) {
    let messaggio = error.message;
    try { const corpo = await (error as { context?: Response }).context?.json(); if (corpo?.errore) messaggio = corpo.errore; } catch { /* corpo non leggibile */ }
    throw new Error(messaggio);
  }
  return data as Record<string, unknown>;
}
