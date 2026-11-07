import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {TestoPubblicoPage} from "@/pages/TestoPubblicoPage";
export const Route=createFileRoute("/contatti")({head:()=>paginaHead("Contatti","Contatti del portale Progettazione LPS."),component:()=> <TestoPubblicoPage titolo="Contatti" sezioni={["Recapiti — da fornire"]}/>});