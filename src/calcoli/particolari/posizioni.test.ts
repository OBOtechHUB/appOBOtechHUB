import { describe, it, expect } from "vitest";
import catalogo from "@/dati/particolari/particolari.json";
import { posizioniParticolari, etichettaParticolare, type ParticolareCatalogo } from "./posizioni";

const cat = catalogo as unknown as ParticolareCatalogo[];

describe("posizioniParticolari", () => {
  it("abbina il morsetto a croce inox al particolare citato in distinta (T5.04)", () => {
    const r = posizioniParticolari(cat, [{
      origine: "proposta-terra",
      morsetti: [{ tipo: "morsetto a croce", x: 1, y: 2, z: -0.7, codiceOBO: "5314659" }],
      distinte: [[{ riferimento: "OBO-TBS-200-T5.04" }]],
    }]);
    expect(r.marcatori).toHaveLength(1);
    expect(r.marcatori[0]?.idParticolare).toBe("OBO-TBS-200-T5.04");
    expect(r.marcatori[0]?.origine).toBe("proposta-terra");
    expect(r.senzaParticolare).toHaveLength(0);
  });

  it("codice sconosciuto → elenco senza particolare", () => {
    const r = posizioniParticolari(cat, [{ origine: "progetto", morsetti: [{ x: 0, y: 0, z: 0, codiceOBO: "0000000" }, { x: 5, y: 0, z: 0, codiceOBO: "0000000" }] }]);
    expect(r.marcatori).toHaveLength(0);
    expect(r.senzaParticolare).toEqual([{ codiceOBO: "0000000", tipoComponente: "morsetto", quantita: 2 }]);
  });

  it("raggruppa componenti dello stesso particolare entro 5 cm", () => {
    const m = { tipo: "giunto di sezionamento", codiceOBO: "5336341" };
    const r = posizioniParticolari(cat, [{ origine: "progetto", morsetti: [{ ...m, x: 0, y: 0, z: 0.5 }, { ...m, x: 0.03, y: 0, z: 0.5 }, { ...m, x: 3, y: 0, z: 0.5 }] }]);
    expect(r.marcatori).toHaveLength(2);
    expect(r.marcatori[0]?.quantita).toBe(2);
    expect(r.usati[0]?.punti).toBe(2);
  });

  it("ignora componenti senza codice o con coordinate non valide", () => {
    const r = posizioniParticolari(cat, [{ origine: "progetto", supporti: [{ x: 0, y: 0, codiceOBO: "" }, { x: Number.NaN, y: 0, codiceOBO: "5336341" }] }]);
    expect(r.marcatori).toHaveLength(0);
    expect(r.senzaParticolare).toHaveLength(0);
  });

  it("etichetta breve", () => {
    expect(etichettaParticolare("OBO-TBS-200-T5.04")).toBe("T5.04");
    expect(etichettaParticolare("altro")).toBe("altro");
  });
});
