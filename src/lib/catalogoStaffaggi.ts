/** Catalogo OBO dei sistemi portacavi (public/dati/obo-staffaggi.json), caricato una volta sola nel browser. */
import { useEffect, useMemo, useState } from "react";
import { risorsa } from "@/lib/base";
import { catalogoDaJson, datiPasserellaDaCatalogo, type CatalogoStaffaggi } from "@/calcoli/staffaggi/componenti";
import type { DatiPasserelle } from "@/calcoli/staffaggi/calcolo";

const VUOTO: CatalogoStaffaggi = { articoli: [], aggiornato: null };
let promessa: Promise<CatalogoStaffaggi> | null = null;

export function caricaCatalogoStaffaggi(): Promise<CatalogoStaffaggi> {
  promessa ??= fetch(risorsa("dati/obo-staffaggi.json")).then((r) => (r.ok ? r.json() : null)).then(catalogoDaJson, () => VUOTO);
  return promessa;
}

export function useCatalogoStaffaggi(): CatalogoStaffaggi & { datiPasserella: DatiPasserelle; caricato: boolean } {
  const [cat, setCat] = useState<CatalogoStaffaggi | null>(null);
  useEffect(() => { let vivo = true; void caricaCatalogoStaffaggi().then((c) => vivo && setCat(c)); return () => { vivo = false; }; }, []);
  return useMemo(() => {
    const c = cat ?? VUOTO;
    const cache = new Map<string, ReturnType<DatiPasserelle>>();
    const datiPasserella: DatiPasserelle = (p) => {
      const k = `${p.serie}|${p.larghezza}|${p.altezza}`;
      if (!cache.has(k)) cache.set(k, datiPasserellaDaCatalogo(p, c));
      return cache.get(k) ?? null;
    };
    return { ...c, datiPasserella, caricato: cat != null };
  }, [cat]);
}
