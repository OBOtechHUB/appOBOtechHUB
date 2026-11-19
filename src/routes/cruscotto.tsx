import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {CruscottoPage} from "@/pages/CruscottoPage";
export const Route=createFileRoute("/cruscotto")({head:()=>paginaHead("Cruscotto di direzione","Progetti, revisioni emesse, richieste e materiale OBO prescritto."),component:CruscottoPage});
