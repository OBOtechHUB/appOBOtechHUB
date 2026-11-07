import { createFileRoute } from "@tanstack/react-router";
import { ResistenzaTerraPage } from "@/pages/ResistenzaTerraPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/resistenza-terra")({
  head: () => paginaHead("Resistenza di terra", "Stima della resistenza di terra di picchetti, anelli e maglie e resistività del terreno dalla misura Wenner."),
  component: ResistenzaTerraPage,
});
