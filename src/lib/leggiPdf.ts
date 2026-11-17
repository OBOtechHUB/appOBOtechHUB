/**
 * Lettura di PDF e immagini di pianta nel browser, da usare come base per ricalcare l'impronta dell'edificio.
 * Il PDF si disegna con pdf.js (caricato solo quando serve); dal testo della pagina si cerca la scala ("1:100").
 */
import { scalaDaTesto } from "@/calcoli/importazione/scala";

export interface PianoImportato {
  /** immagine della pagina o del file (data URL) */
  immagine: string;
  larghezzaPx: number;
  altezzaPx: number;
  /** solo PDF: punti PDF per pixel dell'immagine (1 punto = 1/72 di pollice sulla carta) */
  ptPerPx: number | null;
  /** solo PDF: formato della pagina in millimetri */
  formatoMm: [number, number] | null;
  /** solo PDF: scala trovata nel testo della pagina (denominatore, es. 100 per 1:100) */
  scalaTesto: number | null;
  pagine: number;
  pagina: number;
}

export async function leggiPdf(file: File, pagina = 1): Promise<PianoImportato> {
  if (typeof window === "undefined") throw new Error("Lettura PDF disponibile solo nel browser.");
  if (file.size > 80_000_000) throw new Error("PDF oltre 80 MB.");
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const n = Math.min(Math.max(1, Math.round(pagina)), doc.numPages);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 }); // 1 unità = 1 punto PDF
    const zoom = Math.min(4, Math.max(1, 3200 / Math.max(base.width, base.height)));
    const vp = page.getViewport({ scale: zoom });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Il browser non riesce a disegnare il PDF.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const contenuto = await page.getTextContent();
    const testo = contenuto.items.map((i) => ("str" in i ? i.str : "")).join(" ");
    const mmPerPt = 25.4 / 72;
    return {
      immagine: canvas.toDataURL("image/png"),
      larghezzaPx: canvas.width,
      altezzaPx: canvas.height,
      ptPerPx: canvas.width ? base.width / canvas.width : null,
      formatoMm: [Math.round(base.width * mmPerPt), Math.round(base.height * mmPerPt)],
      scalaTesto: scalaDaTesto(testo),
      pagine: doc.numPages,
      pagina: n,
    };
  } finally {
    void doc.destroy();
  }
}

export async function leggiImmagine(file: File): Promise<PianoImportato> {
  if (file.size > 40_000_000) throw new Error("Immagine oltre 40 MB.");
  const url = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ko(new Error("Immagine non leggibile.")); r.readAsDataURL(file); });
  const dim = await new Promise<[number, number]>((ok, ko) => { const img = new Image(); img.onload = () => ok([img.naturalWidth, img.naturalHeight]); img.onerror = () => ko(new Error("Immagine non leggibile.")); img.src = url; });
  return { immagine: url, larghezzaPx: dim[0], altezzaPx: dim[1], ptPerPx: null, formatoMm: null, scalaTesto: null, pagine: 1, pagina: 1 };
}
