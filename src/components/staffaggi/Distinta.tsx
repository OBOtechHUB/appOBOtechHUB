/** Distinta dei materiali del progetto di staffaggio con codici OBO, prezzi di listino e uscite (Excel, Word, DXF, PDF). */
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, PenTool, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RisultatoTratta } from "@/calcoli/staffaggi/calcolo";
import { distintaProgetto, type CatalogoStaffaggi } from "@/calcoli/staffaggi/componenti";
import type { ProgettoStaffaggi } from "@/calcoli/staffaggi/tipi";
import { prezziListino } from "@/lib/listino";
import type { VoceListino } from "@/lib/listinoMetel";
import { scarica } from "@/lib/esportazioni";

const euro = (v: number) => v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const nomeFile = (pr: ProgettoStaffaggi) => `Staffaggi_${(pr.codice || pr.nome || "progetto").replace(/[^\w-]+/g, "_").slice(0, 60)}`;

export function Distinta({ progetto: pr, risultati, catalogo }: { progetto: ProgettoStaffaggi; risultati: RisultatoTratta[]; catalogo: CatalogoStaffaggi & { caricato: boolean } }) {
  const righe = useMemo(() => distintaProgetto(pr, risultati, catalogo), [pr, risultati, catalogo]);
  const [prezzi, setPrezzi] = useState<Map<string, VoceListino>>(new Map());
  const [msg, setMsg] = useState("");
  const codici = righe.map((r) => r.codice).filter((c): c is string => !!c).join(",");
  useEffect(() => {
    if (!codici) return;
    let vivo = true;
    prezziListino(codici.split(",")).then(({ voci }) => vivo && setPrezzi(voci), () => {});
    return () => { vivo = false; };
  }, [codici]);
  const prezzo = (c: string | null) => { const v = c ? prezzi.get(c) : undefined; return v ? v.prezzoPubblico / (v.moltiplicatore || 1) : null; };
  const totale = righe.reduce((s, r) => s + (prezzo(r.codice) ?? 0) * r.quantita, 0);

  async function excel() {
    const XLSX = await import("xlsx");
    const f = XLSX.utils.aoa_to_sheet([["Codice OBO", "Descrizione", "Finitura", "Unità", "Quantità", "Prezzo di listino (€)", "Importo (€)", "Tratte"]]);
    righe.forEach((r, i) => {
      const n = i + 2, p = prezzo(r.codice);
      XLSX.utils.sheet_add_aoa(f, [[r.codice ?? "da assegnare", r.descrizione, r.finitura, r.unita, r.quantita, p, null, r.tratte.join(", ")]], { origin: `A${n}` });
      if (f[`F${n}`]) f[`F${n}`].z = "#,##0.00";
      f[`G${n}`] = { t: "n", f: `IF(ISNUMBER(F${n}),E${n}*F${n},0)`, v: (p ?? 0) * r.quantita, z: "#,##0.00" };
    });
    const n = righe.length + 2;
    f[`F${n}`] = { t: "s", v: "Totale" };
    f[`G${n}`] = { t: "n", f: `SUM(G2:G${n - 1})`, v: totale, z: "#,##0.00" };
    f["!cols"] = [14, 56, 10, 7, 10, 16, 14, 30].map((wch) => ({ wch }));
    const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, f, "Distinta");
    const t = XLSX.utils.aoa_to_sheet([["Tratta", "Tipologia", "Lunghezza (m)", "Interasse (m)", "Supporti", "Carico per supporto (kN)", "Esito"],
      ...pr.tratte.map((t2, i) => [t2.nome, t2.tipologia, t2.lunghezza, t2.interasse, risultati[i]!.supporti, Math.round(risultati[i]!.Ftotale * 100) / 100, risultati[i]!.esito === "ok" ? "Verificato" : risultati[i]!.esito === "ko" ? "Non verificato" : "Da completare"])]);
    t["!cols"] = [24, 20, 14, 14, 10, 22, 16].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(libro, t, "Tratte");
    const dati = XLSX.write(libro, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    scarica(new Blob([dati], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${nomeFile(pr)}_distinta.xlsx`);
  }
  async function word() {
    const [{ relazioneStaffaggi }, { creaDocx }] = await Promise.all([import("@/calcoli/staffaggi/relazione"), import("@/lib/docx")]);
    scarica(new Blob([creaDocx(relazioneStaffaggi(pr, risultati, righe))], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), `${nomeFile(pr)}_relazione.docx`);
  }
  async function tavole(formato: "dxf" | "pdf") {
    try {
      const [{ tavoleStaffaggi }, { pdfTavole }] = await Promise.all([import("@/calcoli/staffaggi/tavole"), import("@/calcoli/cad/pdfTavole")]);
      const { w, fogli, layer } = tavoleStaffaggi(pr, risultati);
      if (formato === "dxf") scarica(new Blob([w.finale()], { type: "application/dxf" }), `${nomeFile(pr)}_tavole.dxf`);
      else scarica(new Blob([pdfTavole(w, fogli, layer, { titolo: `Staffaggi ${pr.nome}` })], { type: "application/pdf" }), `${nomeFile(pr)}_tavole.pdf`);
    } catch (e) { setMsg((e as Error).message); }
  }
  const senzaCodice = righe.filter((r) => !r.codice).length;

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Distinta dei materiali (tutte le tratte)</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void excel()}><FileSpreadsheet />Distinta e offerta Excel</Button>
          <Button size="sm" variant="outline" onClick={() => void word()}><FileText />Relazione Word</Button>
          <Button size="sm" variant="outline" onClick={() => void tavole("dxf")}><PenTool />Tavole DXF</Button>
          <Button size="sm" variant="outline" onClick={() => void tavole("pdf")}><FileDown />Tavole PDF</Button>
        </div>
      </div>
      {msg && <p className="mb-2 text-sm text-red-700">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-1">Codice OBO</th><th className="p-1">Descrizione</th><th className="p-1">Finitura</th><th className="p-1 text-right">Q.tà</th><th className="p-1 text-right">Listino</th><th className="p-1 text-right">Importo</th></tr></thead>
          <tbody>{righe.map((r) => {
            const p = prezzo(r.codice);
            return (
              <tr key={r.chiave} className="border-b align-top">
                <td className="p-1 font-mono text-xs">{r.codice ?? <span className="text-amber-700">da assegnare</span>}</td>
                <td className="p-1">{r.descrizione}{r.nomeCatalogo && <span className="block text-xs text-muted-foreground">{r.nomeCatalogo}</span>}</td>
                <td className="p-1">{r.finitura}</td>
                <td className="p-1 text-right">{r.quantita} {r.unita}</td>
                <td className="p-1 text-right">{p != null ? euro(p) : "–"}</td>
                <td className="p-1 text-right">{p != null ? euro(p * r.quantita) : "–"}</td>
              </tr>);
          })}</tbody>
          {totale > 0 && <tfoot><tr><td colSpan={5} className="p-1 text-right font-semibold">Totale a listino</td><td className="p-1 text-right font-semibold">{euro(totale)}</td></tr></tfoot>}
        </table>
      </div>
      {senzaCodice > 0 && <p className="mt-2 text-xs text-muted-foreground">{senzaCodice} {senzaCodice === 1 ? "voce senza codice" : "voci senza codice"}: {catalogo.caricato && catalogo.articoli.length ? "il catalogo OBO non ha un articolo sicuro per questa voce, indicare il codice a mano." : "il catalogo OBO dei sistemi portacavi è in aggiornamento."}</p>}
    </section>
  );
}
