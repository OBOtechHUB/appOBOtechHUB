/**
 * Pezzi della scena 3D di Edificio 3D: corpi con spigoli e colori per superficie, aste con base, conduttori come tubi
 * del diametro reale, supporti e morsetti, terreno con griglia o foto satellitare, sole con ombre, telecamera animata,
 * scala grafica e fotografia della vista.
 */
import { useEffect, useMemo, useRef, useState } from "react";
type Rif<T> = { current: T };
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { Asta, Conduttore, Corpo, Punto3 } from "@/calcoli/edificio/tipi";
import { coloreMateriale, direzioneSole, lunghezzaScala, pixelPerMetro, raggioConduttore, tasselliSatellite, type Limiti3D } from "@/calcoli/edificio/vista3d";

export interface ColoriScena {
  parete: string; tetto: string; falde: string; impianto: string; spigolo: string; terreno: string; cieloAlto: string; cieloBasso: string; cemento: string;
  grid: string; metal: string; accent: string; terra: string;
}
export interface StileScena { spigoli: boolean; raggiX: boolean; ombre: boolean; clip: THREE.Plane[] }

const tinta = (col: string, quanto: number) => { const c = new THREE.Color(col); c.lerp(new THREE.Color("#ffffff"), Math.max(0, Math.min(0.35, quanto))); return c; };
function materiale(colore: THREE.Color | string, s: StileScena, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color: colore, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, clippingPlanes: s.clip, clipShadows: true,
    transparent: s.raggiX, opacity: s.raggiX ? 0.22 : 1, depthWrite: !s.raggiX, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...extra,
  });
}
const MAX_TRIANGOLI_SPIGOLI = 200000;
const conta = (g: THREE.BufferGeometry) => (g.index ? g.index.count : (g.attributes["position"]?.count ?? 0)) / 3;

type Clic = (e: ThreeEvent<MouseEvent>) => void;
type Moto = (e: ThreeEvent<PointerEvent>) => void;

