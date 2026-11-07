/** Percorso di pubblicazione (es. "/lps/" su GitHub Pages, "/" in locale). */
export const BASE = import.meta.env.BASE_URL || "/";

/** Percorso di un file in public/ rispettando il percorso di pubblicazione: risorsa("cad/LPS.lsp"). */
export function risorsa(percorso: string): string {
  return BASE.replace(/\/?$/, "/") + percorso.replace(/^\/+/, "");
}

/** URL assoluto di una pagina dell'app (per i link nelle email di Supabase). */
export function urlApp(percorso: string): string {
  return window.location.origin + risorsa(percorso);
}
