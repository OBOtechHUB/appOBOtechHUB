import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {ParticolariPage} from "@/pages/ParticolariPage";
export const Route=createFileRoute("/particolari")({validateSearch:(s:Record<string,unknown>):{rif?:string}=>typeof s["rif"]==="string"?{rif:s["rif"].slice(0,100)}:{},head:()=>paginaHead("Particolari costruttivi","Dettagli, raccordi e componenti per le superfici del progetto LPS."),component:ParticolariPage});