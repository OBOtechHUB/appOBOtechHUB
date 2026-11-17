import type { ReactNode } from "react";

/** "Saetta", personaggio originale dell'assistente: un fulmine sorridente nei colori dell'app. */
export function SaettaFigura({ className = "", saluto = false }: { className?: string; saluto?: boolean }) {
  return <svg viewBox="0 0 120 150" className={className} role="img" aria-label="Saetta, l'assistente">
    <defs>
      <linearGradient id="saetta-corpo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffc24d" /><stop offset="1" stopColor="#f39b00" />
      </linearGradient>
    </defs>
    {/* ombra */}
    <ellipse cx="58" cy="143" rx="30" ry="5" fill="#000" opacity="0.15" />
    {/* corpo a forma di fulmine */}
    <path d="M70 4 L22 78 L52 78 L38 138 L98 54 L66 54 L84 4 Z" fill="url(#saetta-corpo)" stroke="#c97c00" strokeWidth="3" strokeLinejoin="round" />
    {/* occhi */}
    <ellipse cx="57" cy="44" rx="5" ry="6.5" fill="#212529" />
    <ellipse cx="73" cy="44" rx="5" ry="6.5" fill="#212529" />
    <circle cx="58.6" cy="41.8" r="1.8" fill="#fff" />
    <circle cx="74.6" cy="41.8" r="1.8" fill="#fff" />
    {/* guance e sorriso */}
    <circle cx="50" cy="56" r="4" fill="#ff7a59" opacity="0.45" />
    <circle cx="80" cy="56" r="4" fill="#ff7a59" opacity="0.45" />
    <path d="M57 56 Q65 64 73 56" fill="none" stroke="#212529" strokeWidth="3" strokeLinecap="round" />
    {/* braccio con pollice o mano che saluta */}
    {saluto
      ? <g className="origin-[96px_60px] motion-safe:animate-[saluto_1.6s_ease-in-out_infinite]"><path d="M92 62 L108 40" stroke="#c97c00" strokeWidth="5" strokeLinecap="round" /><circle cx="109" cy="37" r="6" fill="#ffc24d" stroke="#c97c00" strokeWidth="2.5" /></g>
      : <g><path d="M30 86 L14 98" stroke="#c97c00" strokeWidth="5" strokeLinecap="round" /><circle cx="12" cy="100" r="6" fill="#ffc24d" stroke="#c97c00" strokeWidth="2.5" /></g>}
  </svg>;
}

/** Saetta con fumetto. */
export function Saetta({ children, saluto = false, chiaro = false }: { children: ReactNode; saluto?: boolean; chiaro?: boolean }) {
  return <div className="flex items-end gap-3">
    <SaettaFigura className="h-28 w-24 shrink-0 sm:h-32 sm:w-28" saluto={saluto} />
    <div className={`relative mb-6 max-w-md rounded-2xl border-[0.8px] px-4 py-3 text-sm leading-relaxed shadow-sm ${chiaro ? "border-white/40 bg-background text-foreground" : "border-bordo-scheda bg-background text-foreground"}`}>
      <span aria-hidden="true" className="absolute -left-2 bottom-4 size-4 rotate-45 border-b-[0.8px] border-l-[0.8px] border-inherit bg-background" />
      {children}
    </div>
  </div>;
}
