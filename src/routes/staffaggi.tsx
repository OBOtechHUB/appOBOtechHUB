import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {StaffaggiPage} from "@/pages/StaffaggiPage";
export const Route=createFileRoute("/staffaggi")({head:()=>paginaHead("Staffaggi OBO","Configura staffaggi con binari MS, mensole e passerelle OBO: verifica dei carichi, sezione quotata, distinta, relazione e tavole."),component:StaffaggiPage});
