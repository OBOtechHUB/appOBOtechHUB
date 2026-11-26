import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/pages/AdminPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/admin")({ head: () => paginaHead("Amministrazione OBO Hub", "Accessi, utenti, sezioni e impostazioni di tutte le app di OBO Hub."), component: AdminPage });
