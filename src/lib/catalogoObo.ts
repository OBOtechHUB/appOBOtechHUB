import { useEffect, useState } from "react";
import { risorsa } from "@/lib/base";

export interface VarianteObo { codice: string; tipo: string; valori: string[]; colonne?: string[]; scheda: string | null }
export interface ProdottoObo {
  codice: string | null; nome: string; url: string; categorie: string[];
  datiTecnici: Record<string, string>;
  foto: string | null; disegno2d: string | null; scheda: string | null; documenti: string[];
  file3d: { stp: string | null; rfa: string | null; cad: string[] };
  varianti: VarianteObo[];
}
export interface CatalogoObo { fonte: string; categorie: string[]; aggiornato: string; prodotti: number; articoli: number; catalogo: ProdottoObo[] }

export const NOMI_CATEGORIE: Record<string, string> = {
  "external-lightning-protection": "Protezione esterna contro i fulmini",
  "surge-protection": "Protezione contro le sovratensioni",
  "equipotential-bonding-and-earthing": "Equipotenzialità e messa a terra",
};
export const nomeSottocategoria = (slug: string) => slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

let promessa: Promise<CatalogoObo | null> | null = null;
/** Il catalogo è un file statico generato da scripts/catalogo-obo.mjs (GitHub Actions). */
export function caricaCatalogoObo(): Promise<CatalogoObo | null> {
  if (!promessa) {
    promessa = fetch(risorsa("dati/obo-prodotti.json")).then((r) => (r.ok ? (r.json() as Promise<CatalogoObo>) : null)).catch(() => null);
    promessa.then((c) => { if (!c) promessa = null; }).catch(() => { promessa = null; });
  }
  return promessa;
}

export function useCatalogoObo() {
  const [stato, setStato] = useState<{ catalogo: CatalogoObo | null; pronto: boolean }>({ catalogo: null, pronto: false });
  useEffect(() => { let ok = true; void caricaCatalogoObo().then((c) => { if (ok) setStato({ catalogo: c, pronto: true }); }); return () => { ok = false; }; }, []);
  return stato;
}

/** Cerca un articolo per codice, anche tra le varianti. */
export function trovaArticolo(c: CatalogoObo, codice: string): { prodotto: ProdottoObo; variante: VarianteObo | null } | null {
  for (const p of c.catalogo) {
    if (p.codice === codice) return { prodotto: p, variante: p.varianti.find((v) => v.codice === codice) ?? null };
    const v = p.varianti.find((x) => x.codice === codice);
    if (v) return { prodotto: p, variante: v };
  }
  return null;
}

/** Ricerca testuale su nome, codici, tipi delle varianti e dati tecnici principali. */
export function cercaProdotti(c: CatalogoObo, testo: string, categoria: string | null): ProdottoObo[] {
  const parole = testo.toLowerCase().split(/\s+/).filter(Boolean);
  return c.catalogo.filter((p) => {
    if (categoria && p.categorie[0] !== categoria) return false;
    if (!parole.length) return true;
    const t = [p.nome, p.codice ?? "", ...p.categorie, ...p.varianti.flatMap((v) => [v.codice, v.tipo]), ...Object.values(p.datiTecnici)].join(" ").toLowerCase();
    return parole.every((w) => t.includes(w));
  });
}