/** Un corpo: pareti, copertura piana o a falde (con i timpani), impianti in copertura in un colore a parte, spigoli scuri. */
export function CorpoMesh({ corpo, impianto, c, s, onClick, onMove, onDoppio }: { corpo: Corpo; impianto: boolean; c: ColoriScena; s: StileScena; onClick: Clic; onMove?: Moto | undefined; onDoppio?: Clic | undefined }) {
  const top = (corpo.quotaBase ?? 0) + corpo.altezzaGronda;
  const geometry = useMemo(() => {
    if (corpo.mesh) {
      const g = new THREE.BufferGeometry(), pos = corpo.mesh.posizioni, converted: number[] = [];
      for (let i = 0; i < pos.length; i += 3) converted.push(pos[i] ?? 0, (pos[i + 2] ?? 0) + corpo.quotaBase, -(pos[i + 1] ?? 0));
      g.setAttribute("position", new THREE.Float32BufferAttribute(converted, 3));
      if (corpo.mesh.indici) g.setIndex(corpo.mesh.indici);
      g.computeVertexNormals();
      return g;
    }
    const shape = new THREE.Shape();
    corpo.impronta.forEach((p, i) => (i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])));
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, corpo.altezzaGronda), bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, corpo.quotaBase, 0);
    return g;
  }, [corpo]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // modelli importati: colore per vertice secondo l'orientamento (in alto = copertura, di lato = parete)
  useMemo(() => {
    if (!corpo.mesh) return;
    const n = geometry.attributes["normal"], cnt = geometry.attributes["position"]?.count ?? 0;
    if (!n) return;
    const cp = new THREE.Color(impianto ? c.impianto : c.parete), ct = tinta(impianto ? c.impianto : c.tetto, top / 120), col = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { const k = n.getY(i) > 0.6 ? ct : cp; col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b; }
    geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }, [geometry, corpo.mesh, c, impianto, top]);
  const roof = useMemo(() => {
    if (corpo.tipoTetto !== "falde" || corpo.mesh) return null;
    const xs = corpo.impronta.map((p) => p[0]), ys = corpo.impronta.map((p) => p[1]);
    const a = Math.min(...xs), b = Math.max(...xs), lo = Math.min(...ys), hi = Math.max(...ys), mid = (lo + hi) / 2, z = corpo.quotaBase + corpo.altezzaGronda, h = corpo.quotaBase + Math.max(corpo.altezzaColmo, corpo.altezzaGronda);
    const falde = [a, z, -lo, b, z, -lo, b, h, -mid, a, z, -lo, b, h, -mid, a, h, -mid, a, h, -mid, b, h, -mid, b, z, -hi, a, h, -mid, b, z, -hi, a, z, -hi];
    const timpani = [a, z, -lo, a, h, -mid, a, z, -hi, b, z, -lo, b, z, -hi, b, h, -mid];
    const gF = new THREE.BufferGeometry(); gF.setAttribute("position", new THREE.Float32BufferAttribute(falde, 3)); gF.computeVertexNormals();
    const gT = new THREE.BufferGeometry(); gT.setAttribute("position", new THREE.Float32BufferAttribute(timpani, 3)); gT.computeVertexNormals();
    return { gF, gT };
  }, [corpo]);
  useEffect(() => () => { roof?.gF.dispose(); roof?.gT.dispose(); }, [roof]);
  const mats = useMemo(() => {
    const parete = impianto ? c.impianto : c.parete;
    const tetto = tinta(impianto ? c.impianto : corpo.tipoTetto === "falde" ? c.parete : c.tetto, top / 120);
    return {
      tetto: materiale(tetto, s), parete: materiale(parete, s),
      mesh: materiale("#ffffff", s, { vertexColors: true }), falde: materiale(c.falde, s, { roughness: 0.75 }),
      spigolo: new THREE.LineBasicMaterial({ color: c.spigolo, clippingPlanes: s.clip, transparent: true, opacity: s.raggiX ? 0.55 : 0.85 }),
    };
  }, [c, s, impianto, top, corpo.tipoTetto]);
  useEffect(() => () => { Object.values(mats).forEach((m) => m.dispose()); }, [mats]);
  const spigoli = useMemo(() => {
    if (!s.spigoli || conta(geometry) > MAX_TRIANGOLI_SPIGOLI) return null;
    const out = [new THREE.EdgesGeometry(geometry, 25)];
    if (roof) out.push(new THREE.EdgesGeometry(roof.gF, 15), new THREE.EdgesGeometry(roof.gT, 15));
    return out;
  }, [geometry, roof, s.spigoli]);
  useEffect(() => () => spigoli?.forEach((g) => g.dispose()), [spigoli]);
  const ombra = s.ombre && !s.raggiX;
  const ev = { onClick, ...(onMove ? { onPointerMove: onMove } : {}), ...(onDoppio ? { onDoubleClick: onDoppio } : {}) };
  return <group>
    <mesh geometry={geometry} material={corpo.mesh ? mats.mesh : [mats.tetto, mats.parete]} castShadow={ombra} receiveShadow={ombra} {...ev} />
    {roof && <><mesh geometry={roof.gF} material={mats.falde} castShadow={ombra} receiveShadow={ombra} {...ev} /><mesh geometry={roof.gT} material={mats.parete} castShadow={ombra} receiveShadow={ombra} {...ev} /></>}
    {spigoli?.map((g, i) => <lineSegments key={i} geometry={g} material={mats.spigolo} />)}
  </group>;
}

/** Cilindro fra due punti (nel 3D). */
export function Cilindro({ a, b, r, colore, metallo = 0, ombra }: { a: THREE.Vector3Tuple; b: THREE.Vector3Tuple; r: number; colore: string; metallo?: number; ombra: boolean }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), l = d.length();
    return { pos: va.add(vb).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), len: l };
  }, [a, b]);
  return <mesh position={pos} quaternion={quat} castShadow={ombra}><cylinderGeometry args={[r, r, len, 8]} /><meshStandardMaterial color={colore} metalness={metallo} roughness={metallo ? 0.4 : 0.8} /></mesh>;
}

