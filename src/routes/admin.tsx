import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/pages/AdminPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/admin")({ head: () => paginaHead("Amministrazione", "Gestione degli accessi a Progettazione LPS."), component: AdminPage });
