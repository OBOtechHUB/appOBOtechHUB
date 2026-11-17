import { describe, expect, it } from "vitest";
import DxfParser from "dxf-parser";
import { generaTavola, ordinaCalate, codiciRichiamo, type DatiTavola } from "./tavolaDXF";
import { LAYER_LPS, nomeBlocco, scegliTavola } from "./standard";
import { testoDxf } from "./dxf12";

/** Controllo strutturale di un DXF R12: coppie codice/valore, sezioni, blocchi, polilinee, attributi, layer e blocchi definiti. */
export function controllaDxf(testo: string): string[] {
  const righe = testo.split(/\r\n/); if (righe.at(-1) === "") righe.pop();
  const err: string[] = [];
  if (righe.length % 2) err.push("numero di righe dispari");
  const c: [number, string][] = [];
  for (let i = 0; i + 1 < righe.length; i += 2) { const k = Number(righe[i]); if (!Number.isInteger(k)) err.push(`codice non numerico alla riga ${i + 1}`); c.push([k, righe[i + 1] ?? ""]); }
  const layerDef = new Set<string>(), bloccoDef = new Set<string>(), layerUso = new Set<string>(), bloccoUso = new Set<string>();
  let sez = "", inTab = "";
  for (let i = 0; i < c.length; i++) {
    const [k, v] = c[i]!;
    if (k === 0 && v === "SECTION") sez = c[i + 1]?.[1] ?? "";
    if (k === 0 && v === "TABLE") inTab = c[i + 1]?.[1] ?? "";
    if (k === 0 && v === "LAYER" && inTab === "LAYER") layerDef.add(c[i + 1]?.[1] ?? "");
    if (k === 0 && v === "BLOCK") { let j = i + 1; while (j < c.length && c[j]![0] !== 0) { if (c[j]![0] === 2) bloccoDef.add(c[j]![1]); j++; } }
    if (k === 8 && sez === "ENTITIES") layerUso.add(v);
    if (k === 0 && v === "INSERT") { let j = i + 1, attr = false; while (j < c.length && c[j]![0] !== 0) { if (c[j]![0] === 2) bloccoUso.add(c[j]![1]); if (c[j]![0] === 66 && c[j]![1] === "1") attr = true; j++; }
      if (attr) { while (j < c.length && c[j]![1] === "ATTRIB") { j++; while (j < c.length && c[j]![0] !== 0) j++; } if (c[j]?.[1] !== "SEQEND") err.push(`INSERT senza SEQEND (${i})`); } }
    if (k === 0 && v === "POLYLINE") { let j = i + 1; while (j < c.length && c[j]![0] !== 0) j++; let nv = 0; while (j < c.length && c[j]![1] === "VERTEX") { nv++; j++; while (j < c.length && c[j]![0] !== 0) j++; } if (c[j]?.[1] !== "SEQEND") err.push(`POLYLINE senza SEQEND (${i})`); if (nv < 2) err.push(`POLYLINE con ${nv} vertici`); }
  }
  const apre = (x: string) => c.filter(([k, v]) => k === 0 && v === x).length;
  if (apre("SECTION") !== apre("ENDSEC")) err.push("sezioni non chiuse");
  if (apre("BLOCK") !== apre("ENDBLK")) err.push("blocchi non chiusi");
  if (c.at(-1)?.[1] !== "EOF") err.push("manca EOF");
  layerUso.forEach((l) => { if (l !== "0" && !layerDef.has(l)) err.push(`layer non definito: ${l}`); });
  bloccoUso.forEach((b) => { if (!bloccoDef.has(b)) err.push(`blocco non definito: ${b}`); });
  return err;
}

