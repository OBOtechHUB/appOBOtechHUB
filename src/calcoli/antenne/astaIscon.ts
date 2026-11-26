/**
 * Particolare dell'asta di captazione sul palo antenne con le calate isCon: set di supporti isCon HM SET (5408090)
 * per fissare fino a 4 calate all'asta, set di estensione HM ERW (5408094) per aste oltre 6 m, fascetta di terra
 * 927 2 6-K alla muffa di collegamento (al massimo 2 calate per fascetta). Valori dalle istruzioni di montaggio OBO
 * del set (aste da 4/6/8/10 m, diametro 40/50 mm, supporti al massimo ogni 1 m, fascetta MBS 100 ≥ 20 cm sotto
 * l'ultimo supporto). Disegno originale dell'app.
 */
export const LUNGHEZZE_ASTA = [4, 6, 8, 10] as const;
export const SET_HM = { codice: "5408090", supporti: 3, coperchi: 12 } as const;
export const SET_HM_ERW = { codice: "5408094", supporti: 2, coperchi: 8 } as const;
/** Distanza massima tra due fissaggi delle calate sull'asta (m). */
export const PASSO_MAX = 1;
/** Distanza minima della fascetta MBS 100 A2 sotto l'ultimo supporto (m). */
export const FASCETTA_SOTTO = 0.2;

export interface RigaAsta { codice: string; descrizione: string; quantita: number; unita: "pz" }
export interface ParticolareAsta {
  /** tratto dell'asta sopra le antenne (m) */
  tratto: number;
  /** lunghezza commerciale scelta (m), null se il tratto supera 10 m */
  lunghezza: number | null;
  /** il set vale per al massimo 4 calate e aste fino a 10 m */
  setApplicabile: boolean;
  n: number;
  estensioni: number;
  supporti: number;
  fascetteTerra: number;
  materiali: RigaAsta[];
  note: string[];
}

const f = (v: number, c = 1) => v.toLocaleString("it-IT", { maximumFractionDigits: c });

export function particolareAsta(punta: number, sommita: number, n: number): ParticolareAsta {
  const tratto = Math.max(0, punta - sommita);
  const lunghezza = LUNGHEZZE_ASTA.find((l) => l >= tratto - 1e-9) ?? null;
  const setApplicabile = lunghezza != null && n >= 1 && n <= 4;
  const estensioni = setApplicabile && lunghezza! > 6 ? 1 : 0;
  const supporti = SET_HM.supporti + estensioni * SET_HM_ERW.supporti;
  const fascetteTerra = Math.ceil(n / 2);
  const materiali: RigaAsta[] = setApplicabile ? [
    { codice: SET_HM.codice, descrizione: `Set di supporti isCon HM SET per ${n} ${n === 1 ? "calata" : "calate"} sull'asta (piastra di contatto, ${SET_HM.supporti} supporti, ${SET_HM.coperchi} coperchi, fascetta MBS 100 A2)`, quantita: 1, unita: "pz" },
    ...(estensioni ? [{ codice: SET_HM_ERW.codice, descrizione: `Set di estensione isCon HM ERW (${SET_HM_ERW.supporti} supporti e ${SET_HM_ERW.coperchi} coperchi) per asta oltre 6 m`, quantita: estensioni, unita: "pz" as const }] : []),
    { codice: "", descrizione: "Fascetta di terra 927 2 6-K alla muffa di collegamento dell'asta (al massimo 2 calate per fascetta)", quantita: fascetteTerra, unita: "pz" },
    { codice: "", descrizione: "Guaina termorestringente sugli elementi di collegamento isCon in cima all'asta", quantita: n, unita: "pz" },
  ] : [];
  const note = setApplicabile ? [
    `Asta di captazione da ${lunghezza} m (tratto sopra le antenne ${f(tratto, 2)} m), diametro 40 o 50 mm; aggiungere la parte di fissaggio al palo indicata dalle istruzioni dell'asta.`,
    "Prima di montare la piastra di contatto, restringere una guaina termorestringente sugli elementi di collegamento delle calate isCon.",
    "Piastra di contatto appoggiata dall'alto sulla testa dell'asta: le viti entrano negli elementi di collegamento delle calate; la vite centrale fissa la piastra all'asta (si può stringere anche dopo aver montato i supporti).",
    `Supporti delle calate sull'asta al massimo ogni ${f(PASSO_MAX)} m (più distanti si rompono); non montarli sulla testa né sulla muffa di collegamento dell'asta.`,
    `Fascetta MBS 100 A2 attorno all'asta e a tutte le calate almeno ${f(FASCETTA_SOTTO * 100, 0)} cm sotto l'ultimo supporto: tiene insieme i supporti.`,
    "Senza la distanza minima tra calata e asta c'è pericolo di scarica: fissare le calate con la fascetta di terra 927 2 6-K alla muffa di collegamento (al massimo 2 calate per fascetta).",
    ...(estensioni ? ["Asta oltre 6 m: aggiungere il set di estensione HM ERW con 2 supporti in più."] : []),
  ] : [lunghezza == null ? `Tratto dell'asta sopra le antenne di ${f(tratto, 2)} m: oltre i 10 m del set isCon HM non c'è un'asta standard, serve una soluzione su misura.` : "Il set isCon HM fissa al massimo 4 calate."];
  return { tratto, lunghezza, setApplicabile, n, estensioni, supporti, fascetteTerra, materiali, note };
}

