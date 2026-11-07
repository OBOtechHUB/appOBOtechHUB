import { describe, it, expect } from "vitest";
import { formaComponente } from "./MarcatoriParticolari";

describe("formaComponente", () => {
  it("riconosce i tipi delle proposte", () => {
    expect(formaComponente("giunto di sezionamento")).toBe("giunto");
    expect(formaComponente("punto di terra fisso")).toBe("punto-terra");
    expect(formaComponente("picchetto")).toBe("picchetto");
    expect(formaComponente("supporto calata")).toBe("supporto");
    expect(formaComponente("compensatore di dilatazione")).toBe("compensatore");
    expect(formaComponente("asta")).toBe("asta");
    expect(formaComponente("morsetto a croce")).toBe("morsetto");
    expect(formaComponente("connettore asta")).toBe("morsetto");
  });
});
