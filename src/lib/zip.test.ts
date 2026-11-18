import { describe, expect, it } from "vitest";
import { crc32, creaZip } from "./zip";

describe("archivio zip", () => {
  it("CRC-32 standard", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });
  it("struttura: intestazioni locali, directory centrale e fine archivio", () => {
    const z = creaZip([{ nome: "a.txt", dati: "ciao" }, { nome: "cartella/b.lsp", dati: new Uint8Array([1, 2, 3]) }], new Date(2026, 10, 19, 10, 0, 0));
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const fine = z.length - 22;
    expect(v.getUint32(fine, true)).toBe(0x06054b50);
    expect(v.getUint16(fine + 10, true)).toBe(2);
    const inizioCentrale = v.getUint32(fine + 16, true);
    expect(v.getUint32(inizioCentrale, true)).toBe(0x02014b50);
    expect(new TextDecoder().decode(z.slice(30, 35))).toBe("a.txt");
    expect(new TextDecoder().decode(z.slice(35, 39))).toBe("ciao");
  });
});
