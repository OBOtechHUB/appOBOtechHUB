/**
 * Sopralluogo da telefono o tablet: foto per ricordare particolari e impianti esistenti, con didascalia,
 * tipo e nota (scritta o dettata) e messaggi vocali, più gli appunti e i vocali generali del sopralluogo. Le foto si salvano anche senza rete e si caricano quando
 * torna; quelle segnate vanno nella relazione. Tutto resta nel progetto attivo (`esteso.sopralluogo`).
 */
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, CloudUpload, WifiOff, Wifi, FolderOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { elencaProgetti, leggiProgetto, progettiCondivisi, utenteId } from "@/lib/progetti.functions";
import { salvaAttivo } from "@/components/ProjectSync";
import { useAccesso } from "@/lib/accesso";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/PageTitle";
import { useDatiEdificio } from "@/lib/progettoStore";
import { caricaSnapshot, impostaAttivo, snapshot, aggiornaEsteso, leggiAttivo, leggiEsteso, useAttivo, useEsteso, sopralluogoSchema, type Sopralluogo } from "@/lib/statoProgetto";
import { PulsanteDetta, NoteVocali } from "@/components/sopralluogo/Voce";
import { fotoInCoda, percorsoFoto, riduciFoto, salvaFoto, scaricaFoto, sincronizzaFoto } from "@/lib/fotoSopralluogo";

type Foto = Sopralluogo["foto"][number];
type Categoria = Foto["categoria"];
const cls = "h-11 w-full rounded-md border border-input bg-background px-3 text-base";
const CATEGORIE: [Exclude<Categoria, "">, string][] = [["particolare", "Particolare da ricordare"], ["impianto", "Impianto esistente"], ["altro", "Altro"]];
const vuoto = (): Sopralluogo => sopralluogoSchema.parse({});

