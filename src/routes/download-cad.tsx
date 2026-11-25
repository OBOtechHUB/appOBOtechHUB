import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {DownloadCADPage} from "@/pages/DownloadCADPage";
export const Route=createFileRoute("/download-cad")({head:()=>paginaHead("Istruzioni e download","Istruzioni in PDF e Word, LPS.lsp per ZWCAD e AutoCAD e pacchetto completo sempre aggiornati."),component:DownloadCADPage});
