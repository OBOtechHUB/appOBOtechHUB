import { useMemo } from "react";
import type { RigaComputo } from "@/calcoli/materiali/tipi";
import { verificaVentoProgetto } from "@/calcoli/vento/progetto";
import { tipoAsta } from "@/calcoli/relazione/testiProgetto";
import { infoArticoli, useCatalogoObo } from "./catalogoObo";
import { relazioneSchema, type StatoEsteso } from "./statoProgetto";

/** Righe del computo dalla verifica al vento (pagina Vento e zavorre): blocchi FangFix, protezioni e barre filettate. */
export function useRigheVento(s: StatoEsteso): RigaComputo[] {
  const { catalogo } = useCatalogoObo();
  const fissaggio = relazioneSchema.parse(s.relazione ?? {}).fissaggioAste;
  return useMemo(() => {
    if (!s.vento || !s.aste.length) return [];
    const art = catalogo ? infoArticoli(catalogo, s.aste.map((a) => a.codiceOBO)) : {};
    const ev = verificaVentoProgetto(s.aste, art, s.vento, (a) => tipoAsta(a.codiceOBO, art, fissaggio));
    return ev.computo.map((c) => ({ id: `vento-${c.codice}`, codice: c.codice, descrizione: c.descrizione, categoria: "accessori", unita: "pz", quantita: c.quantita, provenienza: "Verifica al vento – zavorre delle aste", materiale: "", sezione: "" }));
  }, [s.vento, s.aste, catalogo, fissaggio]);
}
