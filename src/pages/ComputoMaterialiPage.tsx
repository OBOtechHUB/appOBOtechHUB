import { useState } from "react";
import { CodiceObo } from "@/components/prodotti/CodiceObo";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, FileSpreadsheet, FileText, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { PageTitle } from "@/components/PageTitle";
import { aggiornaComputo, useComputo, useDatiEdificio } from "@/lib/progettoStore";
import { applicaModifiche, generaComputo } from "@/calcoli/materiali/computo";
import { categorie, type Articolo, type ModificaRiga, type RigaComputo } from "@/calcoli/materiali/tipi";
import coperture from "@/dati/opzioniEdificio.json";
import { creaExcel, creaRelazione, scarica } from "@/lib/esportazioni";
import {useAuth} from "@/lib/auth";
import {useEsteso} from "@/lib/statoProgetto";
import {computoParticolari} from "@/calcoli/particolari/computoParticolari";
import {particolareSchema} from "@/calcoli/particolari/selezione";
import baseParticolari from "@/dati/particolari/particolari.json";
import {righeProposta} from "@/lib/computoProposta";
import {RiferimentoParticolare} from "@/components/particolari/RiferimentoParticolare";

export function ComputoMaterialiPage() {
  const {user}=useAuth();
  const c = useComputo(); const d = useDatiEdificio();
  const s=useEsteso();const generico=generaComputo(c.risultati,c.configurazione,d.copertura);const base={righe:generico.righe.filter((r)=>!s.terra||!["terra-picchetti","terra-anello"].includes(r.id)),mancanti:generico.mancanti.filter((m)=>!s.terra||m!=="Terra")};const dettagli=(()=>{const validi=(s.particolari.length?s.particolari:baseParticolari).flatMap((p)=>{const r=particolareSchema.safeParse(p);return r.success?[r.data]:[];});if(!validi.length)return {righe:[],mancanti:[]};try{return computoParticolari({...s,conduttori:s.terra?s.conduttori.filter((v)=>v.tipo!=="terra"):s.conduttori,particolari:validi});}catch{return {righe:[],mancanti:["Particolari costruttivi non applicabili al computo"]};}})();
  const daDistinta=s.distinta.length>0;const esterna=["Captazione","Calate"];
  const generato = daDistinta
    ? {righe:[...righeProposta(s),...base.righe.filter((r)=>!esterna.includes(r.provenienza))],mancanti:base.mancanti.filter((m)=>!esterna.includes(m)&&!m.startsWith("Passo supporti"))}
    : {righe:[...base.righe,...dettagli.righe,...righeProposta(s)],mancanti:[...base.mancanti,...dettagli.mancanti]};
  const righe = applicaModifiche(generato.righe, c.modifiche, c.catalogo, c.manuali);
  const [codiceNuovo, setCodiceNuovo] = useState("");
  const [download, setDownload] = useState<{ blob: Blob; nome: string } | null>(null);
  const [busy, setBusy] = useState(false); const [errore, setErrore] = useState("");
  const modifica = (id: string, patch: ModificaRiga) => aggiornaComputo({ modifiche: { ...c.modifiche, [id]: { ...c.modifiche[id], ...patch } } });
  function aggiungi() {
    const articolo = c.catalogo.find((a) => a.codice === codiceNuovo);
    const base: Articolo = articolo ?? { codice: "", descrizione: "Materiale manuale", categoria: "accessori", unita: "pz", materiale: "", sezione: "" };
    aggiornaComputo({ manuali: [...c.manuali, { ...base, id: crypto.randomUUID(), quantita: 1, provenienza: "Inserimento manuale", manuale: true }] });
  }
  async function esporta(tipo: "xlsx" | "pdf") {
    setBusy(true); setErrore(""); setDownload(null);
    try {
      const blob = tipo === "xlsx" ? await creaExcel(righe, generato.mancanti) : await creaRelazione(d, c.risultati, righe, generato.mancanti);
      setDownload({ blob, nome: tipo === "xlsx" ? "computo-materiali.xlsx" : "relazione-progetto-LPS.pdf" });
    } catch (e) { setErrore(e instanceof Error ? e.message : "Esportazione non riuscita."); }
    finally { setBusy(false); }
  }
  const totale = righe.reduce((s, r) => s + r.quantita * (r.prezzo ?? 0), 0);
  return <main className="mx-auto max-w-5xl px-4 py-6"><PageTitle titolo="Computo materiali" />
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {user&&<Button variant="outline" asChild><Link to="/dati-normativi">Dati normativi · Catalogo</Link></Button>}
      <Button variant="outline" disabled={busy} onClick={() => esporta("xlsx")}><FileSpreadsheet />Excel</Button>
      <Button variant="outline" disabled={busy} onClick={() => esporta("pdf")}><FileText />Relazione PDF</Button>
      {busy && <span role="status" className="text-sm text-muted-foreground">Preparazione…</span>}
      {download && <Button onClick={() => scarica(download.blob, download.nome)}><Download />Scarica {download.nome.endsWith("pdf") ? "PDF" : "Excel"}</Button>}
    </div>
    {errore && <p role="alert" className="mt-3 text-sm text-destructive">{errore}</p>}
    {generato.mancanti.length > 0 && <div className="mt-5 border-l-4 border-accent bg-secondary px-4 py-3"><h2 className="font-semibold">Computo incompleto</h2><p className="mt-1 text-sm text-muted-foreground">Dati mancanti: {generato.mancanti.join(", ")}. Le righe manuali non sostituiscono i risultati di progetto.</p></div>}
    <section className="mt-6 border-t pt-5"><h2 className="font-display text-lg font-semibold">Parametri di computo</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Campo etichetta="Maggiorazione sfridi (%)"><input className={inputCls} type="number" min="0" step="1" value={c.configurazione.sfridoPercento} onChange={(e) => aggiornaComputo({ configurazione: { ...c.configurazione, sfridoPercento: Math.max(0, Number(e.target.value) || 0) } })} /></Campo>
        {coperture.coperture.map((copertura) => <Campo key={copertura} etichetta={`Passo supporti — ${copertura} (m)`}><input className={inputCls} type="number" min="0.01" step="0.1" placeholder="Da definire" value={c.configurazione.passoSupporti[copertura] ?? ""} onChange={(e) => {
          const valore = Number(e.target.value); if (e.target.value !== "" && valore <= 0) return;
          aggiornaComputo({ configurazione: { ...c.configurazione, passoSupporti: { ...c.configurazione.passoSupporti, [copertura]: e.target.value === "" ? null : valore } } });
        }} /></Campo>)}
      </div>
    </section>
    <section className="mt-6 border-t pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold">Elenco materiali <span className="font-mono text-sm text-muted-foreground">({righe.length})</span></h2><div className="flex flex-wrap gap-2"><select aria-label="Articolo da aggiungere" className={`${inputCls} w-60 max-w-full`} value={codiceNuovo} onChange={(e) => setCodiceNuovo(e.target.value)}><option value="">Riga libera</option>{c.catalogo.map((a) => <option value={a.codice} key={a.codice}>{a.codice} — {a.descrizione}</option>)}</select><Button onClick={aggiungi}><Plus />Aggiungi riga</Button></div></div>
      <datalist id="codici-catalogo">{c.catalogo.map((a) => <option key={a.codice} value={a.codice}>{a.descrizione}</option>)}</datalist>
      {!righe.length && <p className="my-10 text-center text-muted-foreground">Nessun materiale disponibile.</p>}
      {categorie.map((categoria) => {
        const gruppo = righe.filter((r) => r.categoria === categoria); if (!gruppo.length) return null;
        return <div key={categoria} className="mt-5"><h3 className="border-b border-accent pb-2 font-mono text-sm uppercase">{categoria}</h3><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left">{["Codice", "Descrizione", "Quantità", "Unità", "Provenienza", ""].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{gruppo.map((r) => <tr key={r.id} className="border-b">
          <td className="p-2"><input aria-label={`Codice ${r.descrizione}`} maxLength={100} list="codici-catalogo" className={`${inputCls} w-36`} value={r.codice} onChange={(e) => modifica(r.id, { codice: e.target.value })} />{/^\d{7}$/.test(r.codice) && <span className="mt-1 block text-xs">Anteprima: <CodiceObo codice={r.codice} /></span>}{r.codice && !c.catalogo.some((a) => a.codice === r.codice && a.unita === r.unita) && <span className="mt-1 block text-xs text-accent">Codice/unità fuori catalogo</span>}</td>
          <td className="p-2">{r.provenienza === "Inserimento manuale" && !c.catalogo.some((a) => a.codice === r.codice) ? <input aria-label={`Descrizione riga ${r.id}`} maxLength={500} className={`${inputCls} min-w-44`} value={r.descrizione} onChange={(e) => aggiornaComputo({ manuali: c.manuali.map((m) => m.id === r.id ? { ...m, descrizione: e.target.value } : m) })} /> : r.descrizione}{r.manuale && <span className="mt-1 block text-xs text-muted-foreground">Modifica manuale</span>}</td>
          <td className="p-2"><input aria-label={`Quantità ${r.descrizione}`} className={`${inputCls} w-28 font-mono`} type="number" min="0" step={r.unita === "pz" ? "1" : "0.01"} value={r.quantita} onChange={(e) => modifica(r.id, { quantita: Math.max(0, Number(e.target.value) || 0) })} /></td>
          <td className="p-2">{r.unita}</td><td className="p-2 text-muted-foreground">{r.provenienza.split(/(OBO-TBS-[A-Za-z0-9.-]+)/).map((parte,i)=>parte.startsWith("OBO-TBS-")?<RiferimentoParticolare key={i} riferimento={parte}/>:<span key={i}>{parte}</span>)}</td>
          <td className="p-2"><Button variant="ghost" size="icon" title={r.provenienza === "Inserimento manuale" ? "Elimina riga" : "Ripristina quantità e codice"} aria-label={`${r.provenienza === "Inserimento manuale" ? "Elimina" : "Ripristina"} ${r.descrizione}`} onClick={() => {
            const modifiche = { ...c.modifiche }; delete modifiche[r.id];
            aggiornaComputo({ modifiche, manuali: r.provenienza === "Inserimento manuale" ? c.manuali.filter((m) => m.id !== r.id) : c.manuali });
          }}>{r.provenienza === "Inserimento manuale" ? <Trash2 /> : <RotateCcw />}</Button></td>
        </tr>)}</tbody></table></div></div>;
      })}
      {righe.length > 0 && <div className="mt-5 flex flex-wrap justify-between gap-2 border-t pt-4"><span className="text-sm text-muted-foreground">Totale parziale — esclusi articoli senza prezzo</span><strong className="font-mono">{totale.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</strong></div>}
    </section>
  </main>;
}