import type { DatiEdificio } from "./progettoStore";
import type { RigaComputo, RisultatiModuli } from "@/calcoli/materiali/tipi";
import { categorie } from "@/calcoli/materiali/tipi";
import { areaRaccolta } from "@/calcoli/rischio/areaRaccolta";
import { eventiPericolosi } from "@/calcoli/rischio/eventiPericolosi";
import fattori from "@/dati/rischio/fattorePosizione.json";

export const avvisoRelazione = "Calcoli di supporto alla progettazione – da validare da tecnico abilitato";
export function scarica(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function creaExcel(righe: RigaComputo[], mancanti: string[]): Promise<Blob> {
  const XLSX = await import("xlsx");
  const dati = [["Categoria", "Codice", "Descrizione", "Unità", "Quantità", "Materiale", "Sezione", "Prezzo unitario (€)", "Importo (€)", "Provenienza", "Modifica manuale"]];
  const foglio = XLSX.utils.aoa_to_sheet(dati);
  righe.forEach((r, i) => {
    const n = i + 2;
    XLSX.utils.sheet_add_aoa(foglio, [[r.categoria, r.codice, r.descrizione, r.unita, r.quantita, r.materiale, r.sezione, r.prezzo ?? null, null, r.provenienza, r.manuale ? "Sì" : "No"]], { origin: `A${n}` });
    foglio[`E${n}`].z = '#,##0.00;(#,##0.00);"-"';
    foglio[`I${n}`] = { t: "n", f: `IF(ISNUMBER(H${n}),E${n}*H${n},0)`, v: r.prezzo == null ? 0 : r.quantita * r.prezzo, z: '€ #,##0.00;(€ #,##0.00);"-"' };
  });
  if (righe.length) foglio[`I${righe.length + 2}`] = { t: "n", f: `SUM(I2:I${righe.length + 1})`, v: righe.reduce((s, r) => s + r.quantita * (r.prezzo ?? 0), 0), z: '€ #,##0.00;(€ #,##0.00);"-"' };
  foglio["!cols"] = [18, 18, 48, 8, 12, 18, 18, 22, 18, 18, 20].map((wch) => ({ wch }));
  const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, foglio, "Computo");
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([["Stato"], [mancanti.length ? "Computo incompleto" : "Da validare"], ...mancanti.map((m) => [`Dati mancanti: ${m}`]), ["Prezzi assenti esclusi dal totale; prezzi e importi in euro."], [avvisoRelazione]]), "Note");
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
  const mancante = "Dati mancanti — modulo non ancora compilato. Nessun risultato validato.";
  testo("Progettazione LPS — Relazione di progetto", true);
  testo(`CEI EN IEC 62305:2024 · ${new Date().toLocaleDateString("it-IT")}`);
  testo("BOZZA DI PROGETTO — DA VALIDARE", true);
  if (mancanti.length) testo(`Computo incompleto: ${mancanti.join(", ")}.`);
  testo("1. Dati edificio", true);
  testo(`Progetto: ${d.nomeProgetto || "Non indicato"}\nComune: ${d.comune || "Non indicato"}\nDimensioni L × W × H: ${d.L} × ${d.W} × ${d.H} m\nCopertura: ${d.copertura}; struttura: ${d.materiale}\nImpianti sul tetto: ${d.impiantiTetto ? "Sì" : "No"}`);
  const cd = fattori.find((f) => f.id === d.posizioneId);
  const ad = areaRaccolta(d.L, d.W, d.H);
  testo(`Area di raccolta AD: ${ad.toLocaleString("it-IT", { maximumFractionDigits: 2 })} m²\nPosizione: ${cd?.descrizione ?? "Non indicata"}; CD: ${cd?.valore ?? "Non indicato"}\nDensità: ${d.densita} fulmini/km²·anno\nND: ${eventiPericolosi(d.densita, ad, cd?.valore ?? 1).toFixed(4)} eventi/anno (non costituisce analisi del rischio).`);
  testo("2. Analisi del rischio e LPL", true);
  testo(risultati.rischio ? `Esito: ${risultati.rischio.esito}\nLPL: ${risultati.rischio.lpl}` : mancante);
  testo("3. Captazione", true);
  testo(risultati.captazione ? `${risultati.captazione.descrizione}\nConduttori: ${risultati.captazione.lunghezzaConduttori} m; giunzioni: ${risultati.captazione.giunzioni}; incroci: ${risultati.captazione.incroci}` : mancante);
  const ver = risultati.captazione?.verifica;
  if (ver) {
    testo(`La captazione è verificata combinando il metodo della sfera rotolante e il metodo della maglia (CEI EN IEC 62305-3:2024): una parte di copertura è considerata protetta se è protetta da almeno uno dei due metodi. Superficie protetta dalla sfera rotolante: ${ver.areaProtettaSfera.toFixed(1)} m²; dalla maglia: ${ver.areaProtettaMaglia.toFixed(1)} m²; esposta: ${ver.areaEsposta.toFixed(1)} m². Le maglie sono individuate automaticamente dal tracciato dei conduttori e misurate come interasse dei conduttori.`);
    if (ver.maglie.length) {
      if (y > 240) { pdf.addPage(); y = 20; }
      autoTable(pdf, { startY: y, margin: { top: 20, bottom: 24, left: 16, right: 16 }, head: [["Maglia", "Dimensioni", "Esito", "Motivo"]], body: ver.maglie.map((m) => [`#${m.id + 1}`, `${m.lunghezza.toFixed(1)} × ${m.larghezza.toFixed(1)} m`, m.conforme ? "Conforme" : "Non conforme", m.motivo ?? "—"]), styles: { font: "helvetica", fontSize: 9 }, theme: "grid" });
      const tabella = pdf as typeof pdf & { lastAutoTable?: { finalY: number } }; y = (tabella.lastAutoTable?.finalY ?? y) + 8;
    }
  }
  testo("4. Calate e distanze di separazione", true);
  testo(risultati.calate ? `Calate: ${risultati.calate.numero}; conduttori: ${risultati.calate.lunghezzaConduttori} m; distanza di separazione: ${risultati.calate.distanzaSeparazione} m` : mancante);
  testo("5. Impianto di terra", true);
  testo(risultati.terra ? `${risultati.terra.descrizione}\nPicchetti: ${risultati.terra.numeroPicchetti} da ${risultati.terra.lunghezzaPicchetto} m; anello: ${risultati.terra.lunghezzaAnello} m` : mancante);
  testo("6. SPD", true);
  testo(risultati.spd ? `${risultati.spd.descrizione}\n${risultati.spd.dispositivi.map((s) => `${s.codice}: ${s.descrizione} (${s.quantita} pz)`).join("\n")}` : mancante);
  testo("7. Computo materiali", true);
  if (!righe.length) testo("Nessuna riga disponibile.");
  for (const categoria of categorie) {
    const gruppo = righe.filter((r) => r.categoria === categoria); if (!gruppo.length) continue;
    if (y > 240) { pdf.addPage(); y = 20; }
    testo(categoria.toUpperCase(), true);
    autoTable(pdf, { startY: y, margin: { top: 20, bottom: 24, left: 16, right: 16 }, head: [["Codice", "Descrizione", "Quantità", "Origine"]], body: gruppo.map((r) => [r.codice || "Da assegnare", r.descrizione, `${r.quantita.toLocaleString("it-IT", { maximumFractionDigits: 2 })} ${r.unita}`, `${r.provenienza}${r.manuale ? " (modifica manuale)" : ""}`]), styles: { font: "helvetica", fontSize: 9 }, theme: "grid" });
    const tabella = pdf as typeof pdf & { lastAutoTable?: { finalY: number } }; y = (tabella.lastAutoTable?.finalY ?? y) + 8;
  }
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    pdf.text(avvisoRelazione, 16, 282); pdf.text(`${i} / ${pdf.getNumberOfPages()}`, 194, 290, { align: "right" });
  }
  return pdf.output("blob");
}