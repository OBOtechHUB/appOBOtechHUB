import { createFileRoute } from "@tanstack/react-router";
import { SpdPage } from "@/pages/SpdPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/spd")({
  head: () => paginaHead("Scelta SPD", "Requisiti Iimp, Uc e Up degli SPD e scelta dei prodotti OBO dal catalogo."),
  component: SpdPage,
});
