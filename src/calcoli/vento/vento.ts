/**
 * Azione del vento sulle aste di captazione e zavorra con blocchi FangFix da 16 kg.
 * - Velocità e pressione del vento: NTC 2018 §3.3 (stessi parametri dell'Annesso Nazionale italiano alla EN 1991-1-4):
 *   zona 1–9 (vb,0, a0, ks), correzione con l'altitudine, qb = ½·ρ·vb², ce(z) per categoria di esposizione I–V,
 *   periodo di ritorno 50 anni (cr = 1), ct = 1.
 * - Forza sull'asta: EN 1991-1-4 §5.3 e §7.9 – F = cs·cd · cf · qp(z) · Aref, cilindro con cf,0 = 1,2
 *   (Re < 2·10⁵, a favore di sicurezza per tubi lisci) e ψλ dalla snellezza (Tab. 7.16, Fig. 7.36 con φ = 1); cs·cd = 1.
 * - Equilibrio (EN 1990 EQU / NTC 2.6.1): vento × 1,5, pesi favorevoli × 0,9; ribaltamento attorno alla retta tra due piedi
 *   e scorrimento con attrito μ.
 * Calcolo di predimensionamento: il numero definitivo dei blocchi lo conferma lo strutturista (istruzioni OBO §3.6).
 */
import aste from "@/dati/vento/aste.json";
import blocchiTreppiede from "@/dati/captazione/blocchiTreppiede.json";

export const RHO = 1.25; // kg/m³
export const G = 9.81;
export const MASSA_BLOCCO = aste.blocco.massa; // 16 kg

export interface Zona { zona: number; vb0: number; a0: number; ks: number; descrizione: string }
/** NTC 2018 Tab. 3.3.I */
export const ZONE: Zona[] = [
  { zona: 1, vb0: 25, a0: 1000, ks: 0.4, descrizione: "Valle d'Aosta, Piemonte, Lombardia, Trentino-Alto Adige, Veneto, Friuli Venezia Giulia (esclusa la provincia di Trieste)" },
  { zona: 2, vb0: 25, a0: 750, ks: 0.45, descrizione: "Emilia-Romagna" },
  { zona: 3, vb0: 27, a0: 500, ks: 0.37, descrizione: "Toscana, Marche, Umbria, Lazio, Abruzzo, Molise, Puglia, Campania, Basilicata, Calabria (esclusa la provincia di Reggio Calabria)" },
  { zona: 4, vb0: 28, a0: 500, ks: 0.36, descrizione: "Sicilia e provincia di Reggio Calabria" },
  { zona: 5, vb0: 28, a0: 750, ks: 0.4, descrizione: "Sardegna (a oriente della retta Capo Teulada – Isola di Maddalena)" },
  { zona: 6, vb0: 28, a0: 500, ks: 0.36, descrizione: "Sardegna (a occidente della retta Capo Teulada – Isola di Maddalena)" },
  { zona: 7, vb0: 28, a0: 1000, ks: 0.54, descrizione: "Liguria" },
  { zona: 8, vb0: 30, a0: 1500, ks: 0.5, descrizione: "Provincia di Trieste" },
  { zona: 9, vb0: 31, a0: 500, ks: 0.32, descrizione: "Isole (escluse Sicilia e Sardegna) e mare aperto" },
];

