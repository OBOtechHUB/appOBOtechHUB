import { useEffect, useState } from "react";
import { CodiceObo } from "@/components/prodotti/CodiceObo";
import { L, tx } from "@/lib/lingua";
import { RiferimentoParticolare } from "@/components/particolari/RiferimentoParticolare";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { l1Norma, proponiTerra, verificaTerra, type PropostaTerra, type TipoTerra } from "@/calcoli/terra/proponiTerra";
import { aggiornaEsteso, type StatoEsteso } from "@/lib/statoProgetto";
import { accettaTerra, piediCalate, rimuoviTerra, terraDefault, type ConfigurazioneTerra } from "@/lib/impiantoTerra";
import { scarica } from "@/lib/esportazioni";

type Anteprima = { proposta: PropostaTerra; config: ConfigurazioneTerra; stato: StatoEsteso };
export function ImpiantoTerra({ s, onAnteprima }: { s: StatoEsteso; onAnteprima: (p: PropostaTerra | null) => void }) {
  const [config, setConfig] = useState<ConfigurazioneTerra>(() => s.terra ?? terraDefault);
  const [preview, setPreview] = useState<Anteprima | null>(null);
  const [errore, setErrore] = useState("");
  const [excel, setExcel] = useState<Blob | null>(null);
  const [rho, setRho] = useState("");
  const calate = piediCalate(s);
  const corrente = preview?.stato === s ? preview : null;
  const verifica = corrente ? verificaTerra(corrente.proposta, corrente.config.l1) : null;
  useEffect(() => { if (preview && preview.stato !== s) { setPreview(null); onAnteprima(null); } }, [s, preview, onAnteprima]);
  useEffect(() => { setConfig(s.terra ?? terraDefault); }, [s.terra]);
  function cambia(patch: Partial<ConfigurazioneTerra>) { setConfig((c) => ({ ...c, ...patch })); setPreview(null); setExcel(null); onAnteprima(null); }
  function proponi() {
    setErrore(""); setExcel(null);
    try {
      if (!calate.length || !s.modello.corpi.length) throw new Error("Prima accetta o disegna le calate");
      if (![config.distanzaAnello, config.profondita, config.lunghezzaPicchetto, config.latoMagliaFondazione].every((n) => Number.isFinite(n) && n > 0) || (config.l1 !== null && (!Number.isFinite(config.l1) || config.l1 < 0))) throw new Error("Inserisci distanze e lunghezze positive; l1 deve essere positivo o zero.");
      const proposta = proponiTerra(s.modello.corpi, { ...config, calate });
      setPreview({ proposta, config: { ...config }, stato: s }); onAnteprima(proposta);
    } catch (e) { setErrore(e instanceof Error ? e.message : "Proposta non riuscita."); }
  }
  async function preparaExcel() {
    if (!corrente) return;
    try {
      const X = await import("xlsx");
      const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([[L("Codice", "Code"), L("Descrizione", "Description"), L("Quantità", "Quantity"), L("Unità", "Unit"), L("Riferimento", "Reference")], ...corrente.proposta.distinta.map((v) => [v.codice, tx(v.descrizione), v.quantita, v.unita, v.riferimento ?? ""])]), L("Impianto di terra", "Earthing system"));
      setExcel(new Blob([X.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    } catch { setErrore("Esportazione Excel non riuscita."); }
  }
  return <section className="mt-8 border-t pt-5" aria-labelledby="terra-titolo">
    <h2 id="terra-titolo" className="font-display text-xl font-semibold">Impianto di terra</h2>
    {s.terra && <p className="mt-2 text-sm text-protected">Impianto di terra accettato · {s.terra.tipo === "fondazione" ? "Fondazione" : `Tipo ${s.terra.tipo}`} · {s.picchetti.length} picchetti</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Campo etichetta="Tipo di dispersore"><select className={inputCls} value={config.tipo} onChange={(e) => cambia({ tipo: e.target.value as TipoTerra })}><option value="A">A – picchetti</option><option value="B">B – anello perimetrale</option><option value="fondazione">Fondazione</option></select></Campo>
      <Campo etichetta="Distanza dal muro (m)"><input className={inputCls} type="number" min="0.1" step="0.1" value={config.distanzaAnello} onChange={(e) => cambia({ distanzaAnello: Number(e.target.value) })} /></Campo>
      <Campo etichetta="Profondità (m)"><input className={inputCls} type="number" min="0.1" step="0.1" value={config.profondita} onChange={(e) => cambia({ profondita: Number(e.target.value) })} /></Campo>
      {config.tipo === "A" && <Campo etichetta="Lunghezza picchetto (m)"><input className={inputCls} type="number" min="0.1" step="0.1" value={config.lunghezzaPicchetto} onChange={(e) => cambia({ lunghezzaPicchetto: Number(e.target.value) })} /></Campo>}
      {config.tipo === "fondazione" && <Campo etichetta="Lato maglia fondazione (m)"><input className={inputCls} type="number" min="0.1" step="1" value={config.latoMagliaFondazione} onChange={(e) => cambia({ latoMagliaFondazione: Number(e.target.value) })} /></Campo>}
      <Campo etichetta="Lunghezza minima l1 (m)"><input className={inputCls} type="number" min="0" step="0.1" placeholder="Facoltativa" value={config.l1 ?? ""} onChange={(e) => cambia({ l1: e.target.value === "" ? null : Number(e.target.value) })} /></Campo>
    </div>
    <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
      <Campo etichetta="Resistività ρ (Ω·m)"><input className={inputCls} type="number" min="0" step="10" value={rho} placeholder="es. 200" onChange={(e) => setRho(e.target.value)} /></Campo>
      <Button variant="outline" disabled={rho === ""} onClick={() => { try { cambia({ l1: Math.round(l1Norma(s.lpl, Number(rho)) * 10) / 10 }); } catch { /* valore non valido */ } }}>Calcola l1 (LPL {s.lpl})</Button>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">l1 dalla Fig. 5 della CEI EN IEC 62305-3:2024 (classi III-IV: 5 m; classi I e II crescono con la resistività). Tipo A: ogni picchetto ≥ 0,5·l1 (+ 0,5 m se il terreno gela o si secca); tipo B: raggio equivalente re ≥ l1. Il requisito si può ignorare se la resistenza di un dispersore di tipo A è inferiore a 10 Ω. Se l1 è vuoto la verifica resta “dato norma mancante”.</p>
    {config.tipo === "B" && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={config.picchettiSuAnello} onChange={(e) => cambia({ picchettiSuAnello: e.target.checked })} />Picchetto su ogni calata</label>}
    {!calate.length && <p role="alert" className="mt-4 border-l-4 border-accent pl-3 text-sm">Prima accetta o disegna le calate</p>}
    <div className="mt-4 flex flex-wrap gap-2"><Button disabled={!calate.length || !s.modello.corpi.length} onClick={proponi}>Proponi impianto di terra</Button>{s.terra && <Button variant="outline" onClick={() => { if (!window.confirm("Rimuovere l'impianto di terra?")) return; aggiornaEsteso(rimuoviTerra(s)); setPreview(null); onAnteprima(null); }}>Rimuovi impianto di terra</Button>}</div>
    {errore && <p role="alert" className="mt-3 text-sm text-destructive">{errore}</p>}
    {corrente && <div className="mt-4 rounded border border-accent p-4" data-testid="proposta-terra"><h3 className="font-display text-lg font-semibold">Proposta di impianto di terra</h3><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
      <span>Tipo: <strong>{corrente.proposta.riepilogo.tipo}</strong></span>
      <span>Dispersore: <strong>{corrente.proposta.riepilogo.metriDispersore.toFixed(2)} m</strong></span>
      <span>Collegamenti: <strong>{corrente.proposta.riepilogo.metriCollegamenti.toFixed(2)} m</strong></span>
      <span>Picchetti: <strong>{corrente.proposta.riepilogo.picchetti}</strong></span>
      <span>Area racchiusa: <strong>{corrente.proposta.riepilogo.areaRacchiusa.toFixed(2)} m²</strong></span>
      <span>Raggio equivalente re: <strong>{corrente.proposta.riepilogo.raggioEquivalente.toFixed(2)} m</strong></span>
    </div>{verifica && <div role="status" className={`mt-3 text-sm ${verifica.esito === "adeguata" ? "text-protected" : verifica.esito === "non adeguata" ? "text-exposed" : "text-muted-foreground"}`}><strong>{verifica.esito}</strong><p>{verifica.dettaglio}</p></div>}
      {corrente.proposta.avvisi.map((a, i) => <p key={i} className="mt-2 border-l-4 border-accent pl-2 text-xs">{a}</p>)}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Distinta materiali</h3><Button size="sm" variant="outline" onClick={() => excel ? scarica(excel, "distinta-terra.xlsx") : void preparaExcel()}><Download />{excel ? "Scarica Excel" : "Prepara Excel"}</Button></div>
      <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-left">{["Codice", "Descrizione", "Quantità", "Unità", "Riferimento"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{corrente.proposta.distinta.map((v, i) => <tr key={i} className="border-b"><td className="p-2"><CodiceObo codice={v.codice} /></td><td className="p-2">{v.descrizione}</td><td className="p-2 font-mono">{v.quantita.toLocaleString("it-IT")}</td><td className="p-2">{v.unita}</td><td className="p-2"><RiferimentoParticolare riferimento={v.riferimento} /></td></tr>)}</tbody></table></div>
      <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => { if (s.conduttori.some((c) => c.tipo === "terra") && !window.confirm("L'impianto di terra esistente sarà sostituito. Continuare?")) return; try { aggiornaEsteso(accettaTerra(s, corrente.proposta, corrente.config)); setPreview(null); onAnteprima(null); } catch (e) { setErrore(e instanceof Error ? e.message : "Accettazione non riuscita."); } }}>Accetta impianto di terra</Button><Button variant="outline" onClick={() => { setPreview(null); onAnteprima(null); }}>Annulla</Button></div>
    </div>}
  </section>;
}