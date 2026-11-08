/**
 * Aspetto condiviso da tutte le app di OBO Hub (stesso sito, stessa scelta):
 * "auto" segue il sistema, "light" chiaro, "dark" scuro.
 */
import { useSyncExternalStore } from "react";

export type Tema = "auto" | "light" | "dark";
const CHIAVE = "obo-tema";
const ascoltatori = new Set<() => void>();

export function leggiTema(): Tema {
  try { const v = localStorage.getItem(CHIAVE); return v === "light" || v === "dark" ? v : "auto"; } catch { return "auto"; }
}
function scuro(t: Tema) { return t === "dark" || (t === "auto" && window.matchMedia?.("(prefers-color-scheme: dark)").matches); }
export function applicaTema(t: Tema = leggiTema()) {
  const r = document.documentElement;
  r.classList.toggle("dark", !!scuro(t));
  r.style.colorScheme = scuro(t) ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", scuro(t) ? "#1b1f23" : "#ffffff");
}
export function impostaTema(t: Tema) {
  try { if (t === "auto") localStorage.removeItem(CHIAVE); else localStorage.setItem(CHIAVE, t); } catch { /* niente */ }
  applicaTema(t); ascoltatori.forEach((f) => f());
}
export function avviaTema() {
  applicaTema();
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => applicaTema());
  // scelta cambiata in un'altra app/scheda di OBO Hub
  window.addEventListener("storage", (e) => { if (e.key === CHIAVE) { applicaTema(); ascoltatori.forEach((f) => f()); } });
}
export function useTema(): Tema {
  return useSyncExternalStore((f) => { ascoltatori.add(f); return () => ascoltatori.delete(f); }, leggiTema, () => "auto");
}
export const NOMI_TEMA: Record<Tema, string> = { auto: "Automatico", light: "Chiaro", dark: "Scuro" };
