/**
 * Esportazione IFC4 (STEP, ISO 10303-21) del modello LPS, da aprire in Revit, ArchiCAD, BIMcollab, Solibri, ecc.:
 * - corpi dell'edificio: solido estruso dall'impronta (quota base → gronda);
 * - aste di captazione: cilindri (diametro e altezza dal progetto);
 * - conduttori di captazione, calate e terra: tubo (IfcSweptDiskSolid) lungo la polilinea, Ø dalla sezione o 8 mm;
 * - picchetti di terra: cilindri verso il basso.
 * Tutti come IfcBuildingElementProxy con il tipo nel campo ObjectType e il set di proprietà "OBO_LPS" (codice OBO, tipo,
 * materiale, sezione, lunghezza). Coordinate del modello in metri (X, Y in pianta, Z in alto).
 */
import type { Asta, Conduttore, Corpo } from "@/calcoli/edificio/tipi";

export interface IngressoIFC {
  progetto: { codice?: string | undefined; nome?: string | undefined; comune?: string | undefined };
  corpi: Corpo[]; aste: Asta[]; conduttori: Conduttore[];
  picchetti?: { id: string; x: number; y: number; z: number; lunghezza: number; diametro?: number | undefined; codiceOBO?: string | undefined }[] | undefined;
  autore?: string | undefined; data?: Date | undefined;
}

const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
/** GlobalId IFC: 128 bit compressi in 22 caratteri. */
export function guidIfc(rnd: () => number = Math.random): string {
  const b = Array.from({ length: 16 }, () => Math.floor(rnd() * 256));
  const num = [b[0]!, ...[1, 4, 7, 10, 13].map((i) => (b[i]! << 16) | (b[i + 1]! << 8) | b[i + 2]!)];
  let s = "";
  num.forEach((v, k) => { const n = k === 0 ? 2 : 4; let t = ""; for (let j = 0; j < n; j++) { t = ALFABETO[v % 64] + t; v = Math.floor(v / 64); } s += t; });
  return s;
}
/** Testo IFC: apici raddoppiati, caratteri non ASCII come \X2\…\X0\. */
export function testoIfc(t: string | null | undefined): string {
  if (t == null) return "$";
  let o = "";
  for (const ch of String(t)) {
    const c = ch.codePointAt(0)!;
    if (ch === "'") o += "''"; else if (ch === "\\") o += "\\\\";
    else if (c >= 32 && c < 127) o += ch;
    else if (c <= 0xffff) o += `\\X2\\${c.toString(16).toUpperCase().padStart(4, "0")}\\X0\\`;
  }
  return `'${o}'`;
}
const r = (v: number) => { const x = Math.round(v * 1e6) / 1e6; const s = String(x === 0 ? 0 : x); return s.includes(".") || s.includes("e") ? s : s + "."; };
const diametroSezione = (sez: string) => { const m = /(\d+(?:[.,]\d+)?)/.exec(sez ?? ""); const v = m ? Number(m[1]!.replace(",", ".")) : NaN; return Number.isFinite(v) && v > 2 && v < 60 ? v / 1000 : 0.008; };

