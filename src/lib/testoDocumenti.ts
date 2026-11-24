/**
 * Testo dei documenti del progetto per il lettore automatico: PDF (pdf.js, fino a 25 pagine),
 * Word .docx (ZIP letto nel browser con DecompressionStream), testo semplice. Nessun servizio esterno.
 */
export async function testoPdf(file: Blob, maxPagine = 25): Promise<string> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const parti: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, maxPagine); n++) {
      const c = await (await doc.getPage(n)).getTextContent();
      parti.push(c.items.map((i) => ("str" in i ? i.str + ((i as { hasEOL?: boolean }).hasEOL ? "\n" : " ") : "")).join(""));
    }
    return parti.join("\n");
  } finally { void doc.destroy(); }
}

/** un file di un archivio ZIP (metodo 0 o 8) */
async function fileZip(buf: ArrayBuffer, nome: string): Promise<Uint8Array | null> {
  const v = new DataView(buf), b = new Uint8Array(buf);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) return null;
  let p = v.getUint32(e + 16, true);
  const n = v.getUint16(e + 10, true), dec = new TextDecoder();
  for (let k = 0; k < n && p + 46 <= b.length; k++) {
    const metodo = v.getUint16(p + 10, true), comp = v.getUint32(p + 20, true), ln = v.getUint16(p + 28, true), le = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const nomeF = dec.decode(b.subarray(p + 46, p + 46 + ln));
    if (nomeF === nome) {
      const inizio = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), dati = b.slice(inizio, inizio + comp);
      if (metodo === 0) return dati;
      const s = new Blob([dati]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(s).arrayBuffer());
    }
    p += 46 + ln + le + lc;
  }
  return null;
}

export async function testoDocx(file: Blob): Promise<string> {
  const x = await fileZip(await file.arrayBuffer(), "word/document.xml");
  if (!x) return "";
  return new TextDecoder().decode(x).replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, " ").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

export async function testoDocumento(file: Blob, nome: string): Promise<string> {
  if (/\.pdf$/i.test(nome)) return testoPdf(file);
  if (/\.docx$/i.test(nome)) return testoDocx(file);
  if (/\.(txt|csv|md)$/i.test(nome)) return (await file.text()).slice(0, 2_000_000);
  return "";
}
