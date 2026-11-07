import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/pages/HomePage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Progettazione LPS – Protezione contro i fulmini" },
      { name: "description", content: "Progettazione di impianti di protezione contro i fulmini secondo CEI EN IEC 62305:2024." },
      { property: "og:title", content: "Progettazione LPS" },
      { property: "og:description", content: "Progettazione impianti LPS secondo CEI EN IEC 62305:2024." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});
