import { useState } from "react";
import { DatabaseBackup, ExternalLink, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/Campo";
import { db } from "@/lib/accesso";

/** Giorni dall'ultima copia (null = mai fatta). */
export function giorniDallaCopia(ultima: string | undefined, ora = Date.now()): number | null {
  if (!ultima) return null;
  const t = new Date(ultima).getTime();
  return isNaN(t) ? null : Math.floor((ora - t) / 864e5);
}

const conta = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** Admin → Copia di sicurezza: tutti i dati di OBO Hub in un file da salvare nella cartella SharePoint. */
export function CopiaSicurezza({ ultima, cartella, onFatto }: { ultima: string | undefined; cartella: string | undefined; onFatto: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [url, setUrl] = useState(cartella ?? "");
  const giorni = giorniDallaCopia(ultima);

  async function scarica() {
    setBusy(true); setMsg("");
    try {
      const { data, error } = await db().rpc("copia_sicurezza");
      if (error) throw new Error(error.message.includes("Could not find") ? "manca la funzione: esegui supabase/pro.sql nell'editor SQL di Supabase" : error.message);
      const d = data as Record<string, unknown>;
      const oggi = new Date().toLocaleDateString("sv-SE");
      const blob = new Blob([JSON.stringify(d, null, 1)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `copia-obo-hub-${oggi}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setMsg(`Copia scaricata (${(blob.size / 1048576).toFixed(1)} MB): ${conta(d["progetti"])} progetti LPS, ${conta(d["progetti_archivio"])} nell'archivio, ${conta(d["accessi_profili"])} utenti, ${conta(d["mappa_progetti"])} progetti della Mappa. Salvala nella cartella SharePoint.`);
      onFatto();
    } catch (e) { setMsg("Copia non riuscita: " + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); }
  }
  async function salvaCartella() {
    const { error } = await db().from("impostazioni_admin").upsert({ chiave: "cartella_copie", valore: url.trim() });
    setMsg(error ? "Cartella non salvata: " + error.message : "Cartella salvata."); if (!error) onFatto();
  }

  return <div className="max-w-3xl space-y-5">
    <div className={`rounded-lg border-l-4 p-4 ${giorni === null || giorni > 7 ? "border-[#b3261e] bg-[#fdecea] text-[#5c1410]" : "border-green-700 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"}`}>
      <p className="font-semibold">{giorni === null ? "Nessuna copia di sicurezza fatta finora." : giorni === 0 ? "Ultima copia: oggi." : `Ultima copia: ${giorni} ${giorni === 1 ? "giorno" : "giorni"} fa (${new Date(ultima!).toLocaleDateString("it-IT")}).`}</p>
      <p className="mt-1 text-sm">Consigliata almeno una volta alla settimana e prima di ogni modifica importante.</p>
    </div>
    <p className="text-sm text-muted-foreground">Il file contiene tutti i dati di OBO Hub: progetti salvati di Progettazione LPS (anche l'archivio dei cancellati), cataloghi personali, utenti e permessi, richieste di accesso, registri completi (accessi, errori, uso delle app), progetti e persone della Mappa carichi. <strong>Le password non ci sono.</strong> Contiene però dati di lavoro e nomi: salvalo solo nella cartella SharePoint OBO riservata, non inviarlo per email.</p>
    <Button size="lg" disabled={busy} onClick={() => void scarica()}><DatabaseBackup strokeWidth={1.5} />{busy ? "Preparo la copia…" : "Scarica copia di sicurezza"}</Button>
    {msg && <p role="status" className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">{msg}</p>}
    <div className="space-y-2 rounded-lg border-[0.8px] border-bordo-scheda p-4">
      <p className="text-sm font-semibold">Cartella SharePoint dove salvare le copie</p>
      <div className="flex flex-wrap gap-2">
        <input className={`${inputCls} min-w-0 flex-1`} type="url" placeholder="https://obo.sharepoint.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button variant="outline" onClick={() => void salvaCartella()}><Save strokeWidth={1.5} />Salva</Button>
        {cartella && <Button variant="outline" asChild><a href={cartella} target="_blank" rel="noopener noreferrer"><ExternalLink strokeWidth={1.5} />Apri cartella</a></Button>}
      </div>
    </div>
    <p className="text-xs text-muted-foreground">Per ripristinare dati da una copia non serve fare niente qui: chiedi a Claude indicando il file e cosa recuperare (per esempio un progetto cancellato per errore). Con il piano Pro di Supabase si aggiungono anche i backup automatici giornalieri del database.</p>
  </div>;
}
