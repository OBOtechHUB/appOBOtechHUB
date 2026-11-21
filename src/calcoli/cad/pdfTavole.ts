/**
 * PDF vettoriale delle tavole LPS: una pagina per tavola, nel formato del foglio (A3…A0), disegnata dagli stessi
 * elementi scritti nel DXF (linee, polilinee, cerchi, archi, testi, campiture e blocchi con attributi).
 * Colori e spessori come una tabella di stampa CTB; tipi linea tratteggiati. Testi in Helvetica.
 * Logica pura (nessuna libreria), il risultato è un Uint8Array da salvare come .pdf.
 */
import { testoDxf, type Disegnato, type P2, type ScrittoreDXF } from "./dxf12";
import { TIPI_LINEA, type LayerLps, type Primitiva } from "./standard";
import type { Foglio } from "./tavoleLPS";

const MM = 72 / 25.4;
/** Colore di stampa e spessore (mm) per indice colore AutoCAD. */
export function penna(aci: number): { rgb: [number, number, number]; mm: number } {
  const t: Record<number, { rgb: [number, number, number]; mm: number }> = {
    1: { rgb: [0.85, 0, 0], mm: 0.5 }, 2: { rgb: [0.75, 0.6, 0], mm: 0.25 }, 3: { rgb: [0, 0.55, 0.15], mm: 0.35 }, 4: { rgb: [0, 0.55, 0.65], mm: 0.25 },
    5: { rgb: [0, 0.25, 0.8], mm: 0.25 }, 6: { rgb: [0.7, 0, 0.7], mm: 0.35 }, 7: { rgb: [0, 0, 0], mm: 0.3 }, 8: { rgb: [0.45, 0.45, 0.45], mm: 0.25 },
    9: { rgb: [0.62, 0.62, 0.62], mm: 0.18 }, 30: { rgb: [0.95, 0.5, 0], mm: 0.4 }, 150: { rgb: [0.15, 0.35, 0.8], mm: 0.3 },
  };
  return t[aci] ?? { rgb: [0.2, 0.3, 0.7], mm: 0.25 };
}

/** Larghezza approssimata di un testo Helvetica in unità di altezza. */
function larghezza(s: string): number {
  let w = 0;
  for (const ch of s) w += ch === " " ? 0.278 : /[A-Z]/.test(ch) ? (/[MW]/.test(ch) ? 0.85 : /[IJ]/.test(ch) ? 0.3 : 0.68) : /[a-z]/.test(ch) ? (/[mw]/.test(ch) ? 0.8 : /[ijlft]/.test(ch) ? 0.28 : 0.53) : /[0-9]/.test(ch) ? 0.556 : 0.33;
  return w;
}
/** Testo per una stringa PDF in WinAnsi: simboli DXF ripristinati, caratteri speciali protetti. */
function strPdf(s: string): string {
  return testoDxf(s).replace(/%%d/gi, "°").replace(/%%c/gi, "Ø").replace(/%%p/gi, "±")
    .replace(/[\\()]/g, (c) => `\\${c}`).replace(/[\u0080-ÿ]/g, (c) => `\\${c.charCodeAt(0).toString(8).padStart(3, "0")}`);
}

