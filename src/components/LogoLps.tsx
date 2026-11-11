import type { ReactNode } from "react";

/** Logo di Progettazione LPS: un fulmine nei colori dell'app. */
export function LogoLps({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 120 150" className={className} role="img" aria-label="Progettazione LPS">
    <defs>
      <linearGradient id="logo-lps" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffc24d" /><stop offset="1" stopColor="#f39b00" />
      </linearGradient>
    </defs>
    <path d="M70 4 L22 78 L52 78 L38 138 L98 54 L66 54 L84 4 Z" fill="url(#logo-lps)" stroke="#c97c00" strokeWidth="3" strokeLinejoin="round" />
  </svg>;
}

/** Riquadro di messaggio (al posto del vecchio fumetto). */
export function Messaggio({ children, chiaro = false }: { children: ReactNode; chiaro?: boolean }) {
  return <div className={`max-w-md rounded-2xl border-[0.8px] px-4 py-3 text-sm leading-relaxed shadow-sm ${chiaro ? "border-white/40 bg-background text-foreground" : "border-bordo-scheda bg-background text-foreground"}`}>{children}</div>;
}