/** Asta di captazione: stelo del diametro reale con punta; sotto 2,2 m su basamento in calcestruzzo, oltre su treppiede con blocchi. */
export function Asta3D({ a, on, evidenzia = false, c, ombra, onClick, onPointerDown }: { a: Asta; on: boolean; evidenzia?: boolean; c: ColoriScena; ombra: boolean; onClick: Clic; onPointerDown: Moto }) {
  const r = Math.max(a.diametro / 2, 0.012), h = a.altezza, treppiede = h > 2.2;
  const col = on ? c.accent : evidenzia ? c.metal : "#d4d9dd";
  const R = Math.min(1.2, 0.42 * h), hAttacco = Math.min(1.1, 0.32 * h);
  const piedi = useMemo(() => [0, 1, 2].map((k) => { const t = (k * 2 * Math.PI) / 3 + Math.PI / 6; return [Math.cos(t) * R, 0.1, Math.sin(t) * R] as THREE.Vector3Tuple; }), [R]);
  return <group position={[a.x, a.z, -a.y]}>
    <mesh position={[0, h * 0.47, 0]} castShadow={ombra}><cylinderGeometry args={[r, r, h * 0.94, 12]} /><meshStandardMaterial color={col} metalness={0.6} roughness={0.35} emissive={on ? c.accent : "#000000"} emissiveIntensity={on ? 0.35 : 0} /></mesh>
    <mesh position={[0, h * 0.97, 0]} castShadow={ombra}><coneGeometry args={[r, h * 0.06, 12]} /><meshStandardMaterial color={col} metalness={0.6} roughness={0.35} /></mesh>
    {treppiede ? <>
      {piedi.map((p, i) => <Cilindro key={i} a={[0, hAttacco, 0]} b={p} r={0.015} colore="#c4c9cd" metallo={0.5} ombra={ombra} />)}
      {piedi.map((p, i) => <mesh key={`b${i}`} position={[p[0], 0.06, p[2]]} castShadow={ombra} receiveShadow={ombra}><cylinderGeometry args={[0.18, 0.18, 0.12, 16]} /><meshStandardMaterial color={c.cemento} roughness={0.95} /></mesh>)}
    </> : <mesh position={[0, 0.075, 0]} castShadow={ombra} receiveShadow={ombra}><cylinderGeometry args={[0.18, 0.18, 0.15, 20]} /><meshStandardMaterial color={c.cemento} roughness={0.95} /></mesh>}
    {/* zona di presa più grande dello stelo, invisibile: rende facile selezionare e trascinare */}
    <mesh position={[0, h / 2, 0]} onClick={onClick} onPointerDown={onPointerDown}><cylinderGeometry args={[0.3, 0.3, h, 8]} /><meshBasicMaterial visible={false} /></mesh>
  </group>;
}

