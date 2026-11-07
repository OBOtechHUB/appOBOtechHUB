import { createFileRoute } from "@tanstack/react-router";
import { CalatePage } from "@/pages/CalatePage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/calate")({
  head: () => paginaHead("Calate e distanza di separazione", "Numero e passo delle calate, kc e distanza di separazione s con verifica dei punti critici."),
  component: CalatePage,
});
