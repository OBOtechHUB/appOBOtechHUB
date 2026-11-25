/**
 * Versioni correnti di ciò che si scarica dalla pagina «Istruzioni e download»: il programma LPS.lsp per
 * AutoCAD/ZWCAD e i documenti di istruzioni. Unica fonte: quando cambiano LPS.lsp o le istruzioni, si aggiornano qui
 * (un test controlla che LSP_VERSIONE sia uguale a *LPS-VERSIONE* dentro public/cad/LPS.lsp).
 * Il file .lpsdati porta il record (LSP "x.y"): LPS.lsp 3.6 e successivi avvisano se la versione caricata è più vecchia.
 */
export const LSP_VERSIONE = "3.6";
export const ISTRUZIONI = { revisione: "D", data: "25/11/2026" } as const;
/** Etichetta unica della versione del pacchetto (cambia quando cambia LPS.lsp o le istruzioni). */
export const VERSIONE_PACCHETTO = `${LSP_VERSIONE}-${ISTRUZIONI.revisione}`;

/** Confronta due versioni "3.6" / "3.10": -1, 0, 1. */
export function confrontaVersioni(a: string, b: string): number {
  const pa = a.split(".").map((x) => Number.parseInt(x, 10) || 0), pb = b.split(".").map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const x = pa[i] ?? 0, y = pb[i] ?? 0; if (x !== y) return x < y ? -1 : 1; }
  return 0;
}

/** File del pacchetto di istruzioni (in public/istruzioni/), con il percorso dentro lo ZIP. */
export const FILE_ISTRUZIONI: { file: string; zip: string; titolo: string }[] = [
  { file: "istruzioni/Progettazione LPS - Istruzioni d'uso.pdf", zip: "1 - Istruzioni d'uso LPS/Progettazione LPS - Istruzioni d'uso.pdf", titolo: "Istruzioni d'uso (PDF)" },
  { file: "istruzioni/Progettazione LPS - Istruzioni d'uso.docx", zip: "1 - Istruzioni d'uso LPS/Progettazione LPS - Istruzioni d'uso.docx", titolo: "Istruzioni d'uso (Word)" },
  { file: "istruzioni/Progettazione LPS - Istruzioni AutoCAD e ZWCAD.pdf", zip: "2 - Istruzioni AutoCAD e ZWCAD/Progettazione LPS - Istruzioni AutoCAD e ZWCAD.pdf", titolo: "Istruzioni AutoCAD e ZWCAD (PDF)" },
  { file: "istruzioni/Progettazione LPS - Istruzioni AutoCAD e ZWCAD.docx", zip: "2 - Istruzioni AutoCAD e ZWCAD/Progettazione LPS - Istruzioni AutoCAD e ZWCAD.docx", titolo: "Istruzioni AutoCAD e ZWCAD (Word)" },
  { file: "istruzioni/prova/CRM-123_LPS.dxf", zip: "3 - File per AutoCAD e ZWCAD/Progetto di prova CRM-123_LPS/CRM-123_LPS.dxf", titolo: "" },
  { file: "istruzioni/prova/CRM-123_LPS.lpsdati", zip: "3 - File per AutoCAD e ZWCAD/Progetto di prova CRM-123_LPS/CRM-123_LPS.lpsdati", titolo: "" },
  { file: "istruzioni/prova/CRM-123_LPS_tavole.pdf", zip: "3 - File per AutoCAD e ZWCAD/Progetto di prova CRM-123_LPS/CRM-123_LPS_tavole.pdf", titolo: "" },
];

export function leggimiPacchetto(): string {
  return [
    "PROGETTAZIONE LPS - ISTRUZIONI E FILE PER AUTOCAD / ZWCAD",
    "",
    `Versione del pacchetto: LPS.lsp ${LSP_VERSIONE} - Istruzioni Rev. ${ISTRUZIONI.revisione} del ${ISTRUZIONI.data}`,
    "",
    "1 - Istruzioni d'uso LPS          guida all'app (PDF e Word)",
    "2 - Istruzioni AutoCAD e ZWCAD    guida al pacchetto CAD e ai comandi di LPS.lsp (PDF e Word)",
    "3 - File per AutoCAD e ZWCAD      LPS.lsp aggiornato e un progetto di prova da provare subito",
    "",
    "AGGIORNAMENTO",
    "  Sostituisci il vecchio LPS.lsp con questo, anche nel \"Gruppo di avvio\" (Startup Suite) di APPLOAD.",
    "  In CAD il comando LPS-VERSIONE mostra la versione caricata.",
    "  Aprendo un progetto scaricato dall'app, LPS.lsp avvisa da solo se esiste una versione piu' recente.",
    "  Ultima versione sempre su: https://obotechhub.github.io/appOBOtechHUB/download-cad",
    "",
  ].join("\r\n");
}
