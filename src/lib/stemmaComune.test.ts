import { describe, expect, it } from "vitest";
import { nomeProvincia, pulisciComune, scegliComune, type ComuneTrovato } from "./stemmaComune";

const c = (id: string, nome: string, provincia: string, lat: number, lon: number): ComuneTrovato => ({ id, nome, provincia, fileStemma: `${nome}-Stemma.svg`, lat, lon });

describe("stemma del Comune", () => {
  it("ripulisce il nome del Comune scritto nel progetto", () => {
    expect(pulisciComune("10095 Grugliasco (TO)")).toBe("Grugliasco");
    expect(pulisciComune("Grugliasco TO, Italia")).toBe("Grugliasco");
    expect(pulisciComune("Comune di Reggio nell'Emilia")).toBe("Reggio nell'Emilia");
    expect(pulisciComune("  Sant'Ambrogio di Torino ")).toBe("Sant'Ambrogio di Torino");
  });
  it("accorcia il nome della provincia", () => {
    expect(nomeProvincia("città metropolitana di Torino")).toBe("Torino");
    expect(nomeProvincia("provincia di Cuneo")).toBe("Cuneo");
    expect(nomeProvincia("libero consorzio comunale di Ragusa")).toBe("Ragusa");
    expect(nomeProvincia("provincia dell'Aquila")).toBe("L'Aquila");
  });
  it("sceglie fra gli omonimi con la provincia o con le coordinate del progetto", () => {
    const lista = [c("Q1", "Calliano", "Trento", 45.93, 11.09), c("Q2", "Calliano", "Asti", 45.0, 8.26), c("Q3", "Callianetto", "Asti", 44.9, 8.2)];
    expect(scegliComune(lista, "Calliano", "Asti")?.id).toBe("Q2");
    expect(scegliComune(lista, "calliano", "", { lat: 45.9, lon: 11.1 })?.id).toBe("Q1");
    expect(scegliComune(lista, "Calliano", "provincia di Asti", { lat: 45.9, lon: 11.1 })?.id).toBe("Q2");
    expect(scegliComune([], "Calliano")).toBeNull();
  });
});
