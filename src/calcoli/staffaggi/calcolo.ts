/**
 * Calcolo di una tratta di staffaggio: numero dei supporti, carichi per supporto e per piano, verifiche
 * (passerella, traverso o mensola, pendini o montanti, fissaggi) e componenti per supporto con le misure.
 * I codici OBO si assegnano dopo, con il catalogo (vedi componenti.ts). Logica pura.
 */
import profilatiJson from "@/dati/staffaggi/profilati.json";
import { G, caricoCritico, interpola, verifica, verificaFlessione, verificaTraverso, type Statica, type TabellaCarichi, type Verifica } from "./statica";
import type { Piano, Tratta } from "./tipi";

export interface Profilo { tipo: string; nome: string; b: number; h: number; t: number; statica: Statica | null; tabella: TabellaCarichi }
export const PROFILATI: Profilo[] = profilatiJson.profilati.map((p) => ({ tipo: p.tipo, nome: p.nome, b: p.b, h: p.h, t: p.t, statica: p.statica, tabella: { L: p.L, Fzul: p.Fzul, qzul: p.qzul } }));

/** Mensole OBO: il numero del tipo è il carico ammesso in daN (AW 15 = 1,5 kN). AW 80 solo a parete. */
export const MENSOLE = [
  { tipo: "AW 15", Famm: 1.5, suProfilato: true },
  { tipo: "AW 30", Famm: 3.0, suProfilato: true },
  { tipo: "AW 55", Famm: 5.5, suProfilato: true },
  { tipo: "AW 80", Famm: 8.0, suProfilato: false },
] as const;
/** Lunghezze commerciali delle mensole (mm, sporgenza utile). */
export const LUNGHEZZE_MENSOLE = [110, 160, 210, 260, 310, 360, 410, 460, 510, 560, 610, 710, 810];

/** Dati di passerella dal catalogo, se disponibili: peso (kg/m) e carichi ammessi per interasse. */
export interface DatiPasserella { peso?: number | null; interassi?: number[]; carichi?: (number | null)[] }
export type DatiPasserelle = (p: Piano) => DatiPasserella | null;

/** Peso proprio stimato (kg/m) se manca il dato OBO: lamiera 1 mm (lamiera) o filo (stima prudente). */
export function pesoStimato(p: Piano): number {
  if (p.serie === "GR-Magic") return 0.6 + 0.004 * p.larghezza + 0.01 * p.altezza;
  if (p.serie === "SL") return 2.5 + 0.004 * p.larghezza;
  const sviluppo = p.larghezza + 2 * p.altezza; // mm di lamiera
  return (sviluppo * 1.0 * 7.85) / 1000 + (p.coperchio ? (p.larghezza * 0.8 * 7.85) / 1000 : 0);
}

export interface CaricoPiano { piano: number; serie: string; larghezza: number; pesoProprio: number; pesoStimato: boolean; qTotale: number; F: number }
export interface Componente { ruolo: string; descrizione: string; quantita: number; lunghezza?: number | undefined; tipo?: string | undefined; unita: "pz" | "m" }
export interface RisultatoTratta {
  supporti: number;
  carichi: CaricoPiano[];
  Ftotale: number; // kN per supporto
  verifiche: Verifica[];
  esito: "ok" | "ko" | "nd";
  /** componenti di un supporto */
  perSupporto: Componente[];
  /** componenti della tratta intera (passerelle, giunti, coperchi) */
  perTratta: Componente[];
  geometria: { luceTraverso?: number; lunghezzaTraverso?: number; lunghezzaMontante?: number; mensole?: { tipo: string; lunghezza: number }[] };
  avvisi: string[];
}

const arrotonda = (v: number, passo = 10) => Math.ceil(v / passo) * passo;

