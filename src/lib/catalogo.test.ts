import { describe, expect, it } from "vitest";
import { validaCatalogo } from "./catalogo";
const articolo = { codice: "C1", descrizione: "Rame", categoria: "conduttori", unita: "m", materiale: "rame", sezione: "50 mm²" };
describe("Catalogo", () => {
  it("ammette il prezzo opzionale", () => expect(validaCatalogo([articolo])[0]?.prezzo).toBeUndefined());
  it("rifiuta categorie non ammesse", () => expect(() => validaCatalogo([{ ...articolo, categoria: "altro" }])).toThrow());
  it("rifiuta unità diverse da metri e pezzi", () => expect(() => validaCatalogo([{ ...articolo, unita: "kg" }])).toThrow());
  it("rifiuta codici duplicati", () => expect(() => validaCatalogo([articolo, articolo])).toThrow());
});