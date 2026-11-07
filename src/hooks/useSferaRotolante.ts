import { useCallback, useEffect, useRef, useState } from "react";
import type { InputSfera, RisultatoSfera, RiepilogoLivello, Asta, Corpo } from "@/calcoli/captazione/sferaRotolante";
import type { RichiestaSfera } from "@/calcoli/captazione/sferaRotolante.worker";
import type { ParametriMaglia, RisultatoMaglia, RisultatoCombinato } from "@/calcoli/captazione/verificaMaglia";
import type { ParametriProposta, PropostaCaptazione } from "@/calcoli/captazione/proponiCaptazione";

type Inviluppo = { x0: number; y0: number; passo: number; nx: number; ny: number; z: number[][] };

// distribuisce Omit sui membri dell'unione
type SenzaId<T> = T extends unknown ? Omit<T, "id"> : never;

/** Hook per usare il motore della sfera rotolante nel Web Worker. */
export function useSferaRotolante() {
  const worker = useRef<Worker | null>(null);
  const attese = useRef(new Map<number, { ok: (v: unknown) => void; ko: (e: Error) => void }>());
  const contatore = useRef(0);
  const [inCalcolo, setInCalcolo] = useState(false);

  useEffect(() => {
    const w = new Worker(new URL("../calcoli/captazione/sferaRotolante.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (ev) => {
      const { id, ok, dati, errore } = ev.data;
      const p = attese.current.get(id);
      if (!p) return;
      attese.current.delete(id);
      if (attese.current.size === 0) setInCalcolo(false);
      if (ok) p.ok(dati);
      else p.ko(new Error(errore));
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  const invia = useCallback(<T,>(msg: SenzaId<RichiestaSfera>): Promise<T> => {
    const id = ++contatore.current;
    setInCalcolo(true);
    return new Promise<T>((ok, ko) => {
      attese.current.set(id, { ok: ok as (v: unknown) => void, ko });
      worker.current?.postMessage({ ...msg, id });
    });
  }, []);

  return {
    inCalcolo,
    /** sfera rotolante + (se 'maglia' è indicato) metodo della maglia e verifica combinata */
    calcola: (input: InputSfera, passoInviluppo?: number, maglia?: ParametriMaglia | null) =>
      invia<{ risultato: RisultatoSfera; inviluppo?: Inviluppo; maglia: RisultatoMaglia | null; combinata: RisultatoCombinato }>(
        { tipo: "calcola", input, passoInviluppo, maglia },
      ),
    confronta: (base: Omit<InputSfera, "raggio">, raggi: Record<string, number | null>) =>
      invia<{ riepilogo: RiepilogoLivello[]; risultati: Record<string, RisultatoSfera> }>({ tipo: "confronta", base, raggi }),
    suggerisci: (input: InputSfera, altezzaAsta: number, asteMax?: number) =>
      invia<{ asteAggiunte: Asta[]; risultato: RisultatoSfera; avvisi: string[] }>({ tipo: "suggerisci", input, altezzaAsta, asteMax }),
    /** proposta automatica di captazione (maglia, calate, aste, supporti, connettori) */
    proponi: (corpi: Corpo[], parametri: ParametriProposta) =>
      invia<PropostaCaptazione>({ tipo: "proponi", corpi, parametri }),
  };
}
