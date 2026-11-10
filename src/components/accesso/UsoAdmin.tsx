import { useEffect, useMemo, useState } from "react";
import { db, SEZIONI } from "@/lib/accesso";

interface Riga { giorno: string; app: string; sezione: string; aperture: number; persone: number; visitatori: number }
const NOMI_APP: Record<string, string> = { hub: "OBO Hub", lps: "Progettazione LPS", mappa: "Mappa carichi ufficio tecnico", prodotti: "Prodotti OBO", torrette: "Configuratore torrette" };
const NOMI_SEZ: Record<string, string> = {
  ...Object.fromEntries(SEZIONI.map((s) => [`lps:${s.id}`, s.nome])),
  "lps:home": "Home", "lps:norma": "Norma 62305: calcoli e tabelle", "lps:strumenti": "Strumenti", "lps:guida": "Guida",
  "mappa:home": "Home", "mappa:ins": "Inserisci progetto", "mappa:map": "Mappa dei carichi", "mappa:prj": "Progetti", "mappa:team": "Persone", "mappa:offerte": "Offerte", "mappa:data": "Download",
  "prodotti:home": "Home", "prodotti:novita": "Novità", "prodotti:codici": "Codici", "prodotti:ricerca": "Ricerca",
};
const PERIODI = [{ g: 7, n: "7 giorni" }, { g: 30, n: "30 giorni" }, { g: 90, n: "3 mesi" }, { g: 365, n: "1 anno" }];

/** Somma le righe per chiave, contando aperture e il massimo di persone diverse per giorno. */
export function raggruppa(righe: Riga[], chiave: (r: Riga) => string): { k: string; aperture: number; giorni: number; persone: number }[] {
  const m = new Map<string, { k: string; aperture: number; giorni: Set<string>; persone: number }>();
  for (const r of righe) {
    const k = chiave(r); const x = m.get(k) ?? { k, aperture: 0, giorni: new Set<string>(), persone: 0 };
    x.aperture += Number(r.aperture); x.giorni.add(r.giorno); x.persone = Math.max(x.persone, Number(r.persone) + Number(r.visitatori)); m.set(k, x);
  }
  return [...m.values()].map((x) => ({ k: x.k, aperture: x.aperture, giorni: x.giorni.size, persone: x.persone })).sort((a, b) => b.aperture - a.aperture);
}

function Barre({ voci, nome }: { voci: { k: string; aperture: number; giorni: number; persone: number }[]; nome: (k: string) => string }) {
  const max = voci[0]?.aperture ?? 1;
  if (!voci.length) return <p className="text-sm text-muted-foreground">Nessun uso nel periodo.</p>;
  return <ul className="space-y-2">{voci.map((v) => <li key={v.k} className="text-sm">
    <div className="flex justify-between gap-2"><span className="truncate">{nome(v.k)}</span><span className="shrink-0 font-mono">{v.aperture}</span></div>
    <div className="mt-0.5 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(v.aperture / max) * 100}%` }} /></div>
    <p className="mt-0.5 text-xs text-muted-foreground">usata in {v.giorni} {v.giorni === 1 ? "giorno" : "giorni"} · fino a {v.persone} {v.persone === 1 ? "persona" : "persone"} al giorno</p>
  </li>)}</ul>;
}

/** Admin → Uso delle app: quali app e sezioni si usano davvero (amministratori esclusi). */
export function UsoAdmin() {
  const [giorni, setGiorni] = useState(30);
  const [righe, setRighe] = useState<Riga[] | null>(null);
  const [problema, setProblema] = useState("");
  useEffect(() => {
    setRighe(null);
    void db().rpc("statistiche_uso", { da: new Date(Date.now() - giorni * 864e5).toISOString() }).then(({ data, error }) => {
      if (error) { setProblema(error.message); setRighe([]); } else { setProblema(""); setRighe((data ?? []) as Riga[]); }
    });
  }, [giorni]);
  const perApp = useMemo(() => raggruppa((righe ?? []).filter((r) => !r.sezione), (r) => r.app), [righe]);
  const perSezione = useMemo(() => raggruppa((righe ?? []).filter((r) => r.sezione && r.sezione !== "home"), (r) => `${r.app}:${r.sezione}`), [righe]);
  // aperture per giorno (tutte le app), per il grafico
  const perGiorno = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of righe ?? []) if (!r.sezione) m.set(r.giorno, (m.get(r.giorno) ?? 0) + Number(r.aperture));
    const out: { g: string; n: number }[] = [];
    for (let i = giorni - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); const k = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }); out.push({ g: k, n: m.get(k) ?? 0 }); }
    return out;
  }, [righe, giorni]);
  const maxG = Math.max(1, ...perGiorno.map((x) => x.n));

  if (problema) return <p className="rounded-lg border-l-4 border-[#b3261e] bg-[#fdecea] p-3 text-sm text-[#5c1410]">Le statistiche d'uso non si leggono ({problema}). Esegui <code>supabase/pro.sql</code> nell'editor SQL di Supabase.</p>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-auto text-sm text-muted-foreground">Aperture di app e sezioni da parte di utenti e visitatori (una per persona ogni 30 minuti). <strong>Gli amministratori non contano.</strong></p>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Periodo">{PERIODI.map((p) => <button key={p.g} type="button" aria-pressed={giorni === p.g} onClick={() => setGiorni(p.g)}
        className={`rounded-full border-[0.8px] px-3 py-1 text-sm ${giorni === p.g ? "border-primary bg-primary text-primary-foreground" : "border-bordo-scheda hover:border-primary"}`}>{p.n}</button>)}</div>
    </div>
    {!righe ? <p className="text-sm text-muted-foreground" role="status">Caricamento…</p> : <>
      <section className="rounded-lg border-[0.8px] border-bordo-scheda p-4">
        <h3 className="font-semibold">Aperture per giorno</h3>
        <div className="mt-3 flex h-28 items-end gap-[2px]" role="img" aria-label={`Aperture per giorno negli ultimi ${giorni} giorni`}>
          {perGiorno.map((x) => <div key={x.g} title={`${new Date(x.g + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" })}: ${x.n}`} className="flex-1 rounded-t-sm bg-primary/80" style={{ height: `${Math.max(x.n ? 4 : 1, (x.n / maxG) * 100)}%`, opacity: x.n ? 1 : 0.25 }} />)}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border-[0.8px] border-bordo-scheda p-4"><h3 className="mb-3 font-semibold">App</h3><Barre voci={perApp} nome={(k) => NOMI_APP[k] ?? k} /></section>
        <section className="rounded-lg border-[0.8px] border-bordo-scheda p-4"><h3 className="mb-3 font-semibold">Sezioni più usate</h3><Barre voci={perSezione.slice(0, 20)} nome={(k) => `${NOMI_APP[k.split(":")[0] ?? ""]?.split(" ")[0] ?? ""} · ${NOMI_SEZ[k] ?? k.split(":").slice(1).join(":")}`} /></section>
      </div>
      {perSezione.length > 0 && <p className="text-xs text-muted-foreground">Sezioni mai aperte nel periodo in Progettazione LPS: {SEZIONI.filter((s) => s.id !== "app_mappa" && !perSezione.some((v) => v.k === `lps:${s.id}`)).map((s) => s.nome).join(", ") || "nessuna"}.</p>}
    </>}
  </div>;
}
