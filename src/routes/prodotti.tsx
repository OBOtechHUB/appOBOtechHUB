import { createFileRoute } from "@tanstack/react-router";
import { ProdottiPage } from "@/pages/ProdottiPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/prodotti")({
  head: () => paginaHead("Prodotti OBO", "Catalogo dei prodotti OBO per protezione contro i fulmini, sovratensioni e messa a terra."),
  component: ProdottiPage,
});
