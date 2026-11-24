import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {VentoPage} from "@/pages/VentoPage";
export const Route=createFileRoute("/vento")({head:()=>paginaHead("Vento e zavorre delle aste","Carico del vento NTC 2018 / EN 1991-1-4 e blocchi FangFix da 16 kg per le aste irod e isFang, su sostegno o a parete."),component:VentoPage});
