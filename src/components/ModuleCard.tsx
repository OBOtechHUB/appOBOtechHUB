import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

type Props = { titolo: string; descrizione: string; icona: LucideIcon; to?: "/dati-edificio" | "/computo-materiali" | "/dati-normativi" | "/edificio-3d" | "/particolari" | "/resistenza-terra" | "/verifiche" };

export function ModuleCard({ titolo, descrizione, icona: Icona, to }: Props) {
  const corpo = (
    <div className={`h-full rounded-lg border bg-card p-5 transition ${to ? "hover:border-accent hover:shadow-md" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-2">
        <Icona className={`h-7 w-7 ${to ? "text-accent" : "text-muted-foreground"}`} />
        {!to && <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">In arrivo</span>}
      </div>
      <h3 className="mt-3 font-display font-semibold text-card-foreground">{titolo}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{descrizione}</p>
    </div>
  );
  return to ? <Link to={to}>{corpo}</Link> : <div aria-disabled>{corpo}</div>;
}
