/**
 * Vento e zavorre delle aste: dalla località (zona NTC 2018, altitudine) la pressione del vento e, per ogni asta,
 * i blocchi FangFix da 16 kg sui sostegni (irod 10–19 m calcolati, isFang dalle tabelle OBO) e la verifica delle aste a parete.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Download, CheckCircle2, XCircle, Wind, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { CampoNumero } from "@/components/CampoNumero";
import { useDatiEdificio } from "@/lib/progettoStore";
import { aggiornaEsteso, relazioneSchema, useEsteso, ventoSchema, type DatiVento } from "@/lib/statoProgetto";
import { ASTE, BARRE, MAX_BLOCCHI_BASE, barraPer, CATEGORIE, MATERIALI, ZONE, ce, pressioneBase, velocitaBase, velocitaPiccoKmh, verificaParete, proveBlocchi, zavorraSostegno, zavorraTabelle, zonaDa, type Materiale, type Parametri } from "@/calcoli/vento/vento";
import { scarica } from "@/lib/esportazioni";
import { NOME_METODO, verificaVentoProgetto } from "@/calcoli/vento/progetto";
import { tipoAsta } from "@/calcoli/relazione/testiProgetto";
import { infoArticoli, useCatalogoObo } from "@/lib/catalogoObo";

const f = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "–" : v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }));
const Esito = ({ ok }: { ok: boolean }) => (ok ? <CheckCircle2 className="inline size-4 text-green-600" aria-label="verificato" /> : <XCircle className="inline size-4 text-red-600" aria-label="non verificato" />);

export function VentoPage() {
  const ed = useDatiEdificio();
  const est = useEsteso();
  const v: DatiVento = est.vento ?? ventoSchema.parse({});
  const set = (p: Partial<DatiVento>) => aggiornaEsteso({ vento: ventoSchema.parse({ ...v, ...p }) });
  const [msg, setMsg] = useState(""), [cerca, setCerca] = useState(false);
  const P: Parametri = { zona: v.zona, altitudine: v.altitudine, categoria: v.categoria, quotaBase: v.quotaBase, mu: v.mu, gammaQ: 1.5, gammaG: 0.9 };
  const vb = velocitaBase(v.zona, v.altitudine);
  const sostegni = useMemo(() => ASTE.sostegni.map((s) => zavorraSostegno(s, P)), [JSON.stringify(P)]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabelle = useMemo(() => zavorraTabelle(P), [JSON.stringify(P)]); // eslint-disable-line react-hooks/exhaustive-deps
  const parete = useMemo(() => ASTE.parete.map((a) => verificaParete(a, v.interasseParete, v.materialeParete, P)), [JSON.stringify(P), v.interasseParete, v.materialeParete]); // eslint-disable-line react-hooks/exhaustive-deps
  const v10 = velocitaPiccoKmh(v.quotaBase + 10, P);
  const { catalogo } = useCatalogoObo();
  const fissaggio = relazioneSchema.parse(est.relazione ?? {}).fissaggioAste;
  const progetto = useMemo(() => {
    if (!est.aste.length) return null;
    const art = catalogo ? infoArticoli(catalogo, est.aste.map((a) => a.codiceOBO)) : {};
    return verificaVentoProgetto(est.aste, art, v, (a) => tipoAsta(a.codiceOBO, art, fissaggio));
  }, [est.aste, catalogo, JSON.stringify(v), fissaggio]); // eslint-disable-line react-hooks/exhaustive-deps
  const barraTxt = (k: number | null) => { const b = barraPer(k); return b ? `${b.tipo} (${b.codice}, ${b.lunghezza} mm)` : k != null ? "nessuna a catalogo" : "–"; };

  /** Zona dalla regione (Photon) e altitudine (Open-Meteo) delle coordinate del progetto. */
  async function daLocalita() {
    if (ed.lat == null || ed.lon == null) { setMsg("Il progetto non ha ancora la posizione: indicala in Dati edificio (Comune o indirizzo), oppure scegli zona e altitudine qui sotto."); return; }
    setCerca(true); setMsg("");
    try {
      const [r, q] = await Promise.all([
        fetch(`https://photon.komoot.io/reverse?lat=${ed.lat}&lon=${ed.lon}&lang=it`).then((x) => x.json() as Promise<{ features?: { properties?: Record<string, string> }[] }>),
        fetch(`https://api.open-meteo.com/v1/elevation?latitude=${ed.lat}&longitude=${ed.lon}`).then((x) => x.json() as Promise<{ elevation?: number[] }>).catch(() => null),
      ]);
      const pr = r.features?.[0]?.properties ?? {};
      const regione = pr["state"] ?? "", provincia = pr["county"] ?? "";
      const zona = zonaDa(regione, provincia, ed.lat, ed.lon);
      const alt = q?.elevation?.[0];
      set({ ...(zona ? { zona } : {}), ...(alt != null && Number.isFinite(alt) ? { altitudine: Math.round(alt) } : {}), regione, provincia, ...(ed.H > 0 && v.quotaBase === 0 ? { quotaBase: ed.H } : {}) });
      setMsg(`${ed.comune || "Località"}: ${regione}${provincia ? `, ${provincia}` : ""} → zona ${zona ?? "da scegliere"}${alt != null ? `, ${Math.round(alt)} m s.l.m.` : ""}. Controlla la categoria di esposizione.${zona == null ? " Regione non riconosciuta: scegli la zona a mano (isole minori: zona 9)." : ""}`);
    } catch { setMsg("Servizio di ricerca non raggiungibile: scegli zona e altitudine a mano."); }
    finally { setCerca(false); }
  }
  function usaNellaRelazione() {
    const rel = relazioneSchema.parse(est.relazione ?? {});
    aggiornaEsteso({ relazione: { ...rel, ventoKmh: Math.round(velocitaPiccoKmh(v.quotaBase + 6, P)) } });
    setMsg(`Velocità di progetto ${Math.round(velocitaPiccoKmh(v.quotaBase + 6, P))} km/h salvata nei Dati della relazione (blocchi dei treppiedi nella relazione).`);
  }
  async function excel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const z = ZONE.find((x) => x.zona === v.zona)!;
    const par = [["Vento e zavorre delle aste – " + (ed.nomeProgetto || ed.comune || "progetto")], [],
      ["Località", ed.comune || ""], ["Regione / provincia", [v.regione, v.provincia].filter(Boolean).join(" / ")], ["Zona NTC 2018", v.zona, z.descrizione], ["vb,0 (m/s)", z.vb0], ["a0 (m)", z.a0], ["ks", z.ks],
      ["Altitudine (m s.l.m.)", v.altitudine], ["ca", Number(vb.ca.toFixed(3))], ["vb (m/s)", Number(vb.vb.toFixed(2))], ["qb (kN/m²)", Number((pressioneBase(vb.vb) / 1000).toFixed(3))],
      ["Categoria di esposizione", v.categoria], ["Quota della base dal suolo (m)", v.quotaBase], ["ce a 10 m sopra la base", Number(ce(v.quotaBase + 10, v.categoria).toFixed(3))], ["Attrito μ", v.mu],
      ["Coefficienti", "vento γQ = 1,5; pesi γG = 0,9; cf,0 = 1,2; cs·cd = 1"], [], ["Predimensionamento: il numero definitivo dei blocchi va confermato dallo strutturista (istruzioni OBO irod §3.6)."]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(par), "Località");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Sistema", "Codice", "Altezza (m)", "Forza vento (kN)", "Momento base (kN·m)", "Basi", "Blocchi per base", "Blocchi totali", "Zavorra (kg)", "Barra filettata per base", "Verifica che governa", "Esito", "Note"],
      ...sostegni.map((s) => [s.nome, s.codice, s.altezza, Number(s.azione.F.toFixed(2)), Number(s.azione.M.toFixed(2)), s.basi, s.perBase ?? `oltre ${MAX_BLOCCHI_BASE}`, s.totali ?? "", s.zavorra ?? "", s.perBase != null ? barraTxt(s.perBase) : "", s.governa ?? "", s.esito === "ok" ? "verificato" : "serve strutturista", s.note.join(" ")])]), "irod su sostegno");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Sistema", "Basi (piedi)", "Leva basi", "Blocchi per piede", "Blocchi totali", "Zavorra (kg)", "MEd = 1,5·M (kN·m)", "MRd ribaltamento (kN·m)", "HEd = 1,5·F (kN)", "HRd scorrimento (kN)", "Esito", "Barra filettata per piede"],
      ...ASTE.sostegni.flatMap((so) => proveBlocchi(so, P).map((x) => [so.nome, x.basi, x.leva, x.perBase, x.totali, x.zavorra, Number(x.MEd.toFixed(2)), Number(x.MRd.toFixed(2)), Number(x.HEd.toFixed(2)), Number(x.HRd.toFixed(2)), x.ok ? "verificato" : "NO", x.barra ?? ""]))]), "Verifica blocchi irod");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Blocchi per base", "Barra art.", "Tipo", "Lunghezza (mm)"], ...BARRE.map((b) => [b.blocchi, b.codice, b.tipo, b.lunghezza])]), "Barre filettate");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Tabella OBO", "Altezza (m)", "Materiale", "Asta", "Sostegno", "Vento di picco in sommità (km/h)", "Blocchi 16 kg", "Zavorra (kg)", "Barra filettata per piede", "Vento massimo con 15 blocchi (km/h)"],
      ...tabelle.map((t) => [t.tabella, t.altezza, t.materiale ?? "", t.asta, t.sostegno, Math.round(t.vento), t.blocchi ?? "oltre la tabella", t.zavorra ?? "", t.blocchi != null ? barraTxt(t.blocchi / 3) : "", t.ventoMax])]), "isFang su treppiede");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Asta", "Ø (mm)", "Lunghezza (m)", "Interasse supporti (m)", "Forza vento (kN)", "Reazione supporto superiore (kN)", "Reazione supporto inferiore (kN)", "Momento al supporto superiore (kN·m)", "σ (MPa)", "fd (MPa)", "Sfruttamento", "Esito"],
      ...parete.map((r) => [r.nome, r.d, r.l, r.s, Number(r.F.toFixed(3)), Number(r.R1.toFixed(3)), Number(r.R2.toFixed(3)), Number(r.M.toFixed(4)), Math.round(r.sigma), r.fd, Number(r.sfruttamento.toFixed(2)), r.esito === "ok" ? "verificato" : "non verificato"])]), "Aste a parete");
    if (progetto) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Art. asta", "Descrizione", "N° aste", "Altezza (m)", "Quota base (m)", "Metodo", "Vento in punta (km/h)", "F (kN)", "M base (kN·m)", "Basi", "Blocchi per base", "Blocchi per asta", "Barra per base", "σ / fd (MPa)", "Esito", "Note"],
      ...progetto.gruppi.map((g) => [g.codice, g.nome, g.numero, g.altezza, g.quotaBase, NOME_METODO[g.metodo], Math.round(g.vento), Number(g.F.toFixed(3)), Number(g.M.toFixed(3)), g.basi ?? "", g.perBase ?? "", g.blocchi ?? "", g.barra ? `${g.barra.tipo} (${g.barra.codice})` : "", g.parete ? `${Math.round(g.parete.sigma)} / ${g.parete.fd}` : "", g.esito === "ok" ? "verificata" : "NON verificata", g.note.join(" ")]),
      [], ["Zavorre e accessori"], ...progetto.computo.map((c) => [c.codice, c.descrizione, c.quantita])]), "Aste del progetto");
    const dati = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    scarica(new Blob([dati], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Vento_zavorre_aste_${(ed.comune || "progetto").replace(/[^\w-]+/g, "_")}.xlsx`);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Wind className="size-6 text-primary" />Vento e zavorre delle aste</h1>
          <p className="text-sm text-muted-foreground">Carico del vento secondo NTC 2018 / EN 1991-1-4 e blocchi FangFix da 16 kg (art. 5403227) per ogni asta, su sostegno o a parete.</p>
        </div>
        <Button variant="outline" onClick={() => void excel()}><Download />Scarica Excel</Button>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Località e parametri</h2>
          <Button size="sm" onClick={() => void daLocalita()} disabled={cerca}><MapPin />{cerca ? "Ricerca…" : `Dalla località del progetto${ed.comune ? ` (${ed.comune})` : ""}`}</Button>
        </div>
        {msg && <p className="mb-3 rounded border-l-4 border-primary bg-primary/10 px-3 py-2 text-sm" role="status">{msg}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Campo etichetta="Zona di vento (NTC 2018)"><select className={inputCls} value={v.zona} onChange={(e) => set({ zona: Number(e.target.value) })}>{ZONE.map((z) => <option key={z.zona} value={z.zona}>{z.zona} – {z.descrizione.split(" (")[0]!.slice(0, 40)}</option>)}</select></Campo>
          <Campo etichetta="Altitudine (m s.l.m.)"><CampoNumero className={inputCls} valore={v.altitudine} min={0} max={3000} onValore={(x) => x != null && set({ altitudine: x })} /></Campo>
          <Campo etichetta="Categoria di esposizione"><select className={inputCls} value={v.categoria} onChange={(e) => set({ categoria: e.target.value as DatiVento["categoria"] })}>{CATEGORIE.map((c) => <option key={c.cat} value={c.cat}>{c.cat} – {c.descrizione}</option>)}</select></Campo>
          <Campo etichetta="Quota della base dal suolo (m)"><CampoNumero className={inputCls} valore={v.quotaBase} min={0} max={300} onValore={(x) => x != null && set({ quotaBase: x })} /></Campo>
          <Campo etichetta="Attrito blocchi–appoggio μ"><CampoNumero className={inputCls} valore={v.mu} min={0.1} max={1} onValore={(x) => x != null && set({ mu: x })} /></Campo>
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <div>vb = <b>{f(vb.vb, 1)}</b> m/s{vb.ca > 1 ? ` (ca ${f(vb.ca, 2)})` : ""}</div>
            <div>qb = <b>{f(pressioneBase(vb.vb) / 1000, 3)}</b> kN/m²</div>
            <div>a 10 m sopra la base: qp = <b>{f((pressioneBase(vb.vb) * ce(v.quotaBase + 10, v.categoria)) / 1000, 3)}</b> kN/m², raffica {Math.round(v10)} km/h</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{ZONE.find((z) => z.zona === v.zona)?.descrizione}. La quota della base è l'altezza dal suolo dove appoggia l'asta (es. tetto: altezza dell'edificio). <button type="button" className="underline" onClick={usaNellaRelazione}><Send className="inline size-3" /> Usa la velocità per la relazione</button></p>
      </section>

      <section className="rounded-lg border bg-card p-4" aria-labelledby="h-aste-progetto">
        <h2 id="h-aste-progetto" className="mb-1 font-semibold">Aste del progetto</h2>
        {!progetto ? <p className="text-sm text-muted-foreground">Il progetto non ha ancora aste: disegnale in <Link to="/edificio-3d" className="underline">Edificio 3D</Link>. La verifica di ogni asta entra nella relazione tecnica e nel computo.</p> : <>
          <p className="mb-3 text-sm text-muted-foreground">Ogni asta del modello con la quota della sua base, il tipo di fissaggio (Dati della relazione: {fissaggio}) e i dati del catalogo OBO. Questi risultati entrano nella relazione tecnica (13.1) e nel computo materiali.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-1">Asta</th><th className="p-1">Metodo</th><th className="p-1 text-right">N°</th><th className="p-1 text-right">H / quota</th><th className="p-1 text-right">Vento in punta</th><th className="p-1 text-right">Blocchi per asta</th><th className="p-1">Barra per base</th><th className="p-1">Esito</th></tr></thead>
              <tbody>{progetto.gruppi.map((g) => (
                <tr key={g.chiave} className="border-b align-top">
                  <td className="p-1"><span className="font-mono text-xs">{g.codice || "—"}</span> <span className="text-xs text-muted-foreground">{g.nome.slice(0, 60)}</span>{g.note.map((n) => <span key={n} className="block text-xs text-amber-700">{n}</span>)}</td>
                  <td className="p-1 text-xs">{NOME_METODO[g.metodo]}</td><td className="p-1 text-right">{g.numero}</td>
                  <td className="p-1 text-right">{f(g.altezza, 1)} m / {f(g.quotaBase, 1)} m</td><td className="p-1 text-right">{Math.round(g.vento)} km/h</td>
                  <td className="p-1 text-right font-semibold">{g.metodo === "parete" ? (g.parete ? `σ ${f(g.parete.sigma, 0)}/${g.parete.fd} MPa` : "–") : g.blocchi != null ? `${g.blocchi}${g.basi && g.basi > 1 ? ` (${g.basi}×${g.perBase})` : ""}` : "oltre"}</td>
                  <td className="p-1 text-xs">{g.barra ? `${g.barra.tipo} (${g.barra.codice})` : "–"}</td>
                  <td className="p-1"><Esito ok={g.esito === "ok"} />{g.stima ? <span className="ml-1 text-xs text-muted-foreground">stima</span> : null}</td>
                </tr>))}</tbody>
            </table>
          </div>
          {progetto.computo.length > 0 && <p className="mt-2 text-sm">Zavorre: {progetto.computo.map((c) => `${c.quantita} × ${c.codice}`).join(" · ")} — {progetto.blocchiTotali * 16} kg di blocchi.</p>}
          {progetto.datiMancanti.length > 0 && <p className="mt-1 text-xs text-amber-700">Dati da completare: {progetto.datiMancanti.join("; ")}.</p>}
        </>}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-1 font-semibold">Aste irod 10–19 m su sostegno a gambe</h2>
        <p className="mb-3 text-sm text-muted-foreground">Ribaltamento attorno alla retta tra due piedi e scorrimento; una base di blocchi per ogni piede, da 1 a {MAX_BLOCCHI_BASE} blocchi per base: la barra filettata più lunga a catalogo (isFang 3B-G4, 500 mm) porta 4 blocchi. Barre: {BARRE.map((b) => `${b.tipo} ${b.codice} = ${b.blocchi} ${b.blocchi === 1 ? "blocco" : "blocchi"}`).join(" · ")}.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-1">Sistema</th><th className="p-1 text-right">Forza vento</th><th className="p-1 text-right">Momento base</th><th className="p-1 text-right">Basi</th><th className="p-1 text-right">Blocchi per base</th><th className="p-1 text-right">Blocchi totali</th><th className="p-1 text-right">Zavorra</th><th className="p-1">Barra per base</th><th className="p-1">Esito</th></tr></thead>
            <tbody>{sostegni.map((s) => (
              <tr key={s.id} className="border-b align-top">
                <td className="p-1"><b>{s.nome}</b> <span className="text-xs text-muted-foreground">art. {s.codice}</span>{s.note.map((n) => <span key={n} className="block text-xs text-amber-700">{n}</span>)}</td>
                <td className="p-1 text-right">{f(s.azione.F)} kN</td><td className="p-1 text-right">{f(s.azione.M)} kN·m</td>
                <td className="p-1 text-right">{s.basi}</td><td className="p-1 text-right font-semibold">{s.perBase ?? `> ${MAX_BLOCCHI_BASE}`}</td><td className="p-1 text-right font-semibold">{s.totali ?? "–"}</td><td className="p-1 text-right">{s.zavorra != null ? `${s.zavorra} kg` : "–"}</td><td className="p-1 text-xs">{s.perBase != null ? `${s.basi} × ${barraTxt(s.perBase)}` : "–"}</td>
                <td className="p-1"><Esito ok={s.esito === "ok"} /> {s.governa ?? "serve strutturista"}</td>
              </tr>))}</tbody>
          </table>
        </div>
              <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium">Dettaglio delle verifiche: da 1 a {MAX_BLOCCHI_BASE} blocchi per piede</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="p-1">Sistema</th><th className="p-1 text-right">Basi</th><th className="p-1 text-right">Blocchi per piede</th><th className="p-1 text-right">Totali</th><th className="p-1 text-right">MEd / MRd (kN·m)</th><th className="p-1 text-right">HEd / HRd (kN)</th><th className="p-1">Barra per piede</th><th className="p-1">Esito</th></tr></thead>
              <tbody>{ASTE.sostegni.flatMap((so) => proveBlocchi(so, P).map((x) => (
                <tr key={`${so.id}-${x.basi}-${x.perBase}`} className={`border-b ${x.ok ? "bg-green-50 dark:bg-green-950/30" : ""}`}>
                  <td className="p-1">{so.nome}</td><td className="p-1 text-right">{x.basi}{x.leva !== 1 ? ` (leva ${f(x.leva)})` : ""}</td><td className="p-1 text-right">{x.perBase}</td><td className="p-1 text-right">{x.totali} = {x.zavorra} kg</td>
                  <td className="p-1 text-right">{f(x.MEd)} / {f(x.MRd)}</td><td className="p-1 text-right">{f(x.HEd)} / {f(x.HRd)}</td><td className="p-1">{x.barra ?? "–"}</td><td className="p-1"><Esito ok={x.ok} /></td>
                </tr>)))}</tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Si sceglie la prima riga verificata (prima con meno basi). Ribaltamento: MRd = 0,9·g·(massa·a + blocchi·a·leva); scorrimento: HRd = μ·0,9·g·massa totale.</p>
        </details>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-1 font-semibold">Aste isFang su treppiede (tabelle del catalogo OBO)</h2>
        <p className="mb-3 text-sm text-muted-foreground">Raffica di picco alla sommità dell'asta confrontata con le velocità ammesse dal catalogo OBO per 3, 6, 9, 12 o 15 blocchi.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-1">Asta</th><th className="p-1">Tipo</th><th className="p-1 text-right">Altezza</th><th className="p-1 text-right">Raffica in sommità</th><th className="p-1 text-right">Blocchi 16 kg</th><th className="p-1 text-right">Zavorra</th><th className="p-1">Barra per piede</th></tr></thead>
            <tbody>{tabelle.map((t) => (
              <tr key={t.asta + t.tabella} className="border-b">
                <td className="p-1 font-mono text-xs">{t.asta}</td><td className="p-1 text-xs">{t.tabella.replace("Aste di captazione ", "")}{t.materiale ? ` (${t.materiale})` : ""}</td>
                <td className="p-1 text-right">{f(t.altezza, 1)} m</td><td className="p-1 text-right">{Math.round(t.vento)} km/h</td>
                <td className="p-1 text-right font-semibold">{t.blocchi ?? <span className="text-red-700">oltre {t.ventoMax} km/h</span>}</td><td className="p-1 text-right">{t.zavorra != null ? `${t.zavorra} kg` : "–"}</td><td className="p-1 text-xs">{t.blocchi != null ? `3 × ${barraTxt(t.blocchi / 3)}` : "–"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-1 font-semibold">Aste a parete con due supporti</h2>
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <Campo etichetta="Interasse tra i due supporti (m)"><CampoNumero className={inputCls} valore={v.interasseParete} min={0.1} max={5} onValore={(x) => x != null && set({ interasseParete: x })} /></Campo>
          <Campo etichetta="Materiale dell'asta"><select className={inputCls} value={v.materialeParete} onChange={(e) => set({ materialeParete: e.target.value as Materiale })}>{Object.entries(MATERIALI).map(([k, m]) => <option key={k} value={k}>{m.nome} (fd {m.fd} MPa)</option>)}</select></Campo>
          <p className="self-end text-xs text-muted-foreground">Supporto inferiore alla base dell'asta, superiore all'interasse indicato; la parte sopra il supporto superiore lavora a sbalzo.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-1">Asta</th><th className="p-1 text-right">Forza vento</th><th className="p-1 text-right">Supporto superiore</th><th className="p-1 text-right">Supporto inferiore</th><th className="p-1 text-right">σ al supporto</th><th className="p-1">Esito</th></tr></thead>
            <tbody>{parete.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-1">{r.nome}</td><td className="p-1 text-right">{f(r.F * 1000, 0)} N</td><td className="p-1 text-right">{f(r.R1 * 1000, 0)} N</td><td className="p-1 text-right">{f(r.R2 * 1000, 0)} N</td>
                <td className="p-1 text-right">{f(r.sigma, 0)} / {r.fd} MPa</td><td className="p-1"><Esito ok={r.esito === "ok"} /> {Math.round(r.sfruttamento * 100)} %</td>
              </tr>))}</tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Metodo: NTC 2018 §3.3 (zone, altitudine, ce per categoria, TR 50 anni) ed EN 1991-1-4 §5.3 e §7.9 (cilindro, cf,0 = 1,2, ψλ dalla snellezza, cs·cd = 1; il distacco dei vortici, Annesso E, non è verificato). Equilibrio con vento × 1,5 e pesi × 0,9.
        Il vento sul sostegno non è conteggiato. Predimensionamento: il numero definitivo dei blocchi lo stabilisce lo strutturista (istruzioni OBO irod §3.6, §4.3.3).{" "}
        <Link to="/edificio-3d" className="underline">Aste del progetto in Edificio 3D</Link>
      </p>
    </main>
  );
}
