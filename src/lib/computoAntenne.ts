import { useMemo } from "react";
import type { RigaComputo } from "@/calcoli/materiali/tipi";
import { DATI_INIZIALI, type DatiAntenne } from "@/calcoli/antenne/antenne";
import { calcolaProgettoAntenne } from "@/calcoli/antenne/progettoAntenne";
import type { StatoEsteso } from "./statoProgetto";

/** Righe del computo dalla pagina Antenne: asta, isCon (numero di calate in parallelo automatico), collegamento al palo, supporti, cartello. */
export function righeAntenne(s: StatoEsteso, lplProgetto?: string | null): RigaComputo[] {
  if (!s.antenne || s.tipologia !== "antenne") return [];
  const d: DatiAntenne = { ...DATI_INIZIALI, ...s.antenne }; void lplProgetto;
  const P = calcolaProgettoAntenne(d);
  return P.materiali.map((m, i) => ({ id: `antenne-${i}-${m.codice || "x"}`, codice: m.codice, descrizione: m.descrizione, categoria: m.categoria, unita: m.unita, quantita: m.quantita, provenienza: "Antenne – calate isCon", materiale: "", sezione: "" }));
}
export function useRigheAntenne(s: StatoEsteso, lplProgetto?: string | null): RigaComputo[] {
  return useMemo(() => righeAntenne(s, lplProgetto), [s, lplProgetto]);
}
