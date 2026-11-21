/** Vista 3D di un tratto (fino a 4 supporti) con profilati, mensole o traversi e passerelle. Metri, y verso l'alto. */
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { RisultatoTratta } from "@/calcoli/staffaggi/calcolo";
import type { Tratta } from "@/calcoli/staffaggi/tipi";

const R = 0.041;
type V3 = [number, number, number];
function Box({ c, s, colore, opacita = 1 }: { c: V3; s: V3; colore: string; opacita?: number }) {
  return <mesh position={c}><boxGeometry args={s} /><meshStandardMaterial color={colore} transparent={opacita < 1} opacity={opacita} metalness={0.4} roughness={0.5} /></mesh>;
}
/** Passerella a U lunga lungo z. */
function Passerella({ x, y, larg, alt, lung, coperchio }: { x: number; y: number; larg: number; alt: number; lung: number; coperchio: boolean }) {
  const sp = 0.004, z = lung / 2;
  return (
    <group>
      <Box c={[x, y + sp / 2, z]} s={[larg, sp, lung]} colore="#a3b1bf" />
      <Box c={[x - larg / 2, y + alt / 2, z]} s={[sp, alt, lung]} colore="#a3b1bf" />
      <Box c={[x + larg / 2, y + alt / 2, z]} s={[sp, alt, lung]} colore="#a3b1bf" />
      {coperchio && <Box c={[x, y + alt, z]} s={[larg + 0.01, sp, lung]} colore="#8796a5" opacita={0.6} />}
      <Box c={[x, y + Math.min(alt * 0.6, 0.05) / 2 + sp, z]} s={[larg * 0.85, Math.min(alt * 0.6, 0.05), lung]} colore="#16a34a" opacita={0.55} />
    </group>
  );
}

export default function Vista3D({ tratta: t, risultato: r }: { tratta: Tratta; risultato: RisultatoTratta }) {
  const nSup = Math.min(4, r.supporti), passo = t.interasse, lung = (nSup - 1) * passo + 0.6;
  const zs = Array.from({ length: nSup }, (_, i) => 0.3 + i * passo);
  const h1 = t.altezzaStaffa, dp = t.distanzaPiani / 1000, n = t.piani.length;
  const hM = (r.geometria.lunghezzaMontante ?? 0) / 1000;
  const soffitto = t.tipologia.startsWith("soffitto");
  const QUOTA = 3; // quota del soffitto (m) nella scena
  const yPiano = (i: number) => (t.tipologia === "parete-mensola" ? QUOTA - 0.5 - i * dp : soffitto ? QUOTA - h1 - i * dp : h1 + i * dp);
  const els: React.ReactNode[] = [];
  zs.forEach((z, k) => {
    if (t.tipologia === "soffitto-trapezio" || t.tipologia === "portale") {
      const luce = (r.geometria.luceTraverso ?? 400) / 1000, lt = (r.geometria.lunghezzaTraverso ?? 500) / 1000;
      for (const x of [-luce / 2, luce / 2]) els.push(<Box key={`m${k}${x}`} c={[x, soffitto ? QUOTA - hM / 2 : hM / 2, z]} s={[R, hM, R]} colore="#d97706" />);
      for (let i = 0; i < n; i++) els.push(<Box key={`t${k}${i}`} c={[0, yPiano(i) - R / 2, z]} s={[lt, R, R]} colore="#d97706" />);
    } else {
      const mens = r.geometria.mensole ?? [];
      if (t.tipologia !== "parete-mensola" || n > 1) els.push(<Box key={`m${k}`} c={[0, t.tipologia === "parete-mensola" ? yPiano(0) - ((n - 1) * dp) / 2 : soffitto ? QUOTA - hM / 2 : hM / 2, z]} s={[R, t.tipologia === "parete-mensola" ? (n - 1) * dp + 0.16 : hM, R]} colore="#d97706" />);
      mens.forEach((m, i) => els.push(<Box key={`b${k}${i}`} c={[R / 2 + m.lunghezza / 2000, yPiano(i) - 0.015, z]} s={[m.lunghezza / 1000, 0.03, 0.04]} colore="#2563eb" />));
    }
  });
  const xPas = (i: number) => (t.tipologia === "soffitto-trapezio" || t.tipologia === "portale" ? 0 : R / 2 + 0.01 + t.piani[i]!.larghezza / 2000);
  return (
    <div className="h-[420px] w-full overflow-hidden rounded border bg-gradient-to-b from-slate-100 to-slate-300 dark:from-slate-800 dark:to-slate-950">
      <Canvas camera={{ position: [2.2, soffitto ? QUOTA - 0.6 : 1.8, -1.4], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, -2]} intensity={1.2} />
        {els}
        {t.piani.map((p, i) => <Passerella key={i} x={xPas(i)} y={yPiano(i)} larg={p.larghezza / 1000} alt={p.altezza / 1000} lung={lung} coperchio={p.coperchio} />)}
        {soffitto && <Box c={[0, QUOTA + 0.05, lung / 2]} s={[1.6, 0.1, lung + 0.4]} colore="#cbd5e1" opacita={0.35} />}
        {(t.tipologia === "pavimento" || t.tipologia === "portale") && <Box c={[0, -0.05, lung / 2]} s={[1.6, 0.1, lung + 0.4]} colore="#cbd5e1" opacita={0.5} />}
        {t.tipologia === "parete-mensola" && <Box c={[-0.05, QUOTA / 2, lung / 2]} s={[0.1, QUOTA, lung + 0.4]} colore="#cbd5e1" opacita={0.4} />}
        <OrbitControls target={[0.2, t.tipologia === "parete-mensola" ? yPiano(0) : soffitto ? QUOTA - h1 : h1, lung / 2]} makeDefault />
      </Canvas>
    </div>
  );
}
