import { describe, it, expect, beforeEach } from "vitest";
import { trovaSchedaPdf, svuotaCacheSchede, CARTELLA_ONEDRIVE } from "./schedeParticolari";

const risposta = (ok: boolean, tipo: string) => async () => ({ ok, headers: new Headers({ "content-type": tipo }) });
const nessunArchivio = async () => null;

describe("trovaSchedaPdf", () => {
  beforeEach(() => svuotaCacheSchede());

  it("PDF presente in public/particolari → locale", async () => {
    const r = await trovaSchedaPdf("OBO-TBS-200-T5.04.pdf", risposta(true, "application/pdf"), nessunArchivio);
    expect(r).toEqual({ tipo: "locale", url: "/particolari/OBO-TBS-200-T5.04.pdf" });
  });

  it("file assente nell'app ma presente nell'archivio → link firmato", async () => {
    const r = await trovaSchedaPdf("A.pdf", risposta(true, "text/html"), async (f) => `https://archivio/firmato/${f}`);
    expect(r).toEqual({ tipo: "locale", url: "https://archivio/firmato/A.pdf" });
  });

  it("file mancante ovunque → cartella OneDrive", async () => {
    expect((await trovaSchedaPdf("X.pdf", risposta(false, "text/plain"), nessunArchivio)).tipo).toBe("cartella");
    const r = await trovaSchedaPdf("X.pdf", risposta(true, "text/html"), nessunArchivio);
    expect(r).toEqual({ tipo: "cartella", url: CARTELLA_ONEDRIVE, fileAtteso: "X.pdf" });
  });

  it("errore di rete → archivio, poi cartella OneDrive", async () => {
    const r = await trovaSchedaPdf("Y.pdf", async () => { throw new Error("rete"); }, nessunArchivio);
    expect(r.tipo).toBe("cartella");
  });
});
