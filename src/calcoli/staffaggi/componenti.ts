/**
 * Distinta del progetto di staffaggio: somma i componenti di tutte le tratte, taglia i profilati dalle barre
 * commerciali e assegna i codici OBO cercandoli nel catalogo (public/dati/obo-staffaggi.json). Logica pura.
 */
import type { Componente, DatiPasserella, RisultatoTratta } from "./calcolo";
import type { Finitura, Piano, ProgettoStaffaggi } from "./tipi";

/** Articolo del catalogo appiattito: prodotto o variante, con il testo per la ricerca. */
export interface ArticoloCatalogo { codice: string; nome: string; testo: string; dati: Record<string, string>; url?: string | undefined }
export interface CatalogoStaffaggi { articoli: ArticoloCatalogo[]; aggiornato: string | null }

export interface RigaDistinta {
  chiave: string; ruolo: string; descrizione: string; quantita: number; unita: "pz" | "m";
  tipo?: string | undefined; finitura: Finitura; lunghezza?: number | undefined;
  codice: string | null; nomeCatalogo?: string | undefined; tratte: string[];
}

export const BARRA_PROFILATO = 3000; // mm, barra commerciale dei profilati MS

/** Barre necessarie per i tagli indicati (first-fit decrescente, sfrido del taglio 3 mm). */
export function barreNecessarie(tagli: number[], barra = BARRA_PROFILATO): { barre: number; sfrido: number } {
  const residui: number[] = [];
  for (const t of [...tagli].sort((a, b) => b - a)) {
    const l = Math.min(t, barra) + 3;
    const i = residui.findIndex((r) => r >= l);
    if (i >= 0) residui[i]! -= l; else residui.push(barra - l);
    if (t > barra) for (let k = 1; k < Math.ceil(t / barra); k++) residui.push(0); // pezzi più lunghi della barra: giunzione
  }
  return { barre: residui.length, sfrido: residui.reduce((s, r) => s + r, 0) };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
/** La finitura compare nel testo dell'articolo? (FS, FT, A2/VA4301, A4/VA4571) */
export function finituraArticolo(a: ArticoloCatalogo): Finitura | null {
  const t = ` ${norm(a.testo)} `;
  if (/\b(a4|va ?4571|1\.4571|1\.4404)\b/.test(t)) return "A4";
  if (/\b(a2|va ?4301|1\.4301)\b/.test(t)) return "A2";
  if (/\bft\b|hot-dip|hot dip|tauchfeuer/.test(t)) return "FT";
  if (/\bfs\b|strip galvani|pre-galvani|bandverzinkt|\bdd\b/.test(t)) return "FS";
  return null;
}
/** Numeri presenti nel testo (per larghezze, altezze e lunghezze). */
const numeri = (s: string) => new Set((s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(",", "."))));

/** Regole di ricerca nel catalogo per ruolo del componente. */
function regola(r: { ruolo: string; tipo?: string | undefined; lunghezza?: number | undefined }): { parole: RegExp[]; numeri: number[] } | null {
  const prof = (r.tipo ?? "").replace("MSL", "MSL ").replace("MS", "MS ").replace("  ", " ").trim(); // "MS 4141"
  const p = r.tipo?.split("|") ?? [];
  switch (r.ruolo) {
    case "profilato": return { parole: [/profile rail|profilschiene|rail/i, new RegExp(prof.replace(" ", " ?"), "i")], numeri: [] };
    case "mensola": return { parole: [/bracket|ausleger|console/i, new RegExp((r.tipo ?? "").replace(" ", " ?"), "i")], numeri: r.lunghezza ? [r.lunghezza] : [] };
    case "attacco-soffitto": return { parole: [/ceiling|deckenbefestig|ceiling plate|ceiling bracket/i], numeri: [] };
    case "piastra-base": return { parole: [/base plate|foot plate|fußplatte|floor plate/i], numeri: [] };
    case "angolare": return { parole: [/angle|winkel/i], numeri: [] };
    case "dado-vite": return { parole: [/slot nut|sliding nut|gleitmutter|rail nut/i], numeri: [10] };
    case "tappo": return { parole: [/end cap|cover cap|endkappe/i], numeri: [] };
    case "passerella": return { parole: [/cable tray|mesh cable tray|cable ladder|gitterrinne|kabelrinne|kabelleiter/i, new RegExp(p[0] === "GR-Magic" ? "gr|magic|mesh" : p[0] === "SL" ? "\\bsl|ladder" : `\\b${p[0]}`, "i")], numeri: [Number(p[1]), Number(p[2])].filter(Boolean) };
    case "giunto": return { parole: [/connector|coupler|verbinder|joint/i, new RegExp(`\\b${p[0] === "GR-Magic" ? "gr" : p[0]}`, "i")], numeri: [Number(p[2])].filter(Boolean) };
    case "coperchio": return { parole: [/cover|deckel/i], numeri: [Number(p[1])].filter(Boolean) };
    default: return null;
  }
}

/** Codice OBO dell'articolo che corrisponde al componente (o null se il catalogo non lo trova con certezza). */
export function trovaArticolo(c: { ruolo: string; tipo?: string | undefined; lunghezza?: number | undefined }, finitura: Finitura, cat: CatalogoStaffaggi): ArticoloCatalogo | null {
  const r = regola(c);
  if (!r || !cat.articoli.length) return null;
  let migliore: ArticoloCatalogo | null = null, punti = -1;
  for (const a of cat.articoli) {
    if (!r.parole.every((re) => re.test(`${a.nome} ${a.testo}`))) continue;
    const nn = numeri(a.testo);
    if (!r.numeri.every((n) => nn.has(n))) continue;
    const f = finituraArticolo(a);
    if (f && f !== finitura) continue;
    const p = (f === finitura ? 2 : 0) + (c.ruolo === "profilato" && nn.has(BARRA_PROFILATO) ? 1 : 0);
    if (p > punti) { punti = p; migliore = a; }
  }
  return migliore;
}