/** Particolare dell'asta in SVG (colori fissi: va bene nella pagina e nella relazione Word). */
export function svgParticolareAsta(p: ParticolareAsta): string {
  const W = 500, H = 540;
  const t = (x: number, y: number, s: string, opz: { col?: string; b?: boolean; anc?: "start" | "end" | "middle"; size?: number } = {}) =>
    `<text x="${x}" y="${y}" font-family="Arial" font-size="${opz.size ?? 12}" fill="${opz.col ?? "#282a31"}"${opz.b ? ' font-weight="bold"' : ""}${opz.anc ? ` text-anchor="${opz.anc}"` : ""}>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
  const num = (x: number, y: number, k: number) => `<circle cx="${x}" cy="${y}" r="9" fill="#f39b00"/>${t(x, y + 4, String(k), { col: "#ffffff", b: true, anc: "middle", size: 11 })}`;
  const xA = 200, yTop = 40, ySleeve = 330, yPalo = 520;
  const nb = Math.max(1, p.supporti);
  const passo = (ySleeve - 60 - (yTop + 30)) / nb;
  const yb = Array.from({ length: nb }, (_, i) => yTop + 30 + passo * (i + 0.6));
  const yLast = yb[nb - 1]!;
  const yClip = yLast + 26;
  const nVis = Math.min(4, Math.max(1, p.n));
  const offs = [-16, 16, -26, 26].slice(0, nVis);
  const parti: string[] = [
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    // palo antenne
    `<rect x="${xA - 14}" y="${ySleeve + 18}" width="28" height="${yPalo - ySleeve - 18}" fill="#c9d3d9" stroke="#7694a4"/>`,
    t(xA + 60, yPalo - 6, "palo antenne", { col: "#41525d" }),
    // antenne sotto la muffa
    `<rect x="${xA + 30}" y="${ySleeve + 50}" width="16" height="60" rx="2" fill="#41525d"/>`, `<line x1="${xA + 14}" x2="${xA + 30}" y1="${ySleeve + 80}" y2="${ySleeve + 80}" stroke="#41525d" stroke-width="3"/>`,
    t(xA + 52, ySleeve + 84, "antenne", { col: "#41525d" }),
    // asta (parte isolante chiara) e muffa
    `<rect x="${xA - 5}" y="${yTop}" width="10" height="${ySleeve - yTop}" fill="#e6e1d6" stroke="#9a9384"/>`,
    `<rect x="${xA - 10}" y="${ySleeve}" width="20" height="18" fill="#7694a4" stroke="#41525d"/>`,
    // punta
    `<line x1="${xA}" x2="${xA}" y1="${yTop - 26}" y2="${yTop}" stroke="#f39b00" stroke-width="4"/>`, `<circle cx="${xA}" cy="${yTop - 26}" r="4" fill="#f39b00"/>`,
    // piastra di contatto
    `<rect x="${xA - 34}" y="${yTop - 4}" width="68" height="10" rx="2" fill="#9aa5ad" stroke="#41525d"/>`,
  ];
  // calate isCon
  for (const o of offs) parti.push(`<path d="M ${xA + o * 1.6} ${yTop + 6} L ${xA + o} ${yTop + 34} L ${xA + o} ${ySleeve + 9} L ${xA + o * 0.95} ${yPalo}" fill="none" stroke="#1b1f23" stroke-width="4"/>`,
    `<rect x="${xA + o * 1.6 - 4}" y="${yTop + 4}" width="8" height="12" fill="#f39b00" fill-opacity="0.55"/>`);
  // supporti
  for (const y of yb) parti.push(`<rect x="${xA - 34}" y="${y - 4}" width="68" height="8" rx="3" fill="#bfc6cb" stroke="#41525d"/>`);
  // fascetta MBS 100
  parti.push(`<rect x="${xA - 36}" y="${yClip - 2.5}" width="72" height="5" fill="#41525d"/>`);
  // fascetta di terra alla muffa
  parti.push(`<rect x="${xA - 32}" y="${ySleeve + 4}" width="64" height="7" fill="#c47a00"/>`);
  // quote
  const xq = xA - 70;
  parti.push(`<line x1="${xq}" x2="${xq}" y1="${yTop}" y2="${yLast}" stroke="#2b7de9" stroke-width="1"/>`);
  for (const y of [yTop, ...yb]) parti.push(`<line x1="${xq - 5}" x2="${xq + 5}" y1="${y}" y2="${y}" stroke="#2b7de9"/>`);
  parti.push(t(xq - 8, (yTop + yLast) / 2, `≤ ${PASSO_MAX} m tra i fissaggi`, { col: "#2b7de9", anc: "end", size: 11 }),
    `<line x1="${xq + 20}" x2="${xq + 20}" y1="${yLast}" y2="${yClip}" stroke="#2b7de9"/>`, t(xq + 14, yClip + 4, "≥ 20 cm", { col: "#2b7de9", anc: "end", size: 11 }));
  // numeri
  const xn = xA + 70;
  parti.push(num(xn, yTop + 1, 1), `<line x1="${xn - 9}" x2="${xA + 34}" y1="${yTop + 1}" y2="${yTop + 1}" stroke="#f39b00"/>`,
    num(xn, yTop + 22, 2), `<line x1="${xn - 9}" x2="${xA + 30}" y1="${yTop + 22}" y2="${yTop + 12}" stroke="#f39b00"/>`,
    num(xn, yb[0]!, 3), `<line x1="${xn - 9}" x2="${xA + 34}" y1="${yb[0]!}" y2="${yb[0]!}" stroke="#f39b00"/>`,
    num(xn, yClip, 4), `<line x1="${xn - 9}" x2="${xA + 36}" y1="${yClip}" y2="${yClip}" stroke="#f39b00"/>`,
    num(xn, ySleeve + 8, 5), `<line x1="${xn - 9}" x2="${xA + 32}" y1="${ySleeve + 8}" y2="${ySleeve + 8}" stroke="#f39b00"/>`,
    num(xn, ySleeve + 34, 6), `<line x1="${xn - 9}" x2="${xA + 22}" y1="${ySleeve + 34}" y2="${ySleeve + 34}" stroke="#f39b00"/>`);
  const legenda = ["piastra di contatto (HM SET)", "guaina termorestringente", `supporti isCon HM (${p.supporti})`, "fascetta MBS 100 A2", `fascetta di terra 927 2 6-K (${p.fascetteTerra})`, `calate isCon (${p.n})`];
  legenda.forEach((s, i) => parti.push(t(xn + 16, [yTop + 5, yTop + 26, yb[0]! + 4, yClip + 4, ySleeve + 12, ySleeve + 38][i]!, s, { size: 11 })));
  parti.push(t(20, 22, `Asta ${p.lunghezza != null ? `${p.lunghezza} m` : "fuori standard"} · ${p.n} ${p.n === 1 ? "calata" : "calate"} isCon`, { b: true, size: 13 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parti.join("")}</svg>`;
}
