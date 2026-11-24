/**
 * Introduzione "cinematografica" della pagina iniziale: scorrendo, la telecamera scende dalla tempesta all'edificio,
 * la sfera rotolante scorre sul tetto, il fulmine colpisce l'asta, la corrente scende dalle calate e si disperde a
 * terra, poi si entra dalla finestra nel salotto protetto dagli SPD. Tutto disegnato dal codice (nessuna immagine
 * di terzi); con "riduci movimento" resta un'immagine ferma.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronsDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type P = [number, number];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const liscio = (t: number) => t * t * (3 - 2 * t);
const tra = (p: number, a: number, b: number) => liscio(clamp((p - a) / (b - a)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// telecamera: [progresso, centro x, centro y, metri visibili in altezza]
const CAMERA: [number, number, number, number][] = [[0, 0, 42, 64], [0.2, 0, 34, 58], [0.45, 0, 10, 34], [0.65, 0, 8.5, 30], [0.8, 2, 7, 24], [1, 6.5, 6, 4.2]];
function camera(p: number) {
  for (let i = 1; i < CAMERA.length; i++) {
    const a = CAMERA[i - 1]!, b = CAMERA[i]!;
    if (p <= b[0]) { const t = liscio((p - a[0]) / (b[0] - a[0])); return { x: lerp(a[1], b[1], t), y: lerp(a[2], b[2], t), h: lerp(a[3], b[3], t) }; }
  }
  const u = CAMERA[CAMERA.length - 1]!; return { x: u[1], y: u[2], h: u[3] };
}

const CAPITOLI: { da: number; a: number; titolo: string; testo: string }[] = [
  { da: 0, a: 0.2, titolo: "Arriva la tempesta", testo: "Un fulmine porta decine di migliaia di ampere in pochi microsecondi." },
  { da: 0.22, a: 0.44, titolo: "La sfera rotolante", testo: "Rotola sul tetto e mostra dove servono aste e conduttori di captazione." },
  { da: 0.46, a: 0.63, titolo: "Il punto di impatto", testo: "Il fulmine colpisce l'asta, non l'edificio." },
  { da: 0.65, a: 0.8, titolo: "A terra, in sicurezza", testo: "Le calate portano la corrente al dispersore, che la sparge nel terreno." },
  { da: 0.83, a: 1.01, titolo: "Dentro, tutto protetto", testo: "Gli SPD fermano le sovratensioni: persone e impianti al sicuro." },
];

// edificio (metri): tetto piano a 12 m da -15 a 15, aste da 2,5 m
const ASTE = [-12, 0, 12];
const PERCORSO: P[] = [[0, 14.5], [0, 12.05], [-15, 12.05], [-15, 0], [-15, -3]]; // asta centrale → tetto → calata → dispersore
function lunghezza(pp: P[]) { let l = 0; for (let i = 1; i < pp.length; i++) l += Math.hypot(pp[i]![0] - pp[i - 1]![0], pp[i]![1] - pp[i - 1]![1]); return l; }
function puntoA(pp: P[], d: number): P { for (let i = 1; i < pp.length; i++) { const a = pp[i - 1]!, b = pp[i]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= l) return [a[0] + (b[0] - a[0]) * d / l, a[1] + (b[1] - a[1]) * d / l]; d -= l; } return pp[pp.length - 1]!; }

function fulmine(da: P, a: P, rugosita: number, rnd: () => number): P[] {
  let pts: P[] = [da, a];
  for (let g = 0; g < 6; g++) {
    const n: P[] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) { const p = pts[i - 1]!, q = pts[i]!, l = Math.hypot(q[0] - p[0], q[1] - p[1]); n.push([(p[0] + q[0]) / 2 + (rnd() - 0.5) * l * rugosita, (p[1] + q[1]) / 2 + (rnd() - 0.5) * l * rugosita * 0.3], q); }
    pts = n;
  }
  return pts;
}
function casuale(seme: number) { let s = seme >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function CinemaFulmini() {
  const sezione = useRef<HTMLElement>(null), tela = useRef<HTMLCanvasElement>(null);
  const [p, setP] = useState(0);
  const fermo = typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || (navigator.webdriver && !/[?&]fx\b/.test(window.location.search)));

  useEffect(() => {
    const sez = sezione.current, cv = tela.current; if (!sez || !cv || !("ResizeObserver" in window) || !("IntersectionObserver" in window)) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let vivo = true, visibile = true, raf = 0, prog = fermo ? 0.66 : 0, colpo: { pts: P[]; rami: P[][]; t: number } | null = null, ultimoColpo = -1, flash = 0;
    const lampi: { pts: P[]; t: number }[] = [];
    const gocce = Array.from({ length: 260 }, (_, i) => ({ x: (i * 97.13) % 1, y: (i * 61.7) % 1, v: 0.6 + ((i * 13) % 10) / 20 }));
    const nuvole = Array.from({ length: 14 }, (_, i) => ({ x: -55 + i * 8.5, y: 30 + ((i * 7) % 5) * 4 + (i % 2) * 6, r: 9 + ((i * 5) % 7), v: 0.3 + (i % 4) * 0.12 }));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const misura = () => { const r = cv.getBoundingClientRect(); cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr)); };
    misura(); const ro = new ResizeObserver(misura); ro.observe(cv);
    const scorri = () => { const r = sez.getBoundingClientRect(), corsa = r.height - window.innerHeight; prog = fermo ? 0.66 : clamp(corsa > 0 ? -r.top / corsa : 0); setP(prog); };
    if (!fermo) { window.addEventListener("scroll", scorri, { passive: true }); scorri(); }
    const io = new IntersectionObserver(([v]) => { visibile = !!v?.isIntersecting; if (visibile && !raf) raf = requestAnimationFrame(disegna); }, { threshold: 0 });
    io.observe(sez);

    function disegna(ms: number) {
      raf = 0; if (!vivo || !cv || !ctx) return;
      const t = fermo ? 2 : ms / 1000, W = cv.width, H = cv.height, cam = camera(prog), k = H / cam.h;
      const X = (x: number) => W / 2 + (x - cam.x) * k, Y = (y: number) => H / 2 - (y - cam.y) * k;
      // cielo
      const cielo = ctx.createLinearGradient(0, 0, 0, H);
      cielo.addColorStop(0, "#0f1418"); cielo.addColorStop(0.6, "#25313a"); cielo.addColorStop(1, "#41525d");
      ctx.fillStyle = cielo; ctx.fillRect(0, 0, W, H);
      // lampi lontani nelle nuvole
      if (!fermo && Math.random() < 0.012 && prog < 0.8) lampi.push({ pts: fulmine([cam.x + (Math.random() - 0.5) * cam.h * 1.4, cam.y + cam.h * 0.45], [cam.x + (Math.random() - 0.5) * cam.h, cam.y + cam.h * (0.05 + Math.random() * 0.2)], 0.5, Math.random), t });
      for (let i = lampi.length - 1; i >= 0; i--) {
        const l = lampi[i]!, e = t - l.t; if (e > 0.35) { lampi.splice(i, 1); continue; }
        const a = (1 - e / 0.35) * (Math.sin(e * 90) > -0.3 ? 1 : 0.3);
        ctx.fillStyle = `rgba(160,180,220,${0.18 * a})`; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(220,230,255,${0.55 * a})`; ctx.lineWidth = 1.2 * dpr; ctx.beginPath(); l.pts.forEach((q, j) => (j ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])))); ctx.stroke();
      }
      // nuvole
      for (const n of nuvole) {
        const x = ((n.x + t * n.v + 60) % 120) - 60;
        const g = ctx.createRadialGradient(X(x), Y(n.y), 0, X(x), Y(n.y), n.r * k);
        g.addColorStop(0, "rgba(70,84,95,0.85)"); g.addColorStop(1, "rgba(70,84,95,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X(x), Y(n.y), n.r * k * 1.6, n.r * k * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      }
      // terreno e sottosuolo
      ctx.fillStyle = "#1d2327"; ctx.fillRect(0, Y(0), W, H);
      ctx.fillStyle = "#3a3129"; ctx.fillRect(0, Y(-0.6), W, H);
      // edificio
      ctx.fillStyle = "#56656f"; ctx.fillRect(X(-15), Y(12), 30 * k, 12 * k);
      ctx.fillStyle = "#4a5862"; ctx.fillRect(X(-15), Y(12.3), 30 * k, 0.3 * k);
      for (let fx = -13; fx < 14; fx += 4.5) for (let fy = 1.2; fy < 11; fy += 3.6) {
        const finestra = fx === 4 && fy === 4.8;
        ctx.fillStyle = finestra ? "#ffd27a" : "rgba(255,210,122," + (0.12 + ((fx * 7 + fy * 3) % 5) / 30) + ")";
        ctx.fillRect(X(fx), Y(fy + 2.6), 3 * k, 2.6 * k);
      }
      // sfera rotolante (R 30 m del livello II, disegnata in scala) che scorre sul tetto
      const sf = tra(prog, 0.22, 0.46), cxS = lerp(-30, 30, sf);
      if (sf > 0 && sf < 1) {
        const R = 30, cyS = 12 + 2.5 + Math.sqrt(Math.max(0, R * R - Math.min(...ASTE.map((a) => Math.abs(cxS - a))) ** 2));
        ctx.strokeStyle = `rgba(243,155,0,${0.8 * Math.sin(sf * Math.PI)})`; ctx.setLineDash([6 * dpr, 6 * dpr]); ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.arc(X(cxS), Y(cyS), R * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      // impianto: conduttori, aste, calate, dispersore
      ctx.strokeStyle = "#f39b00"; ctx.lineWidth = Math.max(1.2 * dpr, 0.08 * k);
      ctx.beginPath(); ctx.moveTo(X(-15), Y(12.05)); ctx.lineTo(X(15), Y(12.05)); ctx.moveTo(X(-15), Y(12.05)); ctx.lineTo(X(-15), Y(0)); ctx.moveTo(X(15), Y(12.05)); ctx.lineTo(X(15), Y(0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(-15), Y(0)); ctx.lineTo(X(-15), Y(-3)); ctx.moveTo(X(15), Y(0)); ctx.lineTo(X(15), Y(-3)); ctx.stroke();
      for (const a of ASTE) { ctx.lineWidth = Math.max(1.5 * dpr, 0.12 * k); ctx.beginPath(); ctx.moveTo(X(a), Y(12)); ctx.lineTo(X(a), Y(14.5)); ctx.stroke(); ctx.fillStyle = "#f39b00"; ctx.beginPath(); ctx.arc(X(a), Y(14.5), Math.max(2 * dpr, 0.12 * k), 0, Math.PI * 2); ctx.fill(); }
      // il fulmine colpisce l'asta centrale
      const fase = tra(prog, 0.47, 0.55);
      if (prog > 0.47 && prog < 0.82) {
        const quale = Math.floor(t * 1.6);
        if (!colpo || quale !== ultimoColpo) {
          ultimoColpo = quale; const rnd = casuale(quale * 7919);
          const pts = fulmine([-6 + rnd() * 12, cam.y + cam.h * 0.6], [0, 14.5], 0.45, rnd);
          const rami: P[][] = []; for (let r = 0; r < 4; r++) { const da = pts[8 + Math.floor(rnd() * (pts.length - 20))]!; rami.push(fulmine(da, [da[0] + (rnd() - 0.5) * 12, da[1] - 4 - rnd() * 6], 0.5, rnd).slice(0, 30)); }
          colpo = { pts, rami, t }; if (!fermo) flash = 1;
        }
        const e = t - colpo.t, vivo2 = fermo ? 1 : Math.max(0, 1 - e * 1.4) * (0.6 + 0.4 * Math.sin(e * 70));
        const traccia = (pp: P[], w: number, c: string) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pp.forEach((q, j) => (j ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])))); ctx.stroke(); };
        const parte = Math.max(2, Math.floor(colpo.pts.length * (fermo ? 1 : Math.min(1, fase * 1.2 + e * 6))));
        ctx.shadowColor = "#b9ccff"; ctx.shadowBlur = 24 * dpr;
        traccia(colpo.pts.slice(0, parte), 7 * dpr, `rgba(160,185,255,${0.35 * vivo2})`);
        traccia(colpo.pts.slice(0, parte), 2.4 * dpr, `rgba(255,255,255,${vivo2})`);
        for (const r of colpo.rami) traccia(r, 1.2 * dpr, `rgba(220,230,255,${0.6 * vivo2})`);
        ctx.shadowBlur = 0;
        const g = ctx.createRadialGradient(X(0), Y(14.5), 0, X(0), Y(14.5), 3 * k);
        g.addColorStop(0, `rgba(255,240,200,${0.8 * vivo2})`); g.addColorStop(1, "rgba(255,240,200,0)"); ctx.fillStyle = g; ctx.fillRect(X(-3), Y(17.5), 6 * k, 6 * k);
      }
      // la corrente scende: impulsi lungo il percorso e onde nel terreno
      const corrente = tra(prog, 0.55, 0.68) * (1 - tra(prog, 0.84, 0.92));
      if (corrente > 0) {
        const L = lunghezza(PERCORSO);
        for (let i = 0; i < 7; i++) { const d = ((t * 14 + i * (L / 7)) % L), q = puntoA(PERCORSO, d); const g = ctx.createRadialGradient(X(q[0]), Y(q[1]), 0, X(q[0]), Y(q[1]), 0.9 * k); g.addColorStop(0, `rgba(255,220,140,${corrente})`); g.addColorStop(1, "rgba(255,220,140,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 0.9 * k, 0, Math.PI * 2); ctx.fill(); }
        for (let i = 0; i < 3; i++) { const r = ((t * 1.2 + i / 3) % 1); ctx.strokeStyle = `rgba(243,155,0,${corrente * (1 - r)})`; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.ellipse(X(-15), Y(-3), r * 8 * k, r * 2.5 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
      }
      // pioggia
      if (prog < 0.85) {
        ctx.strokeStyle = "rgba(190,205,215,0.28)"; ctx.lineWidth = 1 * dpr; ctx.beginPath();
        for (const d of gocce) { const x = ((d.x + t * 0.05) % 1) * W, y = ((d.y + t * d.v) % 1) * H; ctx.moveTo(x, y); ctx.lineTo(x - 3 * dpr, y + 14 * dpr); }
        ctx.stroke();
      }
      // dentro: il salotto oltre la finestra, protetto dagli SPD
      const dentro = tra(prog, 0.84, 0.97);
      if (dentro > 0) {
        const fx = X(4), fy = Y(7.4), fw = 3 * k, fh = 2.6 * k;
        const x0 = lerp(fx, 0, dentro), y0 = lerp(fy, 0, dentro), w = lerp(fw, W, dentro), h = lerp(fh, H, dentro);
        ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
        const u = (a: number) => x0 + a * w, v = (b: number) => y0 + b * h;
        const muro = ctx.createLinearGradient(0, y0, 0, y0 + h); muro.addColorStop(0, "#f4e7d2"); muro.addColorStop(1, "#e3cfb1"); ctx.fillStyle = muro; ctx.fillRect(x0, y0, w, h);
        ctx.fillStyle = "#b98d5f"; ctx.fillRect(x0, v(0.78), w, h * 0.22); // pavimento
        const tondo = (x: number, y: number, ww: number, hh: number) => { ctx.beginPath(); const c2 = ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }; if (typeof c2.roundRect === "function") c2.roundRect(x, y, ww, hh, 12 * dpr); else c2.rect(x, y, ww, hh); ctx.fill(); };
        ctx.fillStyle = "#41525d"; tondo(u(0.1), v(0.55), w * 0.42, h * 0.2); // divano
        ctx.fillStyle = "#56656f"; tondo(u(0.08), v(0.47), w * 0.46, h * 0.12);
        ctx.fillStyle = "#1b1f23"; ctx.fillRect(u(0.62), v(0.3), w * 0.26, h * 0.22); // televisore acceso
        const tv = ctx.createLinearGradient(u(0.62), 0, u(0.88), 0); tv.addColorStop(0, "#f39b00"); tv.addColorStop(1, "#7694a4"); ctx.fillStyle = tv; ctx.globalAlpha = 0.85; ctx.fillRect(u(0.63), v(0.315), w * 0.24, h * 0.19); ctx.globalAlpha = 1;
        ctx.fillStyle = "#5c4a3a"; ctx.fillRect(u(0.6), v(0.6), w * 0.3, h * 0.04); ctx.fillRect(u(0.63), v(0.64), w * 0.02, h * 0.14); ctx.fillRect(u(0.85), v(0.64), w * 0.02, h * 0.14);
        ctx.fillStyle = "#fff8ec"; ctx.beginPath(); ctx.arc(u(0.06), v(0.3), w * 0.03, 0, Math.PI * 2); ctx.fill(); // lampada
        // quadro con SPD (verde = protetto)
        ctx.fillStyle = "#e9edef"; ctx.fillRect(u(0.92), v(0.25), w * 0.06, h * 0.22); ctx.strokeStyle = "#41525d"; ctx.lineWidth = 2 * dpr; ctx.strokeRect(u(0.92), v(0.25), w * 0.06, h * 0.22);
        const verde = 0.6 + 0.4 * Math.sin(t * 3); ctx.fillStyle = `rgba(30,170,90,${verde})`; for (let i = 0; i < 3; i++) ctx.fillRect(u(0.93) + i * w * 0.017, v(0.3), w * 0.012, h * 0.04);
        ctx.fillStyle = "#41525d"; ctx.font = `${Math.max(10, h * 0.025)}px system-ui, sans-serif`; ctx.fillText("SPD", u(0.925), v(0.43));
        // pioggia e lampo dietro la finestra del salotto
        ctx.fillStyle = `rgba(20,28,34,${0.9 - dentro * 0.2})`; ctx.fillRect(u(0.18), v(0.08), w * 0.3, h * 0.3);
        if (!fermo && Math.sin(t * 1.3) > 0.97) { ctx.fillStyle = "rgba(220,230,255,0.6)"; ctx.fillRect(u(0.18), v(0.08), w * 0.3, h * 0.3); }
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 4 * dpr; ctx.strokeRect(u(0.18), v(0.08), w * 0.3, h * 0.3); ctx.beginPath(); ctx.moveTo(u(0.33), v(0.08)); ctx.lineTo(u(0.33), v(0.38)); ctx.stroke();
        ctx.restore();
      }
      // lampo a tutto schermo
      if (flash > 0) { ctx.fillStyle = `rgba(235,240,255,${flash * 0.55})`; ctx.fillRect(0, 0, W, H); flash = Math.max(0, flash - 0.08); }
      // vignettatura
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (visibile && !fermo) raf = requestAnimationFrame(disegna);
    }
    raf = requestAnimationFrame(disegna);
    return () => { vivo = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener("scroll", scorri); };
  }, [fermo]);

  const salta = () => document.getElementById("inizio-app")?.scrollIntoView({ behavior: "smooth" });
  return <section ref={sezione} aria-label="Introduzione: come funziona la protezione dai fulmini" className="relative bg-[#0f1418]" style={{ height: fermo ? "70svh" : "380svh" }}>
    <div className="sticky top-[55px] h-[calc(100svh-55px)] overflow-hidden sm:top-[59px] sm:h-[calc(100svh-59px)]">
      <canvas ref={tela} className="absolute inset-0 size-full" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 flex items-end pb-[14vh] sm:items-center sm:pb-0">
        <div className="mx-auto w-full max-w-5xl px-4">
          {CAPITOLI.map((c, i) => { const o = fermo ? (i === 3 ? 1 : 0) : Math.min(tra(p, c.da, c.da + 0.04), 1 - tra(p, c.a - 0.04, c.a));
            return <div key={c.titolo} className="absolute max-w-xl text-white transition-none" style={{ opacity: o, transform: `translateY(${(1 - o) * 24}px)` }}>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f39b00]">{String(i + 1).padStart(2, "0")} / 05</p>
              <h2 className="mt-2 text-4xl font-bold leading-[1.05] drop-shadow-[0_4px_24px_rgba(0,0,0,.6)] sm:text-6xl">{c.titolo}</h2>
              <p className="mt-3 text-lg text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,.7)] sm:text-xl">{c.testo}</p>
            </div>; })}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-6 flex flex-wrap items-center justify-center gap-3 px-4" style={{ opacity: fermo ? 1 : 0.35 + 0.65 * tra(p, 0.9, 1) }}>
        <Button asChild><Link to="/assistente">Inizia il progetto <ArrowRight strokeWidth={1.5} /></Link></Button>
        <Button variant="outline" className="border-white/40 bg-black/30 text-white hover:bg-black/50 hover:text-white" onClick={salta}>{p < 0.9 ? "Salta l'introduzione" : "Vai agli strumenti"} <ChevronsDown strokeWidth={1.5} /></Button>
      </div>
      {!fermo && <div aria-hidden="true" className="absolute right-4 top-1/2 hidden h-40 w-0.5 -translate-y-1/2 rounded bg-white/20 sm:block"><div className="w-full rounded bg-[#f39b00]" style={{ height: `${p * 100}%` }} /></div>}
    </div>
  </section>;
}
