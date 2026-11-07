import { createFileRoute } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { elencaProgetti } from "@/lib/progetti.functions";
import { ProgettiPage } from "@/pages/ProgettiPage";
import { paginaHead } from "@/lib/head";
export const progettiQuery=queryOptions({queryKey:["progetti",0],queryFn:()=>elencaProgetti({data:{pagina:0}})});
export const Route=createFileRoute("/_authenticated/progetti")({loader:({context})=>context.queryClient.ensureQueryData(progettiQuery),head:()=>paginaHead("I miei progetti","Gestisci i tuoi progetti privati di protezione contro i fulmini."),component:ProgettiPage});