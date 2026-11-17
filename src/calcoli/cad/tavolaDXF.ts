/**
 * Tavola DXF professionale dell'impianto LPS: pianta delle coperture in scala di stampa, squadratura,
 * legenda (linee e simboli con codice OBO, descrizione e quantità), elenco dei particolari costruttivi
 * con richiami in pianta, numerazione delle calate, quote e cartiglio. Logica pura.
 */
import { COLONNA_MM, LAYER_LPS, SIMBOLI, nomeBlocco, scegliTavola, type TipoSimbolo } from "./standard";
import { ScrittoreDXF, type Attributo, type P2, type P3 } from "./dxf12";

export interface CorpoTavola { nome: string; impronta: P2[]; quotaBase: number; altezzaGronda: number; tipoTetto: string; altezzaColmo: number }
export interface ComponenteTavola { x: number; y: number; z?: number | undefined; rotazione?: number | undefined; codiceOBO?: string | null | undefined; tipo?: string | undefined }
export interface AstaTavola extends ComponenteTavola { altezza: number }
export interface PicchettoTavola extends ComponenteTavola { lunghezza: number }
export interface ConduttoreTavola { tipo: string; sottotipo?: string | undefined; punti: P3[]; materiale?: string | undefined; sezione?: string | number | undefined; codiceOBO?: string | undefined }
export interface VoceDistinta { codice: string; descrizione: string; quantita: number; unita: string; riferimento?: string | undefined }
export interface RichiamoParticolare { idParticolare: string; nome: string; x: number; y: number }

export interface DatiTavola {
  progetto: { codice: string; nome: string; comune: string; lpl: string; data: string };
  corpi: CorpoTavola[];
  aste: AstaTavola[];
  conduttori: ConduttoreTavola[];
  supporti: ComponenteTavola[];
  morsetti: ComponenteTavola[];
  compensatori: ComponenteTavola[];
  picchetti: PicchettoTavola[];
  distinta: VoceDistinta[];
  /** marcatori dei particolari (da posizioniParticolari) e particolari usati, nell'ordine di numerazione */
  particolari: { marcatori: RichiamoParticolare[]; usati: { idParticolare: string; nome: string; punti: number }[] };
  /** true se la pianta è orientata con il nord in alto (coordinate da mappa/KML) */
  nordInAlto?: boolean | undefined;
}

export interface RisultatoTavola { dxf: ScrittoreDXF; scala: number; formato: string; foglio: { x: number; y: number; larghezza: number; altezza: number } }

const fmtM = (v: number) => v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Numerazione dei particolari: P01, P02… nell'ordine dei particolari usati. */
export function codiciRichiamo(usati: { idParticolare: string }[]): Map<string, string> {
  return new Map(usati.map((u, i) => [u.idParticolare, `P${String(i + 1).padStart(2, "0")}`]));
}

/** Calate ordinate in senso orario partendo da ovest (la prima è quella a nord-ovest), attorno al baricentro: C1, C2… */
export function ordinaCalate(punti: P2[], centro: P2): number[] {
  return punti.map((p, i) => ({ i, a: Math.atan2(p[1] - centro[1], p[0] - centro[0]) }))
    .sort((u, v) => { const k = (a: number) => { let t = Math.PI - a; while (t < 0) t += 2 * Math.PI; while (t >= 2 * Math.PI) t -= 2 * Math.PI; return t; }; return k(u.a) - k(v.a); }) // da ovest, in senso orario
    .map((o) => o.i);
}

