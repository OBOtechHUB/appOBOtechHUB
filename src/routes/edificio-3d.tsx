import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {Edificio3DPage} from "@/pages/Edificio3DPage";
export const Route=createFileRoute("/edificio-3d")({head:()=>paginaHead("Edificio 3D · Captazione e terra","Modello edificio, captazione LPS con sfera rotolante e proposta di impianto di terra con distinta e CAD."),component:Edificio3DPage});