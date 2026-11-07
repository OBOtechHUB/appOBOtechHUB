import { describe, expect, it } from "vitest";
import { applicaModifiche, conSfrido, generaComputo, numeroSupporti } from "./computo";
import type { ConfigurazioneComputo, RisultatiModuli } from "./tipi";
const config: ConfigurazioneComputo = { sfridoPercento: 10, passoSupporti: { Piana: 2, "A falde": 1 } };
const risultati: RisultatiModuli = {
  captazione: { lunghezzaConduttori: 100, giunzioni: 8, incroci: 6, descrizione: "maglia" },
  calate: { lunghezzaConduttori: 40, numero: 4, distanzaSeparazione: 0.3 },
  terra: { numeroPicchetti: 6, lunghezzaPicchetto: 2, lunghezzaAnello: 60, descrizione: "anello" },
  spd: { dispositivi: [{ codice: "SPD1", descrizione: "SPD", quantita: 2 }], descrizione: "SPD" },
};
const quantita = (id: string) => generaComputo(risultati, config, "Piana").righe.find((r) => r.id === id)?.quantita;
describe("Regole computo LPS", () => {
  it("applica lo sfrido iniziale del 10% ai metri di captazione", () => expect(quantita("captazione-conduttore")).toBeCloseTo(110));
  it("applica lo sfrido del 10% alle calate", () => expect(quantita("calate-conduttore")).toBe(44));
  it("consente di configurare lo sfrido", () => expect(conSfrido(100, 20)).toBe(120));
  it("calcola un supporto ogni X metri arrotondando per eccesso", () => expect(numeroSupporti(5, 2)).toBe(3));
  it("usa il passo della copertura selezionata", () => expect(generaComputo(risultati, config, "A falde").righe.find((r) => r.id === "captazione-supporti")?.quantita).toBe(100));
  it("non inventa il passo non configurato", () => expect(generaComputo(risultati, config, "Shed").mancanti).toContain("Passo supporti per copertura Shed"));
  it("deriva i morsetti di giunzione dalle maglie", () => expect(quantita("maglia-giunzioni")).toBe(8));
  it("deriva i morsetti di incrocio dalle maglie", () => expect(quantita("maglia-incroci")).toBe(6));
  it("ha un morsetto di sezionamento per calata", () => expect(quantita("calate-sezionamenti")).toBe(4));
  it("riprende i picchetti dal modulo terra", () => expect(quantita("terra-picchetti")).toBe(6));
  it("riprende i metri dell'anello dal modulo terra", () => expect(quantita("terra-anello")).toBe(60));
  it("riprende gli SPD e i relativi codici dal modulo", () => expect(generaComputo(risultati, config, "Piana").righe.find((r) => r.id === "spd-0")).toMatchObject({ quantita: 2, codice: "SPD1", provenienza: "SPD" }));
  it("mantiene la provenienza su ogni riga", () => expect(generaComputo(risultati, config, "Piana").righe.every((r) => ["Captazione", "Calate", "Terra", "SPD"].includes(r.provenienza))).toBe(true));
  it("non trasforma i moduli mancanti in quantità zero", () => expect(generaComputo({}, config, "Piana")).toEqual({ righe: [], mancanti: ["Captazione", "Calate", "Terra", "SPD"] }));
  it("conserva quantità manuale e codice dopo un ricalcolo", () => {
    const righe = generaComputo(risultati, config, "Piana").righe;
    expect(applicaModifiche(righe, { "captazione-conduttore": { codice: "CU", quantita: 130 } }, [], [])[0]).toMatchObject({ codice: "CU", quantita: 130, provenienza: "Captazione", manuale: true });
  });
  it("rifiuta un passo nullo", () => expect(() => numeroSupporti(10, 0)).toThrow());
});