import { createFileRoute } from "@tanstack/react-router";
import { AssistentePage } from "@/pages/AssistentePage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/assistente")({
  head: () => paginaHead("Assistente di progetto", "Passi del progetto LPS dall'edificio al dossier, con lo stato aggiornato e il prossimo passo consigliato."),
  component: AssistentePage,
});
