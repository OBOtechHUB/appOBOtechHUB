/**
 * Schema verticale (non in scala orizzontale) delle calate isCon da grande altezza: punta, antenne, tratto isolato fino
 * al PAE, livelli equipotenziali intermedi e base. Disegno originale dell'app.
 */
import type { RisultatoCalateAltezza } from "@/calcoli/calate/isconAltezza";

const f = (v: number) => v.toLocaleString("it-IT", { maximumFractionDigits: 1 });

export function SchemaCalateAltezza({ punta, sommita, apparatoBasso, r, piano, finoATerra = false }: { punta: number; sommita: number; apparatoBasso: number; r: RisultatoCalateAltezza; piano: "tetto" | "terreno"; finoATerra?: boolean }) {
  const W = 280, H = 360, top = 18, bot = 326, zMax = Math.max(punta, sommita, 1);
  const y = (z: number) => bot - (Math.max(0, z) / zMax) * (bot - top);
  const xPalo = 150, xIscon = 132, xAnt = 172;
  const pae = r.quotaPAE;
  const inter = r.livelli.filter((l) => l.tipo === "intermedio");
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[280px] rounded-md border bg-card" role="img" aria-label="Schema delle calate isCon e dei collegamenti equipotenziali">
    {/* piano di riferimento */}
    <line x1={20} x2={W - 20} y1={bot} y2={bot} stroke="currentColor" strokeWidth={2} />
    {Array.from({ length: 12 }, (_, i) => <line key={i} x1={24 + i * 20} x2={14 + i * 20} y1={bot} y2={bot + 10} stroke="currentColor" strokeWidth={1} opacity={0.5} />)}
    <text x={22} y={bot + 24} fontSize={11} fill="currentColor">{piano === "tetto" ? "piano del tetto" : "terreno"} · 0 m</text>
    {/* palo o struttura */}
    <line x1={xPalo} x2={xPalo} y1={y(Math.min(punta, sommita + 0.5))} y2={bot} stroke="#7694a4" strokeWidth={6} strokeLinecap="round" />
    {/* asta di captazione */}
    <line x1={xPalo} x2={xPalo} y1={y(punta)} y2={y(sommita)} stroke="#f39b00" strokeWidth={3} />
    <circle cx={xPalo} cy={y(punta)} r={3.5} fill="#f39b00" />
    <text x={xPalo + 8} y={y(punta) + 4} fontSize={11} fill="currentColor">punta {f(punta)} m</text>
    {/* antenne */}
    <rect x={xAnt} y={y(sommita)} width={14} height={Math.max(4, y(apparatoBasso) - y(sommita))} rx={2} fill="#41525d" opacity={0.85} />
    <text x={xAnt + 18} y={y(apparatoBasso) + 4} fontSize={10} fill="currentColor">antenne da {f(apparatoBasso)} m</text>
    {/* isCon dalla punta al PAE (o fino a terra) */}
    {pae != null && <line x1={xIscon} x2={xIscon} y1={y(punta - 0.3)} y2={y(finoATerra ? 0 : pae)} stroke="#222" strokeWidth={4} />}
    {pae != null && <>
      <line x1={30} x2={W - 30} y1={y(pae)} y2={y(pae)} stroke="#f39b00" strokeWidth={2} />
      <rect x={xIscon - 5} y={y(pae) - 5} width={10} height={10} fill="#f39b00" />
      <text x={24} y={y(pae) - 6} fontSize={11} fontWeight={700} fill="#d98a00">PAE {f(pae)} m</text>
      <text x={24} y={(y(punta) + y(pae)) / 2} fontSize={10} fill="currentColor">l = {f(r.l)} m</text>
      {/* zona x senza parti conduttrici */}
      <rect x={xIscon - 14} y={y(pae + r.zonaX)} width={28} height={Math.max(2, y(pae) - y(pae + r.zonaX))} fill="#f39b00" opacity={0.18} />
    </>}
    {inter.map((l, i) => <g key={i}>
      <line x1={40} x2={W - 40} y1={y(l.quota)} y2={y(l.quota)} stroke="#2b7de9" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={24} y={y(l.quota) - 4} fontSize={10} fill="#2b7de9">{f(l.quota)} m</text>
    </g>)}
    {pae == null && <text x={24} y={y(zMax / 2)} fontSize={11} fill="#b3261e">nessuna soluzione isCon</text>}
  </svg>;
}
