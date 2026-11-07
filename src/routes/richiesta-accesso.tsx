import { createFileRoute } from "@tanstack/react-router";
import { RichiestaAccessoPage } from "@/pages/RichiestaAccessoPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/richiesta-accesso")({ head: () => paginaHead("Richiedi l'accesso", "Richiesta di accesso allo strumento Progettazione LPS."), component: RichiestaAccessoPage });
