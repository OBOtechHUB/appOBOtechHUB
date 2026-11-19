import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {SopralluogoPage} from "@/pages/SopralluogoPage";
export const Route=createFileRoute("/sopralluogo")({head:()=>paginaHead("Sopralluogo","Foto, stato di fatto, misure per calata, checklist e firma da tablet o telefono, anche senza rete."),component:SopralluogoPage});
