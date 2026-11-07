import { createFileRoute } from "@tanstack/react-router";
import { Modelli3DPage } from "@/pages/Modelli3DPage";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/modelli-3d")({
  head: () => paginaHead("Modelli 3D dei prodotti", "Apri i file STEP dei prodotti, guardali in 3D e convertili in DXF 3D per ZWCAD e AutoCAD."),
  component: Modelli3DPage,
});
