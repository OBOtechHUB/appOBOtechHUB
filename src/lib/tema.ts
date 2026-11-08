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
  applicaTema(); applicaZoom();
  // niente zoom con le dita su iPhone/iPad: si usano Testo più piccolo / più grande
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => applicaTema());
  // scelta cambiata in un'altra app/scheda di OBO Hub
  window.addEventListener("storage", (e) => { if (e.key === CHIAVE) { applicaTema(); ascoltatori.forEach((f) => f()); } if (e.key === "obo-zoom") { applicaZoom(); ascoltatori.forEach((f) => f()); } });
}
export function useTema(): Tema {
  return useSyncExternalStore((f) => { ascoltatori.add(f); return () => ascoltatori.delete(f); }, leggiTema, () => "auto");
}
export const NOMI_TEMA: Record<Tema, string> = { auto: "Automatico", light: "Chiaro", dark: "Scuro" };

/* Dimensione del testo condivisa da tutte le app di OBO Hub ("obo-zoom"): pulsanti − e +. */
const PASSI_ZOOM = [0.85, 0.9, 1, 1.1, 1.2, 1.3, 1.45];
const CHIAVE_ZOOM = "obo-zoom";
export function leggiZoom(): number {
  try { const v = Number(localStorage.getItem(CHIAVE_ZOOM)); return PASSI_ZOOM.includes(v) ? v : 1; } catch { return 1; }
}
export function applicaZoom(z = leggiZoom()) { document.documentElement.style.setProperty("--obo-zoom", String(z)); }
export function cambiaZoom(verso: 1 | -1) {
  const i = PASSI_ZOOM.indexOf(leggiZoom());
  const z = PASSI_ZOOM[Math.min(PASSI_ZOOM.length - 1, Math.max(0, i + verso))]!;
  try { if (z === 1) localStorage.removeItem(CHIAVE_ZOOM); else localStorage.setItem(CHIAVE_ZOOM, String(z)); } catch { /* niente */ }
  applicaZoom(z); ascoltatori.forEach((f) => f());
}
export function useZoom(): number {
  return useSyncExternalStore((f) => { ascoltatori.add(f); return () => ascoltatori.delete(f); }, leggiZoom, () => 1);
}
