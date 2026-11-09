import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createRootRoute, createRoute, createRouter, createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { NormaPage } from "./NormaPage";
import { RischioPage } from "./RischioPage";

async function renderPagina(Pagina: () => React.ReactNode, testo: string) {
  const root = createRootRoute();
  const route = createRoute({ getParentRoute: () => root, path: "/", component: Pagina });
  const router = createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(screen.getAllByText(testo).length).toBeGreaterThan(0));
}

describe("pagina Norma 62305", () => {
  it("mostra tutte le sezioni e i risultati", async () => {
    await renderPagina(NormaPage, "Parametri del fulmine");
    for (const t of ["Materiali e sezioni minime", "Schermo dei cavi entranti", "Tensioni di contatto e di passo", "Strutture con rischio di esplosione", "Schermatura magnetica", "SPD: livello di protezione effettivo", "Tensione indotta nel circuito protetto", "Impianti fotovoltaici sul tetto"])
      expect(screen.getByRole("region", { name: t })).toBeInTheDocument();
    expect(screen.getByText(/Servono misure di protezione/)).toBeInTheDocument();
    expect(screen.queryAllByText("NaN")).toHaveLength(0);
  });

  it("verifica una sezione minima e cambia esito con il diametro", async () => {
    await renderPagina(NormaPage, "Parametri del fulmine");
    expect(screen.getByText(/Sezione 50,3 mm² ≥ minimo 50 mm²/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Diametro (mm)"), { target: { value: "6" } });
    await waitFor(() => expect(screen.getByText(/Sezione 28,3 mm² < minimo 50 mm²/)).toBeInTheDocument());
  });
});

describe("pagina Analisi del rischio", () => {
  it("si apre con zone, SPD per zona e ambiente circostante", async () => {
    await renderPagina(RischioPage, "Analisi del rischio");
    expect(screen.getByText("SPD minimo della zona")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/coinvolgere l'ambiente circostante/));
    await waitFor(() => expect(screen.getByText("Estensione del danno (Tab. E.3)")).toBeInTheDocument());
    fireEvent.click(screen.getAllByLabelText(/Linea divisa in sezioni/)[0]!);
    await waitFor(() => expect(screen.getByText("Sezione 1: lunghezza (m)")).toBeInTheDocument());
  });
});
