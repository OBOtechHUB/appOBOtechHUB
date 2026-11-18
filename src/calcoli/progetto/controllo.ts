/**
 * Controllo "progetto completo" prima dell'emissione: cosa manca o non torna, con il link alla pagina da sistemare.
 * Logica pura sui fatti già calcolati dal progetto: nessun accesso a stato, DOM o rete.
 */
export type Lpl = "I" | "II" | "III" | "IV";
export type Livello = "errore" | "avviso" | "ok";
export interface VoceControllo { id: string; livello: Livello; titolo: string; dettaglio: string; pagina: string }

export interface FattiProgetto {
  edificio: { L: number; W: number; H: number; comune: string; lplProgetto: Lpl | null };
  rischio: { valutato: boolean; lplMinimo: Lpl | "nessuno" | null; conformeConProgetto: boolean | null };
  captazione: { conduttori: number; aste: number; areaEsposta: number | null };
  calate: { numero: number; perimetro: number; distanzaTipica: number | null };
  separazione: { punti: number; nonConformi: number; peggiore: { descrizione: string; d: number; s: number } | null };
  terra: { tipo: "A" | "B" | "fondazione" | null; elementi: number; l1: number | null; lunghezzaMinPicchetto: number | null; raggioEquivalente: number | null };
  spd: { linee: number; dispositivi: number };
}

const ORD: Lpl[] = ["I", "II", "III", "IV"];
const m = (v: number, d = 1) => v.toLocaleString("it-IT", { maximumFractionDigits: d });

