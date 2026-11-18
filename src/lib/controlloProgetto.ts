/**
 * Raccoglie dal progetto i fatti per il controllo "progetto completo" (calcoli/progetto/controllo.ts).
 */
import { useMemo } from "react";
import distanzaCalate from "@/dati/calate/distanzaCalate.json";
import { useComputo, useDatiEdificio } from "@/lib/progettoStore";
import { useEsteso, type StatoEsteso } from "@/lib/statoProgetto";
import { leggiStato, strutturaRischio } from "@/lib/statoRischio";
import { calcolaZone, protezioneMinimaZone } from "@/calcoli/rischio/rischioR1";
import { KI, KM, kcSemplificato, perimetro, verificaPunti } from "@/calcoli/calate/separazione";
import { controllaProgetto, type FattiProgetto, type Lpl, type VoceControllo } from "@/calcoli/progetto/controllo";

type Dati = ReturnType<typeof useDatiEdificio>;
type Computo = ReturnType<typeof useComputo>;

export function fattiProgetto(d: Dati, c: Computo, s: StatoEsteso): FattiProgetto {
  const lpl = (d.lplProgetto ?? null) as Lpl | null;
  // rischio
  let lplMinimo: FattiProgetto["rischio"]["lplMinimo"] = null, conforme: boolean | null = null;
  if (s.datiRischio) {
    try {
      const stato = leggiStato(s.datiRischio), st = strutturaRischio(d, stato);
      const min = protezioneMinimaZone(st, stato.zone);
      lplMinimo = min ? (min.protezione.lps === "nessuno" ? "nessuno" : min.protezione.lps) : null;
      if (lpl) { const e = calcolaZone(st, stato.zone, { lps: lpl, spd: lpl }); conforme = e.conforme && e.frequenzaConforme; }
    } catch { /* dati del rischio non leggibili: resta "valutato" senza esito */ }
  }
  // captazione e calate
  const capt = s.conduttori.filter((x) => x.tipo === "captazione").length;
  const calate = s.conduttori.filter((x) => x.tipo === "calata").length;
  const per = s.modello.corpi.reduce((t, b) => t + perimetro(b.impronta), 0) || (d.L > 0 && d.W > 0 ? 2 * (d.L + d.W) : 0);
  const livello = lpl ?? s.lpl;
  // separazione
  const ki = s.separazione.ki ?? KI[livello], kc = kcSemplificato(Math.max(1, calate || c.risultati.calate?.numero || 1));
  const km = { ...KM, ...(s.separazione.kmSolido ? { solido: s.separazione.kmSolido } : {}) };
  const esiti = verificaPunti(s.separazione.punti, ki, kc, km);
  const peggiore = esiti.filter((x) => !x.conforme).sort((a, b) => a.margine - b.margine)[0];
  // terra
  const t = s.terra;
  const elementiTerra = s.picchetti.length + s.conduttori.filter((x) => x.tipo === "terra").length + (t?.distinta.length ? 1 : 0);
  const area = s.modello.corpi.reduce((a, b) => a + Math.abs(b.impronta.reduce((acc, p, i) => { const q = b.impronta[(i + 1) % b.impronta.length]!; return acc + p[0] * q[1] - q[0] * p[1]; }, 0) / 2), 0) || d.L * d.W;
  const re = t && t.tipo !== "A" ? Math.sqrt((area + (t.tipo === "B" ? per * t.distanzaAnello : 0)) / Math.PI) : null;
  // SPD
  const linee = s.datiRischio ? leggiStato(s.datiRischio).linee.filter((l) => l.connessione !== "nessuna").length : 0;
  return {
    edificio: { L: d.L, W: d.W, H: d.H, comune: d.comune, lplProgetto: lpl },
    rischio: { valutato: !!s.datiRischio || !!c.risultati.rischio, lplMinimo, conformeConProgetto: conforme },
    captazione: { conduttori: capt, aste: s.aste.length, areaEsposta: c.risultati.captazione?.verifica ? c.risultati.captazione.verifica.areaEsposta : null },
    calate: { numero: calate || c.risultati.calate?.numero || 0, perimetro: per, distanzaTipica: distanzaCalate[livello]?.distanzaTipica ?? null },
    separazione: { punti: esiti.length, nonConformi: esiti.filter((x) => !x.conforme).length, peggiore: peggiore ? { descrizione: peggiore.descrizione, d: peggiore.d, s: peggiore.s } : null },
    terra: { tipo: t?.tipo ?? (s.picchetti.length ? "A" : null), elementi: elementiTerra, l1: t?.l1 ?? null, lunghezzaMinPicchetto: s.picchetti.length ? Math.min(...s.picchetti.map((p) => p.lunghezza)) : null, raggioEquivalente: re },
    spd: { linee, dispositivi: c.risultati.spd?.dispositivi.reduce((a, x) => a + x.quantita, 0) ?? 0 },
  };
}

export function useControlloProgetto(): VoceControllo[] {
  const d = useDatiEdificio(), c = useComputo(), s = useEsteso();
  return useMemo(() => controllaProgetto(fattiProgetto(d, c, s)), [d, c, s]);
}
