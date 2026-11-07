import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
export function PageTitle({ titolo }: { titolo: string }) {
  return <><Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent"><ArrowLeft className="size-4" />Moduli</Link><h1 className="mt-2 font-display text-2xl font-bold">{titolo}</h1></>;
}