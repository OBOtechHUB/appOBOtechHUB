import type { DatiEdificio } from "./progettoStore";
import type { RigaComputo, RisultatiModuli } from "@/calcoli/materiali/tipi";
import { categorie } from "@/calcoli/materiali/tipi";
import { areaRaccolta } from "@/calcoli/rischio/areaRaccolta";
import { eventiPericolosi } from "@/calcoli/rischio/eventiPericolosi";
import fattori from "@/dati/rischio/fattorePosizione.json";
import { L, locale, tx } from "./lingua";

export const avvisoRelazioneIt = "Calcoli di supporto alla progettazione – da validare da tecnico abilitato";
/** Avviso a piè di pagina nella lingua attiva. */
export const avvisoRelazione = () => L(avvisoRelazioneIt, "Design support calculations – to be validated by a qualified engineer");
export function scarica(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function creaExcel(righe: RigaComputo[], mancanti: string[]): Promise<Blob> {
  const XLSX = await import("xlsx");
  const dati = [[L("Categoria", "Category"), L("Codice", "Code"), L("Descrizione", "Description"), L("Unità", "Unit"), L("Quantità", "Quantity"), L("Materiale", "Material"), L("Sezione", "Cross-section"), L("Prezzo unitario (€)", "Unit price (€)"), L("Importo (€)", "Amount (€)"), L("Provenienza", "Source"), L("Modifica manuale", "Manual edit")]];
  const foglio = XLSX.utils.aoa_to_sheet(dati);
  righe.forEach((r, i) => {
    const n = i + 2;
    XLSX.utils.sheet_add_aoa(foglio, [[tx(r.categoria), r.codice, tx(r.descrizione), r.unita, r.quantita, tx(r.materiale), r.sezione, r.prezzo ?? null, null, tx(r.provenienza), r.manuale ? L("Sì", "Yes") : "No"]], { origin: `A${n}` });
    foglio[`E${n}`].z = '#,##0.00;(#,##0.00);"-"';
    foglio[`I${n}`] = { t: "n", f: `IF(ISNUMBER(H${n}),E${n}*H${n},0)`, v: r.prezzo == null ? 0 : r.quantita * r.prezzo, z: '€ #,##0.00;(€ #,##0.00);"-"' };
  });
  if (righe.length) foglio[`I${righe.length + 2}`] = { t: "n", f: `SUM(I2:I${righe.length + 1})`, v: righe.reduce((s, r) => s + r.quantita * (r.prezzo ?? 0), 0), z: '€ #,##0.00;(€ #,##0.00);"-"' };
  foglio["!cols"] = [18, 18, 48, 8, 12, 18, 18, 22, 18, 18, 20].map((wch) => ({ wch }));
  const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, foglio, L("Computo", "Bill of materials"));
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([[L("Stato", "Status")], [mancanti.length ? L("Computo incompleto", "Bill of materials incomplete") : L("Da validare", "To be validated")], ...mancanti.map((m) => [`${L("Dati mancanti", "Missing data")}: ${tx(m)}`]), [L("Prezzi assenti esclusi dal totale; prezzi e importi in euro.", "Missing prices are excluded from the total; prices and amounts in euro.")], [avvisoRelazione()]]), L("Note", "Notes"));
  return new Blob([XLSX.write(libro, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
export async function creaRelazione(d: DatiEdificio, risultati: RisultatiModuli, righe: RigaComputo[], mancanti: string[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const pdf = new jsPDF(); let y = 20;
  const testo = (value: string, titolo = false) => {
    pdf.setFont("helvetica", titolo ? "bold" : "normal"); pdf.setFontSize(titolo ? 13 : 10);
    const lines: string[] = pdf.splitTextToSize(value, 178);
    for (const line of lines) { if (y > 267) { pdf.addPage(); y = 20; } pdf.text(line, 16, y); y += titolo ? 7 : 5; }
    y += 3;
  };
  const mancante = L("Dati mancanti — modulo non ancora compilato. Nessun risultato validato.", "Missing data — module not yet completed. No validated result.");
  const ni = L("Non indicato", "Not specified"), sn = (b: boolean) => (b ? L("Sì", "Yes") : "No"), num = (v: number) => v.toLocaleString(locale(), { maximumFractionDigits: 2 });
  testo(L("Progettazione LPS — Relazione di progetto", "LPS Design — Design report"), true);
  testo(`CEI EN IEC 62305:2024 · ${new Date().toLocaleDateString(locale())}`);
  testo(L("BOZZA DI PROGETTO — DA VALIDARE", "DRAFT DESIGN — TO BE VALIDATED"), true);
  if (mancanti.length) testo(`${L("Computo incompleto", "Bill of materials incomplete")}: ${mancanti.map(tx).join(", ")}.`);
  testo(L("1. Dati edificio", "1. Building data"), true);
  testo(`${L("Progetto", "Project")}: ${d.nomeProgetto || ni}\n${L("Comune", "Municipality")}: ${d.comune || ni}${d.indirizzo ? `\n${L("Indirizzo", "Address")}: ${d.indirizzo}` : ""}${typeof d.lat === "number" && typeof d.lon === "number" ? `\n${L("Coordinate", "Coordinates")}: ${d.lat.toFixed(5)}, ${d.lon.toFixed(5)}` : ""}\n${L("Dimensioni", "Dimensions")} L × W × H: ${d.L} × ${d.W} × ${d.H} m\n${L("Copertura", "Roof")}: ${tx(d.copertura)}; ${L("struttura", "structure")}: ${tx(d.materiale)}\n${L("Impianti sul tetto", "Rooftop installations")}: ${sn(d.impiantiTetto)}`);
  const cd = fattori.find((f) => f.id === d.posizioneId);
  const ad = areaRaccolta(d.L, d.W, d.H);
  testo(`${L("Area di raccolta", "Collection area")} AD: ${num(ad)} m²\n${L("Posizione", "Location")}: ${cd?.descrizione ? tx(cd.descrizione) : ni}; CD: ${cd?.valore ?? ni}\n${L("Densità", "Density")}: ${d.densita} ${L("fulmini/km²·anno", "flashes/km²·year")}\nNSG = 2 · NG: ${num(2 * d.densita)} ${L("punti di impatto/km²·anno (k = 2, CEI EN IEC 62305-2:2024, A.1)", "strike points/km²·year (k = 2, CEI EN IEC 62305-2:2024, A.1)")}\nND: ${eventiPericolosi(2 * d.densita, ad, cd?.valore ?? 1).toFixed(4)} ${L("eventi/anno (non costituisce analisi del rischio).", "events/year (not a risk assessment).")}`);
  testo(L("2. Analisi del rischio e LPL", "2. Risk assessment and LPL"), true);
  testo(risultati.rischio ? `${L("Esito", "Result")}: ${tx(risultati.rischio.esito)}\nLPL: ${risultati.rischio.lpl}` : mancante);
  testo(L("3. Captazione", "3. Air-termination"), true);
  testo(risultati.captazione ? `${tx(risultati.captazione.descrizione)}\n${L("Conduttori", "Conductors")}: ${risultati.captazione.lunghezzaConduttori} m; ${L("giunzioni", "joints")}: ${risultati.captazione.giunzioni}; ${L("incroci", "crossings")}: ${risultati.captazione.incroci}` : mancante);
  const ver = risultati.captazione?.verifica;
  if (ver) {
    testo(L(`La captazione è verificata combinando il metodo della sfera rotolante e il metodo della maglia (CEI EN IEC 62305-3:2024): una parte di copertura è considerata protetta se è protetta da almeno uno dei due metodi. Superficie protetta dalla sfera rotolante: ${ver.areaProtettaSfera.toFixed(1)} m²; dalla maglia: ${ver.areaProtettaMaglia.toFixed(1)} m²; esposta: ${ver.areaEsposta.toFixed(1)} m². Le maglie sono individuate automaticamente dal tracciato dei conduttori e misurate come interasse dei conduttori.`, `The air-termination is checked by combining the rolling sphere method and the mesh method (CEI EN IEC 62305-3:2024): a roof area is considered protected if at least one of the two methods protects it. Area protected by the rolling sphere: ${ver.areaProtettaSfera.toFixed(1)} m²; by the mesh: ${ver.areaProtettaMaglia.toFixed(1)} m²; exposed: ${ver.areaEsposta.toFixed(1)} m². Meshes are identified automatically from the conductor layout and measured as conductor spacing.`));
    if (ver.maglie.length) {
      if (y > 240) { pdf.addPage(); y = 20; }
      autoTable(pdf, { startY: y, margin: { top: 20, bottom: 24, left: 16, right: 16 }, head: [[L("Maglia", "Mesh"), L("Dimensioni", "Dimensions"), L("Esito", "Result"), L("Motivo", "Reason")]], body: ver.maglie.map((m) => [`#${m.id + 1}`, `${m.lunghezza.toFixed(1)} × ${m.larghezza.toFixed(1)} m`, m.conforme ? L("Conforme", "Compliant") : L("Non conforme", "Not compliant"), m.motivo ? tx(m.motivo) : "—"]), styles: { font: "helvetica", fontSize: 9 }, theme: "grid" });
      const tabella = pdf as typeof pdf & { lastAutoTable?: { finalY: number } }; y = (tabella.lastAutoTable?.finalY ?? y) + 8;
    }
  }
  testo(L("4. Calate e distanze di separazione", "4. Down conductors and separation distances"), true);
  testo(risultati.calate ? `${L("Calate", "Down conductors")}: ${risultati.calate.numero}; ${L("conduttori", "conductors")}: ${risultati.calate.lunghezzaConduttori} m; ${L("distanza di separazione", "separation distance")}: ${risultati.calate.distanzaSeparazione} m` : mancante);
  testo(L("5. Impianto di terra", "5. Earthing system"), true);
  testo(risultati.terra ? `${tx(risultati.terra.descrizione)}\n${L("Picchetti", "Earth rods")}: ${risultati.terra.numeroPicchetti} × ${risultati.terra.lunghezzaPicchetto} m; ${L("anello", "ring")}: ${risultati.terra.lunghezzaAnello} m` : mancante);
  testo("6. SPD", true);
  testo(risultati.spd ? `${tx(risultati.spd.descrizione)}\n${risultati.spd.dispositivi.map((s) => `${s.codice}: ${tx(s.descrizione)} (${s.quantita} ${L("pz", "pcs")})`).join("\n")}` : mancante);
  testo(L("7. Computo materiali", "7. Bill of materials"), true);
  if (!righe.length) testo(L("Nessuna riga disponibile.", "No rows available."));
  for (const categoria of categorie) {
    const gruppo = righe.filter((r) => r.categoria === categoria); if (!gruppo.length) continue;
    if (y > 240) { pdf.addPage(); y = 20; }
    testo(tx(categoria).toUpperCase(), true);
    autoTable(pdf, { startY: y, margin: { top: 20, bottom: 24, left: 16, right: 16 }, head: [[L("Codice", "Code"), L("Descrizione", "Description"), L("Quantità", "Quantity"), L("Origine", "Origin")]], body: gruppo.map((r) => [r.codice || L("Da assegnare", "To be assigned"), tx(r.descrizione), `${num(r.quantita)} ${r.unita}`, `${tx(r.provenienza)}${r.manuale ? L(" (modifica manuale)", " (manual edit)") : ""}`]), styles: { font: "helvetica", fontSize: 9 }, theme: "grid" });
    const tabella = pdf as typeof pdf & { lastAutoTable?: { finalY: number } }; y = (tabella.lastAutoTable?.finalY ?? y) + 8;
  }
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    pdf.text(avvisoRelazione(), 16, 282); pdf.text(`${i} / ${pdf.getNumberOfPages()}`, 194, 290, { align: "right" });
  }
  return pdf.output("blob");
}