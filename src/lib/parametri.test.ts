import { beforeEach, describe, expect, it } from "vitest";
import {
  aggiornaParametriCaptazione,
  leggiParametriCaptazione,
  parametriIniziali,
  sostituisciParametriCaptazione,
} from "./parametri";

describe("parametri captazione", () => {
  beforeEach(() => {
    localStorage.clear();
    sostituisciParametriCaptazione(parametriIniziali);
  });

  it("il valore predefinito della pendenza massima è null (da impostare in Dati normativi)", () => {
    expect(parametriIniziali.pendenzaMassimaMaglia).toBeNull();
    expect(leggiParametriCaptazione().pendenzaMassimaMaglia).toBeNull();
  });

  it("l'aggiornamento imposta il valore e lo rende leggibile", () => {
    aggiornaParametriCaptazione({ pendenzaMassimaMaglia: 0.1 });
    expect(leggiParametriCaptazione().pendenzaMassimaMaglia).toBe(0.1);
  });

  it("la sostituzione dalla libreria ignora valori non validi", () => {
    aggiornaParametriCaptazione({ pendenzaMassimaMaglia: 0.2 });
    sostituisciParametriCaptazione({ pendenzaMassimaMaglia: -5 });
    expect(leggiParametriCaptazione().pendenzaMassimaMaglia).toBe(0.2);
    sostituisciParametriCaptazione("non un oggetto");
    expect(leggiParametriCaptazione().pendenzaMassimaMaglia).toBe(0.2);
  });

  it("la sostituzione dalla libreria accetta null (limite non impostato)", () => {
    aggiornaParametriCaptazione({ pendenzaMassimaMaglia: 0.2 });
    sostituisciParametriCaptazione({ pendenzaMassimaMaglia: null });
    expect(leggiParametriCaptazione().pendenzaMassimaMaglia).toBeNull();
  });
});