/** Tubi (prismi a 8 lati) lungo tutti i segmenti, in un'unica geometria. */
function geometriaTubi(seg: { a: Punto3; b: Punto3; r: number }[]): THREE.BufferGeometry {
  const L = 8, pos: number[] = [], nor: number[] = [], idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0), alt = new THREE.Vector3(1, 0, 0);
  for (const s of seg) {
    const A = new THREE.Vector3(s.a[0], s.a[2], -s.a[1]), B = new THREE.Vector3(s.b[0], s.b[2], -s.b[1]), d = B.clone().sub(A);
    if (d.lengthSq() < 1e-8) continue;
    d.normalize();
    const u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? alt : up).normalize(), v = new THREE.Vector3().crossVectors(d, u).normalize();
    const base = pos.length / 3;
    for (let k = 0; k < L; k++) {
      const t = (k / L) * Math.PI * 2, n = u.clone().multiplyScalar(Math.cos(t)).add(v.clone().multiplyScalar(Math.sin(t)));
      for (const P of [A, B]) { pos.push(P.x + n.x * s.r, P.y + n.y * s.r, P.z + n.z * s.r); nor.push(n.x, n.y, n.z); }
    }
    for (let k = 0; k < L; k++) { const a0 = base + k * 2, a1 = a0 + 1, b0 = base + ((k + 1) % L) * 2, b1 = b0 + 1; idx.push(a0, b0, a1, a1, b0, b1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}

/** Conduttori come tubi del diametro reale, colorati per materiale. */
export function ConduttoriTubi({ conduttori, c, ombra, evidenzia = false }: { conduttori: Conduttore[]; c: ColoriScena; ombra: boolean; evidenzia?: boolean }) {
  const gruppi = useMemo(() => {
    const m = new Map<string, { a: Punto3; b: Punto3; r: number }[]>();
    for (const k of conduttori) {
      const col = k.tipo === "terra" ? c.terra : evidenzia ? c.metal : coloreMateriale(k.materiale, k.tipo), r = Math.max(0.003, raggioConduttore(k.sezione));
      const l = m.get(col) ?? []; for (let i = 1; i < k.punti.length; i++) l.push({ a: k.punti[i - 1]!, b: k.punti[i]!, r }); m.set(col, l);
    }
    return [...m.entries()].map(([col, seg]) => ({ col, g: geometriaTubi(seg) }));
  }, [conduttori, c.terra, c.metal, evidenzia]);
  useEffect(() => () => gruppi.forEach((x) => x.g.dispose()), [gruppi]);
  return <group>{gruppi.map((x) => <mesh key={x.col} geometry={x.g} castShadow={ombra}><meshStandardMaterial color={x.col} metalness={x.col === "#2a2d31" ? 0 : 0.55} roughness={0.4} /></mesh>)}</group>;
}

export interface Componente3D { tipo?: string | undefined; x: number; y: number; z: number; rotazione?: number | undefined }
/** Supporti (blocchi in copertura, staffe a parete) e morsetti a grandezza reale, con istanze. */
export function Componenti3D({ supporti, morsetti, c, ombra }: { supporti: Componente3D[]; morsetti: Componente3D[]; c: ColoriScena; ombra: boolean }) {
  const mesh = (lista: Componente3D[], geo: THREE.BufferGeometry, col: string, dy: number, metallo: number) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: col, metalness: metallo, roughness: metallo ? 0.4 : 0.9 }), Math.max(1, lista.length));
    const o = new THREE.Object3D();
    lista.forEach((s, i) => { o.position.set(s.x, s.z + dy, -s.y); o.rotation.set(0, ((s.rotazione ?? 0) * Math.PI) / 180, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.count = lista.length; m.instanceMatrix.needsUpdate = true; m.castShadow = ombra; return m;
  };
  const tetto = useMemo(() => supporti.filter((s) => s.tipo !== "supporto calata"), [supporti]);
  const parete = useMemo(() => supporti.filter((s) => s.tipo === "supporto calata"), [supporti]);
  const mT = useMemo(() => mesh(tetto, new THREE.CylinderGeometry(0.075, 0.09, 0.07, 12), "#8c9196", 0.035, 0), [tetto, ombra]);
  const mP = useMemo(() => mesh(parete, new THREE.BoxGeometry(0.05, 0.05, 0.05), "#b9bfc4", 0, 0.5), [parete, ombra]);
  const mM = useMemo(() => mesh(morsetti, new THREE.BoxGeometry(0.06, 0.04, 0.06), "#c9ced2", 0, 0.6), [morsetti, ombra]);
  useEffect(() => () => { for (const m of [mT, mP, mM]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }, [mT, mP, mM]);
  void c;
  return <group>{tetto.length > 0 && <primitive object={mT} />}{parete.length > 0 && <primitive object={mP} />}{morsetti.length > 0 && <primitive object={mM} />}</group>;
}

/** Picchetto: cilindro del diametro reale sotto terra (si vede con il terreno trasparente). */
export function Picchetto3D({ x, y, z, lunghezza, diametro, c }: { x: number; y: number; z: number; lunghezza: number; diametro: number; c: ColoriScena }) {
  return <mesh position={[x, z - lunghezza / 2, -y]}><cylinderGeometry args={[Math.max(0.01, diametro / 2), Math.max(0.01, diametro / 2), lunghezza, 10]} /><meshStandardMaterial color={c.terra} metalness={0.5} roughness={0.5} /></mesh>;
}

function Griglia({ dim, divisioni, colore, opacita, centro }: { dim: number; divisioni: number; colore: string; opacita: number; centro: [number, number] }) {
  const g = useMemo(() => { const h = new THREE.GridHelper(dim, divisioni, colore, colore); const m = h.material as THREE.Material; m.transparent = true; m.opacity = opacita; m.depthWrite = false; return h; }, [dim, divisioni, colore, opacita]);
  useEffect(() => () => { g.geometry.dispose(); (g.material as THREE.Material).dispose(); }, [g]);
  return <primitive object={g} position={[centro[0], 0.01, centro[1]]} />;
}

/** Foto satellitare (Esri World Imagery) sotto l'edificio, solo con le coordinate del modello. */
function Satellite({ origine, b, onStato }: { origine: { lat: number; lon: number }; b: Limiti3D; onStato: (m: string) => void }) {
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2, lato = Math.max(120, Math.max(b.maxX - b.minX, b.maxY - b.minY) * 3);
  const tasselli = useMemo(() => tasselliSatellite(origine, cx, cy, lato), [origine, cx, cy, lato]);
  const [tex, setTex] = useState<Record<string, THREE.Texture>>({});
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let vivo = true, errori = 0; const caricate: THREE.Texture[] = [];
    const l = new THREE.TextureLoader(); l.setCrossOrigin("anonymous");
    for (const t of tasselli) l.load(t.url, (x) => { x.colorSpace = THREE.SRGBColorSpace; caricate.push(x); if (vivo) { setTex((p) => ({ ...p, [t.url]: x })); invalidate(); } }, undefined, () => { errori++; if (vivo && errori === tasselli.length) onStato("Foto satellitare non disponibile (servizio non raggiungibile)."); });
    return () => { vivo = false; caricate.forEach((x) => x.dispose()); setTex({}); };
  }, [tasselli, invalidate, onStato]);
  return <group>{tasselli.map((t) => { const x = tex[t.url]; if (!x) return null; const w = t.maxX - t.minX, h = t.maxY - t.minY; return <mesh key={t.url} position={[(t.minX + t.maxX) / 2, 0.005, -(t.minY + t.maxY) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[w, h]} /><meshStandardMaterial map={x} roughness={1} /></mesh>; })}</group>;
}

/** Terreno: piano che riceve le ombre, con griglia metrica (1 m e 10 m) o foto satellitare. */
export function Terreno({ b, modo, c, s, origine, onStato, onClick, onMove, onDoppio }: { b: Limiti3D; modo: "griglia" | "terreno" | "satellite"; c: ColoriScena; s: StileScena; origine?: { lat: number; lon: number } | undefined; onStato: (m: string) => void; onClick: Clic; onMove: Moto; onDoppio?: Clic | undefined }) {
  const E = Math.max(b.maxX - b.minX, b.maxY - b.minY, 20), dim = Math.max(300, E * 8), cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const dimG = Math.ceil((E * 3) / 10) * 10, centro: [number, number] = [Math.round(cx / 10) * 10, -Math.round(cy / 10) * 10];
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02, -cy]} receiveShadow={s.ombre} onClick={onClick} onPointerMove={onMove} {...(onDoppio ? { onDoubleClick: onDoppio } : {})}>
      <planeGeometry args={[dim, dim]} /><meshStandardMaterial color={c.terreno} roughness={1} transparent={s.raggiX} opacity={s.raggiX ? 0.45 : 1} depthWrite={!s.raggiX} />
    </mesh>
    {modo === "griglia" && <><Griglia dim={dimG} divisioni={Math.min(600, dimG)} colore={c.grid} opacita={0.18} centro={centro} /><Griglia dim={dimG} divisioni={Math.max(1, dimG / 10)} colore={c.grid} opacita={0.5} centro={centro} /></>}
    {modo === "satellite" && origine && <Satellite origine={origine} b={b} onStato={onStato} />}
  </group>;
}

