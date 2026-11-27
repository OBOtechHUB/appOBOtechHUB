/**
 * Analisi di una pianta CAD importata (DXF o DWG): dalle polilinee chiuse dei layer scelti riconosce
 *  - i corpi dell'edificio (contorni esterni o grandi parti interne, es. un corpo più alto),
 *  - gli impianti sul tetto (UTA, torrini, camini: contorni piccoli dentro un corpo),
 *  - i lucernari (contorni piccoli dentro un corpo su layer o con testo "lucernario", "skylight", "cupolino"),
 * e propone l'altezza di ognuno dai testi del disegno che stanno dentro il contorno ("+12,50", "H=9", "h 2.5").
 * Logica pura, coordinate nell'unità del file: il fattore converte in metri.
 */
export type P2 = [number, number];
export interface PoliCad { layer: string; punti: P2[]; chiusa: boolean }
export interface TestoCad { layer: string; x: number; y: number; testo: string }
export type Ruolo = "corpo" | "impianto" | "lucernario" | "ignora";
export interface ElementoPianta {
  id: number; layer: string; punti: P2[]; area: number; genitore: number | null; ruolo: Ruolo;
  /** altezza letta dai testi (m): gronda per i corpi, altezza sopra il tetto per impianti e lucernari */
  altezza: number | null; testo: string;
}

const uguali = (a: P2, b: P2) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

/** Solo le polilinee chiuse (flag o ultimo vertice uguale al primo), senza vertici doppi. */
export function polilineeChiuse(poli: PoliCad[]): PoliCad[] {
  return poli.map((p) => {
    let pts = p.punti.filter((q, i, a) => i === 0 || !uguali(q, a[i - 1]!));
    const chiusa = p.chiusa || (pts.length > 3 && uguali(pts[0]!, pts[pts.length - 1]!));
    if (pts.length > 3 && uguali(pts[0]!, pts[pts.length - 1]!)) pts = pts.slice(0, -1);
    return { ...p, punti: pts, chiusa };
  }).filter((p) => p.chiusa && p.punti.length >= 3);
}

export function areaPoligono(p: P2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i]!, r = p[(i + 1) % p.length]!; a += q[0] * r[1] - r[0] * q[1]; }
  return Math.abs(a) / 2;
}
export function dentroPoligono(p: P2, poli: P2[]): boolean {
  let ok = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const a = poli[i]!, b = poli[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) ok = !ok;
  }
  return ok;
}
const baricentro = (p: P2[]): P2 => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

