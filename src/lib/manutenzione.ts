import { useEffect, useState } from "react";
import { db, SEZIONI, URL_HUB } from "@/lib/accesso";

/** Una voce in manutenzione: nomi per la pagina (inglese) e per l'avviso admin, fine prevista e nota facoltative. */
export interface VoceManutenzione { nome: string; nome_en: string; fino?: string; nota?: string }
export type MappaManutenzione = Record<string, VoceManutenzione>;
export interface StatoManutenzione { sezioni: MappaManutenzione; admin: boolean }

/** App di OBO Hub che si possono mettere in manutenzione (id come in hub/config.js). */
export const APP_HUB: { id: string; nome: string; nome_en: string }[] = [
  { id: "app:lps", nome: "Progettazione LPS (tutta l'app)", nome_en: "Lightning protection design" },
  { id: "app:mappa", nome: "Mappa carichi ufficio tecnico", nome_en: "Technical office workload map" },
  { id: "app:prodotti", nome: "Prodotti OBO", nome_en: "OBO products" },
  { id: "app:torrette", nome: "Configuratore torrette", nome_en: "Floor box configurator" },
];
const EN: Record<string, string> = {
  assistente: "Project assistant", progetti: "Saved projects", edificio: "Building and standard data", rischio: "Risk assessment",
  captazione: "3D building and air-termination", calate: "Down conductors and separation distance", terra: "Earthing system",
  spd: "SPD selection", computo: "Bill of materials", particolari: "Construction details", verifiche: "Inspections and dossier",
  prodotti: "OBO products", modelli3d: "3D product models", cad: "CAD downloads",
};
/** Sezioni di Progettazione LPS (id "lps:<sezione>", le stesse dei permessi). */
export const SEZIONI_LPS = SEZIONI.filter((s) => !s.id.startsWith("app_")).map((s) => ({ id: `lps:${s.id}`, nome: s.nome, nome_en: EN[s.id] ?? s.nome }));

/** La prima voce in manutenzione tra quelle indicate (es. tutta l'app, poi la sezione della pagina). */
export function primaInManutenzione(m: MappaManutenzione | undefined, ids: (string | undefined)[]): string | null {
  if (!m) return null;
  for (const id of ids) if (id && m[id]) return id;
  return null;
}

/** Indirizzo della pagina di manutenzione di OBO Hub, con ritorno alla pagina attuale. */
export function urlManutenzione(id: string): string {
  const torna = typeof location !== "undefined" ? location.pathname + location.search + location.hash : "/";
  return `${URL_HUB}manutenzione.html?s=${encodeURIComponent(id)}&torna=${encodeURIComponent(torna)}`;
}

/** Converte il testo salvato in impostazioni_admin (JSON) in mappa, ignorando valori non validi. */
export function leggiMappa(valore: string | undefined | null): MappaManutenzione {
  if (!valore) return {};
  try { const j = JSON.parse(valore); return j && typeof j === "object" && !Array.isArray(j) ? j as MappaManutenzione : {}; } catch { return {}; }
}

let cache: { quando: number; stato: StatoManutenzione | null } | null = null;
/** Stato dalla funzione pubblica stato_manutenzione() (supabase/manutenzione.sql); null se non disponibile. */
export async function leggiManutenzione(forza = false): Promise<StatoManutenzione | null> {
  if (!forza && cache && Date.now() - cache.quando < 60_000) return cache.stato;
  let stato: StatoManutenzione | null = null;
  try {
    const { data, error } = await db().rpc("stato_manutenzione");
    if (!error && data && typeof data === "object") { const d = data as { sezioni?: MappaManutenzione; admin?: boolean }; stato = { sezioni: d.sezioni ?? {}, admin: !!d.admin }; }
  } catch { /* funzione non ancora creata: nessuna manutenzione */ }
  cache = { quando: Date.now(), stato };
  return stato;
}

/** Stato della manutenzione, riletto quando cambia la pagina o l'utente. */
let ultimoUtente: string | undefined;
export function useManutenzione(utente: string, pagina: string): StatoManutenzione | null {
  const [s, setS] = useState<StatoManutenzione | null>(cache?.stato ?? null);
  useEffect(() => {
    let vivo = true;
    const cambiato = utente !== ultimoUtente; ultimoUtente = utente; // altro utente: "admin" va richiesto di nuovo
    void leggiManutenzione(cambiato).then((x) => { if (vivo) setS(x); });
    return () => { vivo = false; };
  }, [utente, pagina]);
  return s;
}
