/** Icone schematiche delle tipologie di staffaggio (disegni originali). */
import type { Tipologia } from "@/calcoli/staffaggi/tipi";

export function IconaTipologia({ tipo, className = "" }: { tipo: Tipologia; className?: string }) {
  const s = { stroke: "currentColor", strokeWidth: 3, fill: "none", strokeLinecap: "round" as const };
  const p = { stroke: "#16a34a", strokeWidth: 3, fill: "none" };
  const base = { stroke: "currentColor", strokeWidth: 2, opacity: 0.5 };
  return (
    <svg viewBox="0 0 100 60" className={className} aria-hidden="true">
      {tipo === "soffitto-trapezio" && <g><line x1="10" y1="4" x2="90" y2="4" {...base} /><line x1="30" y1="4" x2="30" y2="50" {...s} /><line x1="70" y1="4" x2="70" y2="50" {...s} /><line x1="24" y1="28" x2="76" y2="28" {...s} /><line x1="24" y1="50" x2="76" y2="50" {...s} /><path d="M36 28 V20 H64 V28" {...p} /><path d="M36 50 V42 H64 V50" {...p} /></g>}
      {tipo === "soffitto-mensola" && <g><line x1="10" y1="4" x2="90" y2="4" {...base} /><line x1="30" y1="4" x2="30" y2="54" {...s} /><line x1="30" y1="28" x2="74" y2="28" {...s} /><line x1="30" y1="50" x2="74" y2="50" {...s} /><path d="M36 28 V20 H70 V28" {...p} /><path d="M36 50 V42 H70 V50" {...p} /></g>}
      {tipo === "parete-mensola" && <g><line x1="20" y1="2" x2="20" y2="58" {...base} /><line x1="24" y1="6" x2="24" y2="54" {...s} /><line x1="24" y1="26" x2="76" y2="26" {...s} /><line x1="24" y1="48" x2="76" y2="48" {...s} /><line x1="24" y1="36" x2="50" y2="26" {...s} strokeWidth={2} /><path d="M30 26 V18 H72 V26" {...p} /><path d="M30 48 V40 H72 V48" {...p} /></g>}
      {tipo === "pavimento" && <g><line x1="10" y1="56" x2="90" y2="56" {...base} /><line x1="30" y1="6" x2="30" y2="56" {...s} /><line x1="24" y1="56" x2="36" y2="56" {...s} strokeWidth={5} /><line x1="30" y1="38" x2="74" y2="38" {...s} /><line x1="30" y1="16" x2="74" y2="16" {...s} /><path d="M36 38 V30 H70 V38" {...p} /><path d="M36 16 V8 H70 V16" {...p} /></g>}
      {tipo === "portale" && <g><line x1="10" y1="56" x2="90" y2="56" {...base} /><line x1="28" y1="8" x2="28" y2="56" {...s} /><line x1="72" y1="8" x2="72" y2="56" {...s} /><line x1="22" y1="38" x2="78" y2="38" {...s} /><line x1="22" y1="16" x2="78" y2="16" {...s} /><path d="M34 38 V30 H66 V38" {...p} /><path d="M34 16 V8 H66 V16" {...p} /></g>}
    </svg>
  );
}
