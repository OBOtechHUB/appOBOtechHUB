import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {TestoPubblicoPage} from "@/pages/TestoPubblicoPage";
export const Route=createFileRoute("/termini")({head:()=>paginaHead("Termini di utilizzo","Termini del portale LPS: documento da completare e validare."),component:()=> <TestoPubblicoPage titolo="Termini di utilizzo" sezioni={["Condizioni del servizio — documento non definitivo"]}/>});