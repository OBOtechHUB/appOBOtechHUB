import { createFileRoute } from "@tanstack/react-router";
import { VerifichePage } from "@/pages/VerifichePage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/verifiche")({
  head: () => paginaHead("Verifiche e dossier", "Piano delle verifiche periodiche dell'LPS, checklist, misure e dossier tecnico in PDF."),
  component: VerifichePage,
});
