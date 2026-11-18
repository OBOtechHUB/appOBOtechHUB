/**
 * Archivio ZIP minimo (metodo "store", senza compressione) creato nel browser: per il pacchetto CAD
 * (DXF, dati di progetto, LPS.lsp, istruzioni). Nomi dei file in UTF-8.
 */
const TABELLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b: Uint8Array): number { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABELLA[(c ^ b[i]!) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export interface FileZip { nome: string; dati: Uint8Array | string }

function dosData(d: Date): [number, number] {
  return [((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31), (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)];
}

export function creaZip(file: FileZip[], data = new Date()): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder(), [ora, giorno] = dosData(data);
  const locali: Uint8Array[] = [], centrali: Uint8Array[] = [];
  let offset = 0;
  for (const f of file) {
    const nome = enc.encode(f.nome), dati = typeof f.dati === "string" ? enc.encode(f.dati) : f.dati, crc = crc32(dati);
    const l = new Uint8Array(30 + nome.length), v = new DataView(l.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
    v.setUint16(10, ora, true); v.setUint16(12, giorno, true); v.setUint32(14, crc, true); v.setUint32(18, dati.length, true); v.setUint32(22, dati.length, true);
    v.setUint16(26, nome.length, true); v.setUint16(28, 0, true); l.set(nome, 30);
    const c = new Uint8Array(46 + nome.length), w = new DataView(c.buffer);
    w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true); w.setUint16(10, 0, true);
    w.setUint16(12, ora, true); w.setUint16(14, giorno, true); w.setUint32(16, crc, true); w.setUint32(20, dati.length, true); w.setUint32(24, dati.length, true);
    w.setUint16(28, nome.length, true); w.setUint32(42, offset, true); c.set(nome, 46);
    locali.push(l, dati); centrali.push(c); offset += l.length + dati.length;
  }
  const dimC = centrali.reduce((a, c) => a + c.length, 0), fine = new Uint8Array(22), e = new DataView(fine.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, file.length, true); e.setUint16(10, file.length, true); e.setUint32(12, dimC, true); e.setUint32(16, offset, true);
  const out = new Uint8Array(offset + dimC + 22); let p = 0;
  for (const x of [...locali, ...centrali, fine]) { out.set(x, p); p += x.length; }
  return out;
}
