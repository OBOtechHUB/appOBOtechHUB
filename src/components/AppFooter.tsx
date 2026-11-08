import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUp } from "lucide-react";

/** Fascia ardesia in fondo alla pagina + pulsante tondo "torna su". */
export function AppFooter() {
  const [suVisibile, setSuVisibile] = useState(false);
  useEffect(() => {
    const aggiorna = () => setSuVisibile(window.scrollY > 300);
    aggiorna();
    window.addEventListener("scroll", aggiorna, { passive: true });
    return () => window.removeEventListener("scroll", aggiorna);
  }, []);

  return (
    <>
      <footer className="mt-16 bg-ardesia text-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-base">Calcoli di supporto – da validare da tecnico abilitato</p>
          <p className="mt-1 text-sm text-white/70">Riferimento normativo: CEI EN IEC 62305:2024</p>
          <nav className="mt-6 flex flex-wrap gap-x-3 gap-y-2 text-sm text-white/85" aria-label="Collegamenti legali">
            <Link to="/contatti" className="hover:text-white">Contatti</Link><span aria-hidden="true">|</span>
            <Link to="/termini" className="hover:text-white">Termini d'uso</Link><span aria-hidden="true">|</span>
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
          </nav>
        </div>
      </footer>
      <button
        type="button"
        aria-label="Torna su"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-6 z-30 flex size-12 items-center justify-center rounded-full bg-background text-primary shadow-[0_2px_12px_rgba(0,0,0,0.18)] transition-opacity ${suVisibile ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <ArrowUp className="size-6" strokeWidth={1.5} />
      </button>
    </>
  );
}
