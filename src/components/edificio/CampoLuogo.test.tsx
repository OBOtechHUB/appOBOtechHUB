import { describe, expect, it, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CampoLuogo, type ValoreLuogo } from "./CampoLuogo";

function Prova({ visto }: { visto: (v: ValoreLuogo) => void }) {
  const [v, setV] = useState<ValoreLuogo>({ comune: "" });
  return <CampoLuogo valore={v} onChange={(n) => { setV(n); visto(n); }} />;
}

afterEach(() => vi.unstubAllGlobals());

describe("campo Comune o indirizzo", () => {
  it("cerca, propone l'elenco e salva comune e coordinate", async () => {
    const fetchFinto = vi.fn(async (_url: string) => new Response(JSON.stringify({ features: [{ geometry: { coordinates: [9.6773, 45.6983] }, properties: { street: "Via Roma", housenumber: "1", city: "Bergamo", country: "Italia" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchFinto);
    const visto = vi.fn();
    render(<Prova visto={visto} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "via roma 1 bergamo" } });
    expect(visto).toHaveBeenLastCalledWith({ comune: "via roma 1 bergamo", indirizzo: undefined, lat: null, lon: null }); // a mano vale come comune
    const voce = await waitFor(() => screen.getByRole("option"), { timeout: 3000 });
    expect(String(fetchFinto.mock.calls[0]![0])).toContain("photon.komoot.io/api");
    fireEvent.click(voce.querySelector("button")!);
    expect(visto).toHaveBeenLastCalledWith({ comune: "Bergamo", indirizzo: "Via Roma 1, Bergamo, Italia", lat: 45.6983, lon: 9.6773 });
    await waitFor(() => expect(screen.getByText("Apri in Google Maps")).toBeInTheDocument());
    expect(screen.getByText("Apri in Google Earth").getAttribute("href")).toContain("earth.google.com/web/@45.698300,9.677300");
    expect(screen.getByTitle("Vista satellitare di Google Maps").getAttribute("src")).toContain("q=45.698300,9.677300");
  });

  it("senza risultati avvisa e lascia scrivere il comune a mano", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ features: [] }), { status: 200 })));
    render(<Prova visto={() => undefined} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "xyzxyz" } });
    await waitFor(() => expect(screen.getByText(/Nessun luogo trovato/)).toBeInTheDocument(), { timeout: 3000 });
  });
});
