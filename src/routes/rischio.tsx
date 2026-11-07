import { createFileRoute } from "@tanstack/react-router";
import { RischioPage } from "@/pages/RischioPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/rischio")({
  head: () => paginaHead("Analisi del rischio", "Rischio R1 con le sue componenti, confronto con RT e livello di protezione minimo."),
  component: RischioPage,
});
