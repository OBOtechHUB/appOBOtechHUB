import { useMemo } from "react";
import { useEsteso } from "@/lib/statoProgetto";
import { useComputo, useDatiEdificio } from "@/lib/progettoStore";
import { applicaModifiche, generaComputo } from "@/calcoli/materiali/computo";
import { completamento, passiAssistente, prossimoPasso } from "@/calcoli/assistente/passi";
import { INTERVALLI_TIPICI, prossimeScadenze, scaduta } from "@/calcoli/verifiche/verifiche";

/** Passi del progetto, completamento e prossimo passo, calcolati dai dati correnti (assistente e barra di avanzamento). */
export function useAvanzamentoProgetto() {
  const s = useEsteso(), d = useDatiEdificio(), c = useComputo();
  return useMemo(() => {
    const computo = generaComputo(c.risultati, c.configurazione, d.copertura);
    const righe = applicaModifiche(computo.righe, c.modifiche, c.catalogo, c.manuali);
    const scad = prossimeScadenze(s.verifiche, s.pianoVerifiche.intervalli ?? INTERVALLI_TIPICI[s.lpl], s.pianoVerifiche.critico);
    const oggi = new Date().toISOString().slice(0, 10);
    const passi = passiAssistente({
      edificio: { nome: d.nomeProgetto, comune: d.comune, L: d.L, W: d.W, H: d.H, lpl: d.lplProgetto || null, densita: d.densita },
      corpi: s.modello.corpi.length,
      aste: s.aste.length,
      conduttoriCaptazione: s.conduttori.filter((x) => x.tipo === "captazione").length,
      calate: s.conduttori.filter((x) => x.tipo === "calata").length,
      terraAccettata: s.terra !== null,
      conduttoriTerra: s.conduttori.filter((x) => x.tipo === "terra").length,
      picchetti: s.picchetti.length,
      componentiPosizionati: s.supporti.length + s.morsetti.length + s.compensatori.length,
      righeComputo: righe.length,
      mancantiComputo: computo.mancanti.length + righe.filter((r) => !r.codice).length,
      verifiche: s.verifiche.length,
      verificaScaduta: scaduta(scad.visiva, oggi) || scaduta(scad.completa, oggi),
    });
    return { passi, prossimo: prossimoPasso(passi), comp: completamento(passi), mancanti: passi.filter((p) => p.obbligatorio && p.stato !== "completo") };
  }, [s, d, c]);
}
