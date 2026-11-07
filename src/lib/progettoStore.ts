import { useSyncExternalStore } from "react";
import { z } from "zod";
import catalogoBase from "@/dati/materiali/catalogo.json";
import { articoloSchema } from "@/lib/catalogo";
import { categorie, type Articolo, type ConfigurazioneComputo, type ModificaRiga, type RigaComputo, type RisultatiModuli } from "@/calcoli/materiali/tipi";

export type DatiEdificio = {
  nomeProgetto: string;
  comune: string;
  L: number;
  W: number;
  H: number;
  copertura: string;
  materiale: string;
  impiantiTetto: boolean;
  posizioneId: string;
  densita: number;
  lplProgetto: "I" | "II" | "III" | "IV" | null;
};

const KEY = "lps-dati-edificio";
export const datiIniziali: DatiEdificio = {
  nomeProgetto: "", comune: "", L: 0, W: 0, H: 0,
  copertura: "Piana", materiale: "Cemento armato", impiantiTetto: false,
  posizioneId: "isolata", densita: 0, lplProgetto: null,
};

let stato = datiIniziali;
let salvataggioLocale=true;
export function impostaSalvataggioLocale(v:boolean){salvataggioLocale=v;}
let caricato = false;
const ascoltatori = new Set<() => void>();

function carica() {
  if (caricato || typeof window === "undefined") return;
  caricato = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {const parsed=edificioSchema.safeParse({...datiIniziali,...JSON.parse(raw)});if(parsed.success)stato=parsed.data;}
  } catch { /* ignora */ }
}

export function aggiornaDati(parz: Partial<DatiEdificio>) {
  stato = { ...stato, ...parz };
  try { if(salvataggioLocale)localStorage.setItem(KEY, JSON.stringify(stato)); } catch { /* ignora */ }
  ascoltatori.forEach((f) => f());
}

export function useDatiEdificio() {
  return useSyncExternalStore(
    (f) => {
      ascoltatori.add(f);
      if (!caricato) { carica(); f(); }
      return () => ascoltatori.delete(f);
    },
    () => stato,
    () => datiIniziali,
  );
}

export type DatiComputo = {
  catalogo: Articolo[]; configurazione: ConfigurazioneComputo; risultati: RisultatiModuli;
  modifiche: Record<string, ModificaRiga>; manuali: RigaComputo[];
};
export const computoIniziale: DatiComputo = {
  catalogo: catalogoBase as Articolo[],
  configurazione: { sfridoPercento: 10, passoSupporti: { Piana: null, "A falde": null, "A volta": null, Shed: null, Altro: null } },
  risultati: {}, modifiche: {}, manuali: [],
};
const numero = z.number().finite().nonnegative();
const risultatiSchema = z.object({
  rischio: z.object({ esito: z.string(), lpl: z.enum(["I", "II", "III", "IV"]) }).optional(),
  captazione: z.object({ lunghezzaConduttori: numero, giunzioni: numero.int(), incroci: numero.int(), descrizione: z.string() }).optional(),
  calate: z.object({ lunghezzaConduttori: numero, numero: numero.int(), distanzaSeparazione: numero }).optional(),
  terra: z.object({ numeroPicchetti: numero.int(), lunghezzaPicchetto: numero, lunghezzaAnello: numero, descrizione: z.string() }).optional(),
  spd: z.object({ dispositivi: z.array(z.object({ codice: z.string(), descrizione: z.string(), quantita: numero.int() })), descrizione: z.string() }).optional(),
});
export const computoSchema = z.object({
  catalogo: z.array(articoloSchema),
  configurazione: z.object({ sfridoPercento: numero, passoSupporti: z.record(z.number().finite().positive().nullable()) }),
  risultati: risultatiSchema,
  modifiche: z.record(z.object({ codice: z.string().max(100).optional(), quantita: numero.optional() })),
  manuali: z.array(z.object({ id: z.string(), codice: z.string().max(100), descrizione: z.string().max(500), categoria: z.enum(categorie), unita: z.enum(["m", "pz"]), materiale: z.string(), sezione: z.string(), prezzo: numero.optional(), quantita: numero, provenienza: z.string(), manuale: z.boolean().optional() })),
});
let computo = computoIniziale;
let computoCaricato = false;
const ascoltatoriComputo = new Set<() => void>();
export function aggiornaComputo(parziale: Partial<DatiComputo>) {
  computo = computoSchema.parse({ ...computo, ...parziale }) as DatiComputo;
  try { if(salvataggioLocale)localStorage.setItem("lps-computo-materiali", JSON.stringify(computo)); } catch { /* dispositivo senza storage */ }
  ascoltatoriComputo.forEach((f) => f());
}
export function useComputo() {
  return useSyncExternalStore((f) => {
    ascoltatoriComputo.add(f);
    if (!computoCaricato && typeof window !== "undefined") {
      computoCaricato = true;
      try {
        const raw = localStorage.getItem("lps-computo-materiali");
        if (raw) { const parsed = computoSchema.safeParse(JSON.parse(raw)); if (parsed.success) computo = parsed.data as DatiComputo; }
      } catch { /* conserva i valori iniziali */ }
      f();
    }
    return () => ascoltatoriComputo.delete(f);
  }, () => computo, () => computoIniziale);
}

export const edificioSchema = z.object({ nomeProgetto: z.string().max(200), comune: z.string().max(200), L: numero, W: numero, H: numero, copertura: z.string(), materiale: z.string(), impiantiTetto: z.boolean(), posizioneId: z.string(), densita: numero, lplProgetto: z.enum(["I", "II", "III", "IV"]).nullable().default(null) });
export function leggiStatoBase() { return { edificio: stato, computo }; }
export function sostituisciStatoBase(d: DatiEdificio, c: DatiComputo) {
  stato = edificioSchema.parse(d); computo = computoSchema.parse(c) as DatiComputo;
  caricato = true; computoCaricato = true;
  ascoltatori.forEach((f) => f()); ascoltatoriComputo.forEach((f) => f());
}
