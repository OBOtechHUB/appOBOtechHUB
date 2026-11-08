import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AIUTI } from "@/dati/aiutiNorma";
import { useLingua } from "@/lib/lingua";

/** Piccolo "?" accanto a un campo di scelta: spiegazione sintetica e riferimento alla norma. */
export function AiutoNorma({ chiave }: { chiave: string }) {
  const lingua = useLingua();
  const a = AIUTI[chiave];
  if (!a) return null;
  const en = lingua === "en";
  return <Popover>
    <PopoverTrigger type="button" aria-label={en ? "How to choose" : "Come scegliere"} title={en ? "How to choose" : "Come scegliere"}
      onClick={(e) => e.stopPropagation()}
      className="ml-1 inline-flex size-5 items-center justify-center rounded-full align-middle text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <CircleHelp className="size-4" strokeWidth={1.75} />
    </PopoverTrigger>
    <PopoverContent data-no-traduci className="w-80 text-sm leading-relaxed" onClick={(e) => e.stopPropagation()}>
      <p className="font-semibold">{en ? "How to choose" : "Come scegliere"}</p>
      <p className="mt-1">{en ? a.en : a.it}</p>
      <p className="mt-2 text-xs text-muted-foreground">{en ? "Reference" : "Riferimento"}: {a.rif}</p>
      {a.daVerificare && <p className="mt-1 text-xs text-muted-foreground">{en ? "Summary in our own words, to be checked against the 2024 edition." : "Sintesi con parole nostre, da verificare con l'edizione 2024."}</p>}
    </PopoverContent>
  </Popover>;
}
