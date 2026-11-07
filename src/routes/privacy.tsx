import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {TestoPubblicoPage} from "@/pages/TestoPubblicoPage";
export const Route=createFileRoute("/privacy")({head:()=>paginaHead("Privacy","Informativa del portale LPS: documento da completare e validare."),component:()=> <TestoPubblicoPage titolo="Privacy" sezioni={["Informativa sul trattamento dei dati — documento non definitivo"]}/>});