import { describe, expect, it } from "vitest";
import { categoriaDocumento, dimensioneLeggibile, importabileNelModello } from "./documentazione";

describe("categoria dei documenti", () => {
  it("riconosce piante, prospetti, relazioni, ATEX e foto", () => {
    expect(categoriaDocumento("Planimetria piano terra.pdf")).toBe("planimetria");
    expect(categoriaDocumento("capannone.dwg")).toBe("planimetria");
    expect(categoriaDocumento("Prospetto nord.pdf")).toBe("prospetti");
    expect(categoriaDocumento("Sezione A-A.dxf")).toBe("prospetti");
    expect(categoriaDocumento("Relazione tecnica.docx")).toBe("relazione");
    expect(categoriaDocumento("Classificazione zone ATEX.pdf")).toBe("atex");
    expect(categoriaDocumento("zona_2 reparto.pdf")).toBe("atex");
    expect(categoriaDocumento("IMG_0012.JPG", "image/jpeg")).toBe("foto");
    expect(categoriaDocumento("varie.zip")).toBe("altro");
  });
  it("file importabili e dimensioni", () => {
    expect(importabileNelModello("a.DWG")).toBe(true);
    expect(importabileNelModello("a.docx")).toBe(false);
    expect(dimensioneLeggibile(2_500_000)).toBe("2,4 MB");
  });
});
