import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {SopralluogoPage} from "@/pages/SopralluogoPage";
export const Route=createFileRoute("/sopralluogo")({head:()=>paginaHead("Sopralluogo","Foto per ricordare particolari e impianti esistenti, con didascalia e note, anche senza rete."),component:SopralluogoPage});
