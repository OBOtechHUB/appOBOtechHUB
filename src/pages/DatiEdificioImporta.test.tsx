import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { DatiEdificioPage } from "./DatiEdificioPage";

function file(nome: string, contenuto: string): File {
  const f = new File([contenuto], nome);
  Object.defineProperty(f, "text", { value: async () => contenuto });
  Object.defineProperty(f, "arrayBuffer", { value: async () => new TextEncoder().encode(contenuto).buffer });
  return f;
}
const dxfMm = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES",
  "0", "LWPOLYLINE", "8", "EDIFICIO", "90", "4", "70", "1", "10", "0", "20", "0", "10", "24000", "20", "0", "10", "24000", "20", "12000", "10", "0", "20", "12000",
  "0", "ENDSEC", "0", "EOF"].join("\n");

describe("Dati edificio: importazione con dimensioni automatiche", () => {
  it("un DXF in millimetri compila L, W e H", async () => {
    const root = createRootRoute();
    const route = createRoute({ getParentRoute: () => root, path: "/", component: DatiEdificioPage });
    render(<RouterProvider router={createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: ["/"] }) })} />);
    await waitFor(() => expect(screen.getByText(/Importa un disegno o un modello/)).toBeInTheDocument());
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file("pianta.dxf", dxfMm)] } });
    await waitFor(() => expect(screen.getByText(/Il file indica millimetri/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/il DXF è solo in pianta/), { target: { value: "9" } });
    fireEvent.click(screen.getByText("Importa con questa scala"));
    await waitFor(() => expect(screen.getByText(/Dimensioni compilate dal file/)).toBeInTheDocument());
    expect((screen.getByLabelText("Lunghezza L (m)") as HTMLInputElement).value).toBe("24");
    expect((screen.getByLabelText("Larghezza W (m)") as HTMLInputElement).value).toBe("12");
    expect((screen.getByLabelText("Altezza H (m)") as HTMLInputElement).value).toBe("9");
  });
});
