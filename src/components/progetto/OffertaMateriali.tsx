/**
 * Offerta materiali dal computo con il listino OBO (METEL) caricato in Amministrazione:
 * sconto globale e per famiglia, prezzi netti manuali per riga, confezioni; Word ed Excel.
 * Impostazioni in `esteso.offerta` (fuori dall'impronta delle revisioni).
 */
import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { useDatiEdificio } from "@/lib/progettoStore";
import { aggiornaEsteso, leggiAttivo, useEsteso } from "@/lib/statoProgetto";
import { useAuth } from "@/lib/auth";
import type { RigaComputo } from "@/calcoli/materiali/tipi";
import { documentoOfferta, offertaVuota, righeOfferta, totaliOfferta, type ImpostazioniOfferta } from "@/calcoli/offerta/offerta";
import { prezziListino, type VersioneListino } from "@/lib/listino";
import type { VoceListino } from "@/lib/listinoMetel";
import { creaDocx } from "@/lib/docx";
import { bloccoImmagine } from "@/calcoli/relazione/relazioneTecnica";
import { scarica } from "@/lib/esportazioni";
import { logoObo } from "./RelazioneTecnica";

const euro = (v: number | null) => (v == null ? "—" : v.toLocaleString("it-IT", { style: "currency", currency: "EUR" }));

