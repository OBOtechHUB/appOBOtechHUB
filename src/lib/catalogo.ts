import { z } from "zod";
import { categorie, type Articolo } from "@/calcoli/materiali/tipi";

export const articoloSchema = z.object({
  codice: z.string().trim().min(1, "Codice obbligatorio").max(100),
  descrizione: z.string().trim().min(1, "Descrizione obbligatoria").max(500),
  categoria: z.enum(categorie), unita: z.enum(["m", "pz"]),
  materiale: z.string().max(200).default(""), sezione: z.string().max(100).default(""),
  prezzo: z.number().finite().nonnegative().optional(),
});
export function validaCatalogo(righe: unknown[]): Articolo[] {
  if (righe.length > 5000) throw new Error("Massimo 5.000 articoli per importazione.");
  const codici = new Set<string>();
  return righe.map((r, i) => {
    const esito = articoloSchema.safeParse(r);
    if (!esito.success) throw new Error(`Riga ${i + 2}: ${esito.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")}`);
    if (codici.has(esito.data.codice)) throw new Error(`Riga ${i + 2}: codice duplicato ${esito.data.codice}.`);
    codici.add(esito.data.codice); return esito.data;
  });
}
export async function importaCatalogo(file: File): Promise<Articolo[]> {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("Seleziona un file Excel o CSV.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Il file supera 10 MB.");
  const XLSX = await import("xlsx");
  const libro = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const nome = libro.SheetNames[0]; const foglio = nome ? libro.Sheets[nome] : undefined;
  if (!foglio) throw new Error("Il file non contiene fogli.");
  const righe = XLSX.utils.sheet_to_json<Record<string, unknown>>(foglio, { defval: "" });
  if (!righe.length) throw new Error("Nessun articolo trovato.");
  return validaCatalogo(righe.map((r) => {
    const n = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v]));
    const prezzo = n["prezzo"] === "" || n["prezzo"] == null ? undefined : Number(String(n["prezzo"]).replace(",", "."));
    return { codice: String(n["codice"] ?? ""), descrizione: String(n["descrizione"] ?? ""), categoria: String(n["categoria"] ?? "").trim().toLowerCase(), unita: String(n["unita"] ?? "").trim().toLowerCase(), materiale: String(n["materiale"] ?? ""), sezione: String(n["sezione"] ?? ""), prezzo };
  }));
}