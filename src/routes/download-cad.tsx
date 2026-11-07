import {createFileRoute} from "@tanstack/react-router";
import {paginaHead} from "@/lib/head";
import {DownloadCADPage} from "@/pages/DownloadCADPage";
export const Route=createFileRoute("/download-cad")({head:()=>paginaHead("Download CAD","LPS.lsp per ZWCAD e AutoCAD: importa il progetto LPS, disegna la sfera rotolante ed esporta l'edificio."),component:DownloadCADPage});
