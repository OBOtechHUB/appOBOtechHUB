import { useMemo, useState } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { etichettaParticolare, type MarcatoreParticolare } from "@/calcoli/particolari/posizioni";

type Forma = "supporto" | "morsetto" | "compensatore" | "giunto" | "picchetto" | "punto-terra" | "asta";

/** Forma schematica del componente, ricavata dal tipo (testo libero della proposta). */
export function formaComponente(tipo: string): Forma {
  const t = tipo.toLowerCase();
  if (t.includes("sezionamento")) return "giunto";
  if (t.includes("punto di terra")) return "punto-terra";
  if (t.includes("picchetto")) return "picchetto";
  if (t.includes("compensator")) return "compensatore";
  if (t.includes("supporto")) return "supporto";
  if (t.startsWith("asta")) return "asta";
  return "morsetto";
}

const GEOMETRIE: Record<Forma, () => THREE.BufferGeometry> = {
  supporto: () => new THREE.CylinderGeometry(0.06, 0.09, 0.08, 10),
  morsetto: () => new THREE.BoxGeometry(0.08, 0.08, 0.08),
  compensatore: () => new THREE.TorusGeometry(0.1, 0.02, 6, 12, Math.PI),
  giunto: () => new THREE.BoxGeometry(0.14, 0.1, 0.08),
  picchetto: () => new THREE.SphereGeometry(0.07, 10, 8),
  "punto-terra": () => new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16),
  asta: () => new THREE.SphereGeometry(0.07, 10, 8),
};
const COLORE: Record<Forma, string> = {
  supporto: "#6b7a84", morsetto: "#3a4750", compensatore: "#6b7a84", giunto: "#e5b300",
  picchetto: "#875b32", "punto-terra": "#875b32", asta: "#3a4750",
};
const ARANCIONE = "#f39b00";

function Gruppo({ marcatori, forma, proposta, onClic, onSopra }: {
  marcatori: MarcatoreParticolare[]; forma: Forma; proposta: boolean;
  onClic: (m: MarcatoreParticolare) => void; onSopra: (m: MarcatoreParticolare | null) => void;
}) {
  const mesh = useMemo(() => {
    const geo = GEOMETRIE[forma]();
    const mat = new THREE.MeshStandardMaterial({ color: proposta ? ARANCIONE : COLORE[forma], transparent: proposta, opacity: proposta ? 0.7 : 1 });
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, marcatori.length));
    const o = new THREE.Object3D();
    marcatori.forEach((p, i) => {
      // coordinate progetto (x, y, z) → scena (x, z, -y), come nel resto del viewer
      o.position.set(p.x, p.z + 0.05, -p.y);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = marcatori.length;
    m.instanceMatrix.needsUpdate = true;
    m.renderOrder = 3;
    return m;
  }, [marcatori, forma, proposta]);
  const trova = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId !== undefined ? marcatori[e.instanceId] ?? null : null);
  return <primitive
    object={mesh}
    onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); const m = trova(e); if (m) onClic(m); }}
    onPointerMove={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onSopra(trova(e)); }}
    onPointerOut={() => onSopra(null)}
  />;
}

/** Marcatori dei particolari costruttivi nel viewer 3D: forma schematica per tipo, etichetta al passaggio, clic → scheda. */
export function MarcatoriParticolari({ marcatori, onSeleziona }: { marcatori: MarcatoreParticolare[]; onSeleziona: (idParticolare: string) => void }) {
  const [sopra, setSopra] = useState<MarcatoreParticolare | null>(null);
  const gruppi = useMemo(() => {
    const g = new Map<string, { forma: Forma; proposta: boolean; lista: MarcatoreParticolare[] }>();
    for (const m of marcatori) {
      const forma = formaComponente(m.tipoComponente);
      const proposta = m.origine !== "progetto";
      const k = `${forma}|${proposta}`;
      const v = g.get(k) ?? { forma, proposta, lista: [] };
      v.lista.push(m);
      g.set(k, v);
    }
    return [...g.entries()];
  }, [marcatori]);
  return <group>
    {gruppi.map(([k, v]) => <Gruppo key={k} marcatori={v.lista} forma={v.forma} proposta={v.proposta} onClic={(m) => onSeleziona(m.idParticolare)} onSopra={setSopra} />)}
    {sopra && <Html position={[sopra.x, sopra.z + 0.35, -sopra.y]} center style={{ pointerEvents: "none" }}>
      <div className="whitespace-nowrap rounded-full bg-[#212529] px-2 py-0.5 text-xs text-white shadow">
        {etichettaParticolare(sopra.idParticolare)} · {sopra.tipoComponente}{sopra.quantita > 1 ? ` ×${sopra.quantita}` : ""}
      </div>
    </Html>}
  </group>;
}
