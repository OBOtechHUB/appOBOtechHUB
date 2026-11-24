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
export const separazioneSchema = z.object({ modoKc: z.enum(["semplificato", "dettagliato"]), kcUno: z.boolean().optional(), ki: z.number().positive().max(1).nullable(), kmSolido: z.number().positive().max(1).nullable(), punti: z.array(z.object({ id: z.string().max(100), descrizione: z.string().max(200), l: z.number().finite().nonnegative(), d: z.number().finite().nonnegative(), materiale: z.enum(["aria", "solido", "frp"]) })).max(200) });
export const pianoVerificheSchema = z.object({ critico: z.boolean(), intervalli: z.object({ visiva: z.number().positive().max(20), completa: z.number().positive().max(20), critica: z.number().positive().max(20) }).nullable() });
export const terraSchema = z.object({ tipo: z.enum(["A", "B", "fondazione"]), distanzaAnello: z.number().finite().positive(), profondita: z.number().finite().positive(), lunghezzaPicchetto: z.number().finite().positive(), latoMagliaFondazione: z.number().finite().positive(), picchettiSuAnello: z.boolean(), l1: z.number().finite().nonnegative().nullable(), distinta: distintaSchema });
export const revisioneSchema = z.object({ rev: z.string().max(10), data: z.string().max(40), autore: z.string().max(200), descrizione: z.string().max(1000), impronta: z.string().max(40), archiviata: z.boolean().default(false) });
export const emissioneSchema = z.object({ stato: z.enum(["bozza", "emesso"]), rev: z.string().max(10).nullable(), impronta: z.string().max(40).nullable() });
const t200 = z.string().max(200).default("");
const sn = z.enum(["no", "si", "da-verificare"]);
const naturale = z.enum(["no", "si-collegato", "si-da-collegare", "si-da-verificare"]);
const nNull = z.number().finite().nullable().default(null);
export const relazioneSchema = z.object({
  committente: t200, indirizzoCommittente: t200, cittaCommittente: t200, provincia: t200, titoloOpera: z.string().max(300).default(""), destinazione: z.string().max(500).default(""), luogo: z.string().max(100).default("Rivoli"), descrizione: z.string().max(20000).default(""),
  // intervento e attestato NG/NSG
  tipoIntervento: z.enum(["nuovo", "adeguamento", "integrazione"]).default("nuovo"), ngFornitore: t200, ngData: t200, nsgAttestato: nNull,
  // stato di fatto (sopralluogo)
  parapetto: naturale.default("no"), strutturaMetallica: naturale.default("no"), armature: sn.default("no"), coperturaMetallica: z.boolean().default(false),
  calateEsistenti: z.enum(["nessuna", "naturali", "in-getto", "esterne"]).default("nessuna"), calateNumero: nNull, calateInterasse: nNull,
  terraEsistente: z.enum(["nessuno", "anello", "fondazione", "picchetti", "misto"]).default("nessuno"), terraCollegataAltri: z.boolean().default(false), spdEsistenti: sn.default("no"),
  impiantiCopertura: z.string().max(2000).default(""), altezzaImpianti: nNull,
  // captazione
  fissaggioAste: z.enum(["putrella", "parapetto", "treppiede", "basamento", "parete", "misto"]).default("misto"), ventoKmh: nNull, margineSicurezza: z.number().finite().min(0).max(10).default(1),
  corpi: z.record(z.object({ altezzaDaProteggere: nNull, nota: z.string().max(1000).default("") })).default({}),
  valutazioneEconomica: z.boolean().default(false), tecnico: t200, albo: t200,
  // impresa installatrice e verifiche
  impresaNome: t200, impresaSede: t200, impresaPiva: z.string().max(40).default(""), impresaCciaa: t200, impresaResponsabile: t200,
  luogoDiLavoro: z.boolean().default(false), ambienteSevero: z.boolean().default(false), dataMessaEsercizio: z.string().max(10).default(""),
  lingua: z.enum(["it", "en"]).default("it"),
});
/** Sopralluogo da tablet: foto (nello storage "sopralluoghi"), misure e checklist del verbale di prima verifica, firma. */
const numOpz = z.number().finite().nullable().default(null);
export const sopralluogoSchema = z.object({
  foto: z.array(z.object({ id: z.string().max(60), percorso: z.string().max(300), didascalia: z.string().max(300).default(""), data: z.string().max(40).default(""), lat: z.number().finite().nullable().default(null), lon: z.number().finite().nullable().default(null), inRelazione: z.boolean().default(true),
    /** foto di una misura: calata e grandezza (continuità / terra) */ calata: z.string().max(20).default(""), misura: z.enum(["", "continuita", "terra", "terra-totale"]).default(""),
    /** promemoria: particolare da ricordare, impianto esistente, altro */ categoria: z.enum(["", "particolare", "impianto", "altro"]).default(""), nota: z.string().max(1000).default("") })).max(120).default([]),
  appunti: z.string().max(5000).default(""),
  /** messaggi vocali (storage "sopralluoghi"): generali o legati a una foto (`foto` = id della foto) */
  vocali: z.array(z.object({ id: z.string().max(60), percorso: z.string().max(300), data: z.string().max(40).default(""), durata: z.number().finite().min(0).max(3600).default(0),
    foto: z.string().max(60).default(""), testo: z.string().max(2000).default("") })).max(100).default([]),
  dataVerifica: z.string().max(10).default(""), verificatore: z.string().max(200).default(""), strumenti: z.string().max(300).default(""), condizioni: z.string().max(200).default(""),
  calate: z.array(z.object({ nome: z.string().max(20), continuita: numOpz, resistenza: numOpz, giunto: z.boolean().nullable().default(null), note: z.string().max(300).default("") })).max(200).default([]),
  resistenzaTotale: numOpz, metodo: z.string().max(100).default(""),
  esiti: z.record(z.object({ esito: z.enum(["C", "NC", "NA"]), nota: z.string().max(300).default("") })).default({}),
  spd: z.array(z.object({ quadro: z.string().max(100).default(""), tipo: z.string().max(100).default(""), indicatoreOk: z.boolean().nullable().default(null), collegatoOk: z.boolean().nullable().default(null) })).max(40).default([]),
  esitoFinale: z.enum(["", "conforme", "non-conforme"]).default(""), note: z.string().max(3000).default(""),
  /** firma del verificatore: PNG come data URL (max ~150 kB) */
  firma: z.string().max(200000).default(""), firmatoIl: z.string().max(40).default(""),
});
export type Sopralluogo = z.infer<typeof sopralluogoSchema>;
export const offertaSchema = z.object({
  scontoPercento: z.number().finite().min(0).max(100).default(0), scontiFamiglia: z.record(z.number().finite().min(0).max(100)).default({}),
  prezziManuali: z.record(z.number().finite().nonnegative()).default({}), arrotondaConfezioni: z.boolean().default(true),
  destinatario: z.string().max(300).default(""), riferimento: z.string().max(300).default(""), validitaGiorni: z.number().int().min(1).max(365).default(30), note: z.string().max(5000).default(""),
});
/** Vento e zavorre delle aste (pagina /vento): località e parametri NTC 2018 / EN 1991-1-4. Fuori dall'impronta delle revisioni. */
export const ventoSchema = z.object({
  zona: z.number().int().min(1).max(9).default(1), altitudine: z.number().finite().min(0).max(3000).default(200),
  categoria: z.enum(["I", "II", "III", "IV", "V"]).default("III"), quotaBase: z.number().finite().min(0).max(300).default(0),
  mu: z.number().finite().min(0.1).max(1).default(0.4), regione: z.string().max(100).default(""), provincia: z.string().max(100).default(""),
  interasseParete: z.number().finite().min(0.1).max(5).default(0.5), materialeParete: z.enum(["AL", "VA", "FT"]).default("AL"),
});
export type DatiVento = z.infer<typeof ventoSchema>;
export const estesoSchema = z.object({ modello: modelloSchema, aste: z.array(astaSchema).max(1000), conduttori: z.array(conduttoreSchema).max(5000), lpl: z.enum(["I","II","III","IV"]), particolari: z.array(particolareSchema).max(5000), supporti: z.array(componenteSchema).max(50000).default([]), morsetti: z.array(componenteSchema).max(20000).default([]), compensatori: z.array(componenteSchema).max(20000).default([]), distinta: distintaSchema.default([]), picchetti: z.array(picchettoSchema).max(5000).default([]), terra: terraSchema.nullable().default(null), verifiche: z.array(verificaSchema).max(500).default([]), pianoVerifiche: pianoVerificheSchema.default({ critico: false, intervalli: null }), separazione: separazioneSchema.default({ modoKc: "semplificato", ki: null, kmSolido: null, punti: [] }), datiRischio: z.record(z.string(), z.unknown()).nullable().default(null), revisioni: z.array(revisioneSchema).max(500).default([]), emissione: emissioneSchema.default({ stato: "bozza", rev: null, impronta: null }), relazione: relazioneSchema.optional(), offerta: offertaSchema.optional(), sopralluogo: sopralluogoSchema.optional(), vento: ventoSchema.optional() });
export type StatoEsteso = z.infer<typeof estesoSchema>;
export const estesoIniziale: StatoEsteso = { modello: {corpi:[]}, aste: [], conduttori: [], lpl:"III", particolari:[], supporti: [], morsetti: [], compensatori: [], distinta: [], picchetti: [], terra: null, verifiche: [], pianoVerifiche: { critico: false, intervalli: null }, separazione: { modoKc: "semplificato", ki: null, kmSolido: null, punti: [] }, datiRischio: null, revisioni: [], emissione: { stato: "bozza", rev: null, impronta: null } };
let esteso=estesoIniziale, caricato=false;
const listeners=new Set<()=>void>();
export function leggiEsteso() { return esteso; }
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