/** Luci: cielo, sole con ombre adattate all'edificio e un ambiente riflesso generato dal codice (nessun file scaricato). */
export function Luci({ b, sole, ombre, c }: { b: Limiti3D; sole: { azimut: number; elevazione: number }; ombre: boolean; c: ColoriScena }) {
  const ref = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene), invalidate = useThree((s) => s.invalidate);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2, E = Math.max(b.maxX - b.minX, b.maxY - b.minY, b.H, 20);
  const d = direzioneSole(sole.azimut, sole.elevazione), R = E * 0.9;
  useEffect(() => {
    const l = ref.current; if (!l) return;
    l.target.position.set(cx, 0, -cy); scene.add(l.target); l.target.updateMatrixWorld();
    const cam = l.shadow.camera; cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.near = 0.5; cam.far = E * 6; cam.updateProjectionMatrix();
    l.shadow.needsUpdate = true; invalidate();
    return () => { scene.remove(l.target); };
  }, [cx, cy, R, E, scene, invalidate, d[0], d[1], d[2]]);
  return <>
    <hemisphereLight args={[c.cieloAlto, c.terreno, 0.75]} />
    <ambientLight intensity={0.15} />
    <directionalLight ref={ref} position={[cx + d[0] * E * 2.5, d[1] * E * 2.5, -cy + d[2] * E * 2.5]} intensity={2.1} castShadow={ombre} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03} />
    <Environment resolution={64} frames={1} environmentIntensity={0.55}>
      <Lightformer form="rect" intensity={2} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      <Lightformer form="rect" intensity={0.8} position={[-10, 3, 0]} rotation-y={Math.PI / 2} scale={[20, 6, 1]} />
      <Lightformer form="rect" intensity={0.8} position={[10, 3, 0]} rotation-y={-Math.PI / 2} scale={[20, 6, 1]} />
    </Environment>
  </>;
}