/** Altezza scritta in un testo: "+12,50", "H=9", "h 2.5 m", "quota +6.40", "Hgr 10"; null se non c'è. */
export function altezzaDaTesto(t: string): number | null {
  const s = t.replace(/\\[A-Za-z][^;]*;/g, " ").replace(/[{}]/g, " "); // codici di formattazione MTEXT
  const m = s.match(/(?:^|[\s(:=])(?:h(?:gr|gronda|max)?|quota|alt(?:ezza)?)\s*[=:]?\s*\+?\s*(\d{1,3}(?:[.,]\d{1,3})?)/i) ?? s.match(/(?:^|\s)\+\s?(\d{1,3}(?:[.,]\d{1,3})?)\b/);
  if (!m) return null;
  const v = Number(m[1]!.replace(",", "."));
  return Number.isFinite(v) && v > 0 && v < 400 ? v : null;
}
const parolaLucernario = /lucern|skylight|cupol|evacuatore|exutor|lanternino/i;

/** Un contorno isolato più piccolo di così (m²) o più stretto di così (m) non viene proposto come corpo dell'edificio (si può cambiare a mano). */
export const AREA_MINIMA_CORPO = 4, LATO_MINIMO_CORPO = 0.5;

/**
 * Il disegno sembra un prospetto o una sezione e non una pianta? Lo dice il nome del file (prospetto, elevation,
 * sezione, section, facciata) oppure il contenuto: nessun contorno che possa essere un corpo, o corpi che coprono
 * meno del 2 % dell'ingombro del disegno. Restituisce il testo dell'avviso, oppure null.
 */
export function sembraProspetto(nomeFile: string, elementi: { ruolo: Ruolo; area: number }[], ingombro: number[]): string | null {
  const daNome = /prospett|elevation|elevazion|sezion|section|facciat|fronte|ansicht|schnitt/i.test(nomeFile);
  const corpi = elementi.filter((e) => e.ruolo === "corpo"), areaCorpi = corpi.reduce((t, e) => t + e.area, 0);
  const areaDisegno = (ingombro[0] ?? 0) * (ingombro[1] ?? 0);
  const vuoto = elementi.length > 0 && (!corpi.length || (areaDisegno > 0 && areaCorpi < 0.02 * areaDisegno));
  if (!daNome && !vuoto) return null;
  return `${daNome ? "Dal nome, questo file sembra un prospetto o una sezione" : "Questo disegno non sembra una pianta"}: ${!corpi.length ? "nei layer scelti non c'è nessun contorno chiuso grande come un edificio" : `i contorni trovati coprono solo ${areaCorpi.toLocaleString("it-IT", { maximumFractionDigits: 1 })} m²`}. Da qui si importa la pianta delle coperture (contorni chiusi visti dall'alto). Un prospetto serve per le altezze: importa prima la pianta, poi in Edificio 3D usa «Altezze da un prospetto o da una sezione» (PDF o immagine del prospetto).`;
}

/** Riconosce il ruolo di ogni contorno e ne propone l'altezza. `fattore` = metri per unità del file. */
export function analizzaPianta(poli: PoliCad[], testi: TestoCad[], fattore: number): ElementoPianta[] {
  const chiuse = polilineeChiuse(poli).map((p) => ({ ...p, area: areaPoligono(p.punti) * fattore * fattore, c: baricentro(p.punti) }));
  // i più grandi prima: il genitore di un contorno è il più piccolo tra quelli più grandi che lo contengono
  const ord = chiuse.map((p, i) => ({ ...p, i })).sort((a, b) => b.area - a.area);
  const el: ElementoPianta[] = [];
  const doppio = (a: (typeof ord)[number], b: (typeof ord)[number]) => Math.abs(a.area - b.area) <= Math.max(0.05, a.area * 0.01) && Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) * fattore < 0.2;
  ord.forEach((p, k) => {
    let genitore: number | null = null;
    for (let j = k - 1; j >= 0; j--) {
      const g = ord[j]!;
      if (doppio(g, p) || ord.slice(0, j).some((x) => doppio(x, g))) continue; // i doppioni non fanno da genitore
      const dentro = p.punti.filter((q) => dentroPoligono(q, g.punti)).length / p.punti.length;
      if (dentro >= 0.9 && dentroPoligono(p.c, g.punti)) { genitore = j; break; }
    }
    const copia = ord.slice(0, k).some((g) => doppio(g, p));
    // testi dentro il contorno ma non dentro un contorno figlio (più piccolo che lo contiene)
    const figli = ord.slice(k + 1).filter((f) => !doppio(p, f) && f.area >= 0.2 && dentroPoligono(f.c, p.punti));
    const miei = testi.filter((t) => dentroPoligono([t.x, t.y], p.punti) && !figli.some((f) => dentroPoligono([t.x, t.y], f.punti)));
    const conAltezza = miei.map((t) => ({ t, h: altezzaDaTesto(t.testo) })).find((x) => x.h !== null);
    const testo = miei.map((t) => t.testo.replace(/\\[A-Za-z][^;]*;|[{}]/g, "").trim()).filter(Boolean).join(" · ").slice(0, 80);
    let ruolo: Ruolo = "corpo";
    // contorni minuscoli o sottilissimi senza un corpo intorno: tratti di un prospetto, retini, simboli. Non sono edifici.
    const xs = p.punti.map((q) => q[0]), ys = p.punti.map((q) => q[1]);
    const latoMin = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * fattore;
    if (copia || p.area < 0.2) ruolo = "ignora";
    else if (genitore === null && (p.area < AREA_MINIMA_CORPO || latoMin < LATO_MINIMO_CORPO)) ruolo = "ignora";
    else if (genitore !== null) {
      const g = ord[genitore]!;
      if (p.area / g.area < 0.4) ruolo = parolaLucernario.test(p.layer) || parolaLucernario.test(testo) ? "lucernario" : "impianto";
    }
    el.push({ id: k, layer: p.layer, punti: p.punti, area: p.area, genitore, ruolo, altezza: conAltezza?.h ?? null, testo });
  });
  return el;
}

export interface CorpoDaPianta { nome: string; impronta: P2[]; quotaBase: number; altezzaGronda: number; tipoTetto: "piano"; altezzaColmo: number }

/**
 * Corpi del modello dagli elementi scelti: i corpi partono da terra con la loro altezza (o quella predefinita),
 * impianti e lucernari stanno sopra il tetto del corpo che li contiene, con la loro altezza sopra il tetto.
 */
export function corpiDaPianta(el: ElementoPianta[], fattore: number, predefinite: { corpo: number; impianto: number; lucernario: number }): CorpoDaPianta[] {
  const scelti = el.filter((e) => e.ruolo !== "ignora");
  const quota = new Map<number, number>(); // quota del tetto per id
  const conta = { corpo: 0, impianto: 0, lucernario: 0 };
  const out: CorpoDaPianta[] = [];
  // prima i corpi (dal più grande), poi quello che sta sopra
  const ordine = [...scelti].sort((a, b) => (a.ruolo === "corpo" ? 0 : 1) - (b.ruolo === "corpo" ? 0 : 1) || b.area - a.area);
  for (const e of ordine) {
    const r = e.ruolo as Exclude<Ruolo, "ignora">;
    const h = e.altezza ?? predefinite[r];
    // il tetto su cui appoggia: il genitore più vicino già calcolato che è un corpo
    let base = 0;
    if (r !== "corpo") { let g = e.genitore; while (g !== null && !quota.has(g)) g = el.find((x) => x.id === g)?.genitore ?? null; base = g !== null ? quota.get(g)! : 0; }
    quota.set(e.id, base + h);
    conta[r]++;
    const nome = r === "corpo" ? (e.testo && !altezzaDaTesto(e.testo) ? e.testo.slice(0, 40) : `Corpo ${conta.corpo}`) : r === "lucernario" ? `Lucernario ${conta.lucernario}` : `Impianto sul tetto ${conta.impianto}`;
    out.push({ nome, impronta: e.punti.map((p) => [p[0] * fattore, p[1] * fattore] as P2), quotaBase: base, altezzaGronda: h, tipoTetto: "piano", altezzaColmo: h });
  }
  return out;
}