export function OffertaMateriali({ righe }: { righe: RigaComputo[] }) {
  const d = useDatiEdificio(), s = useEsteso(), { user } = useAuth();
  const o: ImpostazioniOfferta = { ...offertaVuota, ...s.offerta };
  const aggiorna = (p: Partial<ImpostazioniOfferta>) => { setFile(null); aggiornaEsteso({ offerta: { ...o, ...p } }); };
  const [aperto, setAperto] = useState(false), [listino, setListino] = useState<{ versione: VersioneListino | null; voci: Map<string, VoceListino> } | null>(null);
  const [errore, setErrore] = useState(""), [carico, setCarico] = useState(false), [file, setFile] = useState<{ blob: Blob; nome: string } | null>(null);
  const codici = useMemo(() => [...new Set(righe.map((r) => r.codice).filter(Boolean))].sort().join(","), [righe]);
  const carica = async () => {
    if (!user) return; setCarico(true); setErrore("");
    try { setListino(await prezziListino(codici.split(",").filter(Boolean))); } catch (e) { setErrore(e instanceof Error ? e.message : "Listino non disponibile."); }
    finally { setCarico(false); }
  };
  useEffect(() => { if (aperto && !listino) void carica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [aperto, codici, user]);
  const rOff = useMemo(() => righeOfferta(righe.map((r) => ({ codice: r.codice, descrizione: r.descrizione, quantita: r.quantita, unita: r.unita, prezzo: r.prezzo })), listino?.voci ?? new Map(), o), [righe, listino, o]);
  const tot = totaliOfferta(rOff);
  const famiglie = [...new Set(rOff.map((r) => r.famiglia).filter(Boolean))].sort();
  const base = (d.nomeProgetto || d.comune || "progetto").replace(/[^\w.-]+/g, "_");

  async function word() {
    const logo = await logoObo();
    const doc = documentoOfferta({ righe: rOff, o, progetto: d.nomeProgetto, comune: d.comune, codice: leggiAttivo()?.codice || undefined, rev: s.revisioni.at(-1)?.rev, versioneListino: listino?.versione?.versione, logo: logo ? bloccoImmagine(logo, 4.2, "sinistra", 3) : undefined, data: new Date() });
    setFile({ blob: new Blob([creaDocx(doc)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), nome: `Offerta-${base}.docx` });
  }
  async function excel() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      [`Offerta materiali OBO – ${d.nomeProgetto || "progetto"}${d.comune ? ` – ${d.comune}` : ""}`], [`Destinatario: ${o.destinatario || "—"}`, "", "", `Listino: ${listino?.versione?.versione ?? "—"}`], [],
      ["Pos.", "Codice", "Descrizione", "Q.tà progetto", "Q.tà offerta", "U.m.", "Listino unit. €", "Sconto %", "Netto unit. €", "Totale €", "Famiglia sconto", "Fonte"],
    ]);
    rOff.forEach((r, i) => {
      const n = i + 5;
      XLSX.utils.sheet_add_aoa(ws, [[i + 1, r.codice, r.descrizione, Math.round(r.quantitaProgetto * 100) / 100, r.quantita, r.unita, r.listino, r.fonte === "manuale" ? null : r.sconto, r.netto, null, r.famiglia, r.fonte]], { origin: `A${n}` });
      ws[`J${n}`] = { t: "n", f: `IF(ISNUMBER(I${n}),E${n}*I${n},0)`, v: r.totale ?? 0, z: "#,##0.00" };
      for (const c of ["G", "I"]) if (ws[`${c}${n}`]) ws[`${c}${n}`].z = "#,##0.0000";
    });
    const fine = rOff.length + 5;
    XLSX.utils.sheet_add_aoa(ws, [["", "", "Totale netto (IVA esclusa)"]], { origin: `A${fine}` });
    ws[`J${fine}`] = { t: "n", f: `SUM(J5:J${fine - 1})`, v: tot.netto, z: "#,##0.00" };
    ws["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 46 }, { wch: 11 }, { wch: 11 }, { wch: 5 }, { wch: 13 }, { wch: 9 }, { wch: 13 }, { wch: 12 }, { wch: 10 }, { wch: 9 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Offerta");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    scarica(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Offerta-${base}.xlsx`);
  }

  return <section className="mt-6 rounded-lg border p-4" aria-labelledby="h-offerta">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 id="h-offerta" className="font-display text-lg font-semibold">Offerta materiali</h2>
        <p className="text-sm text-muted-foreground">Prezzi dal listino OBO in vigore (formato METEL, caricato in Amministrazione → Listino prezzi), con sconti, confezioni e prezzi netti modificabili. Word ed Excel con i totali.</p></div>
      <Button type="button" variant="outline" onClick={() => setAperto(!aperto)} aria-expanded={aperto}>{aperto ? "Chiudi" : "Prepara offerta"}</Button>
    </div>
    {aperto && !user && <p className="mt-3 text-sm text-muted-foreground">I prezzi di listino sono visibili solo con l'accesso personale.</p>}
    {aperto && user && <div className="mt-4 space-y-4">
      <p className="text-sm">{carico ? "Lettura del listino…" : listino?.versione ? <>Listino <b>{listino.versione.versione}</b> · {listino.voci.size} articoli del computo trovati su {codici.split(",").filter(Boolean).length}</> : "Nessun listino caricato: chiedi all'amministratore di caricarlo."} <Button type="button" size="sm" variant="ghost" onClick={() => void carica()} aria-label="Rileggi il listino"><RefreshCw /></Button></p>
      {errore && <p role="alert" className="text-sm text-destructive">{errore}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etichetta="Destinatario"><input className={inputCls} value={o.destinatario} maxLength={300} placeholder="es. Elettro Rossi S.r.l." onChange={(e) => aggiorna({ destinatario: e.target.value })} /></Campo>
        <Campo etichetta="Riferimento"><input className={inputCls} value={o.riferimento} maxLength={300} placeholder="es. vs. richiesta del 12/11" onChange={(e) => aggiorna({ riferimento: e.target.value })} /></Campo>
        <Campo etichetta="Validità (giorni)"><input className={inputCls} inputMode="numeric" value={o.validitaGiorni} onChange={(e) => { const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 365) aggiorna({ validitaGiorni: v }); }} /></Campo>
        <Campo etichetta="Sconto generale (%)"><input className={inputCls} inputMode="decimal" value={o.scontoPercento} onChange={(e) => { const v = Number(e.target.value.replace(",", ".")); if (v >= 0 && v <= 100) aggiorna({ scontoPercento: v }); }} /></Campo>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={o.arrotondaConfezioni} onChange={(e) => aggiorna({ arrotondaConfezioni: e.target.checked })} />Arrotonda alle confezioni di vendita</label>
      </div>
      {famiglie.length > 0 && <fieldset className="rounded-md border p-3"><legend className="px-1 text-sm font-semibold">Sconto per famiglia di sconto (vuoto = generale)</legend>
        <div className="flex flex-wrap gap-3">{famiglie.map((f) => <label key={f} className="flex items-center gap-1 text-sm">{f}<input className={`${inputCls} w-20 py-1`} inputMode="decimal" value={o.scontiFamiglia[f] ?? ""} placeholder={String(o.scontoPercento)} onChange={(e) => { const t = e.target.value.trim(), v = Number(t.replace(",", ".")); const sf = { ...o.scontiFamiglia }; if (t === "") delete sf[f]; else if (v >= 0 && v <= 100) sf[f] = v; else return; aggiorna({ scontiFamiglia: sf }); }} /> %</label>)}</div></fieldset>}
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
        <thead><tr className="border-b text-left"><th className="p-2">Codice</th><th className="p-2">Descrizione</th><th className="p-2 text-right">Q.tà</th><th className="p-2 text-right">Listino</th><th className="p-2 text-right">Sconto</th><th className="p-2 text-right">Netto unit. (modificabile)</th><th className="p-2 text-right">Totale</th></tr></thead>
        <tbody>{rOff.map((r) => <tr key={r.codice || r.descrizione} className="border-b">
          <td className="p-2 font-mono">{r.codice || "—"}</td><td className="p-2">{r.descrizione}{r.fonte === "mancante" && <span className="ml-1 text-xs text-destructive">(non a listino)</span>}</td>
          <td className="p-2 text-right" title={`Progetto: ${r.quantitaProgetto.toLocaleString("it-IT")} · confezione ${r.confezione}`}>{r.quantita.toLocaleString("it-IT")} {r.unita}</td>
          <td className="p-2 text-right">{euro(r.listino)}</td><td className="p-2 text-right">{r.fonte === "manuale" ? "netto" : `${r.sconto.toLocaleString("it-IT")} %`}</td>
          <td className="p-2 text-right">{r.codice ? <input className={`${inputCls} w-28 py-1 text-right`} inputMode="decimal" aria-label={`Prezzo netto ${r.codice}`} placeholder={r.netto == null ? "" : r.netto.toFixed(4).replace(".", ",")} value={o.prezziManuali[r.codice] ?? ""} onChange={(e) => { const t = e.target.value.trim(), v = Number(t.replace(",", ".")); const pm = { ...o.prezziManuali }; if (t === "") delete pm[r.codice]; else if (v >= 0) pm[r.codice] = v; else return; aggiorna({ prezziManuali: pm }); }} /> : euro(r.netto)}</td>
          <td className="p-2 text-right">{euro(r.totale)}</td></tr>)}
          <tr className="font-semibold"><td className="p-2" colSpan={3}>Totale netto (IVA esclusa){tot.mancanti ? ` · ${tot.mancanti} articoli senza prezzo` : ""}</td><td className="p-2 text-right">{euro(tot.listino)}</td><td className="p-2 text-right">{tot.sconto.toLocaleString("it-IT")} %</td><td /><td className="p-2 text-right">{euro(tot.netto)}</td></tr>
        </tbody></table></div>
      <Campo etichetta="Note per il cliente"><textarea className={`${inputCls} min-h-16`} value={o.note} maxLength={5000} onChange={(e) => aggiorna({ note: e.target.value })} /></Campo>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void word()}><FileText />Offerta Word</Button>
        {file && <Button type="button" variant="outline" onClick={() => scarica(file.blob, file.nome)}><Download />Scarica Word</Button>}
        <Button type="button" variant="outline" onClick={() => void excel()}><FileSpreadsheet />Excel</Button>
      </div>
    </div>}
  </section>;
}
