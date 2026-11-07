export const categorie = ["captazione", "conduttori", "supporti", "morsetti", "calate", "terra", "spd", "accessori"] as const;
export type Categoria = typeof categorie[number];
export type Articolo = {
  codice: string; descrizione: string; categoria: Categoria; unita: "m" | "pz";
  materiale: string; sezione: string; prezzo?: number | undefined;
};
export type RigaComputo = Articolo & {
  id: string; quantita: number; provenienza: string; manuale?: boolean;
};
export type VerificaCaptazione = {
  areaProtettaSfera: number; areaProtettaMaglia: number; areaEsposta: number; esito: string;
  maglie: { id: number; lunghezza: number; larghezza: number; conforme: boolean; motivo?: string | undefined }[];
};
export type RisultatiModuli = {
  rischio?: { esito: string; lpl: "I" | "II" | "III" | "IV" };
  captazione?: { lunghezzaConduttori: number; giunzioni: number; incroci: number; descrizione: string; verifica?: VerificaCaptazione };
  calate?: { lunghezzaConduttori: number; numero: number; distanzaSeparazione: number };
  terra?: { numeroPicchetti: number; lunghezzaPicchetto: number; lunghezzaAnello: number; descrizione: string };
  spd?: { dispositivi: { codice: string; descrizione: string; quantita: number }[]; descrizione: string };
};
export type ConfigurazioneComputo = {
  sfridoPercento: number;
  passoSupporti: Record<string, number | null>;
};
export type ModificaRiga = { codice?: string; quantita?: number };