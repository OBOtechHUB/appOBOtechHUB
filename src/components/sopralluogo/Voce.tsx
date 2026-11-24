/**
 * Note a voce del sopralluogo: pulsante "Detta" che scrive nel campo quello che si dice, e messaggi vocali
 * registrati (generali o di una foto) con il loro testo, salvati come le foto (anche senza rete).
 */
import { useEffect, useState } from "react";
import { Mic, MicOff, Square, AudioLines, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mmss, useDettatura, useRegistratore, DURATA_MASSIMA } from "@/lib/voce";
import { percorsoFoto, salvaFoto, scaricaFoto, erroreCaricamento } from "@/lib/fotoSopralluogo";
import type { Sopralluogo } from "@/lib/statoProgetto";

type Vocale = Sopralluogo["vocali"][number];

/** Pulsante di dettatura: aggiunge le frasi al testo attuale (mai sostituisce). */
export function PulsanteDetta({ valore, onValore, etichetta = "Detta", massimo = 5000 }: { valore: string; onValore: (v: string) => void; etichetta?: string; massimo?: number }) {
  const d = useDettatura((frase) => onValore(`${valore}${valore && !/\s$/.test(valore) ? " " : ""}${frase}.`.slice(0, massimo)));
  if (!d.disponibile) return null;
  return <div className="flex flex-wrap items-center gap-2">
    <Button type="button" size="sm" variant={d.attiva ? "default" : "outline"} aria-pressed={d.attiva} onClick={() => (d.attiva ? d.ferma() : d.avvia())}>
      {d.attiva ? <MicOff /> : <Mic />}{d.attiva ? "Ferma dettatura" : etichetta}
    </Button>
    {d.attiva && <span className="flex min-w-0 items-center gap-1 text-sm text-primary" role="status"><span className="size-2 shrink-0 animate-pulse rounded-full bg-red-600" aria-hidden="true" />{d.parziale || "Ti ascolto…"}</span>}
    {d.errore && <span className="text-sm text-destructive">{d.errore}</span>}
  </div>;
}

/** Elenco e registrazione dei messaggi vocali di una foto (o generali con `foto` = ""). */
export function NoteVocali({ progetto, foto = "", vocali, onVocali, compatto = false }: {
  progetto: string; foto?: string; vocali: Vocale[]; onVocali: (v: Vocale[]) => void; compatto?: boolean;
}) {
  const [audio, setAudio] = useState<Record<string, string>>({}), [msg, setMsg] = useState("");
  const miei = vocali.filter((v) => v.foto === foto);
  const reg = useRegistratore(async (blob, durata, estensione) => {
    const percorso = await percorsoFoto(progetto, estensione);
    if (!percorso) { setMsg("Accedi per salvare i messaggi vocali."); return; }
    const esito = await salvaFoto(percorso, blob);
    setAudio((a) => ({ ...a, [percorso]: URL.createObjectURL(blob) }));
    const v: Vocale = { id: percorso.split("/").pop()!, percorso, data: new Date().toISOString(), durata, foto, testo: "" };
    onVocali([...vocali, v].slice(-100));
    setMsg(esito === "in-coda" ? (erroreCaricamento() || "Senza rete: il messaggio resta sul telefono e si carica da solo quando torna la connessione.") : "");
  });
  useEffect(() => {
    let vivo = true;
    void (async () => { for (const v of miei) if (!audio[v.percorso]) { const b = await scaricaFoto(v.percorso); if (b && vivo) setAudio((a) => ({ ...a, [v.percorso]: URL.createObjectURL(b) })); } })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miei.length]);
  const setTesto = (id: string, testo: string) => onVocali(vocali.map((v) => (v.id === id ? { ...v, testo } : v)));
  // toglie il messaggio dal sopralluogo (il file audio resta nell'archivio, che non cancella mai nulla)
  const elimina = (v: Vocale) => { if (window.confirm(`Eliminare il messaggio vocale del ${v.data ? new Date(v.data).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : ""}${v.testo ? ` («${v.testo.slice(0, 60)}»)` : ""}?`)) onVocali(vocali.filter((x) => x.id !== v.id)); };
  return <div className="space-y-2">
    {reg.disponibile && <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size={compatto ? "sm" : "default"} variant={reg.registra ? "destructive" : "outline"} className={compatto ? "" : "h-12"} onClick={() => (reg.registra ? reg.ferma() : void reg.avvia())}>
        {reg.registra ? <Square /> : <AudioLines />}{reg.registra ? `Ferma e salva (${mmss(reg.secondi)})` : "Registra messaggio vocale"}
      </Button>
      {reg.registra && <span className="flex items-center gap-1 text-sm" role="status"><span className="size-2 animate-pulse rounded-full bg-red-600" aria-hidden="true" />Registrazione… massimo {mmss(DURATA_MASSIMA)}</span>}
    </div>}
    {(reg.errore || msg) && <p className="text-sm text-muted-foreground" role="status">{reg.errore || msg}</p>}
    {miei.length > 0 && <ul className="space-y-2">{miei.map((v) => <li key={v.id} className="rounded-md border bg-background p-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <AudioLines className="size-4 text-primary" aria-hidden="true" />
        <span>{v.data ? new Date(v.data).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : ""} · {mmss(v.durata)}</span>
        <Button type="button" size="sm" variant="ghost" className="ml-auto h-8 text-destructive" onClick={() => elimina(v)} aria-label="Elimina il messaggio vocale"><Trash2 />Elimina</Button>
      </div>
      {audio[v.percorso] ? <audio controls preload="metadata" src={audio[v.percorso]} className="mt-1 h-10 w-full" aria-label="Ascolta il messaggio vocale" /> : <p className="mt-1 text-xs text-muted-foreground">Audio non disponibile su questo dispositivo.</p>}
      <textarea className="mt-1 h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-base" value={v.testo} maxLength={2000} placeholder="Riassunto del messaggio (scrivi o detta)" aria-label="Testo del messaggio vocale" onChange={(e) => setTesto(v.id, e.target.value)} />
      <PulsanteDetta valore={v.testo} onValore={(t) => setTesto(v.id, t)} massimo={2000} />
    </li>)}</ul>}
  </div>;
}
