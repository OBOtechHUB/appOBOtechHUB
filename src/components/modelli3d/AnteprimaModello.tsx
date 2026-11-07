import { useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Bounds, OrbitControls } from "@react-three/drei";
import type { Mesh3D } from "@/calcoli/modelli3d/dxf3d";

function Parte({ m }: { m: Mesh3D }) {
  const geometria = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(Float32Array.from(m.posizioni), 3));
    if (m.indici) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(m.indici), 1));
    g.computeVertexNormals();
    return g;
  }, [m]);
  const colore = m.colore ? new THREE.Color(m.colore[0], m.colore[1], m.colore[2]) : new THREE.Color("#a7b4bc");
  return <mesh geometry={geometria}><meshStandardMaterial color={colore} metalness={0.35} roughness={0.45} side={THREE.DoubleSide} /></mesh>;
}

/** Anteprima 3D del modello di prodotto (STEP in mm, asse Z verso l'alto). */
export default function AnteprimaModello({ meshes }: { meshes: Mesh3D[] }) {
  return <div className="h-[420px] w-full overflow-hidden rounded-lg border-[0.8px] border-bordo-scheda bg-[#eef2f4]">
    <Canvas camera={{ position: [1, -1.4, 1], up: [0, 0, 1], near: 0.1, far: 1e7 }} gl={{ preserveDrawingBuffer: true }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, -2, 5]} intensity={1.4} />
      <directionalLight position={[-3, 2, -1]} intensity={0.4} />
      <Bounds fit clip observe margin={1.2}>{meshes.map((m, i) => <Parte key={i} m={m} />)}</Bounds>
      <OrbitControls makeDefault />
    </Canvas>
  </div>;
}