export function pdfTavole(w: ScrittoreDXF, fogli: Foglio[], layer: LayerLps[], info: { titolo: string; autore?: string } = { titolo: "Tavole LPS" }): Uint8Array {
  const perLayer = new Map(layer.map((l) => [l.nome, l]));
  const pagine: { W: number; H: number; contenuto: string }[] = [];
  for (const f of fogli) {
    const [Wmm, Hmm] = f.formatoMm, k = f.scala / 1000;
    const X = (x: number) => ((x - f.x) / k) * MM, Y = (y: number) => ((y - f.y) / k) * MM;
    const dentroFoglio = (x: number, y: number, m = 0) => x >= f.x - m && x <= f.x + f.larghezza + m && y >= f.y - m && y <= f.y + f.altezza + m;
    const o: string[] = [`q 0 0 ${(Wmm * MM).toFixed(2)} ${(Hmm * MM).toFixed(2)} re W n 1 J 1 j`];
    let stato = "";
    const stile = (nomeLayer: string, riempi = false) => {
      const l = perLayer.get(nomeLayer), p = penna(l?.colore ?? 7);
      const tipo = l?.linea && l.linea !== "CONTINUOUS" ? TIPI_LINEA[l.linea]?.schema : undefined;
      const tratti = tipo ? tipo.map((v) => Math.max(0.15, Math.abs(v) * 10) * MM) : [];
      const s = `${p.rgb.map((c) => c.toFixed(3)).join(" ")} RG ${p.rgb.map((c) => c.toFixed(3)).join(" ")} rg ${(p.mm * MM).toFixed(2)} w [${riempi ? "" : tratti.map((v) => v.toFixed(2)).join(" ")}] 0 d`;
      if (s !== stato) { o.push(s); stato = s; }
    };
    const percorso = (pts: P2[], chiusa: boolean) => {
      if (pts.length < 2) return "";
      return pts.map((p, i) => `${X(p[0]).toFixed(2)} ${Y(p[1]).toFixed(2)} ${i ? "l" : "m"}`).join(" ") + (chiusa ? " h" : "");
    };
    const cerchio = (c: P2, r: number, da = 0, a = 360): P2[] => {
      let fine = a; while (fine <= da) fine += 360;
      const n = Math.max(12, Math.min(96, Math.ceil(((fine - da) / 360) * 64)));
      return Array.from({ length: n + 1 }, (_, i) => { const t = ((da + ((fine - da) * i) / n) * Math.PI) / 180; return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)] as P2; });
    };
    const testo = (nomeLayer: string, p: P2, h: number, s: string, all: string, rot: number) => {
      const t = testoDxf(s); if (!t.trim()) return;
      const hp = (h / k) * MM, lar = larghezza(t.replace(/%%./g, "o")) * hp;
      const dx = all.startsWith("centro") ? -lar / 2 : all === "destra" ? -lar : 0, dy = all.endsWith("medio") ? -hp * 0.36 : 0;
      const r = (rot * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
      const x = X(p[0]) + dx * c - dy * sn, y = Y(p[1]) + dx * sn + dy * c;
      stile(nomeLayer, true);
      o.push(`BT /F1 ${hp.toFixed(2)} Tf ${c.toFixed(4)} ${sn.toFixed(4)} ${(-sn).toFixed(4)} ${c.toFixed(4)} ${x.toFixed(2)} ${y.toFixed(2)} Tm (${strPdf(t)}) Tj ET`);
    };
    const disegna = (e: Disegnato) => {
      if (e.t === "linea") { if (!dentroFoglio(e.a[0], e.a[1]) && !dentroFoglio(e.b[0], e.b[1])) return; stile(e.layer); o.push(`${percorso([e.a, e.b], false)} S`); }
      else if (e.t === "poli") { if (!e.p.some((q) => dentroFoglio(q[0], q[1]))) return; stile(e.layer); o.push(`${percorso(e.p, e.chiusa)} S`); }
      else if (e.t === "cerchio") { if (!dentroFoglio(e.c[0], e.c[1], e.r)) return; stile(e.layer); o.push(`${percorso(cerchio(e.c, e.r), true)} S`); }
      else if (e.t === "arco") { if (!dentroFoglio(e.c[0], e.c[1], e.r)) return; stile(e.layer); o.push(`${percorso(cerchio(e.c, e.r, e.da, e.a), false)} S`); }
      else if (e.t === "pieno") { if (!e.p.some((q) => dentroFoglio(q[0], q[1]))) return; stile(e.layer, true); o.push(`${percorso(e.p, true)} f`); }
      else if (e.t === "testo") { if (!dentroFoglio(e.p[0], e.p[1])) return; testo(e.layer, e.p, e.h, e.s, e.all, e.rot); }
      else if (e.t === "insert") {
        if (!dentroFoglio(e.p[0], e.p[1])) return;
        const def = w.definizioni.get(e.nome); if (!def) return;
        const r = (e.rot * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
        const T = (q: [number, number]): P2 => [e.p[0] + (q[0] * c - q[1] * sn) * e.scala, e.p[1] + (q[0] * sn + q[1] * c) * e.scala];
        for (const pr of def.primitive as Primitiva[]) {
          if (pr.t === "linea") { stile(e.layer); o.push(`${percorso([T(pr.a), T(pr.b)], false)} S`); }
          else if (pr.t === "poli") { stile(e.layer); o.push(`${percorso(pr.p.map(T), pr.chiusa)} S`); }
          else if (pr.t === "cerchio") { stile(e.layer); o.push(`${percorso(cerchio(T(pr.c), pr.r * e.scala), true)} S`); }
          else { stile(e.layer, true); o.push(`${percorso(pr.p.map(T), true)} f`); }
        }
        for (const a of e.attributi) if (a.visibile && a.valore) testo(e.layer, T(a.pos ?? [0, 0]), (a.altezza ?? 0.25) * e.scala, a.valore, "centro-medio", e.rot);
      }
    };
    // le linee continue sottili prima, i testi alla fine
    const ordine = [...w.disegnati].sort((a, b) => (a.t === "testo" ? 1 : 0) - (b.t === "testo" ? 1 : 0));
    ordine.forEach(disegna);
    o.push("Q");
    pagine.push({ W: Wmm * MM, H: Hmm * MM, contenuto: o.join("\n") });
  }
  // ---------- struttura del file
  const ogg: string[] = [];
  const nPag = pagine.length, idFont = 3, primoPag = 4;
  ogg[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  ogg[2] = `<< /Type /Pages /Count ${nPag} /Kids [${pagine.map((_, i) => `${primoPag + i * 2} 0 R`).join(" ")}] >>`;
  ogg[idFont] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  pagine.forEach((p, i) => {
    const id = primoPag + i * 2;
    ogg[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.W.toFixed(2)} ${p.H.toFixed(2)}] /Resources << /Font << /F1 ${idFont} 0 R >> >> /Contents ${id + 1} 0 R >>`;
    ogg[id + 1] = `<< /Length ${p.contenuto.length} >>\nstream\n${p.contenuto}\nendstream`;
  });
  const idInfo = ogg.length;
  const data = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  ogg[idInfo] = `<< /Title (${strPdf(info.titolo)}) /Author (${strPdf(info.autore ?? "Progettazione LPS - OBO Italia")}) /Creator (Progettazione LPS) /CreationDate (D:${data}) >>`;
  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offset: number[] = [];
  for (let i = 1; i < ogg.length; i++) { offset[i] = pdf.length; pdf += `${i} 0 obj\n${ogg[i]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${ogg.length}\n0000000000 65535 f \n${offset.slice(1).map((v) => `${String(v).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${ogg.length} /Root 1 0 R /Info ${idInfo} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // tutto il testo è latin-1: un byte per carattere
  const out = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) out[i] = pdf.charCodeAt(i) & 0xff;
  return out;
}
