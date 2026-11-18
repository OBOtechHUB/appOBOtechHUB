import { createFileRoute } from "@tanstack/react-router";
import { paginaHead } from "@/lib/head";
import { LicenzePage } from "@/pages/LicenzePage";
export const Route = createFileRoute("/licenze")({ head: () => paginaHead("Licenze", "Licenze delle librerie di terze parti usate da Progettazione LPS."), component: LicenzePage });
