import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SchedaParticolare } from "./SchedaParticolare";
import base from "@/dati/particolari/particolari.json";
import { useEsteso } from "@/lib/statoProgetto";
import { etichettaParticolare } from "@/calcoli/particolari/posizioni";

type Personale = { id: string; immagine?: string | null | undefined };

/** Particolare del catalogo base, sovrascritto da quello personale con lo stesso id. */
export function risolviParticolare<P extends Personale>(riferimento: string, personali: P[]) {
  const originale = base.find((p) => p.id === riferimento || p.riferimento === riferimento);
  const personale = personali.find((p) => p.id === riferimento);
  return personale ? { ...originale, ...personale, immagine: personale.immagine ?? originale?.immagine } : originale;
}

/** Opens references in place, preserving the current proposal and table state. */
export function RiferimentoParticolare({ riferimento }: { riferimento: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const s = useEsteso();
  if (!riferimento) return <>—</>;
  if (!riferimento.startsWith("OBO-TBS-")) return <Link to="/particolari" search={{ rif: riferimento }} className="text-accent underline">{riferimento}</Link>;
  const particolare = risolviParticolare(riferimento, s.particolari);
  if (!particolare) return <span className="text-muted-foreground" title="Particolare non presente nel catalogo">{riferimento}</span>;
  return <>
    <Button variant="link" className="h-auto whitespace-normal p-0 text-left text-accent" title={`Scheda ${etichettaParticolare(particolare.id)}`} onClick={() => setOpen(true)}>{riferimento}</Button>
    <SchedaParticolare particolare={particolare} open={open} onOpenChange={setOpen} />
  </>;
}