/** Calcola la tratta. `datiPasserelle` dà peso e carichi ammessi dal catalogo quando ci sono. */
export function calcolaTratta(t: Tratta, datiPasserelle: DatiPasserelle = () => null): RisultatoTratta {
  const prof = PROFILATI.find((p) => p.tipo === t.profilato) ?? PROFILATI[PROFILATI.length - 1]!;
  const n = t.piani.length, supporti = Math.floor(t.lunghezza / t.interasse + 1e-9) + 1;
  const avvisi: string[] = [];
  const verifiche: Verifica[] = [];
  // ---------- carichi per piano
  const carichi: CaricoPiano[] = t.piani.map((p, i) => {
    const dp = datiPasserelle(p);
    const peso = dp?.peso ?? null;
    const pp = peso ?? pesoStimato(p);
    const extra = i === n - 1 ? t.caricoExtra : 0; // il carico extra va sul piano più basso
    const qTotale = (p.caricoCavi + pp) * G; // kN/m
    const F = qTotale * t.interasse + extra * G;
    // passerella tra i supporti
    const qAmm = dp?.interassi && dp.carichi ? interpola(dp.interassi.map((x) => x * 1000), dp.carichi, t.interasse * 1000) : null;
    verifiche.push(verifica(`Passerella piano ${i + 1} (${p.serie} ${p.larghezza}x${p.altezza})`, `carico cavi tra supporti a ${t.interasse.toLocaleString("it-IT")} m`, p.caricoCavi * G, qAmm != null ? qAmm : null, "kN/m",
      qAmm != null ? "carichi ammessi OBO della passerella" : "carico ammesso della passerella non disponibile", qAmm == null ? "Verificare con la tabella dei carichi della passerella OBO." : undefined));
    return { piano: i + 1, serie: p.serie, larghezza: p.larghezza, pesoProprio: pp, pesoStimato: peso == null, qTotale, F };
  });
  if (carichi.some((c) => c.pesoStimato)) avvisi.push("Peso proprio delle passerelle stimato (lamiera 1 mm o filo): sostituito dal peso OBO quando il catalogo lo indica.");
  const Ftot = carichi.reduce((s, c) => s + c.F, 0);
  const perSupporto: Componente[] = [], perTratta: Componente[] = [];
  const geometria: RisultatoTratta["geometria"] = {};
  const hMontante = arrotonda(t.altezzaStaffa * 1000 + (n - 1) * t.distanzaPiani + 50);
  const larghezzaMax = Math.max(...t.piani.map((p) => p.larghezza));

  // ---------- staffaggio a traverso (trapezio a soffitto o portale)
  if (t.tipologia === "soffitto-trapezio" || t.tipologia === "portale") {
    const luce = larghezzaMax + 100, lunghezzaTraverso = luce + 100;
    geometria.luceTraverso = luce; geometria.lunghezzaTraverso = lunghezzaTraverso; geometria.lunghezzaMontante = hMontante;
    carichi.forEach((c) => verifiche.push(verificaTraverso(`Traverso piano ${c.piano} (${prof.tipo})`, prof.tabella, prof.statica, luce, c.larghezza, c.F)));
    const N = Ftot / 2;
    if (t.tipologia === "soffitto-trapezio") {
      verifiche.push(prof.statica?.A ? verifica(`Pendino (${prof.tipo})`, "trazione nel pendino", (N * 1000) / (prof.statica.A * 100), 160, "N/mm²", "calcolo con l'area A del profilo") : verifica(`Pendino (${prof.tipo})`, "trazione nel pendino", N, null, "kN", "area del profilo non disponibile"));
      verifiche.push(verifica("Fissaggio a soffitto (per pendino)", "forza di trazione sull'ancorante", N, null, "kN", "da confrontare con l'ancorante scelto", "Scegliere l'ancorante per il supporto (calcestruzzo, acciaio, legno) con carico ammesso maggiore."));
      perSupporto.push({ ruolo: "pendino", descrizione: `Pendino in profilato ${prof.tipo}`, quantita: 2, lunghezza: hMontante, tipo: prof.tipo, unita: "pz" });
      perSupporto.push({ ruolo: "attacco-soffitto", descrizione: "Attacco a soffitto per profilato", quantita: 2, unita: "pz" });
    } else {
      const l0 = 2 * hMontante, Ncr = caricoCritico(prof.statica, l0);
      verifiche.push(verifica(`Montante (${prof.tipo})`, `compressione (libera inflessione ${l0} mm, sicurezza 2,5)`, N, Ncr != null ? Ncr / 2.5 : null, "kN", Ncr != null ? "carico critico euleriano con Iz" : "valori statici non disponibili"));
      verifiche.push(verifica("Fissaggio a pavimento (per montante)", "forza di compressione sulla piastra", N, null, "kN", "piastra e ancoranti da scegliere"));
      perSupporto.push({ ruolo: "montante", descrizione: `Montante in profilato ${prof.tipo}`, quantita: 2, lunghezza: hMontante, tipo: prof.tipo, unita: "pz" });
      perSupporto.push({ ruolo: "piastra-base", descrizione: "Piastra di base per profilato", quantita: 2, unita: "pz" });
    }
    perSupporto.push({ ruolo: "traverso", descrizione: `Traverso in profilato ${prof.tipo}`, quantita: n, lunghezza: lunghezzaTraverso, tipo: prof.tipo, unita: "pz" });
    perSupporto.push({ ruolo: "angolare", descrizione: "Angolare di collegamento traverso-pendino", quantita: 2 * n, unita: "pz" });
    perSupporto.push({ ruolo: "dado-vite", descrizione: "Dado scorrevole con vite M10", quantita: 4 * n + 4, unita: "pz" });
    perSupporto.push({ ruolo: "tappo", descrizione: "Cappuccio protettivo del profilato", quantita: 2 * n + 2, tipo: prof.tipo, unita: "pz" });
  } else {
    // ---------- montante con mensole (soffitto, parete, pavimento)
    const mensole = carichi.map((c) => {
      const L = LUNGHEZZE_MENSOLE.find((l) => l >= c.larghezza + 10) ?? LUNGHEZZE_MENSOLE[LUNGHEZZE_MENSOLE.length - 1]!;
      const ammesse = MENSOLE.filter((m) => t.tipologia === "parete-mensola" || m.suProfilato);
      const m = ammesse.find((x) => x.Famm >= c.F) ?? ammesse[ammesse.length - 1]!;
      if (L < c.larghezza + 10) avvisi.push(`Piano ${c.piano}: passerella più larga della mensola più lunga (${L} mm).`);
      verifiche.push(verifica(`Mensola piano ${c.piano} (${m.tipo} L ${L})`, "carico sulla mensola", c.F, m.Famm, "kN", "carico ammesso OBO della mensola (tipo AW)"));
      return { tipo: m.tipo, lunghezza: L, F: c.F };
    });
    geometria.mensole = mensole.map((m) => ({ tipo: m.tipo, lunghezza: m.lunghezza }));
    geometria.lunghezzaMontante = hMontante;
    // momento sul montante: carico a metà mensola
    const M = mensole.reduce((s, m) => s + m.F * (m.lunghezza / 2000), 0); // kNm
    if (t.tipologia === "soffitto-mensola") {
      verifiche.push(verificaFlessione(`Montante a soffitto (${prof.tipo})`, prof.statica, M, Ftot));
      verifiche.push(verifica("Fissaggio a soffitto", "trazione sul fissaggio (con momento, braccio 100 mm)", Ftot / 2 + M / 0.1, null, "kN", "da confrontare con gli ancoranti scelti", "Piastra a soffitto con 2 ancoranti a 100 mm: N = F/2 + M/0,1 m."));
      perSupporto.push({ ruolo: "montante", descrizione: `Montante in profilato ${prof.tipo}`, quantita: 1, lunghezza: hMontante, tipo: prof.tipo, unita: "pz" });
      perSupporto.push({ ruolo: "attacco-soffitto", descrizione: "Attacco a soffitto per profilato", quantita: 1, unita: "pz" });
    } else if (t.tipologia === "parete-mensola") {
      const z = 0.1;
      verifiche.push(verifica("Fissaggio della mensola a parete", "trazione sull'ancorante superiore (braccio 100 mm)", Math.max(...mensole.map((m) => (m.F * m.lunghezza) / 2000 / z)), null, "kN", "da confrontare con gli ancoranti scelti", "Coppia di ancoranti a 100 mm: N = F · L/2 / 0,1 m."));
      if (n > 1) perSupporto.push({ ruolo: "montante", descrizione: `Profilato verticale a parete ${prof.tipo}`, quantita: 1, lunghezza: hMontante, tipo: prof.tipo, unita: "pz" });
    } else {
      const l0 = 2 * hMontante, Ncr = caricoCritico(prof.statica, l0);
      verifiche.push(verificaFlessione(`Montante a pavimento (${prof.tipo})`, prof.statica, M, Ftot));
      verifiche.push(verifica(`Montante a pavimento (${prof.tipo})`, `compressione (libera inflessione ${l0} mm, sicurezza 2,5)`, Ftot, Ncr != null ? Ncr / 2.5 : null, "kN", Ncr != null ? "carico critico euleriano con Iz" : "valori statici non disponibili"));
      perSupporto.push({ ruolo: "montante", descrizione: `Montante in profilato ${prof.tipo}`, quantita: 1, lunghezza: hMontante, tipo: prof.tipo, unita: "pz" });
      perSupporto.push({ ruolo: "piastra-base", descrizione: "Piastra di base per profilato", quantita: 1, unita: "pz" });
    }
    for (const m of mensole) perSupporto.push({ ruolo: "mensola", descrizione: `Mensola ${m.tipo} lunghezza ${m.lunghezza} mm`, quantita: 1, lunghezza: m.lunghezza, tipo: m.tipo, unita: "pz" });
    perSupporto.push({ ruolo: "dado-vite", descrizione: "Dado scorrevole con vite M10", quantita: 2 * n + (t.tipologia === "parete-mensola" ? 0 : 2), unita: "pz" });
    if (t.tipologia !== "parete-mensola" || n > 1) perSupporto.push({ ruolo: "tappo", descrizione: "Cappuccio protettivo del profilato", quantita: 1, tipo: prof.tipo, unita: "pz" });
  }

  // ---------- passerelle della tratta (pezzi da 3 m) con giunti e coperchi
  t.piani.forEach((p, i) => {
    const pezzi = Math.ceil(t.lunghezza / 3 - 1e-9);
    perTratta.push({ ruolo: "passerella", descrizione: `${p.serie} ${p.larghezza}x${p.altezza} (piano ${i + 1})`, quantita: pezzi, lunghezza: 3000, tipo: `${p.serie}|${p.larghezza}|${p.altezza}`, unita: "pz" });
    if (pezzi > 1) perTratta.push({ ruolo: "giunto", descrizione: `Giunto per ${p.serie} ${p.altezza} (piano ${i + 1})`, quantita: pezzi - 1, tipo: `${p.serie}|${p.larghezza}|${p.altezza}`, unita: "pz" });
    if (p.coperchio) perTratta.push({ ruolo: "coperchio", descrizione: `Coperchio per ${p.serie} ${p.larghezza} (piano ${i + 1})`, quantita: pezzi, lunghezza: 3000, tipo: `${p.serie}|${p.larghezza}|${p.altezza}`, unita: "pz" });
  });
  const esiti = verifiche.map((v) => v.esito);
  const esito = esiti.includes("ko") ? "ko" : esiti.every((e) => e === "ok") ? "ok" : "nd";
  return { supporti, carichi, Ftotale: Ftot, verifiche, esito, perSupporto, perTratta, geometria, avvisi };
}

/** Suggerimento quando qualcosa non è verificato. */
export function suggerimenti(t: Tratta, r: RisultatoTratta): string[] {
  const s: string[] = [];
  const ko = r.verifiche.filter((v) => v.esito === "ko");
  if (ko.some((v) => v.elemento.startsWith("Traverso") || v.elemento.startsWith("Montante") || v.elemento.startsWith("Pendino"))) {
    const migliore = ["MS4121", "MSL4141", "MS4141"].indexOf(t.profilato) < 2 ? "MS4141" : null;
    s.push(migliore ? `Usare il profilato ${migliore} oppure ridurre l'interasse dei supporti.` : "Ridurre l'interasse dei supporti o dividere i cavi su più piani.");
  }
  if (ko.some((v) => v.elemento.startsWith("Mensola"))) s.push("Ridurre l'interasse dei supporti: la mensola più robusta ammessa non basta.");
  if (ko.some((v) => v.elemento.startsWith("Passerella"))) s.push("Ridurre l'interasse o scegliere una passerella con bordo più alto.");
  return s;
}