export interface RichiestaCamera { n: number; posizione: THREE.Vector3Tuple; obiettivo: THREE.Vector3Tuple; subito?: boolean }
type Controlli = { target: THREE.Vector3; update: () => void } | null;
/** Sposta la telecamera con un movimento morbido (0,7 s) verso la vista richiesta. */
export function ControlloCamera({ richiesta }: { richiesta: RichiestaCamera | null }) {
  const camera = useThree((s) => s.camera), controls = useThree((s) => s.controls) as unknown as Controlli, invalidate = useThree((s) => s.invalidate);
  const anim = useRef<{ p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; t: number } | null>(null);
  useEffect(() => {
    if (!richiesta || !controls) return;
    const p1 = new THREE.Vector3(...richiesta.posizione), t1 = new THREE.Vector3(...richiesta.obiettivo);
    if (richiesta.subito) { camera.position.copy(p1); controls.target.copy(t1); controls.update(); anim.current = null; invalidate(); return; }
    anim.current = { p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, t: 0 }; invalidate();
  }, [richiesta?.n, controls]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const a = anim.current; if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 0.7); const k = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.p0, a.p1, k); controls.target.lerpVectors(a.t0, a.t1, k); controls.update();
    if (a.t >= 1) anim.current = null; invalidate();
  });
  return null;
}

/** Scala grafica: aggiorna direttamente la barra (larghezza e testo) a ogni fotogramma. */
export function ScalaGrafica({ barra, testo }: { barra: Rif<HTMLDivElement | null>; testo: Rif<HTMLSpanElement | null> }) {
  const controls = useThree((s) => s.controls) as unknown as Controlli;
  useFrame(({ camera, size }) => {
    if (!barra.current || !testo.current || !controls) return;
    const cam = camera as THREE.PerspectiveCamera, ppm = pixelPerMetro(cam.position.distanceTo(controls.target), cam.fov ?? 50, size.height), { metri, px } = lunghezzaScala(ppm);
    barra.current.style.width = `${Math.round(px)}px`; testo.current.textContent = `${metri.toLocaleString("it-IT")} m`;
  });
  return null;
}

/** Fotografia della vista a risoluzione doppia, con lo sfondo a sfumatura (senza cubo e senza etichette). */
export function Fotografo({ scatta, c }: { scatta: Rif<((tipo: "image/png" | "image/jpeg") => Promise<Blob | null>) | null>; c: ColoriScena }) {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene), camera = useThree((s) => s.camera), size = useThree((s) => s.size), invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    scatta.current = (tipo) => {
      const prima = gl.getPixelRatio(), scala = 2;
      gl.setPixelRatio(scala); gl.setSize(size.width, size.height, false); gl.render(scene, camera);
      const w = gl.domElement.width, h = gl.domElement.height, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d");
      if (ctx) { const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c.cieloAlto); gr.addColorStop(1, c.cieloBasso); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); ctx.drawImage(gl.domElement, 0, 0); }
      gl.setPixelRatio(prima); gl.setSize(size.width, size.height, false); invalidate();
      return new Promise((ok) => cv.toBlob(ok, tipo, 0.9));
    };
    return () => { scatta.current = null; };
  }, [gl, scene, camera, size, invalidate, scatta, c]);
  return null;
}
