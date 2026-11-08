import type { DatiEdificio } from "./progettoStore";
import type { StatoEsteso } from "./statoProgetto";
import { avvisoRelazione } from "./esportazioni";
import { L, locale, tx } from "./lingua";
import { riepilogo, vociPerTipo, type Intervalli, type Scadenze } from "@/calcoli/verifiche/verifiche";

const lunghezza = (punti: [number, number, number][]) => punti.slice(1).reduce((s, p, i) => { const q = punti[i]!; return s + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }, 0);
const nomiEsito = () => ({ C: L("Conforme", "Compliant"), NC: L("NON conforme", "NOT compliant"), NA: L("Non applicabile", "Not applicable"), "": "—" }) as const;

/** Dossier tecnico in PDF: dati della struttura, consistenza dell'LPS, piano e registro delle verifiche. */
export async function creaDossier(d: DatiEdificio, s: StatoEsteso, intervalli: Intervalli, scadenze: Scadenze): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const pdf = new jsPDF();
  const margin = { top: 20, bottom: 24, left: 16, right: 16 };
  const fine = () => (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  let y = 20;
  pdf.setFontSize(18); pdf.text(L("Dossier tecnico LPS", "LPS technical dossier"), 16, y); y += 8;
  pdf.setFontSize(10); pdf.text(`${d.nomeProgetto || L("Progetto senza nome", "Untitled project")}${d.comune ? " · " + d.comune : ""} · ${L("generato il", "generated on")} ${new Date().toLocaleDateString(locale())}`, 16, y); y += 8;

  const metri = (tipo: string) => s.conduttori.filter((c) => c.tipo === tipo).reduce((t, c) => t + lunghezza(c.punti as [number, number, number][]), 0);
  autoTable(pdf, { startY: y, margin, head: [[L("Consistenza dell'impianto", "System inventory"), ""]], body: [
    [L("Livello di protezione (LPL)", "Lightning protection level (LPL)"), s.lpl],
    [L("Dimensioni edificio L × W × H", "Building dimensions L × W × H"), `${d.L} × ${d.W} × ${d.H} m`],
    [L("Aste di captazione", "Air-termination rods"), String(s.aste.length)],
    [L("Conduttori di captazione", "Air-termination conductors"), `${metri("captazione").toFixed(1)} m`],
    [L("Calate", "Down conductors"), `${s.conduttori.filter((c) => c.tipo === "calata").length} (${metri("calata").toFixed(1)} m)`],
    [L("Impianto di terra", "Earthing system"), s.terra ? `${L("tipo", "type")} ${s.terra.tipo} · ${metri("terra").toFixed(1)} m · ${s.picchetti.length} ${L("picchetti", "rods")}` : L("non definito", "not defined")],
    [L("Supporti / morsetti / compensatori", "Supports / clamps / compensators"), `${s.supporti.length} / ${s.morsetti.length} / ${s.compensatori.length}`],
  ] });
  y = fine();

  autoTable(pdf, { startY: y, margin, head: [[L("Piano delle verifiche", "Inspection plan"), L("Intervallo", "Interval"), L("Prossima scadenza", "Next due date")]], body: [
    [L("Verifica visiva", "Visual inspection"), `${intervalli.visiva} ${L("anni", "years")}`, scadenze.visiva ?? L("da programmare", "to be scheduled")],
    [s.pianoVerifiche.critico ? L("Verifica completa (sistema critico)", "Full inspection (critical system)") : L("Verifica completa", "Full inspection"), `${s.pianoVerifiche.critico ? intervalli.critica : intervalli.completa} ${L("anni", "years")}`, scadenze.completa ?? L("da programmare", "to be scheduled")],
  ] });
  y = fine();

  const ordinate = [...s.verifiche].sort((a, b) => b.data.localeCompare(a.data));
  autoTable(pdf, { startY: y, margin, head: [[L("Data", "Date"), L("Tipo", "Type"), L("Verificatore", "Inspector"), L("R terra (Ω)", "Earth R (Ω)"), L("Esito", "Result")]], body: ordinate.length
    ? ordinate.map((v) => [v.data, tx(v.tipo), v.verificatore || "—", v.resistenzaTerra?.toFixed(2) ?? "—", tx(riepilogo(v).esito)])
    : [["—", L("Nessuna verifica registrata", "No inspections recorded"), "", "", ""]] });
  y = fine();

  for (const v of ordinate) {
    pdf.addPage(); y = 20;
    const r = riepilogo(v);
    pdf.setFontSize(14); pdf.text(L(`Verifica ${v.tipo} del ${v.data}`, `${tx(v.tipo)} inspection of ${v.data}`), 16, y); y += 7;
    pdf.setFontSize(10); pdf.text(`${L("Verificatore", "Inspector")}: ${v.verificatore || "—"} · ${L("Esito", "Result")}: ${tx(r.esito)} (C ${r.conformi}, NC ${r.nonConformi}, NA ${r.nonApplicabili}, ${L("da compilare", "to fill in")} ${r.daCompilare})`, 16, y); y += 6;
    if (v.resistenzaTerra !== null || v.continuitaMax !== null) { pdf.text(`${L("Misure: R terra", "Measurements: earth R")} ${v.resistenzaTerra?.toFixed(2) ?? "—"} Ω · ${L("continuità max", "max continuity")} ${v.continuitaMax?.toFixed(2) ?? "—"} Ω`, 16, y); y += 6; }
    const voci = vociPerTipo(v.tipo);
    autoTable(pdf, { startY: y + 2, margin, head: [[L("Sezione", "Section"), L("Controllo", "Check"), L("Esito", "Result"), L("Nota", "Note")]], body: voci.map((x) => [tx(x.sezione), tx(x.testo), nomiEsito()[v.esiti[x.id]?.esito ?? ""], v.esiti[x.id]?.nota ?? ""]),
      didParseCell: (c) => { if (c.section === "body" && c.column.index === 2 && c.cell.raw === nomiEsito().NC) c.cell.styles.textColor = [179, 38, 30]; } });
    y = fine();
    if (v.note) { pdf.text(pdf.splitTextToSize(`${L("Note", "Notes")}: ${v.note}`, 178), 16, y); }
  }

  const pagine = pdf.getNumberOfPages();
  for (let i = 1; i <= pagine; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.text(`${avvisoRelazione()} · CEI EN IEC 62305-3, ${L("allegato E", "annex E")} · ${L("pagina", "page")} ${i}/${pagine}`, 16, 290); }
  return pdf.output("blob");
}