export function generaTavola(d: DatiTavola, layerExtra: { nome: string; colore: number; linea: "CONTINUOUS"; descrizione: string }[] = []): RisultatoTavola {
  const L = LAYER_LPS;
  const w = new ScrittoreDXF([...Object.values(L), ...layerExtra]);
  // ---------- ingombro della pianta
  const pts: P2[] = [];
  d.corpi.forEach((c) => c.impronta.forEach((p) => pts.push(p)));
  d.conduttori.forEach((c) => c.punti.forEach((p) => pts.push([p[0], p[1]])));
  [...d.aste, ...d.picchetti].forEach((a) => pts.push([a.x, a.y]));
  if (!pts.length) pts.push([0, 0], [10, 10]);
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0])), minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
  const { formato, scala } = scegliTavola(Math.max(maxX - minX, 1), Math.max(maxY - minY, 1));
  const k = scala / 1000; // metri di modello per mm di carta
  const ins = scala / 100; // fattore dei simboli (disegnati per 1:100)
  w.ltscale = ins;
  const [W, H] = formato.mm;
  // area di disegno (mm): margine sinistro 20 (rilegatura), altri 10, colonna a destra
  const areaX0 = 20 + 10, areaX1 = W - 10 - COLONNA_MM - 10, areaY0 = 10 + 10, areaY1 = H - 10 - 10;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const sx = cx - ((areaX0 + areaX1) / 2) * k, sy = cy - ((areaY0 + areaY1) / 2) * k;
  const P = (xmm: number, ymm: number): P2 => [sx + xmm * k, sy + ymm * k]; // punto sul foglio (mm) → modello
  const hT = (mm: number) => mm * k; // altezza testo da mm di carta

  // ---------- squadratura
  w.poli(L.cartiglio.nome, [P(0, 0), P(W, 0), P(W, H), P(0, H)], true);
  w.poli(L.cartiglio.nome, [P(20, 10), P(W - 10, 10), P(W - 10, H - 10), P(20, H - 10)], true);
  const colX = W - 10 - COLONNA_MM;
  w.linea(L.cartiglio.nome, P(colX, 10), P(colX, H - 10));

  // ---------- blocchi (simboli) usati
  const descrizioni = new Map(d.distinta.map((v) => [v.codice, v.descrizione]));
  const usoBlocchi = new Map<string, { tipo: TipoSimbolo; codice: string; descrizione: string; conta: number; layer: string }>();
  const attrDef = (codice: string, descr: string, tipo: TipoSimbolo, extra: Attributo[] = []): Attributo[] =>
    [{ tag: "CODICE", valore: codice }, { tag: "DESCRIZIONE", valore: descr }, { tag: "TIPO", valore: SIMBOLI[tipo].nome }, ...extra];
  function blocco(tipo: TipoSimbolo, codice: string | null | undefined, layer: string, extraDef: Attributo[] = []) {
    const nome = nomeBlocco(tipo, codice), c = String(codice ?? "");
    const descr = (c && descrizioni.get(c)) || SIMBOLI[tipo].nome;
    w.definisciBlocco(nome, SIMBOLI[tipo].primitive, attrDef(c, descr, tipo, extraDef));
    const u = usoBlocchi.get(nome) ?? { tipo, codice: c, descrizione: descr, conta: 0, layer };
    u.conta++; usoBlocchi.set(nome, u);
    return { nome, attr: (extra: Attributo[] = []) => attrDef(c, descr, tipo, extra) };
  }

  // ---------- spazi già occupati (per non sovrapporre richiami, numeri delle calate e scritte)
  const occupati: { x: number; y: number; r: number }[] = [];
  const libero = (x: number, y: number, r: number) => occupati.every((o) => Math.hypot(o.x - x, o.y - y) >= o.r + r);
  const dentroAltroCorpo = (x: number, y: number, escluso: CorpoTavola) => d.corpi.some((c) => c !== escluso && c.impronta.length >= 3 && dentro([x, y], c.impronta));
  /** posto libero vicino a p, preferendo la direzione (ux,uy): prova angoli e distanze crescenti */
  function posto(p: P2, ux: number, uy: number, r: number, dist: number): P2 {
    const a0 = Math.atan2(uy, ux);
    for (const f of [1, 1.6, 2.3, 3.2]) for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.6, -2.6, Math.PI]) {
      const q: P2 = [p[0] + Math.cos(a0 + da) * dist * f, p[1] + Math.sin(a0 + da) * dist * f];
      if (libero(q[0], q[1], r)) return q;
    }
    return [p[0] + Math.cos(a0) * dist, p[1] + Math.sin(a0) * dist];
  }

  // ---------- pianta: edificio
  const centri: P2[] = [];
  for (const c of d.corpi) {
    if (c.impronta.length < 3) continue;
    w.poli(L.edificio.nome, c.impronta, true);
    const bx = c.impronta.map((p) => p[0]), by = c.impronta.map((p) => p[1]);
    const x0 = Math.min(...bx), x1 = Math.max(...bx), y0 = Math.min(...by), y1 = Math.max(...by);
    const ctr: P2 = [c.impronta.reduce((s, p) => s + p[0], 0) / c.impronta.length, c.impronta.reduce((s, p) => s + p[1], 0) / c.impronta.length];
    centri.push(ctr);
    if (c.tipoTetto === "falde") w.linea(L.colmo.nome, [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]);
    // il nome va sotto il centro se lì vicino c'è un'asta
    const astaVicina = d.aste.some((a) => Math.hypot(a.x - ctr[0], a.y - ctr[1]) < hT(14));
    const ty = astaVicina ? ctr[1] - hT(12) : ctr[1];
    w.testo(L.testi.nome, [ctr[0], ty + hT(2)], hT(3), c.nome.toUpperCase(), "centro");
    w.testo(L.testi.nome, [ctr[0], ty - hT(3)], hT(2.2), `H gronda ${fmtM(c.altezzaGronda)} m${c.tipoTetto === "falde" ? ` - H colmo ${fmtM(c.altezzaColmo)} m` : ""}`, "centro");
    occupati.push({ x: ctr[0], y: ty, r: hT(10) });
    // quote d'ingombro: sotto e a sinistra, oppure sopra e a destra se da quel lato c'è un altro corpo
    const sotto = !dentroAltroCorpo((x0 + x1) / 2, y0 - hT(8), c), sinistra = !dentroAltroCorpo(x0 - hT(8), (y0 + y1) / 2, c);
    const qy = sotto ? y0 - hT(8) : y1 + hT(8), qx = sinistra ? x0 - hT(8) : x1 + hT(8), tick = hT(1.2);
    const by0 = sotto ? y0 : y1, bx0 = sinistra ? x0 : x1, sy0 = sotto ? -1 : 1, sx0 = sinistra ? -1 : 1;
    w.linea(L.quote.nome, [x0, qy], [x1, qy]); w.linea(L.quote.nome, [x0, by0 + sy0 * hT(2)], [x0, qy + sy0 * hT(2)]); w.linea(L.quote.nome, [x1, by0 + sy0 * hT(2)], [x1, qy + sy0 * hT(2)]);
    [x0, x1].forEach((x) => w.linea(L.quote.nome, [x - tick, qy - tick], [x + tick, qy + tick]));
    w.testo(L.quote.nome, [(x0 + x1) / 2, qy + hT(1)], hT(2.2), fmtM(x1 - x0), "centro");
    w.linea(L.quote.nome, [qx, y0], [qx, y1]); w.linea(L.quote.nome, [bx0 + sx0 * hT(2), y0], [qx + sx0 * hT(2), y0]); w.linea(L.quote.nome, [bx0 + sx0 * hT(2), y1], [qx + sx0 * hT(2), y1]);
    [y0, y1].forEach((y) => w.linea(L.quote.nome, [qx - tick, y - tick], [qx + tick, y + tick]));
    w.testo(L.quote.nome, [qx - hT(1), (y0 + y1) / 2], hT(2.2), fmtM(y1 - y0), "centro", 90);
    occupati.push({ x: (x0 + x1) / 2, y: qy, r: hT(4) }, { x: qx, y: (y0 + y1) / 2, r: hT(4) });
  }
  // aste e picchetti occupano spazio già prima di numerare le calate
  d.aste.forEach((a) => occupati.push({ x: a.x, y: a.y, r: 0.45 * ins }));
  d.picchetti.forEach((q) => occupati.push({ x: q.x, y: q.y, r: 0.45 * ins }));
  const centro: P2 = centri.length ? [centri.reduce((s, p) => s + p[0], 0) / centri.length, centri.reduce((s, p) => s + p[1], 0) / centri.length] : [cx, cy];

  // ---------- conduttori
  const proietta = (p: P3[]): P2[] => p.map((q) => [q[0], q[1]] as P2).filter((q, i, a) => i === 0 || Math.hypot(q[0] - a[i - 1]![0], q[1] - a[i - 1]![1]) > 1e-4);
  const calatePunti: P2[] = [];
  const legendaLinee = new Map<string, { layer: string; testo: string }>();
  for (const c of d.conduttori) {
    const p2 = proietta(c.punti);
    const mat = [c.materiale, c.sezione ? `${c.sezione} mm2` : ""].filter(Boolean).join(" ");
    if (c.tipo === "calata") {
      const alto = c.punti.reduce((a, b) => (b[2] > a[2] ? b : a), c.punti[0] as P3);
      calatePunti.push([alto[0], alto[1]]);
      if (p2.length > 1) w.poli(L.calate.nome, p2, false);
      legendaLinee.set("calata", { layer: L.calate.nome, testo: `Calata${mat ? ` - ${mat}` : ""}` });
    } else if (c.tipo === "terra") {
      if (p2.length > 1) w.poli(L.terra.nome, p2, false);
      legendaLinee.set("terra", { layer: L.terra.nome, testo: `Conduttore di terra / anello${mat ? ` - ${mat}` : ""}` });
    } else {
      if (p2.length > 1) w.poli(L.captazione.nome, p2, false);
      legendaLinee.set("captazione", { layer: L.captazione.nome, testo: `Conduttore di captazione${mat ? ` - ${mat}` : ""}` });
    }
  }
  // calate numerate C1, C2… in senso orario
  ordinaCalate(calatePunti, centro).forEach((idx, n) => {
    const p = calatePunti[idx] as P2;
    const b = blocco("calata", null, L.calate.nome);
    w.inserisci(L.calate.nome, b.nome, p, ins, 0, b.attr());
    const dx = p[0] - centro[0], dy = p[1] - centro[1], l = Math.hypot(dx, dy) || 1;
    occupati.push({ x: p[0], y: p[1], r: 0.3 * ins });
    const q = posto(p, dx / l, dy / l, hT(2.5), hT(6));
    w.testo(L.calateNum.nome, q, hT(3), `C${n + 1}`, "centro-medio");
    occupati.push({ x: q[0], y: q[1], r: hT(2.8) });
  });

  // ---------- componenti con simbolo e attributi
  for (const a of d.aste) {
    const b = blocco("asta", a.codiceOBO, L.aste.nome, [{ tag: "ALTEZZA", valore: "" }]);
    w.inserisci(L.aste.nome, b.nome, [a.x, a.y, a.z ?? 0], ins, 0, b.attr([{ tag: "ALTEZZA", valore: `${fmtM(a.altezza)} m` }]));
    w.testo(L.testi.nome, [a.x + hT(4), a.y + hT(2)], hT(1.8), `h ${fmtM(a.altezza)}`);
    occupati.push({ x: a.x, y: a.y, r: 0.45 * ins }, { x: a.x + hT(7), y: a.y + hT(2.5), r: hT(3) });
  }
  const gruppi: [ComponenteTavola[], TipoSimbolo, string][] = [[d.supporti, "supporto", L.supporti.nome], [d.morsetti, "morsetto", L.morsetti.nome], [d.compensatori, "compensatore", L.compensatori.nome]];
  for (const [lista, tipo, layer] of gruppi) for (const c of lista) {
    const b = blocco(tipo, c.codiceOBO, layer);
    w.inserisci(layer, b.nome, [c.x, c.y, c.z ?? 0], ins, c.rotazione ?? 0, b.attr());
  }
  for (const q of d.picchetti) {
    const b = blocco("picchetto", q.codiceOBO, L.dispersori.nome, [{ tag: "LUNGHEZZA", valore: "" }]);
    w.inserisci(L.dispersori.nome, b.nome, [q.x, q.y, q.z ?? 0], ins, 0, b.attr([{ tag: "LUNGHEZZA", valore: `${fmtM(q.lunghezza)} m` }]));
    occupati.push({ x: q.x, y: q.y, r: 0.4 * ins });
  }

  // ---------- richiami ai particolari: al massimo 2 per particolare (il primo e il più lontano)
  const codici = codiciRichiamo(d.particolari.usati);
  w.definisciBlocco("LPS_RICHIAMO", SIMBOLI.richiamo.primitive, [{ tag: "NUMERO", valore: "P00", visibile: true, altezza: 0.25, pos: [0, 0.12] }, { tag: "PARTICOLARE", valore: "" }]);
  for (const u of d.particolari.usati) {
    const lista = d.particolari.marcatori.filter((m) => m.idParticolare === u.idParticolare);
    const primo = lista[0]; if (!primo) continue;
    const lontano = lista.reduce((a, b) => (Math.hypot(b.x - primo.x, b.y - primo.y) > Math.hypot(a.x - primo.x, a.y - primo.y) ? b : a), primo);
    const scelti = lontano !== primo && Math.hypot(lontano.x - primo.x, lontano.y - primo.y) > hT(25) ? [primo, lontano] : [primo];
    for (const m of scelti) {
      const dx = m.x - centro[0], dy = m.y - centro[1], l = Math.hypot(dx, dy) || 1;
      const r = 0.45 * ins, c = posto([m.x, m.y], dx / l, dy / l, r * 1.15, hT(11));
      occupati.push({ x: c[0], y: c[1], r });
      const lx = c[0] - m.x, ly = c[1] - m.y, ll = Math.hypot(lx, ly) || 1;
      w.linea(L.particolari.nome, [m.x, m.y], [c[0] - (lx / ll) * r, c[1] - (ly / ll) * r]);
      w.inserisci(L.particolari.nome, "LPS_RICHIAMO", c, ins, 0, [{ tag: "NUMERO", valore: codici.get(u.idParticolare) ?? "P", visibile: true, altezza: 0.25, pos: [0, 0.12] }, { tag: "PARTICOLARE", valore: u.nome }]);
    }
  }

  // ---------- nord
  if (d.nordInAlto) {
    w.definisciBlocco("LPS_NORD", SIMBOLI.nord.primitive);
    const pn = P(areaX1 - 12, areaY1 - 14);
    w.inserisci(L.testi.nome, "LPS_NORD", pn, ins);
    w.testo(L.testi.nome, [pn[0], pn[1] + hT(10)], hT(3.5), "N", "centro");
  }

  // ---------- colonna destra: legenda, particolari, note, cartiglio
  const x0 = colX + 4, rig = 5.2; // mm
  let y = H - 10 - 8;
  w.testo(L.legenda.nome, P(x0, y), hT(4), "LEGENDA"); y -= 7;
  for (const v of legendaLinee.values()) {
    w.poli(v.layer, [P(x0, y + 1.2), P(x0 + 14, y + 1.2)], false);
    w.testo(L.legenda.nome, P(x0 + 18, y), hT(2.4), v.testo); y -= rig;
  }
  const altCartiglio = 72, fondo = 10 + altCartiglio + 4;
  const voci = [...usoBlocchi.entries()].sort((a, b) => a[1].tipo.localeCompare(b[1].tipo) || a[1].codice.localeCompare(b[1].codice));
  const qtaDistinta = new Map<string, { q: number; u: string }>();
  d.distinta.forEach((v) => { const o = qtaDistinta.get(v.codice); qtaDistinta.set(v.codice, { q: (o?.q ?? 0) + v.quantita, u: v.unita }); });
  const spazioParticolari = Math.min(d.particolari.usati.length, 12) * (rig + 1.2) + 16;
  const maxVoci = Math.max(0, Math.floor((y - fondo - spazioParticolari - 10) / rig));
  if (voci.length) {
    y -= 2;
    w.testo(L.legenda.nome, P(x0 + 18, y), hT(2), "CODICE OBO"); w.testo(L.legenda.nome, P(x0 + 42, y), hT(2), "DESCRIZIONE"); w.testo(L.legenda.nome, P(colX + COLONNA_MM - 4, y), hT(2), "Q.TA'", "destra");
    y -= 1.5; w.linea(L.legenda.nome, P(x0, y), P(colX + COLONNA_MM - 4, y)); y -= rig - 1;
  }
  voci.slice(0, maxVoci).forEach(([nome, v]) => {
    w.inserisci(v.layer, nome, P(x0 + 7, y + 1.2), ins, 0, []); // stessa grandezza sulla carta che in pianta
    w.testo(L.legenda.nome, P(x0 + 18, y), hT(2.2), v.codice || "-");
    const descr = v.descrizione.length > 46 ? `${v.descrizione.slice(0, 45)}...` : v.descrizione;
    w.testo(L.legenda.nome, P(x0 + 42, y), hT(2.2), descr);
    const q = v.codice ? qtaDistinta.get(v.codice) : undefined;
    w.testo(L.legenda.nome, P(colX + COLONNA_MM - 4, y), hT(2.2), q ? `${q.u === "m" ? fmtM(q.q) : Math.round(q.q)} ${q.u}` : `${v.conta} pz`, "destra");
    y -= rig;
  });
  if (voci.length > maxVoci) { w.testo(L.legenda.nome, P(x0, y), hT(2), `... altre ${voci.length - maxVoci} voci: vedi distinta materiali`); y -= rig; }
  if (d.particolari.usati.length) {
    y -= 4; w.testo(L.legenda.nome, P(x0, y), hT(3.5), "PARTICOLARI COSTRUTTIVI"); y -= 7.5;
    d.particolari.usati.slice(0, 12).forEach((u) => {
      w.inserisci(L.particolari.nome, "LPS_RICHIAMO", P(x0 + 5, y + 1.1), ins * 0.6, 0, [{ tag: "NUMERO", valore: codici.get(u.idParticolare) ?? "P", visibile: true, altezza: 0.25, pos: [0, 0.12] }, { tag: "PARTICOLARE", valore: u.nome }]);
      const t = `${u.nome}${u.punti ? ` (${u.punti} ${u.punti === 1 ? "punto" : "punti"})` : ""}`;
      w.testo(L.legenda.nome, P(x0 + 12, y), hT(2.2), t.length > 62 ? `${t.slice(0, 61)}...` : t); y -= rig + 1.2;
    });
    if (d.particolari.usati.length > 12) { w.testo(L.legenda.nome, P(x0, y), hT(2), `... altri ${d.particolari.usati.length - 12} particolari: vedi schede`); y -= rig; }
  }
  w.testo(L.legenda.nome, P(x0, fondo + 2), hT(1.8), "Quote in metri. Simboli: blocchi OBO_<codice> con attributi CODICE, DESCRIZIONE, TIPO.");

  // cartiglio
  const cy0 = 10, cy1 = 10 + altCartiglio, xr = colX + COLONNA_MM;
  w.poli(L.cartiglio.nome, [P(colX, cy0), P(xr, cy0), P(xr, cy1), P(colX, cy1)], true);
  const righe: [string, string][] = [
    ["Progetto", d.progetto.nome || "-"], ["Comune", d.progetto.comune || "-"], ["Codice", d.progetto.codice || "-"],
    ["Livello di protezione", `LPL ${d.progetto.lpl}`], ["Scala", `1:${scala} (${formato.nome})`], ["Data", d.progetto.data],
  ];
  w.testo(L.cartiglio.nome, P(colX + 4, cy1 - 7), hT(3.2), "IMPIANTO DI PROTEZIONE CONTRO I FULMINI (LPS)");
  w.testo(L.cartiglio.nome, P(colX + 4, cy1 - 12.5), hT(2.6), "PIANTA COPERTURE - CAPTAZIONE, CALATE E IMPIANTO DI TERRA");
  w.linea(L.cartiglio.nome, P(colX, cy1 - 16), P(xr, cy1 - 16));
  righe.forEach(([e, v], i) => {
    const yy = cy1 - 21 - i * 6.2;
    w.testo(L.cartiglio.nome, P(colX + 4, yy), hT(2), e.toUpperCase());
    w.testo(L.cartiglio.nome, P(colX + 46, yy), hT(2.6), v.length > 44 ? `${v.slice(0, 43)}...` : v);
    w.linea(L.cartiglio.nome, P(colX, yy - 2), P(xr, yy - 2));
  });
  w.linea(L.cartiglio.nome, P(colX + 42, cy1 - 16), P(colX + 42, cy0 + 8.5));
  w.testo(L.cartiglio.nome, P(colX + 4, cy0 + 3), hT(1.8), "CEI EN IEC 62305 - Elaborato con Progettazione LPS (OBO Italia)");
  w.testo(L.cartiglio.nome, P(xr - 4, cy0 + 3), hT(2.6), "TAV. LPS-01", "destra");

  return { dxf: w, scala, formato: formato.nome, foglio: { x: sx, y: sy, larghezza: W * k, altezza: H * k } };
}

/** Punto dentro un poligono (ray casting). */
export function dentro(p: P2, poli: P2[]): boolean {
  let ok = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const a = poli[i]!, b = poli[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) ok = !ok;
  }
  return ok;
}
