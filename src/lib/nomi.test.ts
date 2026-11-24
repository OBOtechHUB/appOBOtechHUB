import { describe, expect, it } from "vitest";
import { formattaNome, soloNome } from "./nomi";

describe("nomi delle persone", () => {
  it("cognome maiuscolo e nome con l'iniziale maiuscola", () => {
    expect(formattaNome("marco lo vetere")).toBe("Marco LO VETERE");
    expect(formattaNome("Lo Vetere Marco", "lovetere.marco@obo.it")).toBe("LO VETERE Marco");
    expect(formattaNome("LO VETERE Marco")).toBe("LO VETERE Marco");
    expect(formattaNome("Gian Luca Bianchi", "bianchi.gianluca@obo.it")).toBe("Gian Luca BIANCHI");
    expect(formattaNome("anna-maria d'angelo")).toBe("Anna-Maria D'ANGELO");
    expect(formattaNome("Visitatore")).toBe("Visitatore");
    expect(formattaNome("a.b@obo.it")).toBe("a.b@obo.it");
    expect(soloNome("LO VETERE Marco")).toBe("Marco");
    expect(formattaNome("Ing. mario rossi")).toBe("Ing. Mario ROSSI");
  });
});
