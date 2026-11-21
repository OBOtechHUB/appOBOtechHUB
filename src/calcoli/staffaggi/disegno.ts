/**
 * Sezione quotata di un supporto di staffaggio (vista frontale, millimetri, y verso l'alto):
 * soffitto o pavimento o parete, pendini o montanti, traversi o mensole, passerelle con i cavi.
 * La stessa geometria serve per la vista nell'app (SVG), per il DXF e per il PDF. Logica pura.
 */
import type { RisultatoTratta } from "./calcolo";
import type { Tratta } from "./tipi";

export type Pt = [number, number];
export type Ruolo = "struttura" | "profilato" | "mensola" | "passerella" | "cavi" | "quote" | "testi" | "asse";
export interface Elemento {
  t: "poli" | "rett" | "testo" | "quota" | "tratteggio";
  ruolo: Ruolo;
  p?: Pt[]; chiusa?: boolean;
  a?: Pt; b?: Pt; // rettangolo (angoli opposti) o quota (estremi)
  testo?: string; h?: number; allinea?: "sinistra" | "centro" | "destra"; offset?: number;
}
export interface Sezione { elementi: Elemento[]; min: Pt; max: Pt }

const R = 41; // lato del profilo MS41
const fmt = (v: number) => String(Math.round(v));

