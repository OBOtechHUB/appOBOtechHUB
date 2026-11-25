/**
 * Annulla / ripeti per tutto il progetto: Ctrl+Z (Cmd+Z) torna allo stato precedente, Ctrl+Y o Ctrl+Maiusc+Z
 * rifà. Nei campi di testo resta l'annulla del browser. Si azzera quando cambi progetto.
 * Tasti laterali del mouse (indietro / avanti): se un disegno o un'area interattiva blocca il tasto, si torna
 * comunque alla pagina precedente.
 */
import { ascoltaBase } from "@/lib/progettoStore";
import { ascoltaEsteso, caricaSnapshot, leggiAttivo, snapshot } from "@/lib/statoProgetto";

type Stato = ReturnType<typeof snapshot>;
const MAX = 25;
let passato: Stato[] = [], futuro: Stato[] = [], ultimo: Stato | null = null, timer = 0, ripristino = false, progetto: string | null | undefined;

function registra() {
  if (ripristino) return;
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    const id = leggiAttivo()?.id ?? null;
    if (id !== progetto) { progetto = id; passato = []; futuro = []; ultimo = snapshot(); return; }
    const ora = snapshot();
    if (ultimo && ora.edificio === ultimo.edificio && ora.computo === ultimo.computo && ora.esteso === ultimo.esteso) return;
    if (ultimo) { passato.push(ultimo); if (passato.length > MAX) passato.shift(); }
    futuro = []; ultimo = ora;
  }, 450);
}

function applica(s: Stato, testo: string) {
  ripristino = true;
  try { caricaSnapshot(s); } finally { ripristino = false; }
  ultimo = snapshot(); avviso(testo);
}
export function annulla(): boolean { const s = passato.pop(); if (!s || !ultimo) return false; futuro.push(ultimo); applica(s, "Modifica annullata · Ctrl+Y per ripeterla"); return true; }
export function ripeti(): boolean { const s = futuro.pop(); if (!s || !ultimo) return false; passato.push(ultimo); applica(s, "Modifica ripetuta"); return true; }

let box: HTMLDivElement | null = null, tAvv = 0;
function avviso(t: string) {
  if (!box) { box = document.createElement("div"); box.setAttribute("role", "status"); box.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;background:#262f35;color:#fff;padding:8px 14px;border-radius:999px;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);pointer-events:none;transition:opacity .3s"; document.body.appendChild(box); }
  box.textContent = t; box.style.opacity = "1"; clearTimeout(tAvv); tAvv = window.setTimeout(() => { if (box) box.style.opacity = "0"; }, 1800);
}

function campoTesto(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null; if (!el) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

export function avviaAnnulla(): () => void {
  progetto = leggiAttivo()?.id ?? null; ultimo = snapshot();
  const via1 = ascoltaBase(registra), via2 = ascoltaEsteso(registra);
  const tasti = (e: KeyboardEvent) => {
    if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey || campoTesto(e.target)) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { if (annulla()) e.preventDefault(); else avviso("Niente da annullare"); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { if (ripeti()) e.preventDefault(); }
  };
  // tasti laterali del mouse bloccati da un'area interattiva (es. il modello 3D): si naviga lo stesso
  let bloccato = -1;
  const giu = (e: PointerEvent) => { bloccato = (e.button === 3 || e.button === 4) && e.defaultPrevented ? e.button : -1; };
  const su = (e: PointerEvent) => { if ((e.button === 3 || e.button === 4) && bloccato === e.button) { bloccato = -1; if (e.button === 3) history.back(); else history.forward(); } };
  addEventListener("keydown", tasti); addEventListener("pointerdown", giu); addEventListener("pointerup", su);
  return () => { via1(); via2(); removeEventListener("keydown", tasti); removeEventListener("pointerdown", giu); removeEventListener("pointerup", su); };
}