export function SopralluogoPage() {
  const d = useDatiEdificio(), s = useEsteso(), attivo = useAttivo();
  const so: Sopralluogo = { ...vuoto(), ...s.sopralluogo };
  const leggiSo = (): Sopralluogo => ({ ...vuoto(), ...leggiEsteso().sopralluogo });
  const setSo = (p: Partial<Sopralluogo>) => aggiornaEsteso({ sopralluogo: { ...leggiSo(), ...p } });
  const setFoto = (id: string, p: Partial<Foto>) => setSo({ foto: leggiSo().foto.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine), [inCoda, setInCoda] = useState(0), [msg, setMsg] = useState(""), [occupato, setOccupato] = useState(false);
  const [anteprime, setAnteprime] = useState<Record<string, string>>({}), [filtro, setFiltro] = useState<Categoria | "tutte">("tutte"), [aperta, setAperta] = useState<string | null>(null);
  const [categoriaNuove, setCategoriaNuove] = useState<Categoria>("particolare");
  const fotoRef = useRef<HTMLInputElement>(null), galleriaRef = useRef<HTMLInputElement>(null);

  const aggiornaCoda = () => void fotoInCoda().then((c) => setInCoda(c.length));
  useEffect(() => {
    const su = () => { setOnline(true); void sincronizzaFoto().then(setInCoda); }, giu = () => setOnline(false);
    window.addEventListener("online", su); window.addEventListener("offline", giu); aggiornaCoda();
    if (navigator.onLine) void sincronizzaFoto().then(setInCoda);
    return () => { window.removeEventListener("online", su); window.removeEventListener("offline", giu); };
  }, []);
  useEffect(() => {
    let vivo = true; const nuove: Record<string, string> = {};
    void (async () => { for (const f of so.foto) if (!anteprime[f.percorso]) { const b = await scaricaFoto(f.percorso); if (b) nuove[f.percorso] = URL.createObjectURL(b); }
      if (vivo && Object.keys(nuove).length) setAnteprime((a) => ({ ...a, ...nuove })); })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [so.foto.length]);

  async function aggiungiFoto(files: FileList | null) {
    const a = leggiAttivo(); if (!files?.length || !a) return;
    setOccupato(true); setMsg("");
    try {
      const nuove: Foto[] = [];
      for (const f of Array.from(files).slice(0, 20)) {
        const percorso = await percorsoFoto(a.id); if (!percorso) { setMsg("Accedi per salvare le foto."); break; }
        const blob = await riduciFoto(f); const esito = await salvaFoto(percorso, blob);
        setAnteprime((x) => ({ ...x, [percorso]: URL.createObjectURL(blob) }));
        nuove.push({ id: percorso.split("/").pop()!, percorso, didascalia: "", data: new Date().toISOString(), lat: null, lon: null, inRelazione: false, calata: "", misura: "", categoria: categoriaNuove, nota: "" });
        if (esito === "in-coda") setMsg("Senza rete: le foto restano sul telefono e si caricano da sole quando torna la connessione.");
      }
      if (nuove.length) { setSo({ foto: [...leggiSo().foto, ...nuove].slice(0, 120) }); setAperta(nuove[nuove.length - 1]!.id); }
    } finally { setOccupato(false); aggiornaCoda(); if (fotoRef.current) fotoRef.current.value = ""; if (galleriaRef.current) galleriaRef.current.value = ""; }
  }

  if (!attivo) return <ScegliProgetto />;
  const vis = [...so.foto].reverse().filter((f) => filtro === "tutte" || f.categoria === filtro);
  const conta = (c: Categoria | "tutte") => (c === "tutte" ? so.foto.length : so.foto.filter((f) => f.categoria === c).length);
  return <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
    <PageTitle titolo="Sopralluogo" />
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">{attivo.codice ? `${attivo.codice} · ` : ""}{attivo.nome || d.nomeProgetto || "Progetto"}{d.comune ? ` – ${d.comune}` : ""}</span>
      <Link to="/progetti" className="text-xs text-primary underline">Cambia progetto</Link>
      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${online ? "bg-green-600/15" : "bg-amber-500/20"}`}>{online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{online ? "In linea" : "Senza rete: le foto restano sul telefono"}</span>
      {inCoda > 0 && <Button type="button" size="sm" variant="outline" onClick={() => void sincronizzaFoto().then(setInCoda)}><CloudUpload />{inCoda} foto da caricare</Button>}
    </div>
    {msg && <p role="status" className="text-sm">{msg}</p>}

    <section className="space-y-3 rounded-lg border bg-card p-4" aria-label="Nuove foto">
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Tipo delle prossime foto">
        {CATEGORIE.map(([v, t]) => <Button key={v} type="button" role="radio" aria-checked={categoriaNuove === v} variant={categoriaNuove === v ? "default" : "outline"} className="h-auto min-h-11 whitespace-normal px-2 py-1 text-sm leading-tight" onClick={() => setCategoriaNuove(v)}>{t}</Button>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="h-12 whitespace-normal px-2 text-sm leading-tight" disabled={occupato} onClick={() => fotoRef.current?.click()}><Camera />Scatta foto</Button>
        <Button type="button" variant="outline" className="h-12 whitespace-normal px-2 text-sm leading-tight" disabled={occupato} onClick={() => galleriaRef.current?.click()}><ImagePlus />Dalla galleria</Button>
      </div>
      <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void aggiungiFoto(e.target.files)} />
      <input ref={galleriaRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void aggiungiFoto(e.target.files)} />
    </section>

    {so.foto.length > 0 && <div className="flex flex-wrap gap-1">
      {(["tutte", ...CATEGORIE.map(([v]) => v)] as (Categoria | "tutte")[]).map((c) => <Button key={c} type="button" size="sm" variant={filtro === c ? "default" : "outline"} aria-pressed={filtro === c} onClick={() => setFiltro(c)}>{c === "tutte" ? "Tutte" : CATEGORIE.find(([v]) => v === c)![1]} ({conta(c)})</Button>)}
    </div>}

    <ul className="grid gap-3 sm:grid-cols-2">{vis.map((f) => <li key={f.id} className="overflow-hidden rounded-lg border bg-card">
      <button type="button" className="block w-full" onClick={() => setAperta(aperta === f.id ? null : f.id)} aria-expanded={aperta === f.id} aria-label={`Foto ${f.didascalia || ""}: apri i dettagli`}>
        {anteprime[f.percorso] ? <img src={anteprime[f.percorso]} alt={f.didascalia || "Foto del sopralluogo"} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-muted text-sm text-muted-foreground">Foto</div>}
      </button>
      <div className="space-y-2 p-3">
        <input className={cls} value={f.didascalia} maxLength={300} placeholder="Cosa si vede (es. UTA lato nord, calata C3)" aria-label="Didascalia" onChange={(e) => setFoto(f.id, { didascalia: e.target.value })} />
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5">{CATEGORIE.find(([v]) => v === f.categoria)?.[1] ?? "Senza tipo"}</span>
          <span>{f.data ? new Date(f.data).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
          {so.vocali.some((v) => v.foto === f.id) && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">{so.vocali.filter((v) => v.foto === f.id).length} vocali</span>}
          {f.nota && aperta !== f.id && <span className="truncate">· {f.nota}</span>}
        </div>
        {aperta === f.id && <>
          <select className={cls} value={f.categoria} aria-label="Tipo" onChange={(e) => setFoto(f.id, { categoria: e.target.value as Categoria })}><option value="">Senza tipo</option>{CATEGORIE.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          <textarea className={`${cls} h-20 py-2`} value={f.nota} maxLength={1000} placeholder="Nota (es. ancoraggio da verificare, cavo esistente da collegare)" aria-label="Nota" onChange={(e) => setFoto(f.id, { nota: e.target.value })} />
          <PulsanteDetta valore={f.nota} onValore={(t) => setFoto(f.id, { nota: t })} etichetta="Detta la nota" massimo={1000} />
          <NoteVocali compatto progetto={attivo.id} foto={f.id} vocali={so.vocali} onVocali={(v) => setSo({ vocali: v })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.inRelazione} onChange={(e) => setFoto(f.id, { inRelazione: e.target.checked })} />Metti nella relazione</label>
        </>}
      </div>
    </li>)}</ul>
    {!so.foto.length && <p className="text-sm text-muted-foreground">Nessuna foto: scegli il tipo e scatta. Ogni foto ha una didascalia e una nota per ricordare cosa serve.</p>}

    <section className="rounded-lg border bg-card p-4" aria-labelledby="h-appunti">
      <h2 id="h-appunti" className="mb-2 font-semibold">Appunti del sopralluogo</h2>
      <textarea className={`${cls} h-32 py-2`} value={so.appunti} maxLength={5000} placeholder="Accessi alla copertura, impianti esistenti, cose da chiedere al cliente…" aria-label="Appunti del sopralluogo" onChange={(e) => setSo({ appunti: e.target.value })} />
      <div className="mt-2"><PulsanteDetta valore={so.appunti} onValore={(t) => setSo({ appunti: t })} etichetta="Detta gli appunti" /></div>
      <p className="mt-2 text-xs text-muted-foreground">Puoi anche scrivere a voce con il microfono della tastiera del telefono.</p>
    </section>

    <section className="rounded-lg border bg-card p-4" aria-labelledby="h-vocali">
      <h2 id="h-vocali" className="mb-1 font-semibold">Messaggi vocali</h2>
      <p className="mb-3 text-sm text-muted-foreground">Registra un appunto a voce (fino a 5 minuti): resta nel progetto, si ascolta da qualsiasi dispositivo e puoi scriverne un riassunto. Per un vocale su una foto, apri la foto.</p>
      <NoteVocali progetto={attivo.id} vocali={so.vocali} onVocali={(v) => setSo({ vocali: v })} />
    </section>
  </main>;
}

/** Nessun progetto aperto (es. progetto creato su un altro dispositivo, app riaperta): si sceglie qui, senza passare da Progetti. */
function ScegliProgetto() {
  const accesso = useAccesso(), visitatore = !!accesso.profilo?.visitatore;
  const [lista, setLista] = useState<{ id: string; codice: string; nome: string; comune: string; data_modifica: string; condiviso?: string }[] | null>(null), [errore, setErrore] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { if (visitatore) return; Promise.all([elencaProgetti({ data: { pagina: 0 } }), progettiCondivisi()]).then(([r, c]) => { const miei = new Set(r.righe.map((x) => x.id)); setLista([...r.righe, ...c.filter((x) => !miei.has(x.id)).map((x) => ({ ...x, condiviso: x.proprietario_nome || x.proprietario_email }))]); }).catch((e: unknown) => setErrore(e instanceof Error ? e.message : "Progetti non letti.")); }, [visitatore]);
  async function apri(id: string) {
    setBusy(true); setErrore("");
    try { await salvaAttivo(); const p = await leggiProgetto({ data: { id } }); caricaSnapshot(p.dati, p.nome); impostaAttivo({ id: p.id, codice: p.codice, nome: p.nome, proprietario: await utenteId(), salvato: JSON.stringify(snapshot()) }); } // chi lavora (proprietario o collega) salva
    catch (e) { setErrore(e instanceof Error ? e.message : "Progetto non aperto."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl px-4 py-8"><PageTitle titolo="Sopralluogo" />
    {visitatore ? <p className="mt-4 text-muted-foreground">I visitatori non salvano progetti nel cloud: il sopralluogo si fa con il proprio account.</p> : <>
      <p className="mt-4 text-muted-foreground">Scegli il progetto a cui collegare il sopralluogo: foto, note e vocali si salvano in quel progetto.</p>
      {errore && <p role="alert" className="mt-3 text-destructive">{errore}</p>}
      {lista === null && !errore ? <p className="mt-4 text-sm text-muted-foreground">Carico i progetti…</p> : lista && !lista.length ? <p className="mt-4">Non hai ancora progetti: <Link to="/progetti" className="text-primary underline">creane uno in Progetti</Link>.</p> :
        <ul className="mt-4 divide-y rounded-lg border">{(lista ?? []).map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <span><b>{p.codice ? `${p.codice} · ` : ""}{p.nome}</b><span className="block text-xs text-muted-foreground">{p.condiviso ? `Condiviso da ${p.condiviso} · ` : ""}{p.comune || "Comune non indicato"} · modificato il {new Date(p.data_modifica).toLocaleDateString("it-IT")}</span></span>
          <Button disabled={busy} onClick={() => void apri(p.id)}><FolderOpen />Collega il sopralluogo</Button></li>)}</ul>}
      <p className="mt-3 text-sm"><Link to="/progetti" className="text-primary underline">Tutti i progetti</Link></p>
    </>}
  </main>;
}
