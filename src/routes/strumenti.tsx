import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {StrumentiPage} from "@/pages/StrumentiPage";
export const Route=createFileRoute("/strumenti")({head:()=>paginaHead("Strumenti LPS","Moduli per dati edificio, progettazione tridimensionale e computo materiali."),component:StrumentiPage});