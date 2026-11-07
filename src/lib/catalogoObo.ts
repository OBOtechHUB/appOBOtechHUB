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

// ---------- novità e prodotti non più presenti ----------
export interface ArticoloVariato { codice: string; nome: string; tipo?: string; url: string; categoria?: string }
export interface Aggiornamento {
  data: string; articoliPrima: number; articoliDopo: number; primaLettura?: boolean;
  nuovi: ArticoloVariato[]; rimossi: ArticoloVariato[];
  modificati: { codice: string; nome: string; url: string; campi: { campo: string; prima: string | null; dopo: string | null }[] }[];
}
export interface NovitaObo { ultimoControllo?: string; aggiornamenti: Aggiornamento[] }

let promessaNovita: Promise<NovitaObo | null> | null = null;
export function caricaNovitaObo(): Promise<NovitaObo | null> {
  if (!promessaNovita) {
    promessaNovita = fetch(risorsa("dati/obo-novita.json")).then((r) => (r.ok ? (r.json() as Promise<NovitaObo>) : null)).catch(() => null);
    promessaNovita.then((c) => { if (!c) promessaNovita = null; }).catch(() => { promessaNovita = null; });
  }
  return promessaNovita;
}
export function useNovitaObo() {
  const [n, setN] = useState<NovitaObo | null>(null);
  useEffect(() => { let ok = true; void caricaNovitaObo().then((x) => { if (ok) setN(x); }); return () => { ok = false; }; }, []);
  return n;
}

/** Tutti i codici articolo del catalogo (prodotti e varianti). */
export function codiciCatalogo(c: CatalogoObo): Set<string> {
  const s = new Set<string>();
  for (const p of c.catalogo) { if (p.codice) s.add(p.codice); for (const v of p.varianti) s.add(v.codice); }
  return s;
}

/**
 * Codici OBO usati nel progetto che non sono più nel catalogo. Si considerano solo i codici a 7 cifre
 * delle categorie lette (gli altri prodotti OBO non sono nel catalogo e non vanno segnalati),
 * cioè quelli presenti in una lettura precedente o nell'elenco dei dismessi.
 */
export function codiciDismessi(usati: Iterable<string>, c: CatalogoObo, n: NovitaObo | null): { codice: string; nome: string | null; data: string | null }[] {
  const attuali = codiciCatalogo(c);
  const dismessi = new Map<string, { nome: string; data: string }>();
  for (const a of n?.aggiornamenti ?? []) for (const r of a.rimossi) if (!dismessi.has(r.codice)) dismessi.set(r.codice, { nome: r.nome, data: a.data });
  const out: { codice: string; nome: string | null; data: string | null }[] = [];
  for (const u of new Set(usati)) {
    if (!/^\d{7}$/.test(u) || attuali.has(u)) continue;
    const d = dismessi.get(u);
    if (d) out.push({ codice: u, nome: d.nome, data: d.data });
  }
  return out;
}
