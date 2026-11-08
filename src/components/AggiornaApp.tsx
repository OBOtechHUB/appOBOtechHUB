import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const ATTUALE = import.meta.env.VITE_VERSIONE as string | undefined;

/** Controlla se è stata pubblicata una versione nuova e mostra in alto "Aggiorna app". */
export function AggiornaApp() {
  const [nuova, setNuova] = useState(false);
  useEffect(() => {
    if (!ATTUALE) return; // in sviluppo locale non c'è versione
    let attivo = true;
    const controlla = async () => {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const { versione } = (await r.json()) as { versione?: string };
        if (attivo && versione && versione !== ATTUALE) setNuova(true);
      } catch { /* offline: riprova più tardi */ }
    };
    void controlla();
    const t = setInterval(() => void controlla(), 5 * 60 * 1000);
    const vis = () => { if (document.visibilityState === "visible") void controlla(); };
    document.addEventListener("visibilitychange", vis);
    return () => { attivo = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, []);
  if (!nuova) return null;
  return <div role="status" className="relative z-[60] flex items-center justify-center gap-3 bg-primary px-4 py-2 text-sm font-semibold text-white" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
    <span>È disponibile una nuova versione dell'app.</span>
    <button type="button" onClick={() => void aggiorna()} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-primary hover:bg-white/90">
      <RefreshCw className="size-4" />Aggiorna app
    </button>
  </div>;
}

async function aggiorna() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    const nomi = await caches?.keys?.() ?? [];
    await Promise.all(nomi.map((n) => caches.delete(n)));
  } catch { /* niente */ }
  location.reload();
}
