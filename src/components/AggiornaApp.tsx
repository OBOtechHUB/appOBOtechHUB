import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

const ATTUALE = import.meta.env["VITE_VERSIONE"] as string | undefined;
const CHIAVE = "obo-novita-lps";
let ultima = "";

/** Voce del registro novita.json (public/novita.json; quelle con app "tutte" stanno nel registro di OBO Hub). */
export interface Novita { id: string; data: string; app: string; titolo: string; titolo_en?: string; voci?: string[]; voci_en?: string[] }

const inglese = () => { try { return localStorage.getItem("obo-lingua") === "en"; } catch { return false; } };
const leggi = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const scrivi = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* niente */ } };
const dataIt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(inglese() ? "en-GB" : "it-IT", { day: "numeric", month: "long", year: "numeric" });

async function caricaNovita(): Promise<Novita[]> {
  const leggiJson = async (u: string) => { try { const r = await fetch(`${u}?t=${Date.now()}`, { cache: "no-store" }); return r.ok ? ((await r.json()) as { aggiornamenti?: Novita[] }).aggiornamenti ?? [] : []; } catch { return []; } };
  const [proprie, comuni] = await Promise.all([leggiJson(`${import.meta.env.BASE_URL}novita.json`), leggiJson("/novita.json")]);
  return [...proprie.filter((a) => a.app === "lps"), ...comuni.filter((a) => a.app === "tutte")]
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.id < b.id ? 1 : -1));
}
/** Voci più recenti dell'ultima vista; al primo avvio segna tutto come visto e non mostra nulla. */
export function nonViste(lista: Novita[], vista: string | null): { voci: Novita[]; primaVolta: boolean } {
  if (!lista.length) return { voci: [], primaVolta: false };
  if (!vista) return { voci: [], primaVolta: true };
  const i = lista.findIndex((a) => a.id === vista);
  return { voci: i < 0 ? [] : lista.slice(0, i), primaVolta: false };
}

function Elenco({ voci }: { voci: Novita[] }) {
  const en = inglese();
  return <div className="space-y-2">{voci.slice(0, 5).map((a) => <div key={a.id}>
    <p className="font-semibold">{en && a.titolo_en ? a.titolo_en : a.titolo} <span className="font-normal opacity-75">· {dataIt(a.data)}</span></p>
    {(en && a.voci_en ? a.voci_en : a.voci ?? []).length > 0 && <ul className="mt-1 list-disc pl-5 font-normal">{(en && a.voci_en ? a.voci_en : a.voci ?? []).map((v) => <li key={v}>{v}</li>)}</ul>}
  </div>)}{voci.length > 5 && <p className="font-normal">…e altro</p>}</div>;
}

/** Controlla se è stata pubblicata una versione nuova e mostra in alto "Aggiorna app" con le novità; dopo l'aggiornamento mostra una volta le novità non viste. */
export function AggiornaApp() {
  const [nuova, setNuova] = useState(false);
  const [vociNuova, setVociNuova] = useState<Novita[]>([]);
  const [aperto, setAperto] = useState(false);
  const [daVedere, setDaVedere] = useState<Novita[]>([]);

  useEffect(() => {
    let attivo = true;
    void caricaNovita().then((l) => {
      if (!attivo) return;
      const { voci, primaVolta } = nonViste(l, leggi(CHIAVE));
      if (primaVolta && l[0]) scrivi(CHIAVE, l[0].id);
      setDaVedere(voci);
    });
    if (!ATTUALE) return () => { attivo = false; }; // in sviluppo locale non c'è versione
    const controlla = async () => {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const { versione } = (await r.json()) as { versione?: string };
        let gia = ""; try { gia = sessionStorage.getItem("obo-aggiornato-lps") ?? ""; } catch { /* niente */ }
        if (attivo && versione && versione !== ATTUALE && versione !== gia) {
          ultima = versione;
          const l = await caricaNovita();
          const vista = leggi(CHIAVE);
          setVociNuova(vista ? nonViste(l, vista).voci : l.slice(0, 3));
          setNuova(true);
        }
      } catch { /* offline: riprova più tardi */ }
    };
    void controlla();
    const t = setInterval(() => void controlla(), 5 * 60 * 1000);
    const vis = () => { if (document.visibilityState === "visible") void controlla(); };
    document.addEventListener("visibilitychange", vis);
    return () => { attivo = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, []);

  return <>
    {nuova && <div role="status" className="relative z-[60] bg-primary px-4 py-2 text-sm font-semibold text-white" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span>È disponibile una nuova versione dell'app.</span>
        {vociNuova.length > 0 && <button type="button" onClick={() => setAperto(!aperto)} className="rounded-full border border-white/80 px-3 py-1 hover:bg-white/10">Cosa cambia</button>}
        <button type="button" onClick={() => void aggiorna()} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-primary hover:bg-white/90">
          <RefreshCw className="size-4" />Aggiorna app
        </button>
      </div>
      {aperto && <div className="mx-auto mt-2 max-w-3xl"><Elenco voci={vociNuova} /></div>}
    </div>}
    {!nuova && daVedere.length > 0 && <div role="dialog" aria-label="Novità" className="fixed bottom-4 left-4 right-4 z-[70] ml-auto max-h-[70vh] max-w-md overflow-auto rounded-xl border border-primary bg-card p-4 text-sm text-foreground shadow-2xl">
      <p className="mb-2 flex items-center gap-2 text-base font-bold text-primary"><Sparkles className="size-5" />Novità dell'app</p>
      <Elenco voci={daVedere} />
      <div className="mt-3 flex justify-end gap-2">
        <a href="/novita.html?app=lps" className="rounded-full border border-primary px-3 py-1.5 font-semibold text-primary">Tutte le novità</a>
        <button type="button" className="rounded-full bg-primary px-3 py-1.5 font-semibold text-white" onClick={() => { scrivi(CHIAVE, daVedere[0]!.id); setDaVedere([]); }}>Ho capito</button>
      </div>
    </div>}
  </>;
}

async function aggiorna() {
  try { sessionStorage.setItem("obo-aggiornato-lps", ultima); } catch { /* niente */ }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    const nomi = await caches?.keys?.() ?? [];
    await Promise.all(nomi.map((n) => caches.delete(n)));
  } catch { /* niente */ }
  location.reload();
}