export function sezioneSupporto(t: Tratta, r: RisultatoTratta): Sezione {
  const el: Elemento[] = [];
  const add = (e: Elemento) => el.push(e);
  const rett = (ruolo: Ruolo, a: Pt, b: Pt) => add({ t: "rett", ruolo, a, b });
  const linea = (ruolo: Ruolo, ...p: Pt[]) => add({ t: "poli", ruolo, p });
  const quota = (a: Pt, b: Pt, offset: number, testo?: string) => add({ t: "quota", ruolo: "quote", a, b, offset, testo: testo ?? fmt(Math.hypot(b[0] - a[0], b[1] - a[1])) });
  const testo = (p: Pt, s: string, h = 40, allinea: Elemento["allinea"] = "sinistra") => add({ t: "testo", ruolo: "testi", a: p, testo: s, h, allinea });
  /** passerella a U appoggiata con il fondo in y, centrata in xc */
  const passerella = (xc: number, y: number, larg: number, alt: number, cavi: number, piano: number) => {
    const x0 = xc - larg / 2, x1 = xc + larg / 2;
    linea("passerella", [x0, y + alt], [x0, y], [x1, y], [x1, y + alt]);
    const hCavi = Math.min(alt * 0.85, 8 + cavi * 0.9);
    if (cavi > 0) add({ t: "tratteggio", ruolo: "cavi", a: [x0 + 6, y + 4], b: [x1 - 6, y + 4 + hCavi] });
    testo([x1 + 30, y + alt / 2], `${t.piani[piano]!.serie} ${larg}x${alt} - ${cavi} kg/m`, 34);
  };
  const n = t.piani.length, dp = t.distanzaPiani, h1 = t.altezzaStaffa * 1000;
  const hM = r.geometria.lunghezzaMontante ?? h1 + (n - 1) * dp + 50;

  if (t.tipologia === "soffitto-trapezio" || t.tipologia === "portale") {
    const luce = r.geometria.luceTraverso ?? 400, lt = r.geometria.lunghezzaTraverso ?? luce + 100;
    const soffitto = t.tipologia === "soffitto-trapezio";
    const yBase = 0; // soffitto (in alto) o pavimento (in basso)
    const largCostruz = lt + 300;
    linea("struttura", [-largCostruz / 2, yBase], [largCostruz / 2, yBase]);
    add({ t: "tratteggio", ruolo: "struttura", a: [-largCostruz / 2, soffitto ? yBase : yBase - 60], b: [largCostruz / 2, soffitto ? yBase + 60 : yBase] });
    const sgn = soffitto ? -1 : 1;
    for (const x of [-luce / 2, luce / 2]) {
      rett("profilato", [x - R / 2, yBase], [x + R / 2, yBase + sgn * hM]);
      rett("struttura", [x - 50, soffitto ? yBase : yBase], [x + 50, yBase + sgn * 8]);
    }
    const yPiani: number[] = [];
    for (let i = 0; i < n; i++) {
      // soffitto: il primo piano a h1 sotto il soffitto, i successivi più in basso; pavimento: dal basso verso l'alto
      const yTraverso = soffitto ? -(h1 + i * dp) : h1 + i * dp;
      yPiani.push(yTraverso);
      rett("profilato", [-lt / 2, yTraverso - R], [lt / 2, yTraverso]);
      const p = t.piani[i]!;
      passerella(0, yTraverso, p.larghezza, p.altezza, p.caricoCavi, i);
    }
    // luce tra i pendini (o montanti) e lunghezza del traverso, su due livelli diversi
    const yQ = soffitto ? Math.min(yBase + sgn * hM, yPiani[n - 1]! - R) : yPiani[0]! - R;
    quota([-luce / 2, yQ], [luce / 2, yQ], -90, `${fmt(luce)}`);
    quota([-lt / 2, yQ], [lt / 2, yQ], -190, `${fmt(lt)}`);
    quota([luce / 2 + 120, yBase], [luce / 2 + 120, yPiani[0]!], 0, fmt(h1));
    if (n > 1) quota([luce / 2 + 220, yPiani[0]!], [luce / 2 + 220, yPiani[1]!], 0, fmt(dp));
    quota([-luce / 2 - 120, yBase], [-luce / 2 - 120, yBase + sgn * hM], 0, fmt(hM));
    testo([-largCostruz / 2, soffitto ? yBase + 90 : yBase - 110], soffitto ? "Soffitto" : "Pavimento", 36);
  } else {
    const mensole = r.geometria.mensole ?? [];
    const parete = t.tipologia === "parete-mensola", pavimento = t.tipologia === "pavimento";
    if (parete) {
      const hTot = (n - 1) * dp + 300;
      linea("struttura", [0, 150], [0, -hTot]);
      add({ t: "tratteggio", ruolo: "struttura", a: [-60, -hTot], b: [0, 150] });
      if (n > 1) rett("profilato", [0, 80], [R, -(n - 1) * dp - 80]);
    } else {
      const yBase = 0, sgn = pavimento ? 1 : -1;
      linea("struttura", [-300, yBase], [Math.max(...mensole.map((m) => m.lunghezza), 300) + 300, yBase]);
      add({ t: "tratteggio", ruolo: "struttura", a: [-300, pavimento ? yBase - 60 : yBase], b: [Math.max(...mensole.map((m) => m.lunghezza), 300) + 300, pavimento ? yBase : yBase + 60] });
      rett("profilato", [0, yBase], [R, yBase + sgn * hM]);
      rett("struttura", [-40, yBase], [R + 40, yBase + sgn * 8]);
      quota([-120, yBase], [-120, yBase + sgn * hM], 0, fmt(hM));
      testo([-300, pavimento ? yBase - 110 : yBase + 90], pavimento ? "Pavimento" : "Soffitto", 36);
    }
    const x0 = parete && n === 1 ? 0 : R;
    mensole.forEach((m, i) => {
      const y = parete ? -i * dp : pavimento ? h1 + i * dp : -(h1 + i * dp);
      // mensola: piatto superiore e saetta
      rett("mensola", [x0, y - 30], [x0 + m.lunghezza, y]);
      linea("mensola", [x0, y - 30 - Math.min(120, m.lunghezza * 0.35)], [x0 + m.lunghezza * 0.6, y - 30]);
      const p = t.piani[i]!;
      passerella(x0 + 10 + p.larghezza / 2, y, p.larghezza, p.altezza, p.caricoCavi, i);
      testo([x0 + 5, y - 200], `${m.tipo} L ${m.lunghezza}`, 30);
      quota([x0, y - 30], [x0 + m.lunghezza, y - 30], -110, fmt(m.lunghezza));
    });
    if (n > 1) quota([x0 + Math.max(...mensole.map((m) => m.lunghezza)) + 380, parete ? 0 : pavimento ? h1 : -h1], [x0 + Math.max(...mensole.map((m) => m.lunghezza)) + 380, parete ? -dp : pavimento ? h1 + dp : -(h1 + dp)], 0, fmt(dp));
    if (!parete) quota([x0 + Math.max(...mensole.map((m) => m.lunghezza)) + 280, 0], [x0 + Math.max(...mensole.map((m) => m.lunghezza)) + 280, pavimento ? h1 : -h1], 0, fmt(h1));
  }
  // ingombro
  const pts: Pt[] = [];
  for (const e of el) { if (e.p) pts.push(...e.p); if (e.a) pts.push(e.a); if (e.b) pts.push(e.b); }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { elementi: el, min: [Math.min(...xs) - 150, Math.min(...ys) - 200], max: [Math.max(...xs) + 900, Math.max(...ys) + 150] };
}
