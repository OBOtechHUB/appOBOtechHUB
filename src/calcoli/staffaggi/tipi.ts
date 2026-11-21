/**
 * Modello dati dell'app Staffaggi OBO: un progetto con più tratte; ogni tratta ha una tipologia di staffaggio,
 * un interasse tra i supporti e uno o più piani di passerelle con il loro carico di cavi.
 */
import { z } from "zod";

export const TIPOLOGIE = {
  "soffitto-trapezio": { nome: "A soffitto con traverso (trapezio)", descrizione: "Due pendini dal soffitto e un traverso per ogni piano" },
  "soffitto-mensola": { nome: "A soffitto con montante e mensole", descrizione: "Un montante dal soffitto con le mensole a sbalzo" },
  "parete-mensola": { nome: "A parete con mensole", descrizione: "Profilato verticale a parete con mensole a sbalzo" },
  pavimento: { nome: "A pavimento con montante e mensole", descrizione: "Montante su piastra a pavimento con mensole a sbalzo" },
  portale: { nome: "A portale", descrizione: "Due montanti a pavimento e un traverso per ogni piano" },
} as const;
export type Tipologia = keyof typeof TIPOLOGIE;

export const SERIE_PASSERELLE = {
  MKS: { nome: "Passerella forata MKS", tipo: "lamiera" },
  SKS: { nome: "Canalina SKS", tipo: "lamiera" },
  RKS: { nome: "Passerella RKS", tipo: "lamiera" },
  "GR-Magic": { nome: "Passerella a filo GR-Magic", tipo: "filo" },
  SL: { nome: "Passerella a scala SL", tipo: "scala" },
} as const;
export type SeriePasserella = keyof typeof SERIE_PASSERELLE;
export const FINITURE = { FS: "Zincato sendzimir (FS)", FT: "Zincato a caldo (FT)", A2: "Acciaio inox A2", A4: "Acciaio inox A4" } as const;
export type Finitura = keyof typeof FINITURE;

export const pianoSchema = z.object({
  serie: z.enum(["MKS", "SKS", "RKS", "GR-Magic", "SL"]).default("MKS"),
  larghezza: z.number().min(50).max(1000).default(300), // mm
  altezza: z.number().min(15).max(200).default(60), // mm, bordo
  caricoCavi: z.number().min(0).max(500).default(20), // kg/m
  coperchio: z.boolean().default(false),
});
export type Piano = z.infer<typeof pianoSchema>;

export const trattaSchema = z.object({
  id: z.string(),
  nome: z.string().max(120).default("Tratta 1"),
  tipologia: z.enum(["soffitto-trapezio", "soffitto-mensola", "parete-mensola", "pavimento", "portale"]).default("soffitto-trapezio"),
  lunghezza: z.number().min(0.5).max(5000).default(30), // m
  interasse: z.number().min(0.3).max(6).default(1.5), // m tra i supporti
  altezzaStaffa: z.number().min(0.1).max(10).default(0.6), // m: dal soffitto al primo piano, o altezza del montante
  distanzaPiani: z.number().min(100).max(1500).default(300), // mm tra i piani
  profilato: z.enum(["MS4121", "MSL4141", "MS4141"]).default("MS4141"),
  finitura: z.enum(["FS", "FT", "A2", "A4"]).default("FS"),
  caricoExtra: z.number().min(0).max(500).default(0), // kg per supporto (es. impianti appesi)
  piani: z.array(pianoSchema).min(1).max(6).default([{ serie: "MKS", larghezza: 300, altezza: 60, caricoCavi: 20, coperchio: false }]),
  note: z.string().max(1000).default(""),
});
export type Tratta = z.infer<typeof trattaSchema>;

export const progettoStaffaggiSchema = z.object({
  versione: z.literal(1).default(1),
  nome: z.string().max(200).default(""),
  codice: z.string().max(60).default(""),
  cliente: z.string().max(200).default(""),
  comune: z.string().max(120).default(""),
  progettista: z.string().max(120).default(""),
  tratte: z.array(trattaSchema).max(200).default([]),
});
export type ProgettoStaffaggi = z.infer<typeof progettoStaffaggiSchema>;

export const nuovaTratta = (n = 1): Tratta => trattaSchema.parse({ id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, nome: `Tratta ${n}` });
