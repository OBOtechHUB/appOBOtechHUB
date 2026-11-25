import { createFileRoute } from "@tanstack/react-router";
import { AntennePage } from "@/pages/AntennePage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/antenne")({
  head: () => paginaHead("Antenne radiomobili", "Protezione contro i fulmini di antenne 5G e stazioni radio base: asta di captazione, distanza di separazione, isCon, SPD e terra."),
  component: AntennePage,
});
