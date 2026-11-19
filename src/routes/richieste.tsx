import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {RichiestePage} from "@/pages/RichiestePage";
export const Route=createFileRoute("/richieste")({head:()=>paginaHead("Richieste all'ufficio tecnico","Richieste di progetti LPS, verifiche e offerte, collegate a progetti e Mappa carichi."),component:RichiestePage});
