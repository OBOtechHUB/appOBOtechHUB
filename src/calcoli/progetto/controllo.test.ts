import { describe, expect, it } from "vitest";
import { controllaProgetto, problemi, type FattiProgetto } from "./controllo";

const completo: FattiProgetto = {
  edificio: { L: 40, W: 20, H: 8, comune: "Milano", lplProgetto: "III" },
  rischio: { valutato: true, lplMinimo: "III", conformeConProgetto: true },
  captazione: { conduttori: 12, aste: 0, areaEsposta: 0 },
  calate: { numero: 8, perimetro: 120, distanzaTipica: 15 },
  separazione: { punti: 2, nonConformi: 0, peggiore: null },
  terra: { tipo: "B", elementi: 1, l1: 5, lunghezzaMinPicchetto: null, raggioEquivalente: 16 },
  spd: { linee: 2, dispositivi: 2 },
};

describe("controllo del progetto completo", () => {
  it("progetto completo: nessun problema", () => {
    expect(problemi(controllaProgetto(completo))).toBe(0);
  });
  it("segnala livello insufficiente, calate distanti, separazione e picchetti corti", () => {
    const v = controllaProgetto({ ...completo,
      edificio: { ...completo.edificio, lplProgetto: "IV" },
      calate: { numero: 4, perimetro: 120, distanzaTipica: 15 },
      separazione: { punti: 3, nonConformi: 1, peggiore: { descrizione: "Unità esterna", d: 0.2, s: 0.35 } },
      terra: { tipo: "A", elementi: 4, l1: 5, lunghezzaMinPicchetto: 1.5, raggioEquivalente: null },
      spd: { linee: 2, dispositivi: 0 } });
    const per = (id: string) => v.find((x) => x.id === id)!;
    expect(per("rischio").livello).toBe("errore");
    expect(per("calate").livello).toBe("avviso");
    expect(per("separazione").livello).toBe("errore");
    expect(per("terra").livello).toBe("errore");
    expect(per("spd").livello).toBe("errore");
  });
  it("progetto vuoto: errori su dati, rischio, captazione e terra", () => {
    const v = controllaProgetto({ edificio: { L: 0, W: 0, H: 0, comune: "", lplProgetto: null }, rischio: { valutato: false, lplMinimo: null, conformeConProgetto: null }, captazione: { conduttori: 0, aste: 0, areaEsposta: null }, calate: { numero: 0, perimetro: 0, distanzaTipica: null }, separazione: { punti: 0, nonConformi: 0, peggiore: null }, terra: { tipo: null, elementi: 0, l1: null, lunghezzaMinPicchetto: null, raggioEquivalente: null }, spd: { linee: 0, dispositivi: 0 } });
    expect(v.filter((x) => x.livello === "errore").map((x) => x.id)).toEqual(["edificio", "rischio", "captazione", "terra"]);
  });
  it("edificio oltre 60 m: avviso sui fulmini laterali; anello sotto l1: lunghezza dei dispersori aggiuntivi", () => {
    expect(controllaProgetto(completo).some((x) => x.id === "laterali")).toBe(false);
    const alto = controllaProgetto({ ...completo, edificio: { ...completo.edificio, H: 90 } }).find((x) => x.id === "laterali")!;
    expect(alto.livello).toBe("avviso"); expect(alto.dettaglio).toMatch(/da 72 m/);
    const t = controllaProgetto({ ...completo, terra: { tipo: "B", elementi: 1, l1: 10, lunghezzaMinPicchetto: null, raggioEquivalente: 6 } }).find((x) => x.id === "terra")!;
    expect(t.livello).toBe("avviso"); expect(t.dettaglio).toMatch(/4 m se orizzontale o 2 m se verticale/); expect(t.dettaglio).toMatch(/\(8\)/);
  });
});