export function controllaProgetto(f: FattiProgetto): VoceControllo[] {
  const v: VoceControllo[] = [];
  const add = (id: string, livello: Livello, titolo: string, dettaglio: string, pagina: string) => v.push({ id, livello, titolo, dettaglio, pagina });
  const e = f.edificio;
  // edificio
  if (!(e.L > 0 && e.W > 0 && e.H > 0)) add("edificio", "errore", "Dimensioni dell'edificio mancanti", "Indica lunghezza, larghezza e altezza (o importa il disegno).", "/dati-edificio");
  else if (!e.comune.trim()) add("edificio", "avviso", "Luogo dell'edificio non indicato", "Serve per la densità di fulmini e per la relazione.", "/dati-edificio");
  else add("edificio", "ok", "Dati dell'edificio", `${m(e.L)} × ${m(e.W)} × ${m(e.H)} m, ${e.comune}`, "/dati-edificio");
  // rischio e livello di protezione
  if (!f.rischio.valutato) add("rischio", "errore", "Valutazione del rischio non fatta", "Il livello di protezione deve essere giustificato dalla valutazione del rischio.", "/rischio");
  else if (!e.lplProgetto) add("rischio", "errore", "Livello di protezione del progetto non scelto", f.rischio.lplMinimo && f.rischio.lplMinimo !== "nessuno" ? `La valutazione richiede almeno LPL ${f.rischio.lplMinimo}.` : "Scegli il livello in Dati edificio o dalla valutazione del rischio.", "/rischio");
  else if (f.rischio.lplMinimo && f.rischio.lplMinimo !== "nessuno" && ORD.indexOf(e.lplProgetto) > ORD.indexOf(f.rischio.lplMinimo)) add("rischio", "errore", "Livello di protezione insufficiente", `Progetto LPL ${e.lplProgetto}, la valutazione del rischio richiede almeno LPL ${f.rischio.lplMinimo}.`, "/rischio");
  else if (f.rischio.conformeConProgetto === false) add("rischio", "errore", "Rischio non ridotto sotto il tollerabile", `Con LPS e SPD di LPL ${e.lplProgetto} almeno una zona resta sopra RT o FT: servono misure in più.`, "/rischio");
  else add("rischio", "ok", "Rischio e livello di protezione", `LPL ${e.lplProgetto}${f.rischio.lplMinimo === "nessuno" ? " (la valutazione non richiede LPS)" : f.rischio.lplMinimo ? `, richiesto almeno ${f.rischio.lplMinimo}` : ""}`, "/rischio");
  // captazione
  if (!f.captazione.conduttori && !f.captazione.aste) add("captazione", "errore", "Captazione non progettata", "Nessun conduttore di captazione e nessuna asta.", "/edificio-3d");
  else if (f.captazione.areaEsposta == null) add("captazione", "avviso", "Captazione non verificata", "Esegui la verifica con sfera rotolante e maglia.", "/edificio-3d");
  else if (f.captazione.areaEsposta > 0.01) add("captazione", "errore", "Parti della copertura non protette", `Area esposta ${m(f.captazione.areaEsposta)} m² dopo la verifica.`, "/edificio-3d");
  else add("captazione", "ok", "Captazione verificata", `${f.captazione.conduttori} conduttori, ${f.captazione.aste} aste, nessuna area esposta`, "/edificio-3d");
  // calate
  if (f.captazione.conduttori || f.captazione.aste) {
    const c = f.calate;
    if (c.numero < 2) add("calate", "errore", "Calate insufficienti", `${c.numero} ${c.numero === 1 ? "calata" : "calate"}: un LPS non isolato ne richiede almeno 2.`, "/calate");
    else if (c.distanzaTipica && c.perimetro > 0 && c.perimetro / c.numero > c.distanzaTipica * 1.05) add("calate", "avviso", "Calate più distanti del valore preferenziale", `Distanza media ${m(c.perimetro / c.numero)} m, valore della norma ${m(c.distanzaTipica)} m per l'LPL del progetto.`, "/calate");
    else add("calate", "ok", "Calate", `${c.numero} calate${c.perimetro > 0 ? `, distanza media ${m(c.perimetro / c.numero)} m` : ""}`, "/calate");
  }
  // distanza di separazione
  const s = f.separazione;
  if (!s.punti) add("separazione", "avviso", "Distanza di separazione non verificata", "Aggiungi i punti critici (impianti sul tetto, parti metalliche vicine alle calate).", "/calate");
  else if (s.nonConformi) add("separazione", "errore", "Distanza di separazione non rispettata", `${s.nonConformi} ${s.nonConformi === 1 ? "punto" : "punti"} sotto s${s.peggiore ? `, il peggiore: ${s.peggiore.descrizione} (d = ${m(s.peggiore.d, 2)} m, s = ${m(s.peggiore.s, 2)} m)` : ""}.`, "/calate");
  else add("separazione", "ok", "Distanza di separazione", `${s.punti} punti verificati`, "/calate");
  // dispersore
  const t = f.terra;
  if (!t.tipo || !t.elementi) add("terra", "errore", "Impianto di terra non progettato", "Proponi o disegna il dispersore.", "/edificio-3d");
  else if (t.l1 == null) add("terra", "avviso", "Lunghezza minima l1 non verificata", "Indica la resistività del terreno per ricavare l1.", "/edificio-3d");
  else if (t.tipo === "A" && t.elementi < 2) add("terra", "errore", "Dispersore di tipo A con meno di 2 elementi", "Servono almeno 2 elementi, consigliato uno per calata.", "/edificio-3d");
  else if (t.tipo === "A" && t.lunghezzaMinPicchetto != null && t.lunghezzaMinPicchetto < 0.5 * t.l1 - 1e-9) add("terra", "errore", "Picchetti più corti di 0,5 · l1", `Picchetto più corto ${m(t.lunghezzaMinPicchetto)} m, richiesti ${m(0.5 * t.l1)} m (l1 = ${m(t.l1)} m), oppure resistenza di terra sotto 10 Ω.`, "/edificio-3d");
  else if (t.tipo !== "A" && t.raggioEquivalente != null && t.raggioEquivalente < t.l1 - 1e-9) add("terra", "avviso", "Raggio equivalente dell'anello sotto l1", `re = ${m(t.raggioEquivalente)} m < l1 = ${m(t.l1)} m: servono almeno 2 dispersori aggiuntivi.`, "/edificio-3d");
  else add("terra", "ok", "Impianto di terra", `Tipo ${t.tipo}, l1 = ${m(t.l1)} m`, "/edificio-3d");
  // SPD
  if (f.spd.linee > 0 && !f.spd.dispositivi) add("spd", "errore", "SPD non scelti", `${f.spd.linee} ${f.spd.linee === 1 ? "linea entrante" : "linee entranti"} senza SPD per il collegamento equipotenziale.`, "/spd");
  else if (f.spd.dispositivi) add("spd", "ok", "SPD", `${f.spd.dispositivi} dispositivi scelti`, "/spd");
  return v;
}

export const problemi = (v: VoceControllo[]) => v.filter((x) => x.livello !== "ok").length;