const esempio = (): DatiTavola => ({
  progetto: { codice: "P-001", nome: "Capannone Rossi", comune: "Città di Castello", lpl: "III", data: "17/11/2026" },
  corpi: [{ nome: "Capannone", impronta: [[0, 0], [40, 0], [40, 20], [0, 20]], quotaBase: 0, altezzaGronda: 9, tipoTetto: "falde", altezzaColmo: 11 }],
  aste: [{ x: 20, y: 10, z: 11, altezza: 1.5, codiceOBO: "5401500" }],
  conduttori: [
    { tipo: "captazione", punti: [[0, 0, 9], [40, 0, 9], [40, 20, 9], [0, 20, 9], [0, 0, 9]], materiale: "Alluminio", sezione: "50" },
    ...[[0, 0], [40, 0], [40, 20], [0, 20]].map(([x, y]) => ({ tipo: "calata", punti: [[x!, y!, 9], [x!, y!, 0]] as [number, number, number][], materiale: "Alluminio", sezione: "50" })),
    { tipo: "terra", sottotipo: "anello", punti: [[-1, -1, -0.5], [41, -1, -0.5], [41, 21, -0.5], [-1, 21, -0.5], [-1, -1, -0.5]], materiale: "Acciaio zincato", sezione: "90" },
  ],
  supporti: Array.from({ length: 40 }, (_, i) => ({ x: i, y: 0, z: 9, codiceOBO: "5218700" })),
  morsetti: [{ x: 0, y: 0, z: 9, codiceOBO: "5311600" }],
  compensatori: [{ x: 20, y: 0, z: 9 }],
  picchetti: [{ x: -1, y: -1, z: -0.5, lunghezza: 1.5, codiceOBO: "5000014" }],
  distinta: [{ codice: "5218700", descrizione: "Supporto per tetti piani, con calcestruzzo", quantita: 40, unita: "pz" }, { codice: "5401500", descrizione: "Asta di captazione 1500 mm", quantita: 1, unita: "pz" }],
  particolari: { marcatori: [{ idParticolare: "TBS-01", nome: "Supporto su tetto piano", x: 0, y: 0 }, { idParticolare: "TBS-01", nome: "Supporto su tetto piano", x: 39, y: 0 }, { idParticolare: "TBS-07", nome: "Dispersore a picchetto", x: -1, y: -1 }], usati: [{ idParticolare: "TBS-01", nome: "Supporto su tetto piano", punti: 40 }, { idParticolare: "TBS-07", nome: "Dispersore a picchetto", punti: 1 }] },
  nordInAlto: true,
});

describe("tavola DXF professionale", () => {
  it("produce un DXF R12 strutturalmente valido e leggibile", () => {
    const r = generaTavola(esempio());
    const testo = r.dxf.finale();
    expect(controllaDxf(testo)).toEqual([]);
    const p = new DxfParser().parseSync(testo);
    expect(p?.header?.["$ACADVER"]).toBe("AC1009");
    const layer = Object.keys(p?.tables?.layer?.layers ?? {});
    for (const l of ["LPS-EDIF-CONT", "LPS-CAPT-COND", "LPS-CALA", "LPS-TERR-ANEL", "LPS-SUPP", "LPS-PART", "LPS-CART", "LPS-LEGE"]) expect(layer).toContain(l);
  });

  it("usa blocchi con il codice OBO e attributi CODICE/DESCRIZIONE", () => {
    const testo = generaTavola(esempio()).dxf.finale();
    const p = new DxfParser().parseSync(testo);
    expect(p?.blocks?.["OBO_5218700"]).toBeTruthy();
    expect(p?.blocks?.["OBO_5401500"]).toBeTruthy();
    expect(p?.blocks?.["LPS_COMPENSATORE"]).toBeTruthy(); // senza codice
    const supporti = (p?.entities ?? []).filter((e) => e.type === "INSERT" && (e as unknown as { name: string }).name === "OBO_5218700" && e.layer === LAYER_LPS.supporti.nome);
    expect(supporti).toHaveLength(40);
    expect(testo).toContain("Supporto per tetti piani, con calcestruzzo");
  });

  it("numera calate e richiami, mette cartiglio e scala", () => {
    const r = generaTavola(esempio());
    const testo = r.dxf.finale();
    for (const t of ["C1", "C2", "C3", "C4", "P01", "P02", "PIANTA COPERTURE", "Capannone Rossi", "LPL III", `1:${r.scala}`]) expect(testo).toContain(t);
    expect(testo).toContain("Citta' di Castello");
    expect(r.scala).toBe(100);
    expect(r.formato).toBe("A1");
  });

  it("sceglie formato e scala adatti", () => {
    expect(scegliTavola(40, 20)).toMatchObject({ scala: 100, formato: { nome: "A1" } });
    expect(scegliTavola(10, 8).scala).toBe(100);
    expect(scegliTavola(300, 150).scala).toBeGreaterThanOrEqual(500);
  });

  it("ordina le calate in senso orario e numera i particolari", () => {
    const ordine = ordinaCalate([[0, 0], [40, 0], [40, 20], [0, 20]], [20, 10]);
    expect(ordine[0]).toBe(3); // nord-ovest per prima
    expect(ordine).toEqual([3, 2, 1, 0]);
    expect([...codiciRichiamo([{ idParticolare: "a" }, { idParticolare: "b" }]).values()]).toEqual(["P01", "P02"]);
    expect(nomeBlocco("supporto", "52 187-00")).toBe("OBO_5218700");
    expect(testoDxf("Città · 20°")).toBe("Citta' ? 20%%d");
  });
});
