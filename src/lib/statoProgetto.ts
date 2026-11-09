import { useSyncExternalStore } from "react";
import { verificaSchema } from "@/calcoli/verifiche/verifiche";
import { z } from "zod";
import { modelloSchema, astaSchema, conduttoreSchema } from "@/calcoli/edificio/tipi";
import { computoIniziale, computoSchema, datiIniziali, edificioSchema, leggiStatoBase, sostituisciStatoBase, impostaSalvataggioLocale, type DatiComputo } from "./progettoStore";
import {particolareSchema} from "@/calcoli/particolari/selezione";
export const componenteSchema = z.object({ tipo: z.string().max(100).optional(), x: z.number().finite(), y: z.number().finite(), z: z.number().finite(), rotazione: z.number().finite().optional(), codiceOBO: z.string().max(100).optional() });
export type Componente = z.infer<typeof componenteSchema>;
const distintaSchema = z.array(z.object({ codice: z.string().max(100), descrizione: z.string().max(500), quantita: z.number().finite().min(0), unita: z.enum(["m","pz"]), riferimento: z.string().max(100).optional() })).max(2000);
export const picchettoSchema = z.object({ id: z.string(), x: z.number().finite(), y: z.number().finite(), z: z.number().finite(), lunghezza: z.number().finite().positive(), diametro: z.number().finite().positive().optional(), codiceOBO: z.string().default("") });
export const separazioneSchema = z.object({ modoKc: z.enum(["semplificato", "dettagliato"]), ki: z.number().positive().max(1).nullable(), kmSolido: z.number().positive().max(1).nullable(), punti: z.array(z.object({ id: z.string().max(100), descrizione: z.string().max(200), l: z.number().finite().nonnegative(), d: z.number().finite().nonnegative(), materiale: z.enum(["aria", "solido", "frp"]) })).max(200) });
export const pianoVerificheSchema = z.object({ critico: z.boolean(), intervalli: z.object({ visiva: z.number().positive().max(20), completa: z.number().positive().max(20), critica: z.number().positive().max(20) }).nullable() });
export const terraSchema = z.object({ tipo: z.enum(["A", "B", "fondazione"]), distanzaAnello: z.number().finite().positive(), profondita: z.number().finite().positive(), lunghezzaPicchetto: z.number().finite().positive(), latoMagliaFondazione: z.number().finite().positive(), picchettiSuAnello: z.boolean(), l1: z.number().finite().nonnegative().nullable(), distinta: distintaSchema });
export const estesoSchema = z.object({ modello: modelloSchema, aste: z.array(astaSchema).max(1000), conduttori: z.array(conduttoreSchema).max(5000), lpl: z.enum(["I","II","III","IV"]), particolari: z.array(particolareSchema).max(5000), supporti: z.array(componenteSchema).max(50000).default([]), morsetti: z.array(componenteSchema).max(20000).default([]), compensatori: z.array(componenteSchema).max(20000).default([]), distinta: distintaSchema.default([]), picchetti: z.array(picchettoSchema).max(5000).default([]), terra: terraSchema.nullable().default(null), verifiche: z.array(verificaSchema).max(500).default([]), pianoVerifiche: pianoVerificheSchema.default({ critico: false, intervalli: null }), separazione: separazioneSchema.default({ modoKc: "semplificato", ki: null, kmSolido: null, punti: [] }), datiRischio: z.record(z.string(), z.unknown()).nullable().default(null) });
export type StatoEsteso = z.infer<typeof estesoSchema>;
export const estesoIniziale: StatoEsteso = { modello: {corpi:[]}, aste: [], conduttori: [], lpl:"III", particolari:[], supporti: [], morsetti: [], compensatori: [], distinta: [], picchetti: [], terra: null, verifiche: [], pianoVerifiche: { critico: false, intervalli: null }, separazione: { modoKc: "semplificato", ki: null, kmSolido: null, punti: [] }, datiRischio: null };
let esteso=estesoIniziale, caricato=false;
const listeners=new Set<()=>void>();
export function aggiornaEsteso(p: Partial<StatoEsteso>) { esteso=estesoSchema.parse({...esteso,...p}); try {if(!attivo)localStorage.setItem("lps-stato-esteso",JSON.stringify(esteso));}catch{} listeners.forEach((f)=>f()); }
export function useEsteso() { return useSyncExternalStore((f)=>{listeners.add(f); if(!caricato&&typeof window!=="undefined"){caricato=true;try{const raw=localStorage.getItem("lps-stato-esteso");if(raw){const parsed=estesoSchema.safeParse(JSON.parse(raw));if(parsed.success)esteso=parsed.data;}}catch{}f();}return()=>listeners.delete(f);},()=>esteso,()=>estesoIniziale); }
export const snapshotSchema=z.object({versione:z.literal(1), edificio:edificioSchema,computo:computoSchema,esteso:estesoSchema});
export function snapshot(){return {versione:1 as const,...leggiStatoBase(),esteso};}
export function snapshotVuoto(){return {versione:1 as const,edificio:datiIniziali,computo:computoIniziale,esteso:estesoIniziale};}
export function caricaSnapshot(input: unknown){const d=snapshotSchema.parse(input);sostituisciStatoBase(d.edificio,d.computo as DatiComputo);esteso=d.esteso;caricato=true;listeners.forEach((f)=>f());}
export type Attivo={id:string;codice:string;nome:string;proprietario:string;salvato:string};
let attivo:Attivo|null=null;
const attivi=new Set<()=>void>();
export function impostaAttivo(v:Attivo|null){attivo=v;impostaSalvataggioLocale(!v);try{if(v)sessionStorage.setItem("lps-progetto-attivo",JSON.stringify({id:v.id,proprietario:v.proprietario}));else sessionStorage.removeItem("lps-progetto-attivo");}catch{}attivi.forEach((f)=>f());}
export function leggiAttivo(){return attivo;}
export function useAttivo(){return useSyncExternalStore((f)=>{attivi.add(f);return()=>attivi.delete(f);},()=>attivo,()=>null);}
export function ripristinaLocale(){
  try {const edificio=JSON.parse(localStorage.getItem("lps-dati-edificio")??"null")??datiIniziali;const computo=JSON.parse(localStorage.getItem("lps-computo-materiali")??"null")??computoIniziale;const extra=JSON.parse(localStorage.getItem("lps-stato-esteso")??"null")??estesoIniziale;caricaSnapshot({versione:1,edificio:{...datiIniziali,...edificio},computo,esteso:extra});}catch{caricaSnapshot(snapshotVuoto());}
}