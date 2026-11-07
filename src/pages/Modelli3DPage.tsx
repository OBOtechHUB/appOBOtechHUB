import { lazy, Suspense, useState } from "react";
import { Download, Upload } from "lucide-react";
import { ClientOnly } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { scarica } from "@/lib/esportazioni";
import { esportaDxf3D, limiti, numeroTriangoli, type Mesh3D } from "@/calcoli/modelli3d/dxf3d";

const Anteprima = lazy(() => import("@/components/modelli3d/AnteprimaModello"));

interface Modello { file: string; codice: string | null; meshes: Mesh3D[] }

export function Modelli3DPage() {
  const [modelli, setModelli] = useState<Modello[]>([]);
  const [scelto, setScelto] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [finezza, setFinezza] = useState<"normale" | "fine">("normale");
  const [unita, setUnita] = useState<"mm" | "m">("mm");

  async function apri(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg("Caricamento di OpenCascade e lettura dei file…");
    try {
      const { leggiStep } = await import("@/lib/leggiStep");
      const nuovi: Modello[] = [];
      const errori: string[] = [];
      for (const f of Array.from(files)) {
        try { nuovi.push({ file: f.name, codice: /(\d{7})/.exec(f.name)?.[1] ?? null, meshes: await leggiStep(await f.arrayBuffer(), f.name, finezza) }); }
        catch (e) { errori.push(`${f.name}: ${e instanceof Error ? e.message : "errore"}`); }
      }
      setModelli((prima) => [...prima, ...nuovi]);
      if (nuovi.length) setScelto(modelli.length);
      setMsg(errori.length ? `Non letti: ${errori.join(" · ")}` : `${nuovi.length} modelli letti.`);
    } catch {
      setMsg("Impossibile caricare il lettore STEP. Ricarica la pagina e riprova.");
    } finally { setBusy(false); }
  }

  function dxf(m: Modello) {
    const testo = esportaDxf3D(m.meshes, unita === "m" ? 0.001 : 1, unita);
    scarica(new Blob([testo], { type: "application/dxf" }), m.file.replace(/\.(stp|step)$/i, "") + ".dxf");
  }
  function dxfTutti() { modelli.forEach((m, i) => setTimeout(() => dxf(m), i * 400)); }

  const m = modelli[scelto];
  const lim = m ? limiti(m.meshes) : null;
  const dim = lim ? lim.max.map((v, i) => v - lim.min[i]!) : null;

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Modelli 3D dei prodotti</h1>
      <p className="mt-2 max-w-3xl text-white/90">Apri i file STEP (.stp) dei prodotti OBO, guardali in 3D e scaricali in DXF 3D: in ZWCAD o AutoCAD si aprono e si salvano come DWG. La conversione avviene nel browser, i file non vengono inviati a nessun server.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button size="lg" asChild disabled={busy}><label className="cursor-pointer"><Upload strokeWidth={1.5} />{busy ? "Lettura in corso…" : "Apri file STEP"}<input type="file" accept=".stp,.step,.STP,.STEP" multiple className="sr-only" disabled={busy} onChange={(e) => { void apri(e.target.files); e.target.value = ""; }} /></label></Button>
        {modelli.length > 1 && <Button size="lg" variant="outline" onClick={dxfTutti}><Download strokeWidth={1.5} />Scarica tutti in DXF</Button>}
      </div>
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etichetta="Triangolazione"><select className={inputCls} value={finezza} onChange={(e) => setFinezza(e.target.value as "normale" | "fine")}><option value="normale">Normale (file leggeri)</option><option value="fine">Fine (curve più precise)</option></select></Campo>
        <Campo etichetta="Unità del DXF"><select className={inputCls} value={unita} onChange={(e) => setUnita(e.target.value as "mm" | "m")}><option value="mm">Millimetri (come lo STEP)</option><option value="m">Metri (come il progetto LPS)</option></select></Campo>
      </div>
      {msg && <p role="status" className="mt-4 border-l-4 border-primary px-3 text-sm">{msg}</p>}

      {!modelli.length && <div className="mt-6 rounded-lg border-[0.8px] border-dashed border-bordo-scheda p-8 text-center text-sm text-muted-foreground">
        <p>Nessun modello aperto. Scarica il file 3D dalla pagina del prodotto OBO (scheda <em>Downloads → 3D data downloads</em>, formato .stp) e aprilo qui.</p>
        <p className="mt-2">Esempio: asta isFang 4000 → <span className="font-mono">5402864_KSTP1.stp</span></p>
      </div>}

      {m && <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <ClientOnly fallback={<div className="h-[420px] rounded-lg bg-muted" />}><Suspense fallback={<div className="h-[420px] rounded-lg bg-muted" />}><Anteprima meshes={m.meshes} /></Suspense></ClientOnly>
        <div className="space-y-3 text-sm">
          <h2 className="break-words text-[1.3rem] font-medium">{m.file}</h2>
          {m.codice && <p>Codice articolo OBO: <span className="font-mono">{m.codice}</span></p>}
          <p>{m.meshes.length} parti · {m.meshes.reduce((t, x) => t + numeroTriangoli(x), 0).toLocaleString("it-IT")} triangoli</p>
          {dim && <p>Ingombro: {dim.map((v) => Math.round(v).toLocaleString("it-IT")).join(" × ")} mm</p>}
          <Button onClick={() => dxf(m)}><Download strokeWidth={1.5} />Scarica DXF 3D</Button>
          <p className="text-xs text-muted-foreground">In ZWCAD: apri il DXF, poi <em>Salva con nome → DWG</em>. Ogni parte è su un layer separato.</p>
        </div>
      </section>}

      {modelli.length > 1 && <ul className="mt-6 divide-y border-y">{modelli.map((x, i) => <li key={`${x.file}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
        <button type="button" className={`text-left hover:text-primary ${i === scelto ? "font-semibold text-primary" : ""}`} onClick={() => setScelto(i)}>{x.file}</button>
        <Button size="sm" variant="outline" onClick={() => dxf(x)}>DXF</Button>
      </li>)}</ul>}
    </main>
  </>;
}
