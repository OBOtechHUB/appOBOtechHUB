/** Sezione quotata del supporto in SVG (millimetri, y verso l'alto nel modello, ribaltata nello schermo). */
import type { Elemento, Pt, Sezione } from "@/calcoli/staffaggi/disegno";

const COLORI: Record<Elemento["ruolo"], string> = {
  struttura: "var(--sz-struttura)", profilato: "#d97706", mensola: "#2563eb", passerella: "#16a34a", cavi: "#16a34a",
  quote: "var(--sz-quote)", testi: "var(--sz-testo)", asse: "#9ca3af",
};

export function VistaSezione({ sezione, className = "" }: { sezione: Sezione; className?: string }) {
  const [x0, y0] = sezione.min, [x1, y1] = sezione.max;
  const w = x1 - x0, h = y1 - y0;
  const P = (p: Pt) => `${p[0]},${-p[1]}`;
  const sw = Math.max(w, h) / 450; // spessore linee proporzionato
  return (
    <svg viewBox={`${x0} ${-y1} ${w} ${h}`} className={`h-auto max-h-[460px] w-full rounded border bg-white [--sz-quote:#475569] [--sz-struttura:#334155] [--sz-testo:#0f172a] dark:bg-slate-950 dark:[--sz-quote:#94a3b8] dark:[--sz-struttura:#cbd5e1] dark:[--sz-testo:#e2e8f0] ${className}`} role="img" aria-label="Sezione quotata del supporto">
      <defs>
        <pattern id="sz-tratteggio" width={sw * 14} height={sw * 14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={sw * 14} stroke="currentColor" strokeWidth={sw * 0.8} />
        </pattern>
      </defs>
      {sezione.elementi.map((e, i) => {
        const c = COLORI[e.ruolo];
        if (e.t === "poli" && e.p) return <polyline key={i} points={e.p.map(P).join(" ")} fill="none" stroke={c} strokeWidth={sw * 1.6} strokeLinejoin="round" />;
        if (e.t === "rett" && e.a && e.b) {
          const xa = Math.min(e.a[0], e.b[0]), ya = Math.max(e.a[1], e.b[1]);
          return <rect key={i} x={xa} y={-ya} width={Math.abs(e.b[0] - e.a[0])} height={Math.abs(e.b[1] - e.a[1])} fill={e.ruolo === "profilato" ? "#fbbf2433" : e.ruolo === "mensola" ? "#3b82f622" : "none"} stroke={c} strokeWidth={sw * 1.4} />;
        }
        if (e.t === "tratteggio" && e.a && e.b) {
          const xa = Math.min(e.a[0], e.b[0]), ya = Math.max(e.a[1], e.b[1]);
          return <rect key={i} x={xa} y={-ya} width={Math.abs(e.b[0] - e.a[0])} height={Math.abs(e.b[1] - e.a[1])} fill="url(#sz-tratteggio)" style={{ color: c }} opacity={e.ruolo === "cavi" ? 0.9 : 0.6} />;
        }
        if (e.t === "testo" && e.a) return <text key={i} x={e.a[0]} y={-e.a[1]} fontSize={e.h ?? 40} fill={c} textAnchor={e.allinea === "centro" ? "middle" : e.allinea === "destra" ? "end" : "start"} dominantBaseline="middle" fontFamily="Arial, sans-serif">{e.testo}</text>;
        if (e.t === "quota" && e.a && e.b) return <Quota key={i} a={e.a} b={e.b} offset={e.offset ?? 0} testo={e.testo ?? ""} sw={sw} c={c} />;
        return null;
      })}
    </svg>
  );
}

function Quota({ a, b, offset, testo, sw, c }: { a: Pt; b: Pt; offset: number; testo: string; sw: number; c: string }) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L; // normale
  const A: Pt = [a[0] + nx * offset, a[1] + ny * offset], B: Pt = [b[0] + nx * offset, b[1] + ny * offset];
  const t = 12 * sw;
  const tick = (p: Pt) => <line x1={p[0] - (dx / L + nx) * t} y1={-(p[1] - (dy / L + ny) * t)} x2={p[0] + (dx / L + nx) * t} y2={-(p[1] + (dy / L + ny) * t)} stroke={c} strokeWidth={sw * 1.2} />;
  const m: Pt = [(A[0] + B[0]) / 2 + nx * 22 * sw, (A[1] + B[1]) / 2 + ny * 22 * sw];
  const ang = (-Math.atan2(dy, dx) * 180) / Math.PI;
  const angolo = ang > 90 || ang < -90 ? ang + 180 : ang;
  return (
    <g>
      {offset !== 0 && <><line x1={a[0]} y1={-a[1]} x2={A[0]} y2={-A[1]} stroke={c} strokeWidth={sw * 0.6} /><line x1={b[0]} y1={-b[1]} x2={B[0]} y2={-B[1]} stroke={c} strokeWidth={sw * 0.6} /></>}
      <line x1={A[0]} y1={-A[1]} x2={B[0]} y2={-B[1]} stroke={c} strokeWidth={sw * 0.8} />
      {tick(A)}{tick(B)}
      <text x={m[0]} y={-m[1]} fontSize={34} fill={c} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${angolo} ${m[0]} ${-m[1]})`} fontFamily="Arial, sans-serif">{testo}</text>
    </g>
  );
}
