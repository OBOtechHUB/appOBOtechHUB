/**
 * Lettura di file STEP (.stp/.step) nel browser con OpenCascade (occt-import-js, WebAssembly):
 * il modello B-rep viene triangolato in mesh. Libreria e WASM si caricano solo quando servono.
 */
import type { Mesh3D } from "@/calcoli/modelli3d/dxf3d";

interface RisultatoOcct {
  success: boolean;
  meshes: { name?: string; color?: [number, number, number]; attributes: { position: { array: number[] } }; index?: { array: number[] } }[];
}
type Occt = { ReadStepFile: (contenuto: Uint8Array, parametri: Record<string, unknown> | null) => RisultatoOcct };

let occt: Promise<Occt> | null = null;

async function caricaOcct(): Promise<Occt> {
  if (!occt) {
    occt = (async () => {
      const [{ default: fabbrica }, { default: wasmUrl }] = await Promise.all([
        import("occt-import-js") as unknown as Promise<{ default: (o: { locateFile: (f: string) => string }) => Promise<Occt> }>,
        import("occt-import-js/dist/occt-import-js.wasm?url") as unknown as Promise<{ default: string }>,
      ]);
      return fabbrica({ locateFile: () => wasmUrl });
    })();
    occt.catch(() => { occt = null; });
  }
  return occt;
}

/** Triangola un file STEP. `finezza` riduce la deviazione della triangolazione (più fine = più triangoli). */
export async function leggiStep(buffer: ArrayBuffer, nomeFile = "modello", finezza: "normale" | "fine" = "normale"): Promise<Mesh3D[]> {
  const lib = await caricaOcct();
  const parametri = finezza === "fine"
    ? { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.0005, angularDeflection: 0.25 }
    : { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.002, angularDeflection: 0.5 };
  const r = lib.ReadStepFile(new Uint8Array(buffer), parametri);
  if (!r.success || !r.meshes.length) throw new Error("File STEP non leggibile o senza geometria.");
  return r.meshes.map((m, i) => ({
    nome: m.name || `${nomeFile.replace(/\.[^.]+$/, "")}_${i + 1}`,
    posizioni: Float32Array.from(m.attributes.position.array),
    indici: m.index ? Uint32Array.from(m.index.array) : null,
    colore: m.color ?? null,
  }));
}
