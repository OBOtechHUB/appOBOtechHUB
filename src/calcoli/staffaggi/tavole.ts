/**
 * Tavole degli staffaggi: una tavola A3 orizzontale per ogni tratta con la sezione quotata del supporto,
 * i dati della tratta, l'esito delle verifiche, la distinta del supporto e un cartiglio OBO.
 * Spazio modello in metri (come le tavole LPS); lo stesso ScrittoreDXF dà il DXF e, con pdfTavole, il PDF.
 */
import { ScrittoreDXF, type P2 } from "@/calcoli/cad/dxf12";
import type { Foglio } from "@/calcoli/cad/tavoleLPS";
import type { LayerLps } from "@/calcoli/cad/standard";
import type { RisultatoTratta } from "./calcolo";
import { sezioneSupporto, type Elemento } from "./disegno";
import { FINITURE, TIPOLOGIE, type ProgettoStaffaggi } from "./tipi";

export const LAYER_STF = {
  struttura: { nome: "STF-STRUTTURA", colore: 8, linea: "CONTINUOUS", descrizione: "Soffitto, parete o pavimento" },
  profilato: { nome: "STF-PROFILATI", colore: 30, linea: "CONTINUOUS", descrizione: "Profilati MS (pendini, montanti, traversi)" },
  mensola: { nome: "STF-MENSOLE", colore: 5, linea: "CONTINUOUS", descrizione: "Mensole" },
  passerella: { nome: "STF-PASSERELLE", colore: 3, linea: "CONTINUOUS", descrizione: "Passerelle e canali" },
  cavi: { nome: "STF-CAVI", colore: 3, linea: "LPS_PUNTINATO", descrizione: "Ingombro dei cavi" },
  quote: { nome: "STF-QUOTE", colore: 7, linea: "CONTINUOUS", descrizione: "Quote" },
  testi: { nome: "STF-TESTI", colore: 7, linea: "CONTINUOUS", descrizione: "Testi e note" },
  asse: { nome: "STF-ASSI", colore: 9, linea: "LPS_TRATTOPUNTO", descrizione: "Assi" },
  cartiglio: { nome: "STF-CARTIGLIO", colore: 7, linea: "CONTINUOUS", descrizione: "Squadratura e cartiglio" },
} satisfies Record<string, LayerLps>;
const SCALE = [5, 10, 15, 20, 25, 50];
const fmt = (v: number, d = 2) => v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

export interface TavoleStaffaggi { w: ScrittoreDXF; fogli: Foglio[]; layer: LayerLps[] }

export function tavoleStaffaggi(pr: ProgettoStaffaggi, risultati: RisultatoTratta[], data = new Date()): TavoleStaffaggi {
  const layer: LayerLps[] = Object.values(LAYER_STF);
  const w = new ScrittoreDXF(layer);
  const fogli: Foglio[] = [];
  const W = 420, H = 297; // A3 orizzontale, mm
  const AREA = { x: 15, y: 15, w: 270, h: 267 }; // zona del disegno sulla carta
  let xFoglio = 0;
  pr.tratte.forEach((t, i) => {
    const r = risultati[i]!;
    const s = sezioneSupporto(t, r);
    const dx = s.max[0] - s.min[0], dy = s.max[1] - s.min[1]; // mm reali
    const scala = SCALE.find((k) => dx / k <= AREA.w && dy / k <= AREA.h) ?? 50;
    const k = scala / 1000; // metri di modello per mm di carta
    const P = (x: number, y: number): P2 => [xFoglio + x * k, y * k]; // coordinate carta (mm) → modello (m)
    const hT = (mm: number) => mm * k;
    const L = (lay: string, a: [number, number], b: [number, number]) => w.linea(lay, P(...a), P(...b));
    const T = (lay: string, x: number, y: number, h: number, txt: string, a: "sinistra" | "centro" | "destra" = "sinistra") => w.testo(lay, P(x, y), hT(h), txt, a);
    const cart = LAYER_STF.cartiglio.nome;
    // squadratura
    w.poli(cart, [P(5, 5), P(W - 5, 5), P(W - 5, H - 5), P(5, H - 5)], true);
    w.poli(cart, [P(290, 5), P(290, H - 5)], false);
    // disegno: centro della sezione al centro dell'area
    const cx = AREA.x + AREA.w / 2 - ((s.min[0] + s.max[0]) / 2) / scala, cy = AREA.y + AREA.h / 2 - ((s.min[1] + s.max[1]) / 2) / scala;
    const M = (p: [number, number]): P2 => P(cx + p[0] / scala, cy + p[1] / scala);
    for (const e of s.elementi) disegna(w, e, M, hT, scala);
    T(LAYER_STF.testi.nome, AREA.x, H - 14, 4, `SEZIONE TIPO - ${t.nome.toUpperCase()}   Scala 1:${scala}`);
    // colonna destra: dati e verifiche
    const X = 295, lt = LAYER_STF.testi.nome;
    let y = H - 14;
    const riga = (txt: string, h = 2.6, passo = 4.4) => { T(lt, X, y, h, txt.length > 62 ? `${txt.slice(0, 61)}...` : txt); y -= passo; };
    riga("DATI DELLA TRATTA", 3.2, 6);
    riga(`Tipologia: ${TIPOLOGIE[t.tipologia].nome}`);
    riga(`Lunghezza ${fmt(t.lunghezza, 1)} m - interasse ${fmt(t.interasse)} m - ${r.supporti} supporti`);
    riga(`Profilato ${t.profilato} - ${FINITURE[t.finitura]}`);
    t.piani.forEach((p, k2) => riga(`Piano ${k2 + 1}: ${p.serie} ${p.larghezza}x${p.altezza}, cavi ${fmt(p.caricoCavi, 1)} kg/m${p.coperchio ? ", coperchio" : ""}`));
    riga(`Carico per supporto: ${fmt(r.Ftotale)} kN`);
    y -= 2; riga("VERIFICHE", 3.2, 6);
    for (const v of r.verifiche.slice(0, 14)) riga(`${v.esito === "ok" ? "OK" : v.esito === "ko" ? "NO" : "--"}  ${v.elemento}: ${fmt(v.valore)}${v.ammesso != null ? ` / ${fmt(v.ammesso)}` : ""} ${v.unita}`, 2.3, 3.9);
    riga(`Esito: ${r.esito === "ok" ? "VERIFICATO" : r.esito === "ko" ? "NON VERIFICATO" : "DA COMPLETARE (fissaggi)"}`, 2.8, 6);
    y -= 1; riga("COMPONENTI DI UN SUPPORTO", 3.2, 6);
    for (const c of r.perSupporto.slice(0, 10)) riga(`${c.quantita} x ${c.descrizione}${c.lunghezza && c.ruolo !== "mensola" ? ` L ${c.lunghezza} mm` : ""}`, 2.3, 3.9);
    // cartiglio
    const y0 = 10, y1 = 62;
    L(cart, [290, y1], [W - 5, y1]); L(cart, [290, 40], [W - 5, 40]); L(cart, [290, 24], [W - 5, 24]); L(cart, [355, 5], [355, 24]);
    T(cart, X, y1 - 7, 4.2, "OBO BETTERMANN - STAFFAGGI");
    T(cart, X, y1 - 13, 2.6, `${pr.codice ? `${pr.codice} - ` : ""}${pr.nome || "Progetto staffaggi"}`.slice(0, 60));
    T(cart, X, y1 - 18, 2.4, `${pr.cliente}${pr.comune ? ` - ${pr.comune}` : ""}`.slice(0, 64));
    T(cart, X, 34, 3, `${t.nome}`.slice(0, 50)); T(cart, X, 28, 2.3, `Progettista: ${pr.progettista || "-"}`.slice(0, 60));
    T(cart, X, 17, 2.3, `Data ${data.toLocaleDateString("it-IT")}`); T(cart, X, y0, 2.3, `Formato A3 - Scala 1:${scala}`);
    T(cart, 360, 14, 5, `STF-${String(i + 1).padStart(2, "0")}`);
    fogli.push({ x: xFoglio, y: 0, larghezza: W * k, altezza: H * k, formatoMm: [W, H], scala, tav: `STF-${String(i + 1).padStart(2, "0")}`, titolo: t.nome });
    xFoglio += W * k + 1;
  });
  return { w, fogli, layer };
}