/** Distinta di tutto il progetto: componenti dei supporti × numero supporti, passerelle, profilati in barre. */
export function distintaProgetto(pr: ProgettoStaffaggi, risultati: RisultatoTratta[], cat: CatalogoStaffaggi): RigaDistinta[] {
  const righe = new Map<string, RigaDistinta>();
  const tagli = new Map<string, { tipo: string; finitura: Finitura; tagli: number[]; tratte: Set<string> }>();
  const aggiungi = (c: Componente, q: number, fin: Finitura, tratta: string) => {
    if (c.lunghezza && (c.ruolo === "pendino" || c.ruolo === "montante" || c.ruolo === "traverso") && c.tipo) {
      const k = `${c.tipo}|${fin}`;
      const v = tagli.get(k) ?? { tipo: c.tipo, finitura: fin, tagli: [], tratte: new Set<string>() };
      for (let i = 0; i < q; i++) v.tagli.push(c.lunghezza);
      v.tratte.add(tratta); tagli.set(k, v);
      return;
    }
    const k = `${c.ruolo}|${c.tipo ?? ""}|${c.lunghezza ?? ""}|${fin}|${c.ruolo === "passerella" || c.ruolo === "giunto" || c.ruolo === "coperchio" ? "" : c.descrizione}`;
    const v = righe.get(k);
    if (v) { v.quantita += q; if (!v.tratte.includes(tratta)) v.tratte.push(tratta); return; }
    righe.set(k, { chiave: k, ruolo: c.ruolo, descrizione: c.descrizione.replace(/ \(piano \d+\)$/, ""), quantita: q, unita: c.unita, tipo: c.tipo, finitura: fin, lunghezza: c.lunghezza, codice: null, tratte: [tratta] });
  };
  pr.tratte.forEach((t, i) => {
    const r = risultati[i];
    if (!r) return;
    for (const c of r.perSupporto) aggiungi(c, c.quantita * r.supporti, t.finitura, t.nome);
    for (const c of r.perTratta) aggiungi(c, c.quantita, t.finitura, t.nome);
  });
  for (const [k, v] of tagli) {
    const { barre } = barreNecessarie(v.tagli);
    righe.set(`profilato|${k}`, { chiave: `profilato|${k}`, ruolo: "profilato", descrizione: `Profilato ${v.tipo} in barre da ${BARRA_PROFILATO / 1000} m (${v.tagli.length} tagli)`, quantita: barre, unita: "pz", tipo: v.tipo, finitura: v.finitura, lunghezza: BARRA_PROFILATO, codice: null, tratte: [...v.tratte] });
  }
  const ordine = ["profilato", "mensola", "attacco-soffitto", "piastra-base", "angolare", "dado-vite", "tappo", "passerella", "giunto", "coperchio"];
  return [...righe.values()].map((r) => {
    const a = trovaArticolo(r, r.finitura, cat);
    return a ? { ...r, codice: a.codice, nomeCatalogo: a.nome } : r;
  }).sort((a, b) => ordine.indexOf(a.ruolo) - ordine.indexOf(b.ruolo) || a.descrizione.localeCompare(b.descrizione));
}

/** Peso e carichi ammessi della passerella dal catalogo, se l'articolo li indica. */
export function datiPasserellaDaCatalogo(p: Piano, cat: CatalogoStaffaggi): DatiPasserella | null {
  const a = trovaArticolo({ ruolo: "passerella", tipo: `${p.serie}|${p.larghezza}|${p.altezza}` }, "FS", cat) ?? trovaArticolo({ ruolo: "passerella", tipo: `${p.serie}|${p.larghezza}|${p.altezza}` }, "FT", cat);
  if (!a) return null;
  const pesoTesto = Object.entries(a.dati).find(([k]) => /weight|gewicht/i.test(k))?.[1] ?? "";
  const m = pesoTesto.match(/([\d.,]+)\s*kg\s*(?:\/\s*(100)?\s*(?:m|pc|piece))?/i);
  let peso: number | null = null;
  if (m) { const v = Number(m[1]!.replace(",", ".")); peso = m[2] ? v / 100 : /pc|piece/i.test(pesoTesto) ? v / 3 : v; }
  return { peso: peso && peso > 0 && peso < 100 ? peso : null };
}

/** Catalogo appiattito dal JSON del lettore (prodotti con varianti). */
export function catalogoDaJson(j: unknown): CatalogoStaffaggi {
  const d = j as { aggiornato?: string; catalogo?: { codice: string; nome: string; url?: string; datiTecnici?: Record<string, string>; varianti?: { codice: string; tipo: string; valori: string[] }[] }[] } | null;
  const articoli: ArticoloCatalogo[] = [];
  for (const p of d?.catalogo ?? []) {
    const dati = p.datiTecnici ?? {};
    const base = `${p.nome} ${Object.entries(dati).map(([k, v]) => `${k} ${v}`).join(" ")}`;
    if (p.varianti?.length) for (const v of p.varianti) articoli.push({ codice: v.codice, nome: p.nome, testo: `${p.nome} ${v.tipo} ${v.valori.join(" ")}`, dati: v.codice === p.codice ? dati : {}, url: p.url });
    if (!p.varianti?.some((v) => v.codice === p.codice)) articoli.push({ codice: p.codice, nome: p.nome, testo: base, dati, url: p.url });
  }
  return { articoli, aggiornato: d?.aggiornato ?? null };
}
