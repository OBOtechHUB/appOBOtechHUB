import { useSyncExternalStore } from "react";

/** Evento di Chrome/Edge/Android per proporre l'installazione dell'app. */
interface EventoInstallazione extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

let evento: EventoInstallazione | null = null;
let installata = false;
const ascoltatori = new Set<() => void>();
const avvisa = () => ascoltatori.forEach((f) => f());

/** Da chiamare all'avvio, prima che React sia pronto (l'evento può arrivare subito). */
export function avviaInstallazione() {
  if (typeof window === "undefined") return;
  installata = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); evento = e as EventoInstallazione; avvisa(); });
  window.addEventListener("appinstalled", () => { installata = true; evento = null; avvisa(); });
}

export type Piattaforma = "ios" | "android" | "mac-safari" | "desktop";
export function piattaforma(): Piattaforma {
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return "mac-safari";
  return "desktop";
}

export function useInstallazione() {
  const stato = useSyncExternalStore((f) => { ascoltatori.add(f); return () => ascoltatori.delete(f); }, () => (installata ? "installata" : evento ? "pronta" : "manuale"), () => "manuale");
  async function installa(): Promise<boolean> {
    if (!evento) return false;
    await evento.prompt();
    const scelta = await evento.userChoice;
    evento = null; avvisa();
    return scelta.outcome === "accepted";
  }
  return { stato: stato as "installata" | "pronta" | "manuale", installa };
}
