import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {TestoPubblicoPage} from "@/pages/TestoPubblicoPage";
export const Route=createFileRoute("/guida")({head:()=>paginaHead("Guida LPS","Guida ai livelli di protezione, captazione, calate, terra e SPD."),component:()=> <TestoPubblicoPage titolo="Guida" sezioni={["Cos’è un LPS","Livelli di protezione","Sfera rotolante","Calate","Terra","SPD"]}/>});