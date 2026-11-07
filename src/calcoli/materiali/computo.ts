import { categorie, type Articolo, type ConfigurazioneComputo, type ModificaRiga, type RigaComputo, type RisultatiModuli, type Categoria } from "./tipi";

function positivo(n: number) {
  if (!Number.isFinite(n) || n < 0) throw new Error("Le quantità devono essere finite e non negative.");
  return n;
}
export function conSfrido(metri: number, percento: number) {
  return positivo(metri) * (1 + positivo(percento) / 100);
}
export function numeroSupporti(metri: number, passo: number) {
  positivo(metri);
  if (!Number.isFinite(passo) || passo <= 0) throw new Error("Il passo dei supporti deve essere maggiore di zero.");
  return Math.ceil(metri / passo);
}
export function generaComputo(r: RisultatiModuli, config: ConfigurazioneComputo, copertura: string): { righe: RigaComputo[]; mancanti: string[] } {
  const righe: RigaComputo[] = [];
  const mancanti: string[] = [];
  const aggiungi = (id: string, descrizione: string, categoria: Categoria, unita: "m" | "pz", quantita: number, provenienza: string) => {
    positivo(quantita);
    righe.push({ id, codice: "", descrizione, categoria, unita, quantita, provenienza, materiale: "", sezione: "" });
  };
  const passo = config.passoSupporti[copertura];
  if (r.captazione) {
    aggiungi("captazione-conduttore", "Conduttore di captazione", "captazione", "m", conSfrido(r.captazione.lunghezzaConduttori, config.sfridoPercento), "Captazione");
    if (passo != null) aggiungi("captazione-supporti", "Supporti per conduttori di captazione", "supporti", "pz", numeroSupporti(r.captazione.lunghezzaConduttori, passo), "Captazione");
    else mancanti.push(`Passo supporti per copertura ${copertura}`);
    aggiungi("maglia-giunzioni", "Morsetti di giunzione", "morsetti", "pz", r.captazione.giunzioni, "Captazione");
    aggiungi("maglia-incroci", "Morsetti di incrocio", "morsetti", "pz", r.captazione.incroci, "Captazione");
  } else mancanti.push("Captazione");
  if (r.calate) {
    aggiungi("calate-conduttore", "Conduttore di calata", "calate", "m", conSfrido(r.calate.lunghezzaConduttori, config.sfridoPercento), "Calate");
    aggiungi("calate-sezionamenti", "Morsetti di sezionamento", "morsetti", "pz", r.calate.numero, "Calate");
  } else mancanti.push("Calate");
  if (r.terra) {
    aggiungi("terra-picchetti", `Picchetto (${r.terra.lunghezzaPicchetto} m)`, "terra", "pz", r.terra.numeroPicchetti, "Terra");
    aggiungi("terra-anello", "Conduttore dell'anello di terra", "terra", "m", r.terra.lunghezzaAnello, "Terra");
  } else mancanti.push("Terra");
  if (r.spd) r.spd.dispositivi.forEach((s, i) => {
    aggiungi(`spd-${i}`, s.descrizione, "spd", "pz", s.quantita, "SPD");
    const ultima = righe.at(-1); if (ultima) ultima.codice = s.codice;
  }); else mancanti.push("SPD");
  return { righe, mancanti };
}
export function applicaModifiche(righe: RigaComputo[], modifiche: Record<string, ModificaRiga>, catalogo: Articolo[], manuali: RigaComputo[]): RigaComputo[] {
  return [...righe, ...manuali].map((riga) => {
    const modifica = modifiche[riga.id];
    const codice = modifica?.codice ?? riga.codice;
    const articolo = catalogo.find((a) => a.codice === codice && a.unita === riga.unita);
    return { ...riga, ...articolo, codice, quantita: modifica?.quantita ?? riga.quantita, manuale: riga.manuale || modifica !== undefined };
  }).sort((a, b) => categorie.indexOf(a.categoria) - categorie.indexOf(b.categoria));
}