/**
 * All'apertura di un progetto salvato: se l'app è stata aggiornata dopo l'ultimo calcolo del progetto (specifiche di
 * calcolo più recenti, src/calcoli/progetto/specifiche.ts) chiede se ricalcolarlo con le nuove specifiche o lasciarlo
 * com'è. La scelta si salva nel progetto (`esteso.specifiche`, fuori dall'impronta delle revisioni) e non si richiede
 * più fino al prossimo aggiornamento dei calcoli. Il lavoro nuovo viene segnato da solo con le specifiche attuali.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { aggiornaEsteso, snapshot, snapshotSchema, snapshotVuoto, useAttivo, useEsteso } from "@/lib/statoProgetto";
import { SPECIFICA_ATTUALE, daChiedere, specificheDopo } from "@/calcoli/progetto/specifiche";
import { Button } from "@/components/ui/button";

let firmaVuota: string | null = null;
function vuoto(): boolean {
  try {
    firmaVuota ??= JSON.stringify(snapshotSchema.parse(snapshotVuoto()));
    const s = snapshot();
    return JSON.stringify(snapshotSchema.parse({ ...s, esteso: { ...s.esteso, specifiche: undefined } })) === firmaVuota;
  } catch { return false; }
}

export function AvvisoSpecifiche() {
  const { user } = useAuth();
  const attivo = useAttivo();
  const esteso = useEsteso();
  const navigate = useNavigate();
  const [chiuso, setChiuso] = useState<string | null>(null);
  /** lavoro già presente all'avvio senza indicazione delle specifiche: può essere precedente all'aggiornamento */
  const vecchio = useRef<boolean | null>(null);
  const sp = esteso.specifiche;

  useEffect(() => {
    if (!user) return;
    const eVuoto = vuoto();
    if (vecchio.current === null) vecchio.current = !sp && !eVuoto;
    if (!attivo && eVuoto) vecchio.current = false; // si riparte da vuoto: il lavoro che segue è nuovo
    // lavoro nuovo (partito da vuoto) o progetto vuoto appena creato: specifiche attuali, senza chiedere
    if (!sp && (eVuoto ? !!attivo : !attivo && !vecchio.current)) aggiornaEsteso({ specifiche: { calcolato: SPECIFICA_ATTUALE, rimandato: "" } });
  }, [user, attivo, sp, esteso]);

  useEffect(() => {
    if (!attivo) return;
    const tasto = (e: KeyboardEvent) => { if (e.key === "Escape") setChiuso(attivo.id); };
    document.addEventListener("keydown", tasto);
    return () => document.removeEventListener("keydown", tasto);
  }, [attivo]);

  if (!user || !attivo || attivo.proprietario !== user.id || chiuso === attivo.id) return null;
  if (!sp && vuoto()) return null;
  if (!daChiedere(sp, esteso.tipologia)) return null;
  const nuove = specificheDopo(sp?.calcolato, esteso.tipologia);
  const ricalcola = () => { aggiornaEsteso({ specifiche: { calcolato: SPECIFICA_ATTUALE, rimandato: "" } }); void navigate({ to: esteso.tipologia === "antenne" ? "/antenne" : "/dati-edificio" }); };
  const lascia = () => aggiornaEsteso({ specifiche: { calcolato: sp?.calcolato ?? "", rimandato: SPECIFICA_ATTUALE } });
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="avviso-specifiche-t" className="fixed inset-0 z-[2147482000] flex items-center justify-center bg-black/55 p-4">
      <div className="max-h-[90svh] w-full max-w-[520px] overflow-y-auto rounded-2xl border bg-card p-5 text-card-foreground shadow-2xl">
        <h2 id="avviso-specifiche-t" className="text-lg font-bold">L'app è stata aggiornata: ricalcolare «{attivo.nome || attivo.codice}»?</h2>
        <p className="mt-2 text-sm">Da quando questo progetto è stato calcolato sono cambiate queste specifiche:</p>
        <ul className="mt-2 grid gap-2 text-sm">
          {nuove.map((s) => <li key={s.id} className="rounded-lg border p-2"><strong>{s.titolo}</strong> <span className="text-muted-foreground">· {s.data}</span><br />{s.cosa}</li>)}
        </ul>
        <p className="mt-3 text-sm"><strong>Ricalcola</strong>: il progetto passa alle nuove specifiche. Ricontrolla poi il controllo del progetto, la distinta e la relazione, e rigenera i documenti.</p>
        <p className="mt-1 text-sm"><strong>Lascia com'è</strong>: i dati salvati, il computo e i documenti già emessi non cambiano. Le pagine di calcolo mostrano comunque i risultati con le regole di oggi: non rigenerare i documenti se vuoi tenere quelli vecchi.</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={lascia}>Lascia com'è</Button>
          <Button size="sm" onClick={ricalcola} autoFocus>Ricalcola con le nuove specifiche</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Non te lo chiedo più per questo progetto fino al prossimo aggiornamento dei calcoli.</p>
      </div>
    </div>
  );
}
