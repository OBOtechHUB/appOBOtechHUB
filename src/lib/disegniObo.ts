/** Disegni 2D ufficiali OBO copiati nell'app (public/obo-disegni, script scripts/disegni-obo.mjs). */
import { useEffect, useState } from "react";
import { risorsa } from "@/lib/base";
import type { IndiceDisegniObo } from "@/calcoli/particolari/tipologico";

let promessa: Promise<IndiceDisegniObo | null> | null = null;
export function caricaDisegniObo(): Promise<IndiceDisegniObo | null> {
  promessa ??= fetch(risorsa("obo-disegni/indice.json"))
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { codici?: Record<string, string>; disegni?: Record<string, { w: number; h: number }> } | null) => (j?.codici && j.disegni ? { base: risorsa("obo-disegni/"), codici: j.codici, disegni: j.disegni } : null))
    .catch(() => null);
  return promessa;
}
export function useDisegniObo(): IndiceDisegniObo | null {
  const [ind, setInd] = useState<IndiceDisegniObo | null>(null);
  useEffect(() => { let ok = true; void caricaDisegniObo().then((x) => { if (ok) setInd(x); }); return () => { ok = false; }; }, []);
  return ind;
}

/** Sostituisce le immagini dei disegni OBO (stessa origine) con dati incorporati, per convertire l'SVG in PNG. */
export async function incorporaImmagini(svg: string): Promise<string> {
  const href = [...new Set([...svg.matchAll(/<image href="([^"]+)"/g)].map((m) => m[1]!))].filter((h) => !h.startsWith("data:"));
  let out = svg;
  for (const h of href) {
    try {
      const r = await fetch(h.replace(/&amp;/g, "&")); if (!r.ok) continue;
      const b = new Uint8Array(await r.arrayBuffer()); let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
      out = out.split(`href="${h}"`).join(`href="data:${r.headers.get("content-type") || "image/jpeg"};base64,${btoa(bin)}"`);
    } catch { /* immagine non disponibile: resta il collegamento */ }
  }
  return out;
}