function disegna(w: ScrittoreDXF, e: Elemento, M: (p: [number, number]) => P2, hT: (mm: number) => number, scala: number) {
  const lay = LAYER_STF[e.ruolo].nome;
  if (e.t === "poli" && e.p) w.poli(lay, e.p.map(M), !!e.chiusa);
  else if ((e.t === "rett" || e.t === "tratteggio") && e.a && e.b) {
    const [a, b] = [e.a, e.b];
    w.poli(lay, [M(a), M([b[0], a[1]]), M(b), M([a[0], b[1]])], true);
    if (e.t === "tratteggio") {
      // tratteggio a 45° con passo 4 mm di carta
      const passo = 4 * scala, x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      for (let d = x0 - (y1 - y0); d < x1; d += passo) {
        const pa: [number, number] = [Math.max(x0, d), Math.max(x0, d) - d + y0], pb: [number, number] = [Math.min(x1, d + (y1 - y0)), Math.min(x1, d + (y1 - y0)) - d + y0];
        if (pb[0] > pa[0]) w.linea(lay, M(pa), M(pb));
      }
    }
  } else if (e.t === "testo" && e.a) w.testo(lay, M(e.a), hT(((e.h ?? 40) / scala) * 0.9 > 2.2 ? ((e.h ?? 40) / scala) * 0.9 : 2.2), e.testo ?? "", e.allinea ?? "sinistra");
  else if (e.t === "quota" && e.a && e.b) {
    const [a, b] = [e.a, e.b], o = e.offset ?? 0;
    const dx = b[0] - a[0], dy = b[1] - a[1], Lq = Math.hypot(dx, dy) || 1, nx = -dy / Lq, ny = dx / Lq;
    const A: [number, number] = [a[0] + nx * o, a[1] + ny * o], B: [number, number] = [b[0] + nx * o, b[1] + ny * o];
    if (o) { w.linea(lay, M(a), M(A)); w.linea(lay, M(b), M(B)); }
    w.linea(lay, M(A), M(B));
    const t = 1.2 * scala;
    for (const p of [A, B]) w.linea(lay, M([p[0] - (dx / Lq + nx) * t, p[1] - (dy / Lq + ny) * t]), M([p[0] + (dx / Lq + nx) * t, p[1] + (dy / Lq + ny) * t]));
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI, rot = ang > 90 || ang <= -90 ? ang + 180 : ang;
    w.testo(lay, M([(A[0] + B[0]) / 2 + nx * 2 * scala, (A[1] + B[1]) / 2 + ny * 2 * scala]), hT(2.5), e.testo ?? "", "centro", rot);
  }
}
