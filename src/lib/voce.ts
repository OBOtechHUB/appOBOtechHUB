/**
 * Voce nel browser: dettatura (riconoscimento vocale del browser, in italiano) e registrazione di
 * messaggi vocali (MediaRecorder). Dettatura: Chrome, Edge, Safari su iPhone/iPad; dove manca
 * resta il microfono della tastiera del telefono.
 */
import { useEffect, useRef, useState } from "react";

interface RisultatoVoce { isFinal: boolean; 0: { transcript: string } }
interface EventoVoce { resultIndex: number; results: ArrayLike<RisultatoVoce> }
interface Riconoscitore {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: EventoVoce) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void; abort?: () => void;
}
type CostruttoreRiconoscitore = new () => Riconoscitore;
const costruttore = (): CostruttoreRiconoscitore | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: CostruttoreRiconoscitore; webkitSpeechRecognition?: CostruttoreRiconoscitore };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const dettaturaDisponibile = () => costruttore() != null;

/** Dettatura: ogni frase riconosciuta viene passata ad `aggiungi`; `parziale` è la frase in corso. */
export function useDettatura(aggiungi: (testo: string) => void) {
  const [attiva, setAttiva] = useState(false), [parziale, setParziale] = useState(""), [errore, setErrore] = useState("");
  const rif = useRef<Riconoscitore | null>(null), cb = useRef(aggiungi);
  cb.current = aggiungi;
  useEffect(() => () => { const r = rif.current; rif.current = null; try { r?.abort?.(); r?.stop(); } catch { /* già ferma */ } }, []);
  // ferma subito: alcuni browser (Chrome su Android) con la dettatura continua non si fermano con stop()
  const ferma = () => {
    const r = rif.current; rif.current = null; setAttiva(false); setParziale("");
    if (!r) return;
    r.onresult = null; r.onend = null;
    try { r.stop(); } catch { /* già ferma */ }
    window.setTimeout(() => { try { r.abort?.(); } catch { /* già ferma */ } }, 400);
  };
  const avvia = () => {
    const C = costruttore(); if (!C) { setErrore("Dettatura non disponibile in questo browser: usa il microfono della tastiera."); return; }
    setErrore("");
    const r = new C(); r.lang = "it-IT"; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      if (rif.current !== r) return;
      let p = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const x = e.results[i]!; const t = x[0].transcript.trim();
        if (x.isFinal) { if (t) cb.current(t.charAt(0).toUpperCase() + t.slice(1)); } else p += ` ${t}`;
      }
      setParziale(p.trim());
    };
    r.onerror = (e) => setErrore(e.error === "not-allowed" ? "Permesso del microfono negato: consentilo dal lucchetto vicino all'indirizzo." : e.error === "no-speech" ? "" : `Dettatura interrotta (${e.error}).`);
    r.onend = () => { if (rif.current === r) { setAttiva(false); setParziale(""); rif.current = null; } };
    rif.current = r; r.start(); setAttiva(true);
  };
  return { attiva, parziale, errore, avvia, ferma, disponibile: dettaturaDisponibile() };
}

/** Formato audio registrabile dal browser (webm su Chrome/Android, mp4 su iPhone/Safari). */
export function formatoAudio(): { mime: string; estensione: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const [mime, estensione] of [["audio/webm;codecs=opus", "webm"], ["audio/webm", "webm"], ["audio/mp4", "m4a"], ["audio/ogg;codecs=opus", "ogg"]] as const)
    if (MediaRecorder.isTypeSupported(mime)) return { mime, estensione };
  return { mime: "", estensione: "webm" };
}

export const DURATA_MASSIMA = 300; // secondi

/** Registrazione di un messaggio vocale: `fine` riceve l'audio e la durata in secondi. */
export function useRegistratore(fine: (audio: Blob, durata: number, estensione: string) => void) {
  const [registra, setRegistra] = useState(false), [secondi, setSecondi] = useState(0), [errore, setErrore] = useState("");
  const rec = useRef<MediaRecorder | null>(null), cb = useRef(fine), t0 = useRef(0), timer = useRef<number | undefined>(undefined);
  cb.current = fine;
  useEffect(() => () => { window.clearInterval(timer.current); rec.current?.state === "recording" && rec.current.stop(); }, []);
  const ferma = () => { if (rec.current?.state === "recording") rec.current.stop(); };
  const avvia = async () => {
    const f = formatoAudio(); if (!f || !navigator.mediaDevices?.getUserMedia) { setErrore("Registrazione non disponibile in questo browser."); return; }
    setErrore("");
    let flusso: MediaStream;
    try { flusso = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setErrore("Permesso del microfono negato: consentilo dal lucchetto vicino all'indirizzo (o da Impostazioni sul telefono)."); return; }
    const r = f.mime ? new MediaRecorder(flusso, { mimeType: f.mime, audioBitsPerSecond: 32000 }) : new MediaRecorder(flusso);
    const pezzi: Blob[] = [];
    r.ondataavailable = (e) => { if (e.data.size) pezzi.push(e.data); };
    r.onstop = () => {
      window.clearInterval(timer.current); flusso.getTracks().forEach((x) => x.stop()); setRegistra(false);
      const durata = Math.round((Date.now() - t0.current) / 1000);
      const tipo = (r.mimeType || f.mime || "audio/webm").split(";")[0]!;
      if (pezzi.length && durata >= 1) cb.current(new Blob(pezzi, { type: tipo }), durata, tipo.includes("mp4") ? "m4a" : f.estensione);
    };
    rec.current = r; t0.current = Date.now(); setSecondi(0); r.start(1000); setRegistra(true);
    timer.current = window.setInterval(() => { const s = Math.round((Date.now() - t0.current) / 1000); setSecondi(s); if (s >= DURATA_MASSIMA) r.stop(); }, 500);
  };
  return { registra, secondi, errore, avvia, ferma, disponibile: typeof window !== "undefined" && typeof MediaRecorder !== "undefined" };
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
