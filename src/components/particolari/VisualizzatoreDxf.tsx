import { useEffect, useRef, useState } from "react";

/** Interfaccia minima di dxf-viewer usata qui (la libreria si carica solo quando serve). */
interface DxfViewerIstanza {
  Load(opzioni: { url: string; fonts: string[] | null; progressCbk?: ((fase: string) => void) | null }): Promise<void>;
  Destroy(): void;
}
type DxfViewerCostruttore = new (contenitore: HTMLElement, opzioni: Record<string, unknown>) => DxfViewerIstanza;

/**
 * Disegno 2D vettoriale da file DXF (zoom con la rotella, trascinamento per spostare).
 * I testi vengono mostrati solo se è disponibile un font: per ora le quote/scritte possono mancare.
 */
export function VisualizzatoreDxf({ url, titolo }: { url: string; titolo: string }) {
  const contenitore = useRef<HTMLDivElement>(null);
  const [stato, setStato] = useState<"carico" | "pronto" | "errore">("carico");

  useEffect(() => {
    const el = contenitore.current;
    if (!el) return;
    let viewer: DxfViewerIstanza | null = null;
    let attivo = true;
    setStato("carico");
    void (async () => {
      try {
        const [{ DxfViewer }, THREE] = await Promise.all([
          import("dxf-viewer") as unknown as Promise<{ DxfViewer: DxfViewerCostruttore }>,
          import("three"),
        ]);
        if (!attivo) return;
        viewer = new DxfViewer(el, {
          clearColor: new THREE.Color("#ffffff"),
          autoResize: true,
          colorCorrection: true,
          sceneOptions: { wireframeMesh: true },
        });
        await viewer.Load({ url, fonts: null });
        if (attivo) setStato("pronto");
      } catch (e) {
        console.error("[DXF]", e);
        if (attivo) setStato("errore");
      }
    })();
    return () => {
      attivo = false;
      viewer?.Destroy();
    };
  }, [url]);

  return <div className="space-y-2">
    <div ref={contenitore} role="img" aria-label={`Disegno DXF ${titolo}`} className="relative h-[60vh] w-full overflow-hidden border bg-white" />
    {stato === "carico" && <p role="status" className="text-sm text-muted-foreground">Caricamento disegno…</p>}
    {stato === "errore" && <p role="alert" className="text-sm text-destructive">Impossibile leggere il file DXF.</p>}
    {stato === "pronto" && <p className="text-xs text-muted-foreground">Rotella: zoom · trascina: sposta. I testi del disegno potrebbero non comparire.</p>}
  </div>;
}
