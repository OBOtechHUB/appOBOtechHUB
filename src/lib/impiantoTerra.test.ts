import { describe, expect, it } from "vitest";
import { rettangolo } from "@/calcoli/edificio/geometria";
import { proponiTerra, verificaTerra } from "@/calcoli/terra/proponiTerra";
import { generaFileCAD } from "@/calcoli/cad/esportaCAD";
import { estesoIniziale, estesoSchema, type StatoEsteso } from "./statoProgetto";
import { accettaTerra, datiTerraCAD, piediCalate, rimuoviTerra, terraDefault } from "./impiantoTerra";
import { righeProposta } from "./computoProposta";

function edificio(): StatoEsteso {
  return estesoSchema.parse({ ...estesoIniziale, modello: { corpi: [rettangolo(20, 10, 8, "edificio")] }, conduttori: [[0, 0], [20, 0], [20, 10], [0, 10]].map(([x, y], i) => ({ id: `c${i}`, tipo: "calata", punti: [[x, y, 8], [x, y, 0]], materiale: "alluminio", sezione: "8", codiceOBO: "5021294" })) });
}
describe("Integrazione della terra", () => {
  it("accetta un anello B 20×10 con quattro calate e picchetti anche nel CAD", () => {
    const s = edificio();
    const config = { ...terraDefault, picchettiSuAnello: true };
    const p = proponiTerra(s.modello.corpi, { ...config, calate: piediCalate(s) });
    const salvato = accettaTerra(s, p, config);
    expect(salvato.conduttori.filter((c) => c.tipo === "calata")).toEqual(s.conduttori);
    expect(salvato.conduttori.filter((c) => c.tipo === "terra").map((c) => c.sottotipo)).toEqual(p.conduttori.map((c) => c.tipo));
    expect(salvato.conduttori.filter((c) => c.tipo === "terra")).toHaveLength(9);
    expect(estesoSchema.parse(salvato).picchetti).toHaveLength(4);
    const dati = datiTerraCAD(salvato);
    expect(dati.picchetti).toHaveLength(4);
    expect(dati.conduttori.filter((c) => c.tipo === "uscita")).toHaveLength(4);
    const file = generaFileCAD({ progetto: {}, edificio: salvato.modello, ...dati });
    expect(file.match(/\(PICCHETTO /g)).toHaveLength(4);
    expect(file.match(/\(CONDUTTORE "uscita"/g)).toHaveLength(4);
  });
  it("ripristina stati precedenti senza picchetti e terra", () => {
    const { picchetti, terra, ...precedente } = edificio();
    const s = estesoSchema.parse(precedente);
    expect(s.picchetti).toEqual([]);
    expect(s.terra).toBeNull();
  });
  it("conserva captazione e componenti accettando, sostituendo e rimuovendo terra", () => {
    const s = estesoSchema.parse({ ...edificio(), supporti: [{ x: 0, y: 0, z: 8 }], morsetti: [{ x: 0, y: 0, z: 8 }], compensatori: [{ x: 1, y: 0, z: 8 }], distinta: [{ codice: "CAP", descrizione: "Captazione", quantita: 580, unita: "m" }] });
    const p = proponiTerra(s.modello.corpi, { ...terraDefault, calate: piediCalate(s) });
    const primo = accettaTerra(s, p, terraDefault);
    const secondo = accettaTerra(primo, p, terraDefault);
    expect(secondo.conduttori).toHaveLength(primo.conduttori.length);
    expect(rimuoviTerra(secondo)).toEqual(s);
  });
  it("aggiunge la distinta di terra anche senza distinta di captazione", () => {
    const s = edificio();
    const p = proponiTerra(s.modello.corpi, { ...terraDefault, calate: piediCalate(s) });
    const righe = righeProposta(accettaTerra(s, p, terraDefault));
    expect(righe).toHaveLength(p.distinta.length);
    expect(righe.every((r) => r.categoria === "terra")).toBe(true);
    expect(righe.find((r) => r.codice === "5336341")?.quantita).toBe(4);
  });
  it("mantiene la verifica senza l1 come dato norma mancante", () => {
    const s = edificio();
    const p = proponiTerra(s.modello.corpi, { ...terraDefault, calate: piediCalate(s) });
    expect(verificaTerra(p, terraDefault.l1).esito).toBe("dato norma mancante");
  });
});