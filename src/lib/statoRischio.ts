/**
 * Dati della valutazione del rischio salvati nel progetto (esteso.datiRischio) e struttura per il calcolo.
 * Usati dalla pagina Rischio e dal controllo del progetto.
 */
import fattori from "@/dati/rischio/fattorePosizione.json";
import { zonaUnica, type DatiRischio, type Linea, type Struttura, type Zona } from "@/calcoli/rischio/rischioR1";

export const nuovoId = () => Math.random().toString(36).slice(2, 9);

/** Dati salvati nel progetto (versione con le zone). */
export interface StatoRischio { versione: 2; k: number; Uw: number; PS: number; PTWS: number; danniMateriali: boolean; linee: Linea[]; zone: Zona[] }

export const lineaNuova = (nome: string): Linea => ({ nome, lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 1, schermata: false, connessione: "interrata-ns", schermatura: "no", adiacente: null });
export const zonaNuova = (nome: string, esterna = false): Zona => ({ id: nuovoId(), nome, oreAnno: 8760, rt: 1e-2, rp: 1, rfId: "ordinario", categoria: "normale", misureContatto: 1, esterna, esposti: false, LD: 0.1, impiantiCritici: false, serviziCritici: false, linee: null, wm1: null, wm2: null, ks3: 1, oreApparecchi: 8760 });

export function leggiStato(raw: Record<string, unknown> | null): StatoRischio {
  if (raw && raw["versione"] === 2) return raw as unknown as StatoRischio;
  if (raw && Array.isArray(raw["linee"])) { // prima versione a zona unica
    const base: DatiRischio = { L: 1, W: 1, H: 1, NG: 1, CD: 1, LF: 5e-2, rt: 1e-2, rp: 1, rf: 1e-2, misureContatto: 1, impiantiCritici: false, frazionePresenza: 1, linee: [] };
    const { st, zona } = zonaUnica(Object.assign(base, raw as Partial<DatiRischio>));
    return { versione: 2, k: st.k ?? 2, Uw: st.Uw ?? 2.5, PS: st.PS ?? 1, PTWS: 1, danniMateriali: st.danniMateriali !== false, linee: st.linee, zone: [zona] };
  }
  return { versione: 2, k: 2, Uw: 2.5, PS: 1, PTWS: 1, danniMateriali: true, linee: [lineaNuova("Energia"), lineaNuova("Telecomunicazioni")], zone: [zonaNuova("Struttura", true)] };
}


/** Struttura per il calcolo dai dati dell'edificio e dai dati salvati della valutazione. */
export function strutturaRischio(d: { L: number; W: number; H: number; densita: number; posizioneId: string }, stato: StatoRischio): Struttura {
  const CD = fattori.find((f) => f.id === d.posizioneId)?.valore ?? 1;
  return { L: d.L || 20, W: d.W || 10, H: d.H || 8, NG: d.densita || 2, CD, k: stato.k, Uw: stato.Uw, PS: stato.PS, PTWS: stato.PTWS, danniMateriali: stato.danniMateriali, linee: stato.linee };
}
