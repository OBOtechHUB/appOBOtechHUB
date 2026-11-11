import { describe, it, expect } from "vitest";
import { completamento, passiAssistente, prossimoPasso, type RiassuntoProgetto } from "./passi";

const vuoto: RiassuntoProgetto = {
  edificio: { nome: "", comune: "", L: 0, W: 0, H: 0, lpl: null, densita: 0 },
  corpi: 0, aste: 0, conduttoriCaptazione: 0, calate: 0, terraAccettata: false, conduttoriTerra: 0, picchetti: 0,
  componentiPosizionati: 0, righeComputo: 0, mancantiComputo: 0, verifiche: 0, verificaScaduta: false,
};

describe("assistente di progetto", () => {
  it("progetto vuoto: si parte dai dati dell'edificio", () => {
    const passi = passiAssistente(vuoto);
    expect(prossimoPasso(passi)?.id).toBe("edificio");
    expect(completamento(passi).completi).toBe(0);
  });

  it("dopo l'edificio il prossimo passo è l'analisi del rischio, poi la captazione", () => {
    const passi = passiAssistente({ ...vuoto, edificio: { nome: "Scuola", comune: "Milano", L: 20, W: 10, H: 8, lpl: "III", densita: 2 }, corpi: 1 });
    expect(passi.find((x) => x.id === "edificio")?.stato).toBe("completo");
    expect(prossimoPasso(passi)?.id).toBe("rischio");
    expect(prossimoPasso(passiAssistente({ ...vuoto, edificio: { nome: "Scuola", comune: "Milano", L: 20, W: 10, H: 8, lpl: "III", densita: 2 }, corpi: 1, rischioValutato: true }))?.id).toBe("captazione");
  });

  it("progetto completo", () => {
    const passi = passiAssistente({ ...vuoto, edificio: { nome: "A", comune: "B", L: 20, W: 10, H: 8, lpl: "II", densita: 2 }, corpi: 1, aste: 4, conduttoriCaptazione: 10, calate: 4, terraAccettata: true, conduttoriTerra: 1, picchetti: 4, componentiPosizionati: 50, righeComputo: 12, verifiche: 1 });
    const c = completamento(passi);
    expect(passi.find((x) => x.id === "calate")?.stato).toBe("in corso");
    expect(c.completi).toBe(c.totale - 1); // calate in corso finché manca la distanza s
    expect(prossimoPasso(passi)?.id).toBe("rischio");
  });

});
