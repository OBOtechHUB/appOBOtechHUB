/**
 * Cruscotto di direzione (solo amministratori): progetti creati e modificati, revisioni emesse e tempi,
 * aste e conduttori OBO prescritti, richieste all'ufficio tecnico e ore della Mappa carichi (supabase/cruscotto.sql).
 */
import { useEffect, useState } from "react";
import { RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/PageTitle";
import { db, useAccesso } from "@/lib/accesso";
import { TIPI_RICHIESTA, STATI_RICHIESTA } from "@/lib/richieste";
import { scaricaCsv } from "@/lib/csv";
import { GraficoBarre } from "@/components/GraficoBarre";

type Mese = { mese: string; n: number };
interface Dati {
  progetti: { creati: number; modificati: number; totale: number; per_mese: Mese[]; per_persona: { nome: string; n: number }[]; per_lpl: Record<string, number> };
  materiale: { aste: { codice: string; n: number; progetti: number }[]; conduttori: { codice: string; tipo: string; n: number }[]; totale_aste: number };
  revisioni?: { emesse: number; per_mese: Mese[]; giorni_prima_emissione: number | null };
  richieste?: { aperte: number; nuove_periodo: number; completate_periodo: number; ore_aperte: number; giorni_medi_chiusura: number | null; per_tipo: Record<string, number>; per_stato: Record<string, number> };
  mappa?: { persona: string; ore: number; progetti: number }[];
}
type Periodo = "mese" | "trimestre" | "anno" | "12mesi";
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function intervallo(p: Periodo): [string, string] {
  const o = new Date(), y = o.getFullYear(), m = o.getMonth();
  if (p === "mese") return [iso(new Date(y, m, 1)), iso(o)];
  if (p === "trimestre") return [iso(new Date(y, Math.floor(m / 3) * 3, 1)), iso(o)];
  if (p === "anno") return [iso(new Date(y, 0, 1)), iso(o)];
  return [iso(new Date(y, m - 11, 1)), iso(o)];
}
const n = (v: number | null | undefined, dec = 0) => (v == null ? "—" : v.toLocaleString("it-IT", { maximumFractionDigits: dec }));

/** Barre animate: verticali per i mesi, orizzontali per le classifiche. */
function Barre({ voci, unita = "", periodo = false }: { voci: { etichetta: string; valore: number }[]; unita?: string; periodo?: boolean }) {
  return <GraficoBarre voci={voci} unita={unita} orizzontale={!periodo} />;
}
const Tessera = ({ titolo, valore, nota }: { titolo: string; valore: string; nota?: string }) => <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{titolo}</p><p className="text-2xl font-semibold tabular-nums">{valore}</p>{nota && <p className="text-xs text-muted-foreground">{nota}</p>}</div>;
const Pannello = ({ titolo, children }: { titolo: string; children: React.ReactNode }) => <section className="rounded-lg border p-4"><h2 className="mb-3 font-semibold">{titolo}</h2>{children}</section>;

export function CruscottoPage() {
  const accesso = useAccesso();
  const admin = accesso.profilo?.ruolo === "admin";
  const [periodo, setPeriodo] = useState<Periodo>("anno"), [dati, setDati] = useState<Dati | null>(null), [errore, setErrore] = useState(""), [carico, setCarico] = useState(false);
  const [da, a] = intervallo(periodo);
  const carica = async () => {
    setCarico(true); setErrore("");
    const { data, error } = await db().rpc("cruscotto_direzione", { p_da: da, p_a: a });
    if (error) setErrore(/function|schema cache|does not exist/i.test(error.message) ? "Cruscotto non ancora attivo: eseguire supabase/cruscotto.sql in Supabase." : error.message);
    else setDati(data as Dati);
    setCarico(false);
  };
  useEffect(() => { if (admin) void carica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [admin, periodo]);
  if (!admin) return <main className="mx-auto max-w-5xl px-4 py-8"><PageTitle titolo="Cruscotto di direzione" /><p className="mt-4 text-muted-foreground">Pagina riservata agli amministratori.</p></main>;
  const p = dati?.progetti, r = dati?.richieste, v = dati?.revisioni;
  const esporta = () => { if (!dati) return; scaricaCsv(`cruscotto-${da}-${a}.csv`, ["Sezione", "Voce", "Valore"], [
    ["Progetti", "Creati", p?.creati], ["Progetti", "Modificati", p?.modificati], ["Progetti", "Totale", p?.totale],
    ...(v ? [["Revisioni", "Emesse", v.emesse], ["Revisioni", "Giorni medi alla Rev. A", v.giorni_prima_emissione]] : []),
    ...(r ? [["Richieste", "Aperte", r.aperte], ["Richieste", "Nuove nel periodo", r.nuove_periodo], ["Richieste", "Completate nel periodo", r.completate_periodo], ["Richieste", "Ore stimate aperte", r.ore_aperte], ["Richieste", "Giorni medi di chiusura", r.giorni_medi_chiusura]] : []),
    ...(dati.materiale.aste.map((x) => ["Aste", x.codice, x.n])), ...(dati.mappa ?? []).map((x) => ["Mappa ore", x.persona, x.ore]),
  ] as (string | number | null | undefined)[][]); };
  return <main className="mx-auto max-w-6xl px-4 py-8"><PageTitle titolo="Cruscotto di direzione" />
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {(["mese", "trimestre", "anno", "12mesi"] as const).map((x) => <Button key={x} type="button" size="sm" variant={periodo === x ? "default" : "outline"} aria-pressed={periodo === x} onClick={() => setPeriodo(x)}>{x === "mese" ? "Mese" : x === "trimestre" ? "Trimestre" : x === "anno" ? "Anno" : "Ultimi 12 mesi"}</Button>)}
      <span className="text-sm text-muted-foreground">dal {new Date(da).toLocaleDateString("it-IT")} al {new Date(a).toLocaleDateString("it-IT")}</span>
      <Button type="button" size="sm" variant="ghost" onClick={() => void carica()} aria-label="Aggiorna" disabled={carico}><RefreshCw /></Button>
      <Button type="button" size="sm" variant="outline" onClick={esporta} disabled={!dati}><Download />CSV</Button>
    </div>
    {errore && <p role="alert" className="mt-3 text-sm text-destructive">{errore}</p>}
    {dati && <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tessera titolo="Progetti creati" valore={n(p?.creati)} nota={`${n(p?.totale)} in archivio`} />
        <Tessera titolo="Progetti modificati" valore={n(p?.modificati)} />
        <Tessera titolo="Revisioni emesse" valore={v ? n(v.emesse) : "—"} nota={v?.giorni_prima_emissione != null ? `${n(v.giorni_prima_emissione, 1)} giorni medi alla Rev. A` : v ? "" : "attivare revisioni.sql"} />
        <Tessera titolo="Richieste aperte" valore={r ? n(r.aperte) : "—"} nota={r ? `${n(r.ore_aperte, 1)} h stimate` : "attivare richieste.sql"} />
        <Tessera titolo="Richieste completate" valore={r ? n(r.completate_periodo) : "—"} nota={r?.giorni_medi_chiusura != null ? `${n(r.giorni_medi_chiusura, 1)} giorni medi` : ""} />
        <Tessera titolo="Aste OBO prescritte" valore={n(dati.materiale.totale_aste)} nota="nei progetti modificati" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Pannello titolo="Progetti creati per mese"><Barre voci={(p?.per_mese ?? []).map((x) => ({ etichetta: x.mese, valore: x.n }))} periodo /></Pannello>
        <Pannello titolo="Revisioni emesse per mese">{v ? <Barre voci={v.per_mese.map((x) => ({ etichetta: x.mese, valore: x.n }))} periodo /> : <p className="text-sm text-muted-foreground">Eseguire supabase/revisioni.sql.</p>}</Pannello>
        <Pannello titolo="Progetti per persona (modificati nel periodo)"><Barre voci={(p?.per_persona ?? []).slice(0, 15).map((x) => ({ etichetta: x.nome, valore: x.n }))} /></Pannello>
        <Pannello titolo="Livello di protezione dei progetti"><Barre voci={Object.entries(p?.per_lpl ?? {}).sort().map(([k, val]) => ({ etichetta: `LPL ${k}`, valore: val }))} /></Pannello>
        <Pannello titolo="Aste OBO più prescritte"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-1">Codice</th><th className="p-1 text-right">Aste</th><th className="p-1 text-right">Progetti</th></tr></thead><tbody>{dati.materiale.aste.map((x) => <tr key={x.codice} className="border-b"><td className="p-1 font-mono">{x.codice}</td><td className="p-1 text-right">{n(x.n)}</td><td className="p-1 text-right">{n(x.progetti)}</td></tr>)}</tbody></table></Pannello>
        <Pannello titolo="Ore pianificate in Mappa carichi (progetti che iniziano nel periodo)">{dati.mappa ? <Barre voci={dati.mappa.slice(0, 15).map((x) => ({ etichetta: x.persona, valore: x.ore }))} unita=" h" /> : <p className="text-sm text-muted-foreground">Mappa carichi non collegata.</p>}</Pannello>
        {r && <Pannello titolo="Richieste per tipo (aperte nel periodo)"><Barre voci={Object.entries(r.per_tipo).map(([k, val]) => ({ etichetta: TIPI_RICHIESTA[k as keyof typeof TIPI_RICHIESTA] ?? k, valore: val }))} /></Pannello>}
        {r && <Pannello titolo="Richieste per stato (tutte)"><Barre voci={Object.entries(r.per_stato).map(([k, val]) => ({ etichetta: STATI_RICHIESTA[k as keyof typeof STATI_RICHIESTA] ?? k, valore: val }))} /></Pannello>}
      </div>
    </div>}
  </main>;
}
