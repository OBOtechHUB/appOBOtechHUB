/**
 * Verifica al vento e zavorre di TUTTE le aste del progetto (Vento e zavorre + relazione tecnica + computo).
 * Per ogni gruppo di aste uguali (articolo, altezza, tipo di fissaggio, quota della base) sceglie il metodo:
 * - irod 10–19 m (5400810…17): equilibrio del sostegno con i blocchi FangFix (zavorraSostegno);
 * - aste isFang con treppiede presenti nelle tabelle del catalogo OBO: blocchi dalla tabella con la velocità di picco in punta;
 * - altre aste su treppiede: equilibrio del treppiede a 3 piedi con 1–4 blocchi per piede (geometria dal catalogo);
 * - aste su basamento FangFix: equilibrio del basamento Ø 365 mm con 1–4 blocchi impilati;
 * - aste fissate alla struttura (parete, putrella, parapetto): asta con due supporti, tensione di flessione.
 * È un predimensionamento: i numeri definitivi li conferma lo strutturista (istruzioni OBO §3.6).
 */
import type { Asta } from "@/calcoli/edificio/tipi";
import { ASTE, BARRE, CF0, MAX_BLOCCHI_BASE, barraPer, G, MASSA_BLOCCO, MATERIALI, azioneAsta, psiLambda, velocitaPiccoKmh, verificaParete, zavorraSostegno, zavorraTabelle, type Materiale, type Parametri } from "./vento";

export type TipoFissaggio = "isolata" | "treppiede" | "basamento" | "fissa";
export type MetodoVento = "irod" | "tabella" | "treppiede" | "basamento" | "parete";
export const NOME_METODO: Record<MetodoVento, string> = {
  irod: "irod su sostegno con blocchi FangFix (calcolo)",
  tabella: "treppiede isFang (tabella del catalogo OBO)",
  treppiede: "treppiede a 3 piedi con blocchi (calcolo)",
  basamento: "basamento FangFix con blocchi impilati (calcolo)",
  parete: "fissata alla struttura con due supporti (calcolo)",
};
export interface ArticoloVento { nome: string; dati?: Record<string, string> | undefined }
export interface DatiVentoProgetto { zona: number; altitudine: number; categoria: Parametri["categoria"]; quotaBase: number; mu: number; interasseParete: number; materialeParete: Materiale; regione?: string | undefined; provincia?: string | undefined }

export interface VerificaGruppo {
  chiave: string; codice: string; nome: string; numero: number; altezza: number; quotaBase: number; tipo: TipoFissaggio; metodo: MetodoVento;
  /** velocità di picco del vento in punta (km/h) */ vento: number;
  /** forza del vento e momento alla base, valori caratteristici (kN, kN·m) */ F: number; M: number;
  diametro: number; basi: number | null; perBase: number | null; /** barra filettata per base */ barra: { codice: string; tipo: string; lunghezza: number } | null; blocchi: number | null; zavorraKg: number | null;
  ribaltamento: { sollecitante: number; resistente: number } | null; scorrimento: { sollecitante: number; resistente: number } | null;
  /** solo aste a parete */ parete: { s: number; sigma: number; fd: number; sfruttamento: number; R1: number; R2: number; materiale: string } | null;
  esito: "ok" | "no" | "oltre"; stima: boolean; note: string[];
}
export interface RigaComputoVento { codice: string; descrizione: string; quantita: number }
export interface EsitoVentoProgetto { parametri: Parametri; gruppi: VerificaGruppo[]; computo: RigaComputoVento[]; blocchiTotali: number; datiMancanti: string[] }

export const parametriDa = (v: DatiVentoProgetto, quotaBase = v.quotaBase): Parametri => ({ zona: v.zona, altitudine: v.altitudine, categoria: v.categoria, quotaBase, mu: v.mu, gammaQ: 1.5, gammaG: 0.9 });

