import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/pages/AuthPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/auth")({ head: () => paginaHead("Accesso", "Accedi o registrati per salvare i tuoi progetti LPS."), component: AuthPage });