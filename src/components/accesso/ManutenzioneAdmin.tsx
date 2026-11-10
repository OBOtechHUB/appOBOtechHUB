import { useEffect, useState } from "react";
import { Copy, ExternalLink, Save, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/Campo";
import { db, URL_HUB } from "@/lib/accesso";
import { APP_HUB, SEZIONI_LPS, leggiManutenzione, leggiMappa, type MappaManutenzione, type VoceManutenzione } from "@/lib/manutenzione";

const SQL = `CREATE OR REPLACE FUNCTION public.stato_manutenzione() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'sezioni', coalesce((SELECT CASE WHEN valore ~ '^\\s*\\{' THEN valore::jsonb END FROM public.impostazioni_admin WHERE chiave = 'manutenzione'), '{}'::jsonb),
    'admin', public.e_admin()
  );
$$;
REVOKE ALL ON FUNCTION public.stato_manutenzione() FROM public;
GRANT EXECUTE ON FUNCTION public.stato_manutenzione() TO anon, authenticated;`;

/** Admin → Manutenzione: app di OBO Hub e sezioni di Progettazione LPS da chiudere temporaneamente. */
export function ManutenzioneAdmin({ valore, onSalvato }: { valore: string | undefined; onSalvato: () => void }) {
  const [mappa, setMappa] = useState<MappaManutenzione>(() => leggiMappa(valore));
  const [funzione, setFunzione] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMappa(leggiMappa(valore)); }, [valore]);
  useEffect(() => { void db().rpc("stato_manutenzione").then(({ error }) => setFunzione(!error)); }, []);

  const accesa = Object.keys(mappa).length;
  const cambia = (v: { id: string; nome: string; nome_en: string }, on: boolean) => {
    const m = { ...mappa };
    if (on) m[v.id] = { nome: v.nome, nome_en: v.nome_en, fino: "", nota: "" }; else delete m[v.id];
    setMappa(m);
  };
  const campo = (id: string, k: "fino" | "nota", x: string) => setMappa({ ...mappa, [id]: { ...(mappa[id] as VoceManutenzione), [k]: x } });

  async function salva() {
    setBusy(true); setMsg("");
    // la fine prevista si salva con il fuso orario, così la pagina la mostra giusta ovunque
    const pulita = Object.fromEntries(Object.entries(mappa).map(([id, v]) => [id, { ...v, fino: v.fino ? new Date(v.fino).toISOString() : "", nota: (v.nota ?? "").trim() }]));
    const { error } = await db().from("impostazioni_admin").upsert({ chiave: "manutenzione", valore: JSON.stringify(pulita) });
    setBusy(false);
    if (error) { setMsg("Errore: " + error.message); return; }
    await leggiManutenzione(true);
    setMsg(Object.keys(pulita).length ? "Salvato: la manutenzione vale da subito (chi ha l'app già aperta la vede alla prossima pagina o al prossimo avvio)." : "Salvato: nessuna sezione in manutenzione.");
    onSalvato();
  }

  const riga = (v: { id: string; nome: string; nome_en: string }) => {
    const voce = mappa[v.id];
    // datetime-local vuole "AAAA-MM-GGThh:mm" nell'ora locale
    const locale = voce?.fino ? (() => { const d = new Date(voce.fino); return isNaN(+d) ? voce.fino : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); })() : "";
    return <div key={v.id} className={`rounded-lg border-[0.8px] p-3 ${voce ? "border-[#7a4b00] bg-[#fff4e0] dark:bg-[#3a2a10]" : ""}`}>
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" className="size-5 accent-[#7a4b00]" checked={!!voce} onChange={(e) => cambia(v, e.target.checked)} />
        <span className="font-semibold">{v.nome}</span>
        {voce && <span className="ml-auto rounded-full bg-[#7a4b00] px-2.5 py-0.5 text-xs font-bold text-white">In manutenzione</span>}
      </label>
      {voce && <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
        <label className="text-sm"><span className="mb-1 block font-semibold">Fine prevista (facoltativa)</span>
          <input type="datetime-local" className={inputCls} value={locale} onChange={(e) => campo(v.id, "fino", e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Nota per gli utenti, in inglese (facoltativa)</span>
          <input className={inputCls} maxLength={300} placeholder="e.g. We are updating the risk calculation." value={voce.nota ?? ""} onChange={(e) => campo(v.id, "nota", e.target.value)} /></label>
        <a className="text-sm font-semibold text-primary underline sm:col-span-2" href={`${URL_HUB}manutenzione.html?s=${encodeURIComponent(v.id)}`} target="_blank" rel="noopener">Anteprima della pagina <ExternalLink className="inline size-3.5" /></a>
      </div>}
    </div>;
  };

  return <div className="max-w-3xl space-y-5">
    <p className="text-sm text-muted-foreground">Chi apre un'app o una sezione in manutenzione vede la pagina <strong>"Under maintenance"</strong> in inglese, con la fine prevista e la nota; la pagina controlla ogni minuto e riporta l'utente indietro appena spegni la manutenzione. Gli admin entrano lo stesso e vedono un avviso. Admin e accesso restano sempre aperti.</p>
    {funzione === false && <div className="rounded-lg border-l-4 border-[#b3261e] bg-[#fdecea] p-3 text-sm text-[#5c1410]">
      <p className="font-semibold">Manca la funzione nel database: finché non c'è, la manutenzione non blocca nessuno.</p>
      <p className="mt-1">Supabase → SQL Editor → incolla ed esegui (non modifica né cancella dati):</p>
      <pre className="mt-2 max-h-48 overflow-auto rounded bg-white p-2 text-xs text-black">{SQL}</pre>
      <Button className="mt-2" size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(SQL)}><Copy strokeWidth={1.5} />Copia SQL</Button>
    </div>}
    <section><h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Wrench className="size-5" strokeWidth={1.5} />App di OBO Hub</h2>
      <div className="space-y-2">{APP_HUB.map(riga)}</div></section>
    <section><h2 className="mb-2 text-lg font-bold">Sezioni di Progettazione LPS</h2>
      <div className="grid gap-2">{SEZIONI_LPS.map(riga)}</div></section>
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg" disabled={busy} onClick={() => void salva()}><Save strokeWidth={1.5} />Salva manutenzione{accesa ? ` (${accesa})` : ""}</Button>
      {accesa > 0 && <Button variant="outline" disabled={busy} onClick={() => setMappa({})}>Spegni tutto</Button>}
      {msg && <span className="text-sm" role="status">{msg}</span>}
    </div>
  </div>;
}
