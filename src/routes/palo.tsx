import { createFileRoute } from "@tanstack/react-router";
import { PaloPage } from "@/pages/PaloPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/palo")({
  head: () => paginaHead("Impianti su palo", "Antenne, telecamere, illuminazione e impianti su palo: numero, modello e lunghezza delle calate isolate OBO isCon con le verifiche della CEI EN IEC 62305-3."),
  component: PaloPage,
});
