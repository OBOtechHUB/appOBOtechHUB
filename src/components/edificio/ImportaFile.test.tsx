import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImportaFile } from "./ImportaFile";
import type { ModelloEdificio } from "@/calcoli/edificio/tipi";

// jsdom non implementa File.text()/arrayBuffer(): si aggiungono al singolo file di prova
function file(nome: string, contenuto: string): File {
  const f = new File([contenuto], nome);
  const buf = new TextEncoder().encode(contenuto).buffer;
  Object.defineProperty(f, "text", { value: async () => contenuto });
  Object.defineProperty(f, "arrayBuffer", { value: async () => buf });
  return f;
}

function dxf(insunits: number, w: number, h: number): string {
  return ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", String(insunits), "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "LWPOLYLINE", "8", "EDIFICIO", "90", "4", "70", "1",
    "10", "0", "20", "0", "10", String(w), "20", "0", "10", String(w), "20", String(h), "10", "0", "20", String(h),
    "0", "ENDSEC", "0", "EOF"].join("\n");
}

function stlScatola(x: number, y: number, z: number): string {
  const v = [[0, 0, 0], [x, 0, 0], [x, y, 0], [0, y, 0], [0, 0, z], [x, 0, z], [x, y, z], [0, y, z]];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return "solid s\n" + f.map((t) => " facet normal 0 0 0\n  outer loop\n" + t.map((i) => `   vertex ${(v[i] ?? []).join(" ")}`).join("\n") + "\n  endloop\n endfacet").join("\n") + "\nendsolid s\n";
}

function carica(f: File) {
  const onImporta = vi.fn<(m: ModelloEdificio) => void>();
  render(<ImportaFile onImporta={onImporta} />);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [f] } });
  return onImporta;
}
const larghezza = (m: ModelloEdificio | undefined) => Math.max(...(m?.corpi[0]?.impronta ?? []).map((p) => p[0]));

describe("Importazione guidata con verifica della scala", () => {
  it("DXF in millimetri: propone i millimetri e importa in metri", async () => {
    const onImporta = carica(file("pianta.dxf", dxf(4, 24000, 12000)));
    await waitFor(() => expect(screen.getByText(/Il file indica millimetri/)).toBeInTheDocument());
    expect((screen.getByLabelText("millimetri") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByText("Importa con questa scala"));
    expect(onImporta).toHaveBeenCalledTimes(1);
    expect(larghezza(onImporta.mock.calls[0]?.[0])).toBeCloseTo(24);
  });

  it("DXF che dichiara metri ma è disegnato in millimetri: segnala e propone i millimetri", async () => {
    carica(file("pianta.dxf", dxf(6, 24000, 12000)));
    await waitFor(() => expect(screen.getByText(/più probabile che sia in millimetri/)).toBeInTheDocument());
    expect((screen.getByLabelText("millimetri") as HTMLInputElement).checked).toBe(true);
  });

  it("scala da una misura nota", async () => {
    const onImporta = carica(file("pianta.dxf", dxf(0, 1200, 600)));
    await waitFor(() => expect(screen.getByText(/non indica l'unità/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Misura reale in metri"), { target: { value: "30" } });
    expect((screen.getByLabelText("Da una misura nota") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByText("Importa con questa scala"));
    expect(larghezza(onImporta.mock.calls[0]?.[0])).toBeCloseTo(30);
  });

  it("STL senza unità: propone i millimetri e usa l'asse Z come verticale", async () => {
    const onImporta = carica(file("capannone.stl", stlScatola(20000, 10000, 8000)));
    await waitFor(() => expect(screen.getByText(/in millimetri l'edificio misura 20 × 10 × 8 m/)).toBeInTheDocument());
    fireEvent.click(screen.getByText("Importa con questa scala"));
    const c = onImporta.mock.calls[0]?.[0]?.corpi[0];
    expect(c?.altezzaGronda).toBeCloseTo(8);
    expect(larghezza(onImporta.mock.calls[0]?.[0])).toBeCloseTo(20);
  });

  it("DWG: spiega come salvarlo in DXF", async () => {
    carica(file("pianta.dwg", "AC1032"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/salva il disegno come DXF/));
  });
});
