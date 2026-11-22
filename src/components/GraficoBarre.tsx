/**
 * Grafico a barre animato (Bklit UI, src/components/charts) con le etichette in italiano:
 * barre verticali per i periodi (giorni, settimane, mesi) e orizzontali per le classifiche.
 */
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";

export interface VoceGrafico { etichetta: string; valore: number; titolo?: string }

const fmt = (v: number, dec: number) => v.toLocaleString("it-IT", { maximumFractionDigits: dec });

export function GraficoBarre({
  voci, orizzontale = false, unita = "", decimali = 1, colore = "#F39B00", nome = "Valore", altezza, valori = true, vuoto = "Nessun dato nel periodo.",
}: {
  voci: VoceGrafico[]; orizzontale?: boolean; unita?: string; decimali?: number; colore?: string; nome?: string;
  /** rapporto larghezza/altezza CSS, es. "3 / 1" */ altezza?: string; valori?: boolean; vuoto?: string;
}) {
  if (!voci.length) return <p className="text-sm text-muted-foreground">{vuoto}</p>;
  // etichette uniche: il grafico usa l'etichetta come categoria
  const viste = new Map<string, number>();
  const dati = voci.map((v) => {
    const k = viste.get(v.etichetta) ?? 0; viste.set(v.etichetta, k + 1);
    return { etichetta: k ? `${v.etichetta} (${k + 1})` : v.etichetta, valore: v.valore, titolo: v.titolo ?? v.etichetta };
  });
  const rapporto = altezza ?? (orizzontale ? `3 / ${Math.max(0.8, Math.min(3, dati.length * 0.22))}` : "2.6 / 1");
  // quante etichette stanno sotto le barre secondo la larghezza del riquadro
  const lungh = Math.max(...dati.map((d) => d.etichetta.length)) * 6.5 + 12;
  const quante = (w: number) => Math.max(2, Math.min(dati.length, 31, Math.floor(w / lungh)));
  const etichette = { base: quante(290), sm: quante(560), md: quante(700), lg: quante(440), xl: quante(520) };
  const sinistra = orizzontale ? Math.min(170, 14 + Math.max(...dati.map((d) => d.etichetta.length)) * 6.5) : 36;
  return (
    <div className="w-full" role="img" aria-label={`${nome}: ${dati.map((d) => `${d.titolo} ${fmt(d.valore, decimali)}${unita}`).join(", ")}`}>
      <BarChart data={dati} xDataKey="etichetta" orientation={orizzontale ? "horizontal" : "vertical"} aspectRatio={rapporto}
        margin={orizzontale ? { top: 4, right: 48, bottom: 8, left: sinistra } : { top: 22, right: 8, bottom: 28, left: sinistra }} barGap={dati.length > 30 ? 0.15 : 0.3}>
        <Grid horizontal={!orizzontale} vertical={orizzontale} strokeOpacity={0.35} />
        <Bar dataKey="valore" fill={colore} lineCap="round" showValue={valori && dati.length <= 31} valueLabelFormatter={(v) => `${fmt(v, decimali)}${unita}`} />
        {orizzontale ? <BarYAxis /> : <BarXAxis maxLabels={etichette} />}
        <ChartTooltip rows={(p) => [{ color: colore, label: String((p as { titolo?: string }).titolo ?? p["etichetta"]), value: `${fmt(Number(p["valore"]), decimali)}${unita}` }]} />
      </BarChart>
    </div>
  );
}