export function generaIFC(x: IngressoIFC): string {
  const righe: string[] = [];
  let id = 0;
  const e = (testo: string) => { righe.push(`#${++id}=${testo};`); return `#${id}`; };
  const data = x.data ?? new Date();
  const nomeP = [x.progetto.codice, x.progetto.nome].filter(Boolean).join(" · ") || "Progetto LPS";

  // contesto, unità, progetto
  const persona = e(`IFCPERSON($,${testoIfc(x.autore || "Progettazione LPS")},$,$,$,$,$,$)`);
  const org = e(`IFCORGANIZATION($,'OBO Bettermann Italia',$,$,$)`);
  const po = e(`IFCPERSONANDORGANIZATION(${persona},${org},$)`);
  const app = e(`IFCAPPLICATION(${org},'1','Progettazione LPS','ProgettazioneLPS')`);
  const storia = e(`IFCOWNERHISTORY(${po},${app},$,.ADDED.,$,$,$,${Math.floor(data.getTime() / 1000)})`);
  const origine = e("IFCCARTESIANPOINT((0.,0.,0.))");
  const asseZ = e("IFCDIRECTION((0.,0.,1.))"), asseX = e("IFCDIRECTION((1.,0.,0.))");
  const pos0 = e(`IFCAXIS2PLACEMENT3D(${origine},${asseZ},${asseX})`);
  const contesto = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${pos0},$)`);
  const corpoCtx = e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${contesto},$,.MODEL_VIEW.,$)`);
  const unita = [e("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)"), e("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)"), e("IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)"), e("IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)")];
  const ass = e(`IFCUNITASSIGNMENT((${unita.join(",")}))`);
  const progetto = e(`IFCPROJECT('${guidIfc()}',${storia},${testoIfc(nomeP)},${testoIfc("Impianto di protezione contro i fulmini (CEI EN IEC 62305)")},$,$,$,(${contesto}),${ass})`);
  const plSito = e(`IFCLOCALPLACEMENT($,${pos0})`);
  const sito = e(`IFCSITE('${guidIfc()}',${storia},${testoIfc(x.progetto.comune || "Sito")},$,$,${plSito},$,$,.ELEMENT.,$,$,$,$,$)`);
  const plEd = e(`IFCLOCALPLACEMENT(${plSito},${pos0})`);
  const edificio = e(`IFCBUILDING('${guidIfc()}',${storia},${testoIfc(x.progetto.nome || "Edificio")},$,$,${plEd},$,$,.ELEMENT.,$,$,$)`);
  const plPiano = e(`IFCLOCALPLACEMENT(${plEd},${pos0})`);
  const piano = e(`IFCBUILDINGSTOREY('${guidIfc()}',${storia},'LPS',$,$,${plPiano},$,$,.ELEMENT.,0.)`);
  e(`IFCRELAGGREGATES('${guidIfc()}',${storia},$,$,${progetto},(${sito}))`);
  e(`IFCRELAGGREGATES('${guidIfc()}',${storia},$,$,${sito},(${edificio}))`);
  e(`IFCRELAGGREGATES('${guidIfc()}',${storia},$,$,${edificio},(${piano}))`);

  const elementi: string[] = [];
  const punto = (p: [number, number, number]) => e(`IFCCARTESIANPOINT((${r(p[0])},${r(p[1])},${r(p[2])}))`);
  const punto2 = (p: [number, number]) => e(`IFCCARTESIANPOINT((${r(p[0])},${r(p[1])}))`);
  const piazza = (p: [number, number, number]) => e(`IFCLOCALPLACEMENT(${plPiano},${e(`IFCAXIS2PLACEMENT3D(${punto(p)},$,$)`)})`);
  const forma = (solido: string, tipo: "SweptSolid" | "AdvancedSweptSolid") => e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${e(`IFCSHAPEREPRESENTATION(${corpoCtx},'Body','${tipo}',(${solido}))`)}))`);
  const proprieta = (el: string, val: Record<string, string | number>) => {
    const ps = Object.entries(val).filter(([, v]) => v !== "" && v != null).map(([k, v]) =>
      e(`IFCPROPERTYSINGLEVALUE(${testoIfc(k)},$,${typeof v === "number" ? `IFCREAL(${r(v)})` : `IFCLABEL(${testoIfc(v)})`},$)`));
    if (!ps.length) return;
    const set = e(`IFCPROPERTYSET('${guidIfc()}',${storia},'OBO_LPS',$,(${ps.join(",")}))`);
    e(`IFCRELDEFINESBYPROPERTIES('${guidIfc()}',${storia},$,$,(${el}),${set})`);
  };
  const elemento = (nome: string, tipo: string, pl: string, sh: string, val: Record<string, string | number>) => {
    const el = e(`IFCBUILDINGELEMENTPROXY('${guidIfc()}',${storia},${testoIfc(nome)},$,${testoIfc(tipo)},${pl},${sh},$,.ELEMENT.)`);
    elementi.push(el); proprieta(el, { Tipo: tipo, ...val }); return el;
  };
  const cilindro = (rag: number, h: number, giu = false) => {
    const prof = e(`IFCCIRCLEPROFILEDEF(.AREA.,$,${e(`IFCAXIS2PLACEMENT2D(${punto2([0, 0])},$)`)},${r(rag)})`);
    return e(`IFCEXTRUDEDAREASOLID(${prof},${pos0},${giu ? e("IFCDIRECTION((0.,0.,-1.))") : asseZ},${r(h)})`);
  };

  // corpi dell'edificio
  x.corpi.forEach((c, i) => {
    const pts = c.impronta.length > 1 && c.impronta[0]![0] === c.impronta.at(-1)![0] && c.impronta[0]![1] === c.impronta.at(-1)![1] ? c.impronta.slice(0, -1) : c.impronta;
    const h = Math.max(0.01, c.altezzaGronda);
    const poli = e(`IFCPOLYLINE((${[...pts, pts[0]!].map((p) => punto2(p)).join(",")}))`);
    const prof = e(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${poli})`);
    const sol = e(`IFCEXTRUDEDAREASOLID(${prof},${pos0},${asseZ},${r(h)})`);
    elemento(c.nome || `Blocco ${i + 1}`, "Corpo edificio", piazza([0, 0, c.quotaBase]), forma(sol, "SweptSolid"), { Quota_base_m: c.quotaBase, Altezza_gronda_m: c.altezzaGronda, Copertura: c.tipoTetto });
  });
  // aste
  x.aste.forEach((a, i) => elemento(`Asta ${i + 1}${a.codiceOBO ? ` – ${a.codiceOBO}` : ""}`, "Asta di captazione", piazza([a.x, a.y, a.z]), forma(cilindro(Math.max(0.004, (a.diametro < 1 ? a.diametro : a.diametro / 1000) / 2), a.altezza), "SweptSolid"),
    { Codice_OBO: a.codiceOBO, Altezza_m: a.altezza, Diametro_mm: Math.round((a.diametro < 1 ? a.diametro * 1000 : a.diametro) * 10) / 10 }));
  // conduttori
  const NOME_COND: Record<string, string> = { captazione: "Conduttore di captazione", calata: "Calata", terra: "Conduttore di terra" };
  x.conduttori.forEach((c, i) => {
    if (c.punti.length < 2) return;
    let L = 0; for (let k = 1; k < c.punti.length; k++) { const p = c.punti[k - 1]!, q = c.punti[k]!; L += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); }
    if (L < 1e-6) return;
    const poli = e(`IFCPOLYLINE((${c.punti.map((p) => punto(p as [number, number, number])).join(",")}))`);
    const sol = e(`IFCSWEPTDISKSOLID(${poli},${r(diametroSezione(c.sezione) / 2)},$,$,$)`);
    const tipo = NOME_COND[c.tipo] ?? "Conduttore";
    elemento(`${tipo} ${i + 1}`, tipo, e(`IFCLOCALPLACEMENT(${plPiano},${pos0})`), forma(sol, "AdvancedSweptSolid"), { Codice_OBO: c.codiceOBO, Materiale: c.materiale, Sezione: c.sezione, Lunghezza_m: Math.round(L * 100) / 100 });
  });
  // picchetti
  (x.picchetti ?? []).forEach((p, i) => elemento(`Picchetto ${i + 1}`, "Picchetto di terra", piazza([p.x, p.y, p.z]), forma(cilindro((p.diametro ?? 0.02) / 2, p.lunghezza, true), "SweptSolid"), { Codice_OBO: p.codiceOBO ?? "", Lunghezza_m: p.lunghezza }));

  if (elementi.length) e(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guidIfc()}',${storia},$,$,(${elementi.join(",")}),${piano})`);

  const iso = data.toISOString().slice(0, 19);
  return ["ISO-10303-21;", "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');",
    `FILE_NAME(${testoIfc(nomeP + ".ifc")},'${iso}',(${testoIfc(x.autore || "")}),('OBO Bettermann Italia'),'Progettazione LPS','Progettazione LPS','');`,
    "FILE_SCHEMA(('IFC4'));", "ENDSEC;", "DATA;", ...righe, "ENDSEC;", "END-ISO-10303-21;", ""].join("\n");
}

