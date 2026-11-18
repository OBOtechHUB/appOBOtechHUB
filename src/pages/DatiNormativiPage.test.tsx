import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { DatiNormativiPage } from "./DatiNormativiPage";
import { leggiParametriCaptazione, sostituisciParametriCaptazione } from "@/lib/parametri";

async function renderPagina() {
  const root = createRootRoute();
  const route = createRoute({ getParentRoute: () => root, path: "/", component: DatiNormativiPage });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(screen.getByText("Parametri di captazione")).toBeInTheDocument());
}

describe("Dati normativi – parametri di captazione", () => {
  it("mostra la tabella LPL e il campo pendenza massima maglia", async () => {
    await renderPagina();
    expect(screen.getAllByText(/LPL III/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Pendenza massima maglia")).toBeInTheDocument();
  });

  it("salva la pendenza nello store e segnala il salvataggio solo locale senza accesso", async () => {
    sostituisciParametriCaptazione({ pendenzaMassimaMaglia: null });
    await renderPagina();
    fireEvent.change(screen.getByLabelText("Pendenza massima maglia"), { target: { value: "0.1" } });
    fireEvent.click(screen.getByRole("button", { name: /Salva parametri/ }));
    await waitFor(() => expect(leggiParametriCaptazione().pendenzaMassimaMaglia).toBe(0.1));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("solo su questo dispositivo"));
  });

  it("rifiuta valori non positivi senza toccare lo store", async () => {
    sostituisciParametriCaptazione({ pendenzaMassimaMaglia: null });
    await renderPagina();
    fireEvent.change(screen.getByLabelText("Pendenza massima maglia"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Salva parametri/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("numero positivo"));
    expect(leggiParametriCaptazione().pendenzaMassimaMaglia).toBeNull();
  });
});

describe("Dati normativi – riferimenti normativi di progetto", () => {
  it("mostra tutti gli argomenti della norma, non solo i livelli LPL", async () => {
    await renderPagina();
    for (const t of ["Parametri del fulmine", "Captazione", "Calate e distanza di separazione", "Dispersori", "Materiali e sezioni minime", "Valutazione del rischio", "SPD e tensioni di tenuta", "Verifiche periodiche"])
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.getByText("Coefficiente ki (classe dell'LPS)")).toBeInTheDocument();
    expect(screen.getByText("Corrente minima di picco intercettata")).toBeInTheDocument();
  });

  it("evidenzia il livello scelto", async () => {
    await renderPagina();
    fireEvent.click(screen.getByRole("button", { name: /^LPL I(\s|$)/ }));
    expect(screen.getByRole("button", { name: /^LPL I(\s|$)/ }).getAttribute("aria-pressed")).toBe("true");
  });
});
