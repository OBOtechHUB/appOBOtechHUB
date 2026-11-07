/**
 * Esportazione di mesh triangolari in DXF ASCII (R12) con entità 3DFACE: si apre in ZWCAD e AutoCAD
 * e si salva come DWG. Logica pura, nessuna dipendenza.
 */

export interface Mesh3D {
  nome: string;
  /** coordinate x,y,z consecutive */
  posizioni: ArrayLike<number>;
  /** indici dei triangoli (3 per triangolo); se assenti i vertici sono già in triangoli consecutivi */
  indici?: ArrayLike<number> | null | undefined;
  /** colore RGB 0–1 */
  colore?: [number, number, number] | null | undefined;
}

export interface Limiti { min: [number, number, number]; max: [number, number, number] }

export function limiti(meshes: Mesh3D[]): Limiti | null {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const m of meshes) {
    for (let i = 0; i + 2 < m.posizioni.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = m.posizioni[i + k]!;
        if (v < min[k]!) min[k] = v;
        if (v > max[k]!) max[k] = v;
      }
    }
  }
  return Number.isFinite(min[0]) ? { min, max } : null;
}

export function numeroTriangoli(m: Mesh3D): number {
  return Math.floor((m.indici ? m.indici.length : m.posizioni.length / 3) / 3);
}

/** Nome layer valido per DXF (lettere, cifre, - e _, massimo 31 caratteri). */
export function nomeLayer(nome: string, i: number): string {
  const pulito = nome.normalize("NFD").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 31);
  return pulito || `PARTE_${i + 1}`;
}

/** Colore AutoCAD (ACI) approssimato da RGB: grigi → 8/9, altrimenti tinta più vicina tra le principali. */
export function coloreAci(rgb: [number, number, number] | null | undefined): number {
  if (!rgb) return 8;
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 0.12) return max > 0.75 ? 9 : max > 0.4 ? 8 : 250;
  const palette: [number, [number, number, number]][] = [[1, [1, 0, 0]], [2, [1, 1, 0]], [3, [0, 1, 0]], [4, [0, 1, 1]], [5, [0, 0, 1]], [6, [1, 0, 1]], [30, [1, 0.5, 0]]];
  let migliore = 8, distanza = Infinity;
  for (const [aci, c] of palette) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < distanza) { distanza = d; migliore = aci; }
  }
  return migliore;
}

const num = (v: number) => (Math.abs(v) < 1e-9 ? "0" : Number(v.toFixed(6)).toString());

/**
 * DXF con un layer per parte e un 3DFACE per triangolo. Unità: quelle del modello (STEP OBO = millimetri);
 * `scala` permette di convertire (es. 0.001 per avere metri).
 */
export function esportaDxf3D(meshes: Mesh3D[], scala = 1, unita: "mm" | "m" = "mm"): string {
  const righe: string[] = [];
  const add = (codice: number, valore: string | number) => { righe.push(String(codice), String(valore)); };
  const layers = meshes.map((m, i) => nomeLayer(m.nome, i));
  add(0, "SECTION"); add(2, "HEADER");
  add(9, "$ACADVER"); add(1, "AC1009");
  add(9, "$INSUNITS"); add(70, unita === "mm" ? 4 : 6);
  add(0, "ENDSEC");
  add(0, "SECTION"); add(2, "TABLES");
  add(0, "TABLE"); add(2, "LAYER"); add(70, layers.length);
  layers.forEach((l, i) => { add(0, "LAYER"); add(2, l); add(70, 0); add(62, coloreAci(meshes[i]!.colore)); add(6, "CONTINUOUS"); });
  add(0, "ENDTAB"); add(0, "ENDSEC");
  add(0, "SECTION"); add(2, "ENTITIES");
  meshes.forEach((m, mi) => {
    const p = m.posizioni;
    const n = numeroTriangoli(m);
    for (let t = 0; t < n; t++) {
      const idx = m.indici ? [m.indici[t * 3]!, m.indici[t * 3 + 1]!, m.indici[t * 3 + 2]!] : [t * 3, t * 3 + 1, t * 3 + 2];
      const v = idx.map((i) => [p[i * 3]! * scala, p[i * 3 + 1]! * scala, p[i * 3 + 2]! * scala]);
      add(0, "3DFACE"); add(8, layers[mi]!);
      const vertici = [v[0]!, v[1]!, v[2]!, v[2]!];
      vertici.forEach((q, k) => { add(10 + k, num(q[0]!)); add(20 + k, num(q[1]!)); add(30 + k, num(q[2]!)); });
    }
  });
  add(0, "ENDSEC"); add(0, "EOF");
  return righe.join("\r\n") + "\r\n";
}