// ---------------------------------------------------------------- importazione di un IFC di Progettazione LPS
type Val = string | number | null | Val[] | { ref: number } | { tipo: string; v: Val };
/** Legge gli argomenti di un'entità STEP: stringhe, numeri, riferimenti #n, liste, $ e *, enumerazioni, valori tipizzati. */
export function argomentiStep(s: string): Val[] {
  let i = 0;
  const testo = () => { let o = ""; i++; while (i < s.length) { if (s[i] === "'") { if (s[i + 1] === "'") { o += "'"; i += 2; continue; } i++; break; } o += s[i++]; } return o.replace(/\\X2\\([0-9A-F]+)\\X0\\/g, (_m, h: string) => h.match(/.{4}/g)!.map((c) => String.fromCharCode(parseInt(c, 16))).join("")).replace(/\\\\/g, "\\"); };
  const valore = (): Val => {
    while (s[i] === " ") i++;
    const c = s[i];
    if (c === "'") return testo();
    if (c === "(") { i++; const l: Val[] = []; while (s[i] !== ")" && i < s.length) { l.push(valore()); while (s[i] === " ") i++; if (s[i] === ",") i++; } i++; return l; }
    if (c === "#") { i++; let n = ""; while (/\d/.test(s[i] ?? "")) n += s[i++]; return { ref: Number(n) }; }
    if (c === "$" || c === "*") { i++; return null; }
    if (c === ".") { let n = "."; i++; while (s[i] !== "." && i < s.length) n += s[i++]; i++; return n + "."; }
    if (/[A-Z]/i.test(c ?? "")) { let n = ""; while (/[A-Z0-9_]/i.test(s[i] ?? "")) n += s[i++]; const a = s[i] === "(" ? (i++, valore()) : null; if (s[i] === ")") i++; return { tipo: n.toUpperCase(), v: a }; }
    let n = ""; while (/[-+0-9.Ee]/.test(s[i] ?? "")) n += s[i++]; return Number(n);
  };
  const out: Val[] = [];
  while (i < s.length) { out.push(valore()); while (s[i] === " ") i++; if (s[i] === ",") i++; else break; }
  return out;
}

