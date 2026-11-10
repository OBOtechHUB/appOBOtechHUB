import { db, leggiVisitatore } from "@/lib/accesso";

/** Registro errori e statistiche d'uso (funzioni segnala_errore e registra_uso di supabase/pro.sql).
 *  Non manda mai dati inseriti dall'utente: solo pagina, messaggio d'errore, browser e versione. */
const APP = "lps";
const visti = new Set<string>();
let inviati = 0;
const versione = () => (typeof document !== "undefined" ? document.querySelector<HTMLMetaElement>('meta[name="obo-versione"]')?.content ?? "" : "");
const pagina = () => (typeof location !== "undefined" ? location.pathname : "");
/** Errori che non dipendono dall'app (rete, estensioni del browser): non si registrano. */
export const ERRORE_IGNORATO = /ResizeObserver loop|^Script error\.?$|Load failed|NetworkError|Failed to fetch|AbortError|dynamically imported module/i;

export function segnalaErrore(messaggio: unknown, dettagli = ""): void {
  const m = String(messaggio ?? "").slice(0, 500);
  if (!m || ERRORE_IGNORATO.test(m)) return;
  const k = `${m}|${pagina()}`;
  if (visti.has(k) || inviati >= 10) return; // al massimo 10 errori diversi per sessione di pagina
  visti.add(k); inviati++;
  void db().rpc("segnala_errore", { app: APP, pagina: pagina(), messaggio: m, dettagli: dettagli.slice(0, 4000), browser: navigator.userAgent.slice(0, 300), versione: versione() }).then(() => undefined, () => undefined);
}

let avviato = false;
export function avviaRegistroErrori(): void {
  if (avviato || typeof window === "undefined") return;
  avviato = true;
  window.addEventListener("error", (e) => { if (e.message) segnalaErrore(e.message, `${e.filename ?? ""}:${e.lineno ?? ""}:${e.colno ?? ""}${e.error instanceof Error && e.error.stack ? `\n${e.error.stack}` : ""}`); });
  window.addEventListener("unhandledrejection", (e) => { const r = e.reason as unknown; segnalaErrore(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack ?? "" : ""); });
}

/** Apertura di una sezione (una volta ogni 30 minuti per sezione); gli admin sono esclusi dal database. */
export function registraUso(sezione: string, entrato: boolean): void {
  const chiave = `obo-uso-${APP}-${sezione}`, ora = Date.now();
  try { if (ora - Number(sessionStorage.getItem(chiave) ?? 0) < 30 * 60_000) return; sessionStorage.setItem(chiave, String(ora)); } catch { /* niente */ }
  const v = leggiVisitatore();
  if (!entrato && !v) return;
  void db().rpc("registra_uso", { app: APP, sezione, visitatore: entrato ? null : v?.name ?? null }).then(() => undefined, () => undefined);
}
