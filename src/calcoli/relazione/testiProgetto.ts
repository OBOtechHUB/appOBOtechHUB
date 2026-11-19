/**
 * Testi della relazione che dipendono dai dati del progetto (stato di fatto, soluzione, verifiche per corpo).
 * Ogni frase è costruita dai dati inseriti nell'app; se un dato manca la frase non viene inventata.
 * Logica pura: nessun accesso a stato, DOM o rete.
 */
import type { Asta, Conduttore, Corpo } from "@/calcoli/edificio/tipi";
import type { DatiRelazione } from "./relazioneTecnica";
import blocchiTreppiede from "@/dati/captazione/blocchiTreppiede.json";

const it = (v: number, dec = 2) => v.toLocaleString("it-IT", { maximumFractionDigits: dec, minimumFractionDigits: 0 });

// ---------------------------------------------------------------- aste: tipo, corpo, verifica
export type TipoAsta = "isolata" | "treppiede" | "basamento" | "fissa";
export const NOME_TIPO: Record<TipoAsta, string> = { isolata: "aste isolate su treppiede (conduttore isCon)", treppiede: "aste non isolate su treppiede", basamento: "aste non isolate su basamento", fissa: "aste non isolate fissate alla struttura" };
export interface InfoArticolo { nome: string; dati?: Record<string, string> | undefined }

/** Tipo di un'asta dal suo articolo (nome e dati del catalogo, descrizione del computo) e dal fissaggio scelto. */
export function tipoAsta(codice: string, articoli: Record<string, InfoArticolo>, fissaggio: DatiRelazione["fissaggioAste"]): TipoAsta {
  const a = articoli[codice];
  const t = `${a?.nome ?? ""} ${a?.dati?.["Version for"] ?? ""} ${Object.values(a?.dati ?? {}).join(" ")}`.toLowerCase();
  const isolata = /insulat|isolat|iscon|in-a /.test(t) || a?.dati?.["High voltage-resistant, insulated version"] === "yes";
  if (isolata) return "isolata";
  // il fissaggio scelto nel progetto prevale: le aste "per treppiede" (3B) si montano anche su putrella o parapetto
  if (fissaggio === "putrella" || fissaggio === "parapetto" || fissaggio === "parete") return "fissa";
  if (fissaggio === "treppiede") return "treppiede";
  if (fissaggio === "basamento") return "basamento";
  if (/fangfix|f-fix|basament|concrete base/.test(t)) return "basamento";
  if (/stand|treppied|tripod|3b-/.test(t)) return "treppiede";
  return "fissa";
}

const dentro = (x: number, y: number, pts: [number, number][]) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) c = !c;
  }
  return c;
};
const distBordo = (x: number, y: number, pts: [number, number][]) => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i]!, [bx, by] = pts[(i + 1) % pts.length]!;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    m = Math.min(m, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return m;
};
export const quotaCopertura = (c: Corpo) => c.quotaBase + c.altezzaGronda;

/**
 * Corpo su cui sta un punto (dentro l'impronta o a meno di 2 m dal bordo). Se è dato `z` (quota della base
 * dell'asta) vince il corpo con la copertura più vicina a quella quota; altrimenti il più alto.
 */
export function corpoDi(x: number, y: number, corpi: Corpo[], z?: number): Corpo | null {
  const cand = corpi.filter((c) => dentro(x, y, c.impronta) || distBordo(x, y, c.impronta) <= 2);
  if (z != null) return cand.sort((a, b) => Math.abs(quotaCopertura(a) - z) - Math.abs(quotaCopertura(b) - z) || (dentro(x, y, b.impronta) ? 1 : 0) - (dentro(x, y, a.impronta) ? 1 : 0))[0] ?? null;
  return cand.sort((a, b) => quotaCopertura(b) - quotaCopertura(a))[0] ?? null;
}

export const penetrazione = (R: number, d: number) => { const h = d / 2; return h >= R ? R : R - Math.sqrt(R * R - h * h); };