export interface ModelloIfcLps {
  corpi: Corpo[]; aste: Asta[]; conduttori: Conduttore[];
  picchetti: { id: string; x: number; y: number; z: number; lunghezza: number; diametro?: number; codiceOBO: string }[];
}
/** È un IFC scritto da Progettazione LPS (proprietà OBO_LPS)? */
export const eIfcLps = (testo: string) => /IFCPROPERTYSET\('[^']*',[^,]*,'OBO_LPS'/.test(testo);

/** Ricostruisce corpi, aste, conduttori e picchetti da un IFC esportato da Progettazione LPS. */
export function leggiIfcLps(testo: string): ModelloIfcLps {
  const ent = new Map<number, { tipo: string; a: Val[] }>();
  const corpoDati = testo.split(/\nDATA;/)[1] ?? testo;
  for (const m of corpoDati.replace(/\r/g, "").replace(/;\s*\n/g, ";\n").matchAll(/#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\);\s*(?=\n#|\nENDSEC)/g))
    ent.set(Number(m[1]), { tipo: m[2]!, a: argomentiStep(m[3]!.replace(/\n/g, "")) });
  const get = (v: Val | undefined) => (v && typeof v === "object" && "ref" in v ? ent.get(v.ref) : undefined);
  const num = (v: Val | undefined) => (typeof v === "number" ? v : 0);
  const pt = (v: Val | undefined): number[] => { const e = get(v); return e?.tipo === "IFCCARTESIANPOINT" ? (e.a[0] as number[]).map(Number) : [0, 0, 0]; };
  const posizione = (pl: Val | undefined): [number, number, number] => {
    let x = 0, y = 0, z = 0, e = get(pl);
    for (let k = 0; e && e.tipo === "IFCLOCALPLACEMENT" && k < 20; k++) { const ax = get(e.a[1]); const p = pt(ax?.a[0]); x += p[0] ?? 0; y += p[1] ?? 0; z += p[2] ?? 0; e = get(e.a[0]); }
    return [x, y, z];
  };
  // proprietà OBO_LPS di ogni elemento
  const prop = new Map<number, Record<string, string | number>>();
  for (const e of ent.values()) if (e.tipo === "IFCRELDEFINESBYPROPERTIES") {
    const set = get(e.a[5]); if (!set || set.a[2] !== "OBO_LPS") continue;
    const val: Record<string, string | number> = {};
    for (const r of (set.a[4] as Val[]) ?? []) { const p = get(r); if (!p) continue; const v = p.a[2] as { tipo: string; v: Val } | null; if (p.a[0] && v) val[String(p.a[0])] = typeof v.v === "number" ? v.v : String(v.v ?? ""); }
    for (const el of (e.a[4] as Val[]) ?? []) if (el && typeof el === "object" && "ref" in el) prop.set(el.ref, val);
  }
  const solido = (rep: Val | undefined) => { const sh = get(rep); const r0 = get((sh?.a[2] as Val[] | undefined)?.[0]); return get((r0?.a[3] as Val[] | undefined)?.[0]); };
  const out: ModelloIfcLps = { corpi: [], aste: [], conduttori: [], picchetti: [] };
  const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  for (const [id, e] of ent) {
    if (e.tipo !== "IFCBUILDINGELEMENTPROXY") continue;
    const p = prop.get(id) ?? {}, tipo = String(p["Tipo"] ?? e.a[4] ?? ""), nome = String(e.a[2] ?? "");
    const [x, y, z] = posizione(e.a[5]), s = solido(e.a[6]);
    const codice = String(p["Codice_OBO"] ?? "");
    if (!s) continue;
    if (s.tipo === "IFCEXTRUDEDAREASOLID") {
      const prof = get(s.a[0]), h = num(s.a[3]);
      if (prof?.tipo === "IFCCIRCLEPROFILEDEF") {
        const d = 2 * num(prof.a[3]);
        if (/picchett/i.test(tipo)) out.picchetti.push({ id: uid(), x, y, z, lunghezza: h, diametro: d, codiceOBO: codice });
        else out.aste.push({ id: uid(), x, y, z, altezza: h, diametro: d, codiceOBO: codice, origine: "ifc" });
      } else if (prof?.tipo === "IFCARBITRARYCLOSEDPROFILEDEF") {
        const poli = get(prof.a[2]);
        const pts = ((poli?.a[0] as Val[]) ?? []).map((r) => pt(r)).map((q) => [q[0]! + x, q[1]! + y] as [number, number]);
        if (pts.length > 3 && pts[0]![0] === pts.at(-1)![0] && pts[0]![1] === pts.at(-1)![1]) pts.pop();
        if (pts.length >= 3) out.corpi.push({ id: uid(), nome: nome || "Corpo", impronta: pts, quotaBase: z, altezzaGronda: h, tipoTetto: String(p["Copertura"] ?? "piano") === "falde" ? "falde" : "piano", altezzaColmo: h } as Corpo);
      }
    } else if (s.tipo === "IFCSWEPTDISKSOLID") {
      const poli = get(s.a[0]);
      const punti = ((poli?.a[0] as Val[]) ?? []).map((r) => { const q = pt(r); return [q[0]! + x, q[1]! + y, (q[2] ?? 0) + z] as [number, number, number]; });
      if (punti.length < 2) continue;
      const t = /calat/i.test(tipo) ? "calata" : /terra/i.test(tipo) ? "terra" : "captazione";
      out.conduttori.push({ id: uid(), tipo: t, punti, materiale: String(p["Materiale"] ?? ""), sezione: String(p["Sezione"] ?? ""), codiceOBO: codice, origine: "ifc" });
    }
  }
  return out;
}
