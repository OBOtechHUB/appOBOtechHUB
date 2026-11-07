import type { DatiEdificio } from "./progettoStore";
import type { StatoEsteso } from "./statoProgetto";
import { avvisoRelazione } from "./esportazioni";
import { riepilogo, vociPerTipo, type Intervalli, type Scadenze } from "@/calcoli/verifiche/verifiche";

const lunghezza = (punti: [number, number, number][]) => punti.slice(1).reduce((s, p, i) => { const q = punti[i]!; return s + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }, 0);
const NOMI_ESITO = { C: "Conforme", NC: "NON conforme", NA: "Non applicabile", "": "—" } as const;

/** Dossier tecnico in PDF: dati della struttura, consistenza dell'LPS, piano e registro delle verifiche. */
export async function creaDossier(d: DatiEdificio, s: StatoEsteso, intervalli: Intervalli, scadenze: Scadenze): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const pdf = new jsPDF();
  const margin = { top: 20, bottom: 24, left: 16, right: 16 };
  const fine = () => (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  let y = 20;
  pdf.setFontSize(18); pdf.text("Dossier tecnico LPS", 16, y); y += 8;
  pdf.setFontSize(10); pdf.text(`${d.nomeProgetto || "Progetto senza nome"}${d.comune ? " · " + d.comune : ""} · generato il ${new Date().toLocaleDateString("it-IT")}`, 16, y); y += 8;

  const metri = (tipo: string) => s.conduttori.filter((c) => c.tipo === tipo).reduce((t, c) => t + lunghezza(c.punti as [number, number, number][]), 0);
  autoTable(pdf, { startY: y, margin, head: [["Consistenza dell'impianto", ""]], body: [
    ["Livello di protezione (LPL)", s.lpl],
    ["Dimensioni edificio L × W × H", `${d.L} × ${d.W} × ${d.H} m`],
    ["Aste di captazione", String(s.aste.length)],
    ["Conduttori di captazione", `${metri("captazione").toFixed(1)} m`],
    ["Calate", `${s.conduttori.filter((c) => c.tipo === "calata").length} (${metri("calata").toFixed(1)} m)`],
    ["Impianto di terra", s.terra ? `tipo ${s.terra.tipo} · ${metri("terra").toFixed(1)} m · ${s.picchetti.length} picchetti` : "non definito"],
    ["Supporti / morsetti / compensatori", `${s.supporti.length} / ${s.morsetti.length} / ${s.compensatori.length}`],
  ] });
  y = fine();

  autoTable(pdf, { startY: y, margin, head: [["Piano delle verifiche", "Intervallo", "Prossima scadenza"]], body: [
    ["Verifica visiva", `${intervalli.visiva} anni`, scadenze.visiva ?? "da programmare"],
    [s.pianoVerifiche.critico ? "Verifica completa (sistema critico)" : "Verifica completa", `${s.pianoVerifiche.critico ? intervalli.critica : intervalli.completa} anni`, scadenze.completa ?? "da programmare"],
  ] });
  y = fine();

  const ordinate = [...s.verifiche].sort((a, b) => b.data.localeCompare(a.data));
  autoTable(pdf, { startY: y, margin, head: [["Data", "Tipo", "Verificatore", "R terra (Ω)", "Esito"]], body: ordinate.length
    ? ordinate.map((v) => [v.data, v.tipo, v.verificatore || "—", v.resistenzaTerra?.toFixed(2) ?? "—", riepilogo(v).esito])
    : [["—", "Nessuna verifica registrata", "", "", ""]] });
  y = fine();

  for (const v of ordinate) {
    pdf.addPage(); y = 20;
    const r = riepilogo(v);
    pdf.setFontSize(14); pdf.text(`Verifica ${v.tipo} del ${v.data}`, 16, y); y += 7;
    pdf.setFontSize(10); pdf.text(`Verificatore: ${v.verificatore || "—"} · Esito: ${r.esito} (C ${r.conformi}, NC ${r.nonConformi}, NA ${r.nonApplicabili}, da compilare ${r.daCompilare})`, 16, y); y += 6;
    if (v.resistenzaTerra !== null || v.continuitaMax !== null) { pdf.text(`Misure: R terra ${v.resistenzaTerra?.toFixed(2) ?? "—"} Ω · continuità max ${v.continuitaMax?.toFixed(2) ?? "—"} Ω`, 16, y); y += 6; }
    const voci = vociPerTipo(v.tipo);
    autoTable(pdf, { startY: y + 2, margin, head: [["Sezione", "Controllo", "Esito", "Nota"]], body: voci.map((x) => [x.sezione, x.testo, NOMI_ESITO[v.esiti[x.id]?.esito ?? ""], v.esiti[x.id]?.nota ?? ""]),
      didParseCell: (c) => { if (c.section === "body" && c.column.index === 2 && c.cell.raw === NOMI_ESITO.NC) c.cell.styles.textColor = [179, 38, 30]; } });
    y = fine();
    if (v.note) { pdf.text(pdf.splitTextToSize(`Note: ${v.note}`, 178), 16, y); }
  }

  const pagine = pdf.getNumberOfPages();
  for (let i = 1; i <= pagine; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.text(`${avvisoRelazione} · CEI EN IEC 62305-3, allegato E · pagina ${i}/${pagine}`, 16, 290); }
  return pdf.output("blob");
}
