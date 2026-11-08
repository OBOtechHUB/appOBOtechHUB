/**
 * Lingua condivisa da tutte le app di OBO Hub (stesso sito, chiave "obo-lingua"): italiano predefinito, inglese a scelta.
 * Il testo dell'app resta scritto in italiano; in inglese le scritte visibili vengono tradotte al volo con il
 * dizionario public/i18n/dizionario-en.js (caricato solo quando serve). I dati inseriti dagli utenti non cambiano.
 */
import { useSyncExternalStore } from "react";

export type Lingua = "it" | "en";
const CHIAVE = "obo-lingua";
const ascoltatori = new Set<() => void>();

export function leggiLingua(): Lingua {
  try { return localStorage.getItem(CHIAVE) === "en" ? "en" : "it"; } catch { return "it"; }
}
export function useLingua(): Lingua {
  return useSyncExternalStore((f) => { ascoltatori.add(f); return () => ascoltatori.delete(f); }, leggiLingua, () => "it");
}

type Dizionario = Record<string, string>;
let dizionario: Dizionario | null = null;
let modelli: { re: RegExp; en: string }[] = [];
let lingua: Lingua = "it";
const originale = new WeakMap<Node, string>();
const impostato = new WeakMap<Node, string>();
const ATTRIBUTI = ["placeholder", "aria-label", "title", "alt"] as const;

function prepara(d: Dizionario) {
  dizionario = d;
  const esc = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  modelli = Object.entries(d).filter(([k]) => k.includes("{}")).map(([k, en]) => ({
    re: new RegExp("^" + k.split("{}").map(esc).join("([\\s\\S]+?)") + "$"), en,
  }));
}

function traduci(testo: string): string {
  if (!dizionario) return testo;
  const k = testo.trim();
  if (!k || !/[A-Za-zÀ-ÿ]/.test(k)) return testo;
  const esatto = dizionario[k];
  if (esatto !== undefined) return testo.replace(k, esatto);
  for (const m of modelli) {
    const r = m.re.exec(k);
    if (r) { let i = 1; return testo.replace(k, m.en.replace(/\{\}/g, () => r[i++] ?? "")); }
  }
  return testo;
}

function nodo(n: Node) {
  if (n.nodeType === 3) {
    const p = n.parentNode as HTMLElement | null;
    if (!p || p.nodeName === "SCRIPT" || p.nodeName === "STYLE" || p.nodeName === "TEXTAREA" || p.closest?.("[data-no-traduci]")) return;
    const attuale = n.nodeValue ?? "";
    if (impostato.get(n) !== attuale) originale.set(n, attuale); // testo nuovo scritto dall'app
    const it = originale.get(n) ?? attuale;
    const v = lingua === "en" ? traduci(it) : it;
    if (v !== attuale) { impostato.set(n, v); n.nodeValue = v; } else impostato.set(n, v);
  } else if (n.nodeType === 1) {
    const el = n as Element;
    if (el.nodeName === "SCRIPT" || el.nodeName === "STYLE" || el.hasAttribute("data-no-traduci")) return;
    for (const a of ATTRIBUTI) {
      if (!el.hasAttribute(a)) continue;
      const chiave = `data-it-${a}`;
      const attuale = el.getAttribute(a) ?? "";
      if (el.getAttribute(`data-en-${a}`) !== attuale) el.setAttribute(chiave, attuale);
      const it = el.getAttribute(chiave) ?? attuale;
      const v = lingua === "en" ? traduci(it) : it;
      el.setAttribute(`data-en-${a}`, v);
      if (v !== attuale) el.setAttribute(a, v);
    }
    el.childNodes.forEach(nodo);
  }
}

let osservatore: MutationObserver | null = null;
function osserva() {
  if (osservatore) return;
  osservatore = new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "characterData") nodo(m.target);
      else if (m.type === "attributes" && m.target.nodeType === 1) nodo(m.target);
      else m.addedNodes.forEach(nodo);
    }
  });
  osservatore.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTI] });
}

async function caricaDizionario(): Promise<void> {
  if (dizionario) return;
  await new Promise<void>((ok) => {
    const s = document.createElement("script");
    s.src = `${import.meta.env.BASE_URL}i18n/dizionario-en.js`;
    s.onload = () => ok(); s.onerror = () => ok();
    document.head.appendChild(s);
  });
  prepara((window as unknown as { OBO_EN?: Dizionario }).OBO_EN ?? {});
}

async function applica() {
  document.documentElement.lang = lingua;
  if (lingua === "en") await caricaDizionario();
  if (dizionario) nodo(document.body);
  if (lingua === "en") osserva();
}

export function impostaLingua(l: Lingua) {
  try { if (l === "en") localStorage.setItem(CHIAVE, "en"); else localStorage.removeItem(CHIAVE); } catch { /* niente */ }
  lingua = l; void applica(); ascoltatori.forEach((f) => f());
}

export function avviaLingua() {
  lingua = leggiLingua();
  void applica();
  window.addEventListener("storage", (e) => { if (e.key === CHIAVE) { lingua = leggiLingua(); void applica(); ascoltatori.forEach((f) => f()); } });
}