export interface VerificaCorpo {
  corpo: Corpo; numero: number; aste: Asta[]; perTipo: Partial<Record<TipoAsta, number>>;
  interasse: number | null; diagonale: number | null; penetrazione: number | null;
  puntaMin: number | null; protezione: number | null; daProteggere: number | null; richiesta: number | null; esito: "ok" | "no" | "dati";
  maglia: boolean;
}

/** Verifica per ogni corpo: interasse delle aste, penetrazione della sfera al centro della maglia di aste, altezza protetta. */
export function verificaCorpi(corpi: Corpo[], aste: Asta[], conduttori: Conduttore[], R: number, r: DatiRelazione, tipi: Map<string, TipoAsta>): VerificaCorpo[] {
  return corpi.map((c, i) => {
    const q = quotaCopertura(c);
    const mie = aste.filter((a) => corpoDi(a.x, a.y, corpi, a.z) === c);
    const perTipo: Partial<Record<TipoAsta, number>> = {};
    for (const a of mie) { const t = tipi.get(a.id) ?? "fissa"; perTipo[t] = (perTipo[t] ?? 0) + 1; }
    const maglia = conduttori.some((k) => k.tipo === "captazione" && k.punti.some((p) => corpoDi(p[0], p[1], corpi) === c));
    // per ogni asta: interasse con la più vicina (d1) e con la più vicina in direzione circa perpendicolare (d2);
    // la figura replicata ha diagonale √(d1² + d2²). Si considera la figura peggiore.
    let interasse: number | null = null, diagonale: number | null = null;
    if (mie.length >= 2) {
      let iMax = 0, dMax = 0;
      for (const a of mie) {
        let d1 = Infinity, v1: [number, number] = [1, 0];
        for (const b of mie) if (b !== a) { const dd = Math.hypot(b.x - a.x, b.y - a.y); if (dd < d1 && dd > 1e-6) { d1 = dd; v1 = [(b.x - a.x) / dd, (b.y - a.y) / dd]; } }
        let d2 = Infinity;
        for (const b of mie) if (b !== a) { const dd = Math.hypot(b.x - a.x, b.y - a.y); if (dd < 1e-6) continue; const cos = Math.abs(((b.x - a.x) * v1[0] + (b.y - a.y) * v1[1]) / dd); if (cos < 0.7 && dd < d2) d2 = dd; }
        if (!Number.isFinite(d1)) continue;
        iMax = Math.max(iMax, d1);
        dMax = Math.max(dMax, Number.isFinite(d2) ? Math.hypot(d1, d2) : d1);
      }
      interasse = iMax; diagonale = dMax;
    }
    const pen = diagonale != null ? penetrazione(R, diagonale) : null;
    const puntaMin = mie.length ? Math.min(...mie.map((a) => a.z + a.altezza - q)) : null;
    const protezione = puntaMin != null && pen != null ? puntaMin - pen : null;
    const dp = r.corpi[c.id]?.altezzaDaProteggere ?? r.altezzaImpianti ?? null;
    const richiesta = dp != null ? dp + r.margineSicurezza : null;
    const esito: VerificaCorpo["esito"] = protezione == null || richiesta == null ? "dati" : protezione >= richiesta - 1e-9 ? "ok" : "no";
    return { corpo: c, numero: i + 1, aste: mie, perTipo, interasse, diagonale, penetrazione: pen, puntaMin, protezione, daProteggere: dp, richiesta, esito, maglia };
  });
}

