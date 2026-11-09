import { createFileRoute } from "@tanstack/react-router";
import { NormaPage } from "@/pages/NormaPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/norma")({
  head: () => paginaHead("Norma CEI EN IEC 62305", "Parametri del fulmine, materiali e sezioni minime, schermi dei cavi, tensioni di contatto, rischio di esplosione, schermatura magnetica, SPD, tensioni indotte e fotovoltaico."),
  component: NormaPage,
});