const numMm = (s: string | undefined) => { const m = /([\d.,]+)/.exec(s ?? ""); return m ? Number(m[1]!.replace(",", ".")) : null; };
/** Diametro massimo dell'asta (mm): dal catalogo ("Diameter" o il primo valore di "Nominal size Ø"), altrimenti dal modello. */
export function diametroAsta(a: Asta, art?: ArticoloVento): { d: number; daCatalogo: boolean } {
  const nom = art?.dati?.["Nominal size Ø"], dia = art?.dati?.["Diameter"];
  const v = numMm(dia) ?? numMm(nom);
  const versione = (art?.dati?.["Version for"] ?? "").toLowerCase();
  // il "Diameter" dei treppiedi e dei basamenti è l'ingombro, non l'asta
  if (v && v > 0 && v <= 120 && !/^(stand|base)$/.test(versione)) return { d: v, daCatalogo: true };
  const m = a.diametro < 1 ? a.diametro * 1000 : a.diametro;
  return { d: m > 0 ? m : 16, daCatalogo: false };
}
const massaKg = (art?: ArticoloVento) => { const w = art?.dati?.["Weight"]; const n = w ? Number(/([\d.,]+)/.exec(w)?.[1]?.replace(",", ".")) : NaN; return Number.isFinite(n) ? (/\bg\b/.test(w!) && !/kg/.test(w!) ? n / 1000 : n) : null; };

const BLOCCO_D = 0.365; // m, FangFix F-FIX-S16
const TREPPIEDE_B = 1.5; // m, ingombro del treppiede isFang 5408967 se il catalogo non lo indica
const MAX_PER_BASE = MAX_BLOCCHI_BASE; // barra isFang 3B-G4: 4 blocchi

function equilibrio(Msd: number, Hsd: number, basi: number, braccio: number, massaFissa: number, p: Parametri, braccioBlocchi = braccio) {
  for (let k = 1; k <= MAX_PER_BASE; k++) {
    const mb = basi * k * MASSA_BLOCCO;
    const Mrd = (p.gammaG * G * (massaFissa * braccio + mb * braccioBlocchi)) / 1000, Hrd = (p.mu * p.gammaG * G * (massaFissa + mb)) / 1000;
    if (Mrd >= Msd && Hrd >= Hsd) return { k, mb, Mrd, Hrd, ok: true };
  }
  const mb = basi * MAX_PER_BASE * MASSA_BLOCCO;
  return { k: null, mb: null, Mrd: (p.gammaG * G * (massaFissa * braccio + mb * braccioBlocchi)) / 1000, Hrd: (p.mu * p.gammaG * G * (massaFissa + mb)) / 1000, ok: false };
}

/**
 * @param tipoDi tipo di fissaggio di ogni asta (relazione: tipoAsta con il fissaggio scelto)
 * @param articoli nome e dati tecnici del catalogo OBO per codice
 */
