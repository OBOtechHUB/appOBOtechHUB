/**
 * Documentazione del progetto: categoria proposta dal nome e dal tipo del file (si può cambiare a mano).
 * Logica pura: nessun accesso a rete o interfaccia.
 */
export type CategoriaDocumento = "planimetria" | "prospetti" | "relazione" | "atex" | "foto" | "altro";
export const CATEGORIE_DOCUMENTO: { id: CategoriaDocumento; nome: string }[] = [
  { id: "planimetria", nome: "Planimetria / pianta" },
  { id: "prospetti", nome: "Prospetti e sezioni" },
  { id: "relazione", nome: "Relazione / documento" },
  { id: "atex", nome: "Zone ATEX" },
  { id: "foto", nome: "Foto" },
  { id: "altro", nome: "Altro" },
];

const senzaAccenti = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function categoriaDocumento(nome: string, tipo = ""): CategoriaDocumento {
  const n = senzaAccenti(nome);
  if (/atex|zon[ae]\s*[_-]?\s*(0|1|2|20|21|22)\b|classificazione.*(luogh|zon)|esplosiv|\bdpe\b|\bdocumento.?protezione.?esplosion/.test(n)) return "atex";
  if (/prospett|sezion|elevation|section|facciat/.test(n)) return "prospetti";
  if (/planimetr|pianta|piante|layout|plan\b|floor|copertur|tetto|roof|inquadramento|catast/.test(n)) return "planimetria";
  if (/\.(dwg|dxf|ifc|step|stp|skp|rvt)$/.test(n)) return "planimetria";
  if (/^image\//.test(tipo) || /\.(jpe?g|png|webp|heic|heif)$/.test(n)) return "foto";
  if (/relazion|report|verbale|capitolat|specific|dichiaraz|\.(docx?|odt|rtf|txt|xlsx?|ods)$/.test(n)) return "relazione";
  return "altro";
}

/** File che l'importazione dell'edificio sa leggere (pianta o modello). */
export const importabileNelModello = (nome: string) => /\.(dxf|dwg|pdf|png|jpe?g|webp|ifc|obj|stl|ply|glb|gltf|step|stp|iges|igs)$/i.test(nome);

export function dimensioneLeggibile(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1048576) return `${(byte / 1024).toLocaleString("it-IT", { maximumFractionDigits: 0 })} kB`;
  return `${(byte / 1048576).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB`;
}