// ---------------------------------------------------------------- blocchi in calcestruzzo per il vento
export interface BlocchiAsta { codice: string; altezza: number; tabella: string; numero: number; blocchi: string | null; pesoKg: number | null; ventoMax: number | null }
/** Blocchi da 16 kg per le aste su treppiede, dalla velocità del vento di progetto (tabelle del catalogo OBO). */
export function blocchiPerVento(aste: Asta[], vento: number | null): BlocchiAsta[] {
  const per = new Map<string, number>();
  for (const a of aste) per.set(a.codiceOBO, (per.get(a.codiceOBO) ?? 0) + 1);
  const out: BlocchiAsta[] = [];
  for (const [codice, numero] of per) {
    for (const tb of blocchiTreppiede.tabelle) {
      const col = (tb.colonne as { altezza: number; asta: string; vento: number[] }[]).find((x) => x.asta === codice);
      if (!col) continue;
      const k = vento == null ? -1 : col.vento.findIndex((v) => v >= vento);
      const bl = k >= 0 ? blocchiTreppiede.blocchi[k] ?? null : null;
      out.push({ codice, altezza: col.altezza, tabella: tb.titolo, numero, blocchi: bl, pesoKg: bl ? Number(bl.split(" x ")[0]) * 16 : null, ventoMax: k >= 0 ? col.vento[k] ?? null : col.vento.at(-1) ?? null });
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- frasi dallo stato di fatto
const NAT: Record<DatiRelazione["parapetto"], string> = { no: "", "si-collegato": "presente e collegato elettricamente alle calate", "si-da-collegare": "presente, da collegare all'LPS", "si-da-verificare": "presente, collegamento alle calate da verificare" };

export function fraseIntervento(r: DatiRelazione, lpl: string): string {
  if (r.tipoIntervento === "adeguamento") return `L'intervento riguarda l'adeguamento dell'impianto di protezione contro i fulmini esistente alla norma CEI EN IEC 62305:2026-10, con un LPS di classe ${lpl}.`;
  if (r.tipoIntervento === "integrazione") return `L'intervento prevede l'integrazione dell'impianto di protezione con un sistema di captazione di classe ${lpl}, coordinato con le calate, i dispersori e gli SPD esistenti.`;
  return `Questa fase prevede la progettazione e la realizzazione di un nuovo sistema di protezione contro le fulminazioni dirette (LPS) di classe ${lpl}, coordinato con l'impianto di terra e con le misure di protezione degli impianti interni (SPD).`;
}

/** Frasi dello stato di fatto rilevato al sopralluogo (solo quelle con dati). */
export function frasiStatoDiFatto(r: DatiRelazione): string[] {
  const f: string[] = [];
  if (r.parapetto !== "no") f.push(`Parapetto o ringhiera metallica perimetrale: ${NAT[r.parapetto]}.`);
  if (r.strutturaMetallica !== "no") f.push(`Struttura metallica perimetrale (putrelle, telai): ${NAT[r.strutturaMetallica]}.`);
  if (r.armature !== "no") f.push(r.armature === "si" ? "I ferri d'armatura delle strutture portanti sono elettricamente continui e possono essere usati come componenti naturali dell'LPS." : "La continuità elettrica dei ferri d'armatura è da verificare con misure prima di utilizzarli come componenti naturali.");
  if (r.coperturaMetallica) f.push("La copertura è metallica: va verificato lo spessore delle lastre per il loro uso come captatore naturale (Tab. 3).");
  const nc = r.calateNumero != null ? ` in numero di ${r.calateNumero}` : "", ic = r.calateInterasse != null ? `, con interasse di circa ${it(r.calateInterasse, 1)} m` : "";
  if (r.calateEsistenti === "naturali") f.push(`Sono presenti calate naturali (ferri d'armatura o strutture metalliche continue)${nc}${ic}.`);
  if (r.calateEsistenti === "in-getto") f.push(`Sono presenti calate predisposte in fase di getto delle strutture portanti, con uscite tecniche in copertura${nc}${ic}.`);
  if (r.calateEsistenti === "esterne") f.push(`Sono presenti calate esterne esistenti${nc}${ic}, da verificare nello stato di conservazione e nella continuità.`);
  const T: Record<DatiRelazione["terraEsistente"], string> = { nessuno: "", anello: "un anello di terra (dispersore di tipo B)", fondazione: "un dispersore di fondazione", picchetti: "dispersori a picchetto (tipo A)", misto: "un impianto di terra con anelli e picchetti" };
  if (r.terraEsistente !== "nessuno") f.push(`L'impianto di terra esistente è costituito da ${T[r.terraEsistente]}${r.terraCollegataAltri ? ", collegato ai dispersori degli edifici vicini in un unico sistema disperdente" : ""}.`);
  if (r.spdEsistenti === "si") f.push("Sugli ingressi delle linee sono presenti SPD, da verificare nel coordinamento con il livello di protezione di progetto.");
  if (r.spdEsistenti === "da-verificare") f.push("La presenza e l'idoneità degli SPD sulle linee entranti sono da verificare.");
  if (r.impiantiCopertura || r.altezzaImpianti != null) f.push(`In copertura sono installati ${r.impiantiCopertura || "impianti tecnologici"}${r.altezzaImpianti != null ? ` con altezza massima di ${it(r.altezzaImpianti, 1)} m sul piano di copertura` : ""}.`);
  return f;
}

/** Frase sulla soluzione di captazione dai dati del progetto. */
export function fraseSoluzione(r: DatiRelazione, perTipo: Partial<Record<TipoAsta, number>>, maglia: boolean, lpl: string, R: number): string {
  const parti: string[] = [];
  const tot = Object.values(perTipo).reduce((a, b) => a + (b ?? 0), 0);
  if (tot) parti.push(`un sistema di ${tot} aste di captazione (${(Object.keys(perTipo) as TipoAsta[]).map((t) => `${perTipo[t]} ${NOME_TIPO[t]}`).join(", ")})`);
  if (maglia) parti.push("conduttori di captazione a maglia");
  const sostegno = r.fissaggioAste === "putrella" ? " Le aste non isolate sono ancorate alle putrelle della struttura metallica perimetrale tramite staffe e accessori OBO e collegate alle calate." :
    r.fissaggioAste === "parapetto" ? " Le aste non isolate sono fissate alla ringhiera o al parapetto perimetrale con staffe OBO e collegate alle calate." :
    r.fissaggioAste === "parete" ? " Le aste sono fissate a parete con supporti distanziatori OBO." :
    r.fissaggioAste === "basamento" ? " Le aste sono posate su basamenti in calcestruzzo FangFix, senza forare la copertura." :
    r.fissaggioAste === "treppiede" ? " Le aste sono sostenute da treppiedi con blocchi in calcestruzzo, senza forare la copertura." : "";
  const nat = r.parapetto === "si-collegato" || r.strutturaMetallica === "si-collegato" ? " Le parti metalliche perimetrali collegate alle calate sono integrate nell'impianto come componenti naturali, assumendo anche la funzione di supporto meccanico delle aste." : "";
  return parti.length ? `Per la protezione della copertura e degli impianti installati si prevede ${parti.join(" e ")}, dimensionato con il metodo della sfera rotolante di raggio ${R} m (LPL ${lpl}). La massima profondità di penetrazione della sfera si ha al centro della figura replicata tra le aste; è prevista una distanza di sicurezza di ${it(r.margineSicurezza, 1)} m tra l'altezza massima da proteggere e il punto di massima penetrazione.${sostegno}${nat}` : "";
}

export function fraseCalate(r: DatiRelazione, nCalateProgetto: number): string {
  if (r.calateEsistenti === "in-getto" || r.calateEsistenti === "naturali") return `Il collegamento dell'impianto di captazione al sistema di dispersori è garantito dalle ${r.calateNumero ?? nCalateProgetto ?? ""} calate ${r.calateEsistenti === "in-getto" ? "predisposte in fase di getto dei solai e delle strutture portanti" : "naturali della struttura"}; le aste sono posizionate vicino alle uscite delle calate per ridurre al minimo i percorsi in copertura. I collegamenti tra le parti metalliche e le calate sono realizzati con conduttori isolati o non isolati e con gli accessori elencati nei tipologici OBO.`.replace("  ", " ");
  if (r.calateEsistenti === "esterne") return "Le calate esterne esistenti sono mantenute e integrate dove necessario per rispettare la distanza preferenziale della Tabella 5; ne vanno verificati la continuità e i collegamenti.";
  return nCalateProgetto ? `Sono previste ${nCalateProgetto} nuove calate distribuite lungo il perimetro, a partire dagli spigoli, collegate al sistema di dispersori.` : "";
}
