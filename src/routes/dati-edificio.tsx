import { createFileRoute } from "@tanstack/react-router";
import { DatiEdificioPage } from "@/pages/DatiEdificioPage";

export const Route = createFileRoute("/dati-edificio")({
  head: () => ({
    meta: [
      { title: "Dati edificio – Progettazione LPS" },
      { name: "description", content: "Dati geometrici della struttura e calcolo dell'area di raccolta AD." },
      { property: "og:title", content: "Dati edificio – Progettazione LPS" },
      { property: "og:description", content: "Inserisci le dimensioni e calcola l'area di raccolta AD in tempo reale." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DatiEdificioPage,
});
