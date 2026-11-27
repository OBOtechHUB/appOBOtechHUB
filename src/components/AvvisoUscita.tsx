/**
 * «Attenzione: perderai i dati»: avviso quando si esce dall'app (link verso OBO Hub o altre app, chiusura o ricarica
 * della scheda) con modifiche non ancora salvate nel progetto. Stesso comportamento di comune/avviso-uscita.js delle
 * app di OBO Hub. I cambi pagina dentro l'app non perdono nulla e non sono intercettati.
 * Casi: progetto aperto con modifiche non ancora salvate (il salvataggio automatico parte ogni 5 s; con un progetto
 * aperto lo stato non resta nel browser) oppure lavoro non salvato in nessun progetto. I visitatori non salvano nel
 * cloud: nessun avviso.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { leggiAttivo, snapshot, snapshotSchema, snapshotVuoto } from "@/lib/statoProgetto";
import { salvaAttivo } from "@/components/ProjectSync";
import { BASE } from "@/lib/base";
import { Button } from "@/components/ui/button";

let vuoto: string | null = null;
const firmaVuota = () => (vuoto ??= JSON.stringify(snapshotSchema.parse(snapshotVuoto())));

/** true se uscendo ora si perderebbero dati: modifiche non salvate nel progetto aperto o lavoro fuori da un progetto. */
export function datiNonSalvati(): boolean {
  const a = leggiAttivo(), s = JSON.stringify(snapshot());
  if (a) return s !== a.salvato;
  try { return JSON.stringify(snapshotSchema.parse(snapshot())) !== firmaVuota(); } catch { return false; }
}

export function AvvisoUscita() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [verso, setVerso] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const via = useRef(false);
  const attivo = !!user;

  useEffect(() => {
    if (!attivo) return;
    const sporco = () => !via.current && datiNonSalvati();
    const prima = (e: BeforeUnloadEvent) => { if (!sporco()) return; e.preventDefault(); e.returnValue = ""; return ""; };
    const clic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#") || /^(javascript|mailto|tel|blob|data):/i.test(href)) return;
      let u: URL; try { u = new URL(a.href, location.href); } catch { return; }
      // pagine di questa app: navigazione interna, i dati restano
      if (u.origin === location.origin && u.pathname.startsWith(BASE)) return;
      if (!sporco()) return;
      e.preventDefault(); e.stopPropagation();
      setMsg(""); setVerso(u.href);
    };
    window.addEventListener("beforeunload", prima);
    document.addEventListener("click", clic, true);
    return () => { window.removeEventListener("beforeunload", prima); document.removeEventListener("click", clic, true); };
  }, [attivo]);

  useEffect(() => {
    if (!verso) return;
    const tasto = (e: KeyboardEvent) => { if (e.key === "Escape") setVerso(null); };
    document.addEventListener("keydown", tasto);
    return () => document.removeEventListener("keydown", tasto);
  }, [verso]);

  if (!verso) return null;
  const conProgetto = !!leggiAttivo();
  const esci = () => { via.current = true; location.href = verso; };
  const salvaEdEsci = async () => {
    setInCorso(true); setMsg("");
    try { await salvaAttivo(); if (datiNonSalvati()) throw new Error("salvataggio sospeso (progetto emesso: apri la revisione successiva)"); esci(); }
    catch (e) { setMsg(`Non salvato: ${e instanceof Error ? e.message : String(e)}`); setInCorso(false); }
  };
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="avviso-uscita-t" className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/55 p-4" onClick={(e) => { if (e.target === e.currentTarget) setVerso(null); }}>
      <div className="w-full max-w-[420px] rounded-2xl border bg-card p-5 text-card-foreground shadow-2xl">
        <h2 id="avviso-uscita-t" className="flex items-center gap-2 text-lg font-bold"><span aria-hidden="true" className="text-[22px] text-[#f39b00]">⚠</span>Attenzione: perderai i dati</h2>
        <p className="mt-2 text-sm">
          {conProgetto ? "Le ultime modifiche non sono ancora salvate nel progetto. Se esci ora andranno perse." : "Questo lavoro non è salvato in nessun progetto. Salvalo da «Progetti» → «Salva lavoro corrente come progetto», altrimenti non lo ritroverai su altri dispositivi."}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={esci} disabled={inCorso}>Esci senza salvare</Button>
          {conProgetto
            ? <Button variant="outline" size="sm" onClick={() => void salvaEdEsci()} disabled={inCorso}>{inCorso ? "Salvataggio…" : "Salva ed esci"}</Button>
            : <Button variant="outline" size="sm" onClick={() => { setVerso(null); void navigate({ to: "/progetti" }); }}>Vai a Progetti</Button>}
          <Button size="sm" onClick={() => setVerso(null)} autoFocus>Resta qui</Button>
        </div>
        {msg && <p role="status" className="mt-2 text-sm text-[#b3261e] dark:text-[#f5b4ad]">{msg}</p>}
      </div>
    </div>
  );
}