export function verificaVentoProgetto(aste: Asta[], articoli: Record<string, ArticoloVento>, v: DatiVentoProgetto, tipoDi: (a: Asta) => TipoFissaggio): EsitoVentoProgetto {
  const gruppi = new Map<string, { a: Asta; n: number; tipo: TipoFissaggio; quota: number }>();
  for (const a of aste) {
    const tipo = tipoDi(a), quota = Math.max(0, a.z); // quota della base dal modello 3D
    const k = `${a.codiceOBO}|${a.altezza.toFixed(2)}|${tipo}|${quota.toFixed(1)}`;
    const g = gruppi.get(k); if (g) g.n++; else gruppi.set(k, { a, n: 1, tipo, quota });
  }
  const mancanti = new Set<string>();
  const out: VerificaGruppo[] = [];
  for (const [chiave, { a, n, tipo, quota }] of gruppi) {
    const p = parametriDa(v, quota), art = articoli[a.codiceOBO];
    const nome = (art?.nome ?? "").trim().replace(/\s+/g, " ") || (a.codiceOBO ? `Art. ${a.codiceOBO}` : "Asta senza articolo");
    const vento = velocitaPiccoKmh(quota + a.altezza, p);
    const base = { chiave, codice: a.codiceOBO, nome, numero: n, altezza: a.altezza, quotaBase: quota, tipo, vento };
    const note: string[] = [];
    // irod
    const irod = ASTE.sostegni.find((s) => s.codice === a.codiceOBO);
    if (irod) {
      const e = zavorraSostegno(irod, p);
      out.push({ ...base, metodo: "irod", F: e.azione.F, M: e.azione.M, diametro: Math.max(...irod.tronchi.map((t) => t.d)), barra: null, basi: e.basi, perBase: e.perBase, blocchi: e.totali, zavorraKg: e.zavorra,
        ribaltamento: e.ribaltamento, scorrimento: e.scorrimento, parete: null, esito: e.esito === "ok" ? "ok" : "oltre", stima: e.stima, note: e.note });
      if (e.stima) mancanti.add(`diametri dei tronchi di ${irod.nome} (art. ${irod.codice}) non indicati nelle istruzioni OBO`);
      continue;
    }
    const { d, daCatalogo } = diametroAsta(a, art);
    if (!daCatalogo && a.codiceOBO) note.push(`Diametro ${d} mm dal modello: il catalogo non lo indica.`);
    if (!a.codiceOBO) { note.push("Asta senza articolo OBO: diametro dal modello."); mancanti.add("articolo OBO di alcune aste del modello"); }
    const az = azioneAsta([{ nome: "Asta", d, l: a.altezza }], a.altezza, p);
    const Msd = p.gammaQ * az.M, Hsd = p.gammaQ * az.F;
    // isFang nelle tabelle del catalogo
    if (tipo === "isolata" || tipo === "treppiede") {
      const t = zavorraTabelle(p).find((r) => r.asta === a.codiceOBO);
      if (t) {
        if (Math.abs(t.altezza - a.altezza) > 0.05) note.push(`Altezza nel modello ${a.altezza} m, nella tabella OBO ${t.altezza} m: vale la tabella dell'articolo.`);
        out.push({ ...base, vento: t.vento, metodo: "tabella", F: az.F, M: az.M, diametro: d, barra: null, basi: 3, perBase: t.blocchi != null ? t.blocchi / 3 : null, blocchi: t.blocchi, zavorraKg: t.zavorra,
          ribaltamento: null, scorrimento: null, parete: null, esito: t.blocchi != null ? "ok" : "oltre", stima: false,
          note: [...note, `Treppiede art. ${t.sostegno}; tabella valida fino a ${t.ventoMax} km/h.`, ...(t.blocchi == null ? [`La velocità di picco in punta (${Math.round(t.vento)} km/h) supera la tabella OBO: asta più corta, altro sostegno o calcolo dello strutturista.`] : [])] });
        continue;
      }
      // treppiede generico: 3 piedi, ribaltamento attorno alla retta tra due piedi
      const B = (numMm(art?.dati?.["Dimension B"]) ?? 0) / 1000;
      const ingombro = B > 0.5 && B < 4 ? B : TREPPIEDE_B;
      if (!(B > 0.5 && B < 4)) { note.push(`Ingombro del treppiede non nel catalogo: assunto ${TREPPIEDE_B} m (treppiede isFang 5408967).`); mancanti.add(`geometria (ingombro) e massa del treppiede per l'art. ${a.codiceOBO || "senza codice"}`); }
      const braccio = (ingombro / 2) * Math.cos(Math.PI / 3);
      const m = massaKg(art) ?? 0;
      if (!m) { note.push("Massa di asta e treppiede non nel catalogo: non considerata (a favore di sicurezza)."); mancanti.add(`massa dell'asta e del treppiede art. ${a.codiceOBO || "senza codice"}`); }
      mancanti.add("tabelle OBO dei blocchi per le aste su treppiede non presenti nel catalogo dell'app");
      const e = equilibrio(Msd, Hsd, 3, braccio, m, p);
      out.push({ ...base, metodo: "treppiede", F: az.F, M: az.M, diametro: d, barra: null, basi: 3, perBase: e.k, blocchi: e.k != null ? 3 * e.k : null, zavorraKg: e.mb,
        ribaltamento: { sollecitante: Msd, resistente: e.Mrd }, scorrimento: { sollecitante: Hsd, resistente: e.Hrd }, parete: null, esito: e.ok ? "ok" : "oltre", stima: true,
        note: [...note, ...(e.ok ? [] : ["Anche con 4 blocchi per piede (massimo installabile con la barra G4) la verifica non è soddisfatta: treppiede più grande o calcolo dello strutturista."])] });
      continue;
    }
    if (tipo === "basamento") {
      // basamento FangFix Ø 365 mm: ribaltamento attorno al bordo, blocchi impilati sulla barra filettata
      const m = massaKg(art) ?? 0;
      if (!m) note.push("Massa dell'asta non nel catalogo: non considerata (a favore di sicurezza).");
      mancanti.add("tabelle OBO FangFix (altezza massima dell'asta e blocchi per velocità del vento) per le aste su basamento");
      const e = equilibrio(Msd, Hsd, 1, BLOCCO_D / 2, m, p);
      out.push({ ...base, metodo: "basamento", F: az.F, M: az.M, diametro: d, barra: null, basi: 1, perBase: e.k, blocchi: e.k, zavorraKg: e.mb,
        ribaltamento: { sollecitante: Msd, resistente: e.Mrd }, scorrimento: { sollecitante: Hsd, resistente: e.Hrd }, parete: null, esito: e.ok ? "ok" : "oltre", stima: true,
        note: [...note, ...(e.ok ? [] : ["Anche con 4 blocchi impilati il basamento si ribalta: usare un treppiede o un fissaggio alla struttura."])] });
      continue;
    }
    // fissata alla struttura
    const mat = MATERIALI[v.materialeParete];
    const e = verificaParete({ id: chiave, nome, d, l: a.altezza }, Math.min(v.interasseParete, a.altezza * 0.9), v.materialeParete, p);
    mancanti.add("interasse consigliato e portata dei supporti per aste a parete (art. 5412xxx) e tipo di tassello");
    out.push({ ...base, metodo: "parete", F: e.F, M: e.M, diametro: d, barra: null, basi: null, perBase: null, blocchi: null, zavorraKg: null, ribaltamento: null, scorrimento: null,
      parete: { s: e.s, sigma: e.sigma, fd: e.fd, sfruttamento: e.sfruttamento, R1: e.R1, R2: e.R2, materiale: mat.nome }, esito: e.esito, stima: !daCatalogo,
      note: [...note, ...(e.esito === "no" ? ["Tensione oltre la resistenza: avvicinare i supporti, aumentare il diametro o scegliere un materiale più resistente."] : [])] });
  }
  for (const g of out) if (g.metodo !== "parete" && g.perBase != null) {
    const b = barraPer(g.perBase);
    if (b) g.barra = { codice: b.codice, tipo: b.tipo, lunghezza: b.lunghezza };
    else g.note.push(`${g.perBase} blocchi per base: la barra più lunga a catalogo (isFang 3B-G4, 500 mm) porta 4 blocchi; verificare con OBO il fissaggio.`);
  }
  out.sort((x, y) => x.metodo.localeCompare(y.metodo) || x.altezza - y.altezza || x.codice.localeCompare(y.codice));
  // computo: blocchi, protezioni (1 per blocco) e barre filettate (1 per base di blocchi)
  let blocchi = 0;
  const barre = new Map<string, number>();
  for (const g of out) if (g.blocchi != null && g.metodo !== "parete") {
    blocchi += g.blocchi * g.numero;
    const b = g.barra ?? (g.perBase != null ? BARRE.at(-1)! : null);
    if (b) barre.set(b.codice, (barre.get(b.codice) ?? 0) + (g.basi ?? 0) * g.numero);
  }
  const computo: RigaComputoVento[] = blocchi ? [
    { codice: ASTE.blocco.codice, descrizione: "Blocco in calcestruzzo FangFix F-FIX-S16, 16 kg, Ø 365 mm, impilabile", quantita: blocchi },
    { codice: "5403238", descrizione: "Protezione per blocco 16 kg F-FIX-B16 3B", quantita: blocchi },
    ...BARRE.filter((b) => barre.has(b.codice)).map((b) => ({ codice: b.codice, descrizione: `Barra filettata M16 L ${b.lunghezza} mm con dado e rondella ${b.tipo}, V2A (per ${b.blocchi} ${b.blocchi === 1 ? "blocco" : "blocchi"})`, quantita: barre.get(b.codice)! })),
  ] : [];
  return { parametri: parametriDa(v), gruppi: out, computo, blocchiTotali: blocchi, datiMancanti: [...mancanti] };
}

/** Coefficiente di forza di un'asta cilindrica (per i testi). */
export const cfAsta = (l: number, dMm: number) => CF0 * psiLambda(l, dMm / 1000);