export interface Categoria { cat: "I" | "II" | "III" | "IV" | "V"; kr: number; z0: number; zmin: number; descrizione: string }
/** NTC 2018 Tab. 3.3.II */
export const CATEGORIE: Categoria[] = [
  { cat: "I", kr: 0.17, z0: 0.01, zmin: 2, descrizione: "Mare aperto o costa a meno di 2 km" },
  { cat: "II", kr: 0.19, z0: 0.05, zmin: 4, descrizione: "Aperta campagna, pochi ostacoli; costa fino a 10 km" },
  { cat: "III", kr: 0.2, z0: 0.1, zmin: 5, descrizione: "Zone suburbane o rurali con ostacoli sparsi" },
  { cat: "IV", kr: 0.22, z0: 0.3, zmin: 8, descrizione: "Aree urbane, almeno il 15 % coperto da edifici alti più di 15 m" },
  { cat: "V", kr: 0.23, z0: 0.7, zmin: 12, descrizione: "Centri di grandi città con edifici alti" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
/** Lato della retta Capo Teulada (38,87 N, 8,64 E) – Isola di Maddalena (41,22 N, 9,40 E): true = a oriente. */
export function sardegnaEst(lat: number, lon: number): boolean {
  const [la1, lo1, la2, lo2] = [38.87, 8.64, 41.22, 9.4];
  return (lo2 - lo1) * (lat - la1) - (la2 - la1) * (lon - lo1) < 0;
}
/** Zona di vento da regione e provincia (nomi come in OpenStreetMap o scritti a mano). */
export function zonaDa(regione: string, provincia = "", lat?: number, lon?: number): number | null {
  const r = norm(regione), p = norm(provincia);
  if (!r) return null;
  if (r.includes("trieste") || p.includes("trieste")) return 8;
  if (r.includes("friuli")) return 1;
  if (["valledaosta", "valleedaoste", "vallee", "piemonte", "lombardia", "trentino", "altoadige", "sudtirol", "veneto"].some((x) => r.includes(x))) return 1;
  if (r.includes("emilia")) return 2;
  if (r.includes("liguria")) return 7;
  if (r.includes("sicilia")) return 4;
  if (r.includes("calabria")) return p.includes("reggio") ? 4 : 3;
  if (r.includes("sardegna") || r.includes("sardigna")) return lat != null && lon != null ? (sardegnaEst(lat, lon) ? 5 : 6) : 5;
  if (["toscana", "marche", "umbria", "lazio", "abruzzo", "molise", "puglia", "campania", "basilicata"].some((x) => r.includes(x))) return 3;
  return null;
}

export interface Parametri {
  zona: number; altitudine: number; categoria: Categoria["cat"];
  /** quota della base dell'asta dal suolo (es. altezza del tetto), m */ quotaBase: number;
  /** attrito blocchi–appoggio per lo scorrimento */ mu: number;
  gammaQ: number; gammaG: number;
}
export const PARAMETRI_BASE: Parametri = { zona: 1, altitudine: 200, categoria: "III", quotaBase: 0, mu: 0.4, gammaQ: 1.5, gammaG: 0.9 };

/** Velocità di riferimento vb (m/s), NTC 2018 eq. 3.3.1. */
export function velocitaBase(zona: number, altitudine: number): { vb: number; ca: number; z: Zona } {
  const z = ZONE.find((x) => x.zona === zona) ?? ZONE[0]!;
  const as = Math.max(0, altitudine);
  const ca = as <= z.a0 ? 1 : 1 + z.ks * (Math.min(as, 1500) / z.a0 - 1);
  return { vb: z.vb0 * ca, ca, z };
}
export const pressioneBase = (vb: number) => 0.5 * RHO * vb * vb; // Pa
/** Coefficiente di esposizione ce(z), NTC 2018 eq. 3.3.7 (ct = 1). */
export function ce(z: number, cat: Categoria["cat"]): number {
  const c = CATEGORIE.find((x) => x.cat === cat) ?? CATEGORIE[2]!;
  const zz = Math.max(z, c.zmin), l = Math.log(zz / c.z0);
  return c.kr * c.kr * l * (7 + l);
}
/** Pressione cinetica di picco qp(z) in Pa. */
export function pressionePicco(z: number, p: Parametri): number {
  return pressioneBase(velocitaBase(p.zona, p.altitudine).vb) * ce(z, p.categoria);
}
/** Velocità di picco equivalente (km/h) a una quota: quella da confrontare con le tabelle OBO. */
export const velocitaPiccoKmh = (z: number, p: Parametri) => Math.sqrt((2 * pressionePicco(z, p)) / RHO) * 3.6;

/** ψλ per cilindro con estremità libera (EN 1991-1-4 Tab. 7.16 e Fig. 7.36, φ = 1). */
export function psiLambda(l: number, b: number): number {
  const r = l / b;
  const lam = l < 15 ? Math.min(r, 70) : l >= 50 ? Math.min(0.7 * r, 70) : Math.min(r * (1 - (0.3 * (l - 15)) / 35), 70);
  const P: [number, number][] = [[1, 0.6], [2, 0.62], [5, 0.66], [10, 0.7], [20, 0.75], [50, 0.84], [70, 0.88], [100, 0.91], [200, 0.97]];
  const x = Math.log10(Math.max(1, lam));
  for (let i = 1; i < P.length; i++) {
    const [l0, y0] = P[i - 1]!, [l1, y1] = P[i]!;
    if (lam <= l1) return y0 + ((y1 - y0) * (x - Math.log10(l0))) / (Math.log10(l1) - Math.log10(l0));
  }
  return 0.97;
}
export const CF0 = 1.2;

export interface Tronco { nome: string; d: number; l: number; stima?: boolean }
export interface AzioneAsta { F: number; M: number; zF: number; cf: number; psi: number; perTronco: { nome: string; d: number; da: number; a: number; f: number; F: number }[] }
/**
 * Forza del vento su un'asta verticale di tronchi (dall'alto verso il basso), con le lunghezze riportate
 * all'altezza visibile `altezza` (i tronchi telescopici si sovrappongono). Momento rispetto alla base (kN·m).
 */
export function azioneAsta(tronchi: Tronco[], altezza: number, p: Parametri): AzioneAsta {
  const somma = tronchi.reduce((s, t) => s + t.l, 0) || 1, k = altezza / somma;
  const dMedio = tronchi.reduce((s, t) => s + (t.d / 1000) * t.l, 0) / somma;
  const psi = psiLambda(altezza, dMedio), cf = CF0 * psi;
  let F = 0, M = 0, z = 0;
  const perTronco: AzioneAsta["perTronco"] = [];
  for (const t of [...tronchi].reverse()) { // dal basso
    const da = z, a = z + t.l * k, passi = Math.max(4, Math.ceil((a - da) / 0.1));
    let Ft = 0;
    for (let i = 0; i < passi; i++) {
      const zi = da + ((i + 0.5) * (a - da)) / passi, dz = (a - da) / passi;
      const f = cf * pressionePicco(p.quotaBase + zi, p) * (t.d / 1000); // N/m
      Ft += f * dz; M += f * dz * zi;
    }
    F += Ft;
    perTronco.push({ nome: t.nome, d: t.d, da, a, f: cf * pressionePicco(p.quotaBase + (da + a) / 2, p) * (t.d / 1000), F: Ft });
    z = a;
  }
  return { F: F / 1000, M: M / 1000, zF: F ? M / F : 0, cf, psi, perTronco: perTronco.reverse() };
}

// ---------------------------------------------------------------- sostegni a gambe (irod) con blocchi
export type Sostegno = (typeof aste.sostegni)[number];
export interface EsitoSostegno {
  id: string; nome: string; codice: string; altezza: number; azione: AzioneAsta;
  basi: number; perBase: number | null; totali: number | null; zavorra: number | null;
  braccio: number; ribaltamento: { sollecitante: number; resistente: number } | null; scorrimento: { sollecitante: number; resistente: number } | null;
  governa: "ribaltamento" | "scorrimento" | null; esito: "ok" | "oltre"; stima: boolean; note: string[];
}
export function zavorraSostegno(s: Sostegno, p: Parametri): EsitoSostegno {
  const az = azioneAsta(s.tronchi as Tronco[], s.altezza, p);
  const R = Math.min(...s.ingombro) / 2, braccio = R * Math.cos(Math.PI / s.gambe);
  const leve = ("leveBasi" in s ? (s.leveBasi as number[]) : null) ?? s.basi.map(() => 1);
  const Msd = p.gammaQ * az.M, Hsd = p.gammaQ * az.F; // kN·m, kN
  const note: string[] = [];
  let scelta: EsitoSostegno | null = null;
  for (let i = 0; i < s.basi.length; i++) {
    const nb = s.basi[i]!, leva = leve[i] ?? 1;
    for (let k = 1; k <= s.bloccoMaxPerBase; k++) {
      const mb = nb * k * MASSA_BLOCCO;
      const Mrd = (p.gammaG * G * (s.massa * braccio + mb * braccio * leva)) / 1000;
      const Hrd = (p.mu * p.gammaG * G * (s.massa + mb)) / 1000;
      if (Mrd >= Msd && Hrd >= Hsd) {
        scelta = { id: s.id, nome: s.nome, codice: s.codice, altezza: s.altezza, azione: az, basi: nb, perBase: k, totali: nb * k, zavorra: mb, braccio,
          ribaltamento: { sollecitante: Msd, resistente: Mrd }, scorrimento: { sollecitante: Hsd, resistente: Hrd },
          governa: Msd / Mrd >= Hsd / Hrd ? "ribaltamento" : "scorrimento", esito: "ok", stima: s.tronchi.some((t) => "stima" in t && t.stima), note };
        break;
      }
    }
    if (scelta) break;
  }
  if (!scelta) {
    const nb = s.basi.at(-1)!, leva = leve.at(-1) ?? 1, mb = nb * s.bloccoMaxPerBase * MASSA_BLOCCO;
    note.push("Anche con il massimo dei blocchi la verifica non è soddisfatta: serve un calcolo dello strutturista (zavorre maggiori o ancoraggio).");
    scelta = { id: s.id, nome: s.nome, codice: s.codice, altezza: s.altezza, azione: az, basi: nb, perBase: null, totali: null, zavorra: null, braccio,
      ribaltamento: { sollecitante: Msd, resistente: (p.gammaG * G * (s.massa * braccio + mb * braccio * leva)) / 1000 },
      scorrimento: { sollecitante: Hsd, resistente: (p.mu * p.gammaG * G * (s.massa + mb)) / 1000 }, governa: null, esito: "oltre", stima: s.tronchi.some((t) => "stima" in t && t.stima), note };
  }
  if (scelta.stima) note.push("Alcuni diametri non sono nelle istruzioni OBO e sono stimati: verificarli prima dell'uso.");
  if (s.posa === "Terreno" && p.quotaBase > 0) note.push("Secondo le istruzioni OBO questo sistema va posato a terra, non sul tetto.");
  return scelta;
}

// ---------------------------------------------------------------- aste isFang su treppiede: tabelle del catalogo OBO
export interface EsitoTabella { tabella: string; altezza: number; materiale?: string | undefined; asta: string; sostegno: string; vento: number; colonna: number | null; blocchi: number | null; zavorra: number | null; ventoMax: number }
export function zavorraTabelle(p: Parametri): EsitoTabella[] {
  const out: EsitoTabella[] = [];
  for (const tb of blocchiTreppiede.tabelle) for (const c of tb.colonne as { altezza: number; materiale?: string; asta: string; sostegno: string; vento: number[] }[]) {
    const v = velocitaPiccoKmh(p.quotaBase + c.altezza, p);
    const k = c.vento.findIndex((x) => x >= v);
    const n = k >= 0 ? Number(blocchiTreppiede.blocchi[k]!.split(" x ")[0]) : null;
    out.push({ tabella: tb.titolo, altezza: c.altezza, materiale: c.materiale, asta: c.asta, sostegno: c.sostegno, vento: v, colonna: k >= 0 ? k : null, blocchi: n, zavorra: n == null ? null : n * MASSA_BLOCCO, ventoMax: c.vento.at(-1)! });
  }
  return out;
}

// ---------------------------------------------------------------- aste a parete con due supporti
export const MATERIALI = { AL: { nome: "Alluminio", fd: 145 }, VA: { nome: "Acciaio inox V2A", fd: 200 }, FT: { nome: "Acciaio zincato a caldo", fd: 224 } } as const;
export type Materiale = keyof typeof MATERIALI;
export interface EsitoParete { id: string; nome: string; d: number; l: number; s: number; F: number; R1: number; R2: number; M: number; sigma: number; fd: number; sfruttamento: number; esito: "ok" | "no" }
/** Asta piena verticale con due supporti a parete: inferiore alla base, superiore a distanza s; vento su tutta l'asta. */
export function verificaParete(a: { id: string; nome: string; d: number; l: number }, s: number, materiale: Materiale, p: Parametri): EsitoParete {
  const passi = 200, dz = a.l / passi;
  let F = 0, Mbase = 0, Msup = 0;
  const psi = psiLambda(a.l, a.d / 1000), cf = CF0 * psi;
  for (let i = 0; i < passi; i++) {
    const z = (i + 0.5) * dz, f = cf * pressionePicco(p.quotaBase + z, p) * (a.d / 1000) * dz; // N
    F += f; Mbase += f * z; if (z > s) Msup += f * (z - s);
  }
  const R1 = s > 0 ? Mbase / s : Infinity, R2 = R1 - F;
  const W = (Math.PI * (a.d / 1000) ** 3) / 32; // m³
  const sigma = (p.gammaQ * Msup) / W / 1e6; // MPa
  const fd = MATERIALI[materiale].fd;
  return { id: a.id, nome: a.nome, d: a.d, l: a.l, s, F: F / 1000, R1: R1 / 1000, R2: R2 / 1000, M: Msup / 1000, sigma, fd, sfruttamento: sigma / fd, esito: sigma <= fd ? "ok" : "no" };
}

export const ASTE = aste;
/** Barre filettate isFang 3B per impilare i blocchi: G1…G4 per 1…4 blocchi (massimo installabile 4 per base). */
export const BARRE = aste.barre;
export const MAX_BLOCCHI_BASE = Math.max(...aste.barre.map((b) => b.blocchi));
export const barraPer = (blocchi: number | null | undefined) => (blocchi == null ? null : aste.barre.find((b) => b.blocchi >= blocchi) ?? null);
