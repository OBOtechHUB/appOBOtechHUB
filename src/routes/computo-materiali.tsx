import { createFileRoute } from "@tanstack/react-router";
import { ComputoMaterialiPage } from "@/pages/ComputoMaterialiPage";
export const Route = createFileRoute("/computo-materiali")({
  head: () => ({ meta: [
    { title: "Computo materiali – Progettazione LPS" },
    { name: "description", content: "Computo dei materiali LPS per categoria, con quantità, provenienza ed esportazione Excel e PDF." },
    { property: "og:title", content: "Computo materiali – Progettazione LPS" },
    { property: "og:description", content: "Materiali e relazione di progetto per impianti di protezione contro i fulmini." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ComputoMaterialiPage,
});