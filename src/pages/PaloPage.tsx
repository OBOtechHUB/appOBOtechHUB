/**
 * Impianti su palo: antenne radio/TV, telecamere, illuminazione, impianti in copertura. Asta di captazione in cima
 * con calate isolate OBO isCon fino al collegamento equipotenziale: numero, modello e lunghezza dei conduttori,
 * verifica degli apparati (sfera rotolante e distanza di separazione) e materiali.
 */
import { useState } from "react";
import { FileText, Plus, RadioTower, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { CampoNumero } from "@/components/CampoNumero";
import { aggiornaEsteso, useEsteso } from "@/lib/statoProgetto";
import { useDatiEdificio } from "@/lib/progettoStore";
import { calcolaPalo, DATI_PALO, kcConduttori, type ApparatoPalo, type DatiPalo } from "@/calcoli/antenne/palo";
import { ISCON, versioniScelta } from "@/calcoli/calate/iscon";
import type { Livello } from "@/calcoli/calate/separazione";
import { relazionePalo } from "@/calcoli/antenne/relazionePalo";
import { creaDocx } from "@/lib/docx";
import { scarica } from "@/lib/esportazioni";
import { bloccoImmagine } from "@/calcoli/relazione/relazioneTecnica";
import { logoObo } from "@/components/progetto/RelazioneTecnica";

const f = (v: number, c = 2) => (Number.isFinite(v) ? v.toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }) : "—");
const ok = "border-[#1d7a45] bg-[#e3f4ea] text-[#14532d]", ko = "border-[#b3261e] bg-[#fdecea] text-[#7a1f16]";
const pill = (b: boolean, si: string, no: string) => <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${b ? "bg-[#e3f4ea] text-[#1d7a45]" : "bg-[#fdecea] text-[#b3261e]"}`}>{b ? si : no}</span>;

export function PaloPage() {
  const s = useEsteso(), de = useDatiEdificio();
  const d: DatiPalo = { ...DATI_PALO, lpl: ((de.lplProgetto ?? s.lpl) as Livello) || "IV", ...(s.palo ?? {}) };
  const set = (p: Partial<DatiPalo>) => aggiornaEsteso({ palo: { ...d, ...p } });
  const r = calcolaPalo(d);
  const num = (k: "quotaPunta" | "quotaCollegamento" | "mastoIsolato", etichetta: string, _passo = 0.1) =>
    <Campo etichetta={etichetta}><CampoNumero className={inputCls} min={0} valore={d[k]} onValore={(v) => { if (v != null) set({ [k]: v }); }} /></Campo>;
  const app = (id: string, p: Partial<ApparatoPalo>) => set({ apparati: d.apparati.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const sc = r.scelta, D = sc?.versione ? ISCON[sc.versione] : null;
  const [msgRel, setMsgRel] = useState("");
  async function relazioneWord() {
    setMsgRel("Preparo la relazione…");
    try {
      const rel = s.relazione, logo = await logoObo();
      const doc = relazionePalo({ dati: d, committente: rel?.committente, opera: rel?.titoloOpera || de.nomeProgetto || undefined, comune: de.comune || undefined, codice: de.nomeProgetto || undefined, tecnico: rel?.tecnico, albo: rel?.albo, logo: logo ? bloccoImmagine(logo, 4.2, "sinistra", 3) : undefined, data: new Date() });
      const nome = `Relazione-impianto-su-palo-${(de.nomeProgetto || de.comune || "progetto").replace(/[^\w.-]+/g, "_")}.docx`;
      scarica(new Blob([creaDocx(doc)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), nome);
      setMsgRel("Relazione scaricata.");
    } catch (e) { setMsgRel(e instanceof Error ? e.message : "Relazione non creata."); }
  }

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><RadioTower className="size-5" />Antenne · telecamere · illuminazione · impianti su palo</p>
      <h1 className="mt-2 text-3xl font-bold">Impianti su palo con calate isolate isCon</h1>
      <p className="mt-2 max-w-3xl text-white/90">Asta di captazione in cima al palo e conduttori isolati OBO isCon fino al collegamento equipotenziale: quanti conduttori, quale modello, che lunghezza, con la verifica degli apparati (CEI EN IEC 62305-3, 6.3; certificati OBO isCon secondo IEC TS 62561-8).</p>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <section aria-label="Palo">
        <h2 className="text-[1.7rem] font-medium">1 · Palo e captazione</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Campo etichetta="Livello di protezione (LPL)"><select className={inputCls} value={d.lpl} onChange={(e) => set({ lpl: e.target.value as Livello })}>{(["I", "II", "III", "IV"] as Livello[]).map((l) => <option key={l}>{l}</option>)}</select></Campo>
          {num("quotaPunta", "Quota della punta dell'asta (m da terra)", 0.5)}
          {num("quotaCollegamento", "Quota del collegamento equipotenziale (m)", 0.5)}
          {num("mastoIsolato", "Lunghezza del palo isolato isFang (m)", 1)}
          <Campo etichetta="Posa dei conduttori"><select className={inputCls} value={d.materiale} onChange={(e) => set({ materiale: e.target.value as "aria" | "solido" })}><option value="aria">In aria (lungo il palo)</option><option value="solido">Su / in materiale solido</option></select></Campo>
          <Campo etichetta="Numero di conduttori"><select className={inputCls} value={d.conduttori ?? ""} onChange={(e) => set({ conduttori: e.target.value ? Number(e.target.value) : null })}><option value="">Il minimo che basta</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></Campo>
          <Campo etichetta="Versione isCon"><select className={inputCls} value={d.versione ?? ""} onChange={(e) => set({ versione: (e.target.value || null) as DatiPalo["versione"] })}><option value="">La più semplice che basta</option>{versioniScelta(d.versione).map((v) => <option key={v} value={v}>{ISCON[v].nome}</option>)}</select></Campo>
          <Campo etichetta={`ki (LPL ${d.lpl})`}><CampoNumero className={inputCls} max={1} valore={d.ki} placeholder={r.ki.toLocaleString("it-IT")} onValore={(v) => set({ ki: v && v > 0 ? v : null })} /></Campo>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">l = punta − collegamento = <strong>{f(r.l, 2)} m</strong>. Sotto il collegamento la corrente scende lungo il palo metallico collegato a terra (o lungo una calata). Di solito il collegamento si mette sotto l'apparato più basso.</p>
        <fieldset className="mt-4 rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Esigenze di posa (guida alla scelta OBO)</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{([["verniciabile", "Da verniciare"], ["atex", "Zona ATEX"], ["protezioneMeccanica", "Serve protezione meccanica"], ["tensioniContatto", "Protezione dalle tensioni di contatto"]] as const).map(([k, t]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!d.esigenze[k]} onChange={(e) => set({ esigenze: { ...d.esigenze, [k]: e.target.checked } })} />{t}</label>)}</div>
        </fieldset>
      </section>

      <section className="mt-10" aria-label="Conduttori isolati">
        <h2 className="text-[1.7rem] font-medium">2 · Conduttori isolati isCon</h2>
        <div className={`mt-4 rounded-lg border-l-4 p-4 ${sc?.versione ? ok : ko}`} role="status">
          {sc?.versione && D ? <>
            <p className="text-lg"><strong>{sc.n} × {D.nome}{d.esigenze.tensioniContatto && sc.versione === "proplus" ? " GR" : ""}</strong> · s richiesta = {f(r.ki, 2)} × {f(sc.kc, 2)} × {f(r.l, 2)} = <strong>{f(sc.s, 3)} m</strong> ≤ se {f(d.materiale === "aria" ? D.sAria : D.sSolido, 2)} m</p>
            <p className="mt-1 text-sm">Lunghezza massima con questa scelta: {f(sc.lMax ?? NaN, 2)} m · corrente per conduttore {f(sc.correntePerConduttore, 0)} kA (classe {D.classe}, {D.iimp} kA) · lunghezza da ordinare {f(Math.ceil((r.l + 1) * sc.n), 0)} m in tutto.</p>
          </> : <p className="text-lg">Con {sc?.n ?? 4} conduttor{(sc?.n ?? 4) === 1 ? "e" : "i"} nessun isCon basta: s = {f(sc?.s ?? NaN, 3)} m.</p>}
        </div>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">Conduttori</th><th className="p-2 text-right">kc</th><th className="p-2 text-right">s richiesta</th><th className="p-2 text-right">Corrente per conduttore</th><th className="p-2">{d.versione ? `${ISCON[d.versione].nome}` : "Versione che basta"}</th><th className="p-2 text-right">l max</th></tr></thead>
          <tbody>{r.opzioni.map((o) => <tr key={o.n} className={`border-b ${sc?.n === o.n ? "bg-primary/10 font-semibold" : ""}`}>
            <td className="p-2">{o.n}</td><td className="p-2 text-right font-mono">{f(kcConduttori(o.n), 2)}</td><td className="p-2 text-right font-mono">{f(o.s, 3)} m</td><td className="p-2 text-right font-mono">{f(o.correntePerConduttore, 0)} kA</td>
            <td className="p-2">{o.versione ? ISCON[o.versione].nome : pill(false, "", "nessuna")}</td><td className="p-2 text-right font-mono">{o.lMax ? `${f(o.lMax, 2)} m` : "—"}</td></tr>)}</tbody>
        </table></div>
        {D && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">{D.equipotenziale.nota} Zona di controllo del potenziale x = {f(D.zonaPotenziale, 2)} m. Raggio di curvatura minimo {D.raggioCurvatura.nero} mm. Supporti ogni 1 m al massimo; fascetta MBS 100 almeno 20 cm sotto il supporto più basso; al massimo 2 conduttori per fascetta di messa a terra.</p>}
      </section>

      <section className="mt-10" aria-label="Apparati">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-[1.7rem] font-medium">3 · Apparati sul palo</h2>
          <Button variant="outline" onClick={() => set({ apparati: [...d.apparati, { id: crypto.randomUUID(), nome: "Apparato", quota: Math.max(0, d.quotaPunta - 4), sbraccio: 0.5, distanza: 1 }] })}><Plus />Aggiungi apparato</Button></div>
        <p className="mt-1 text-sm text-muted-foreground">Antenne, parabole, telecamere, proiettori: quota della sommità, sporgenza dall'asse dell'asta e distanza reale dalle parti nude della captazione (sfera r = {r.r} m).</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">Apparato</th><th className="p-2">Sommità (m)</th><th className="p-2">Sporgenza (m)</th><th className="p-2">Distanza reale (m)</th><th className="p-2 text-right">s</th><th className="p-2">Sfera</th><th className="p-2">Separazione</th><th className="p-2" /></tr></thead>
          <tbody>{r.apparati.map((a) => <tr key={a.id} className="border-b">
            <td className="p-2"><input aria-label="Nome" className={`${inputCls} py-1.5`} value={a.nome} maxLength={120} onChange={(e) => app(a.id, { nome: e.target.value })} /></td>
            <td className="p-2"><CampoNumero aria-label="Quota" className={`${inputCls} w-24 py-1.5`} min={0} valore={a.quota} onValore={(v) => { if (v != null) app(a.id, { quota: v }); }} /></td>
            <td className="p-2"><CampoNumero aria-label="Sporgenza" className={`${inputCls} w-24 py-1.5`} min={0} valore={a.sbraccio} onValore={(v) => { if (v != null) app(a.id, { sbraccio: v }); }} /></td>
            <td className="p-2"><CampoNumero aria-label="Distanza" className={`${inputCls} w-24 py-1.5`} min={0} valore={a.distanza} onValore={(v) => { if (v != null) app(a.id, { distanza: v }); }} /></td>
            <td className="p-2 text-right font-mono">{f(a.sNuda, 3)} m</td>
            <td className="p-2">{pill(a.protetto, "protetto", "esposto")}</td>
            <td className="p-2">{pill(a.distanzaOk, "d ≥ s", "d < s")}</td>
            <td className="p-2"><Button size="icon" variant="ghost" aria-label="Elimina apparato" onClick={() => set({ apparati: d.apparati.filter((x) => x.id !== a.id) })}><Trash2 /></Button></td>
          </tr>)}</tbody>
        </table></div>
      </section>

      {r.avvisi.length > 0 && <section className={`mt-8 rounded-lg border-l-4 p-4 ${ko}`} aria-label="Avvisi"><ul className="list-disc space-y-1 pl-5 text-sm">{r.avvisi.map((a) => <li key={a}>{a}</li>)}</ul></section>}

      <section className="mt-10" aria-label="Materiali">
        <h2 className="text-[1.7rem] font-medium">4 · Materiali OBO</h2>
        {r.materiali.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Codice</th><th className="p-2">Descrizione</th><th className="p-2 text-right">Quantità</th></tr></thead>
          <tbody>{r.materiali.map((m) => <tr key={m.codice} className="border-b"><td className="p-2 font-mono">{m.codice}</td><td className="p-2">{m.descrizione}</td><td className="p-2 text-right font-mono">{m.quantita} {m.unita}</td></tr>)}</tbody></table></div>
          : <p className="mt-2 text-sm text-muted-foreground">Nessuna soluzione valida: rivedi i dati.</p>}
        <div className="mt-6 flex flex-wrap items-center gap-3"><Button size="lg" onClick={() => void relazioneWord()}><FileText strokeWidth={1.5} />Relazione tecnica (Word)</Button><span role="status" className="text-sm">{msgRel}</span></div>
        <p className="mt-1 text-sm text-muted-foreground">Dati dimensionali, tenuta dell'isolamento, corrente per conduttore, numero di conduttori in parallelo, verifica degli apparati, posa e materiali. Committente e tecnico dai «Dati della relazione» del progetto.</p>
        <p className="mt-3 text-xs text-muted-foreground">Asta, palo isolato isFang, elementi di collegamento e morsetti dal catalogo OBO della sezione Prodotti. Usare solo componenti OBO provati con isCon (IEC TS 62561-8, Allegato F).</p>
      </section>
    </main>
  </>;
}
