/**
 * Schemi disegnati per l'app (non riproduzioni della norma) per calate e impianto di terra.
 */
import { l1Norma } from "@/calcoli/terra/proponiTerra";

const t = { fontSize: 11, fill: "currentColor" } as const;

function Riquadro({ titolo, rif, children }: { titolo: string; rif: string; children: React.ReactNode }) {
  return <figure className="rounded-lg border-[0.8px] border-bordo-scheda bg-background p-3">
    <figcaption className="mb-2 text-sm font-semibold">{titolo}</figcaption>
    {children}
    <p className="mt-2 text-xs text-muted-foreground">Schema semplificato, non in scala · {rif}</p>
  </figure>;
}

/** Ripartizione della corrente tra le calate e significato di c, h e l nella distanza di separazione. */
export function SchemaKc({ n, c, h, kc }: { n: number; c: number; h: number; kc: number }) {
  const calate = Math.min(6, Math.max(2, n));
  const xs = Array.from({ length: calate }, (_, i) => 70 + (i * 300) / (calate - 1));
  return <Riquadro titolo="Distanza di separazione e ripartizione della corrente (kc)" rif="CEI EN IEC 62305-3:2024, 6.3, Tab. 13 e Allegato B (Fig. B.2–B.3)">
    <svg viewBox="0 0 520 230" className="h-auto w-full text-foreground" role="img" aria-label="Schema delle calate con corrente di fulmine ripartita">
      <line x1="20" y1="200" x2="420" y2="200" stroke="currentColor" />
      <rect x="70" y="60" width="300" height="140" className="fill-muted" />
      <line x1="70" y1="60" x2="370" y2="60" stroke="currentColor" strokeWidth="3" />
      {xs.map((x, i) => <line key={i} x1={x} y1="60" x2={x} y2="200" stroke="currentColor" strokeWidth="2.5" />)}
      <line x1="60" y1="205" x2="380" y2="205" className="stroke-primary" strokeWidth="3" />
      <text x="300" y="222" style={t}>anello di terra / fondazione</text>
      {/* fulmine */}
      <path d="M 200 5 L 190 30 L 205 30 L 192 58" className="stroke-primary" strokeWidth="3" fill="none" />
      <text x="212" y="22" style={t}>I</text>
      {/* frecce corrente */}
      {xs.map((x, i) => <text key={`a${i}`} x={x + 4} y="130" style={{ ...t, fontSize: 10 }} className="fill-primary">↓ I/{calate}</text>)}
      {/* quote c e h */}
      <line x1={xs[0]} y1="48" x2={xs[1]} y2="48" stroke="currentColor" markerEnd="url(#fr)" markerStart="url(#fr)" />
      <text x={(xs[0]! + xs[1]!) / 2 - 18} y="44" style={t}>c = {c.toLocaleString("it-IT", { maximumFractionDigits: 1 })} m</text>
      <line x1="388" y1="60" x2="388" y2="200" stroke="currentColor" markerEnd="url(#fr)" markerStart="url(#fr)" />
      <text x="394" y="134" style={t}>h = {h.toLocaleString("it-IT", { maximumFractionDigits: 1 })} m</text>
      {/* parte metallica e distanza */}
      <rect x="250" y="95" width="70" height="12" className="fill-accent/60" />
      <line x1={xs[xs.length - 1]} y1="101" x2="320" y2="101" stroke="currentColor" strokeDasharray="3 2" />
      <text x="248" y="90" style={{ ...t, fontSize: 10 }}>impianto metallico</text>
      <text x="324" y="116" style={{ ...t, fontSize: 10 }}>d ≥ s</text>
      <defs><marker id="fr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
      <text x="430" y="70" style={t}>n = {n}</text>
      <text x="430" y="88" style={t}>kc = {kc.toLocaleString("it-IT", { maximumFractionDigits: 3 })}</text>
      <text x="430" y="112" style={{ ...t, fontSize: 10 }}>s = ki · kc / km · l</text>
      <text x="430" y="128" style={{ ...t, fontSize: 10 }}>l: dal punto al</text>
      <text x="430" y="142" style={{ ...t, fontSize: 10 }}>collegamento</text>
      <text x="430" y="156" style={{ ...t, fontSize: 10 }}>equipotenziale</text>
    </svg>
  </Riquadro>;
}

/** Grafico della lunghezza minima l1 del dispersore in funzione della resistività (curve ricavate dalla Fig. 5). */
export function GraficoL1({ rho, lpl }: { rho: number | null; lpl: "I" | "II" | "III" | "IV" }) {
  const X = (r: number) => 50 + (r / 3000) * 420, Y = (l: number) => 190 - (l / 90) * 170;
  const curva = (c: "I" | "II" | "III") => Array.from({ length: 31 }, (_, i) => i * 100).map((r) => `${X(r)},${Y(l1Norma(c, r))}`).join(" ");
  const punto = rho != null && Number.isFinite(rho) && rho >= 0 ? { x: X(Math.min(rho, 3000)), y: Y(l1Norma(lpl, rho)), l: l1Norma(lpl, rho) } : null;
  return <Riquadro titolo="Lunghezza minima l1 del dispersore" rif="CEI EN IEC 62305-3:2024, 5.4.2 e Fig. 5">
    <svg viewBox="0 0 520 225" className="h-auto w-full text-foreground" role="img" aria-label="Grafico di l1 in funzione della resistività per le classi di LPS">
      {[0, 20, 40, 60, 80].map((l) => <g key={l}><line x1="50" y1={Y(l)} x2="470" y2={Y(l)} className="stroke-muted-foreground/30" /><text x="22" y={Y(l) + 4} style={{ ...t, fontSize: 10 }}>{l}</text></g>)}
      {[0, 500, 1000, 1500, 2000, 2500, 3000].map((r) => <text key={r} x={X(r) - 12} y="206" style={{ ...t, fontSize: 10 }}>{r}</text>)}
      <text x="230" y="222" style={t}>ρ (Ω·m)</text>
      <text x="6" y="16" style={t}>l1 (m)</text>
      <polyline points={curva("I")} fill="none" className="stroke-primary" strokeWidth={lpl === "I" ? 3 : 1.5} />
      <polyline points={curva("II")} fill="none" className="stroke-accent" strokeWidth={lpl === "II" ? 3 : 1.5} />
      <polyline points={curva("III")} fill="none" stroke="currentColor" strokeWidth={lpl === "III" || lpl === "IV" ? 3 : 1.5} />
      <text x="474" y={Y(80) + 4} style={t}>I</text><text x="474" y={Y(50) + 4} style={t}>II</text><text x="474" y={Y(5) + 4} style={t}>III–IV</text>
      {punto && <g><circle cx={punto.x} cy={punto.y} r="5" className="fill-primary" /><text x={punto.x + 8} y={punto.y - 8} style={t}>l1 = {punto.l.toLocaleString("it-IT", { maximumFractionDigits: 1 })} m</text></g>}
    </svg>
    <p className="mt-1 text-xs text-muted-foreground">Tipo A: picchetti verticali almeno 0,5·l1, orizzontali almeno l1. Tipo B: raggio equivalente re ≥ l1, altrimenti dispersori aggiuntivi lr = l1 − re (orizzontali) o lv = (l1 − re)/2 (verticali).</p>
  </Riquadro>;
}
