import {useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useThree,useFrame,type ThreeEvent} from "@react-three/fiber";
import {OrbitControls,Line,Html} from "@react-three/drei";
import * as THREE from "three";
import type {Asta,Conduttore,Corpo,ModelloEdificio,Punto3} from "@/calcoli/edificio/tipi";
import {limitiModello} from "@/calcoli/edificio/geometria";
import type {RisultatoSfera} from "@/calcoli/captazione/sferaRotolante";
import type {RisultatoCombinato,RisultatoMaglia} from "@/calcoli/captazione/verificaMaglia";
import type {PropostaTerra} from "@/calcoli/terra/proponiTerra";
import type {MarcatoreParticolare} from "@/calcoli/particolari/posizioni";
import {MarcatoriParticolari} from "@/components/particolari/MarcatoriParticolari";
import type {AstaCAD,ComponenteCAD,ConduttoreCAD,PicchettoCAD} from "@/calcoli/cad/esportaCAD";
export type InviluppoGriglia={x0:number;y0:number;passo:number;nx:number;ny:number;z:number[][]};
export type PropostaViewer={conduttori:ConduttoreCAD[];aste:AstaCAD[];supporti:ComponenteCAD[];morsetti:ComponenteCAD[];compensatori?:ComponenteCAD[]};
type Props={particolari?:MarcatoreParticolare[];onParticolare?:(id:string)=>void;picchetti?:PicchettoCAD[];propostaTerra?:PropostaTerra|null;modello:ModelloEdificio;aste:Asta[];conduttori:Conduttore[];alto:boolean;misura:boolean;onPunto:(p:Punto3)=>void;risultato?:RisultatoSfera|undefined;combinata?:RisultatoCombinato|undefined;maglia?:RisultatoMaglia|null|undefined;mostraMaglie?:boolean;magliaEvidenziata?:number|null;inviluppo?:InviluppoGriglia|undefined;mostraInviluppo:boolean;anima:boolean;centriSfera:Punto3[];posizioneSfera:number;suggerite:Asta[];proposta?:PropostaViewer|null|undefined};
function colors(){const css=getComputedStyle(document.documentElement);const get=(name:string)=>css.getPropertyValue(name).trim();return {terra:get("--viewer-terra"),surface:get("--viewer-surface"),roof:get("--viewer-roof"),metal:get("--viewer-metal"),grid:get("--viewer-grid"),exposed:get("--viewer-exposed"),protected:get("--viewer-protected"),maglia:get("--viewer-maglia"),accent:get("--accent")};}
function CorpoMesh({corpo,c,onClick}:{corpo:Corpo;c:ReturnType<typeof colors>;onClick:(e:ThreeEvent<MouseEvent>)=>void}){
  const geometry=useMemo(()=>{if(corpo.mesh){const g=new THREE.BufferGeometry();const pos=corpo.mesh.posizioni;const converted=[];for(let i=0;i<pos.length;i+=3)converted.push(pos[i]??0,(pos[i+2]??0)+corpo.quotaBase,-(pos[i+1]??0));g.setAttribute("position",new THREE.Float32BufferAttribute(converted,3));if(corpo.mesh.indici)g.setIndex(corpo.mesh.indici);g.computeVertexNormals();return g;}
    const shape=new THREE.Shape();corpo.impronta.forEach((p,i)=>i?shape.lineTo(p[0],p[1]):shape.moveTo(p[0],p[1]));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:corpo.altezzaGronda,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,corpo.quotaBase,0);return g;
  },[corpo]);useEffect(()=>()=>geometry.dispose(),[geometry]);
  const roof=useMemo(()=>{if(corpo.tipoTetto!=="falde")return null;const xs=corpo.impronta.map((p)=>p[0]),ys=corpo.impronta.map((p)=>p[1]),a=Math.min(...xs),b=Math.max(...xs),lo=Math.min(...ys),hi=Math.max(...ys),mid=(lo+hi)/2,z=corpo.quotaBase+corpo.altezzaGronda,h=corpo.quotaBase+corpo.altezzaColmo;const points=[a,z,-lo,b,z,-lo,b,h,-mid,a,z,-lo,b,h,-mid,a,h,-mid,a,h,-mid,b,h,-mid,b,z,-hi,a,h,-mid,b,z,-hi,a,z,-hi];const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(points,3));g.computeVertexNormals();return g;},[corpo]);useEffect(()=>()=>roof?.dispose(),[roof]);
  return <group><mesh geometry={geometry} onClick={onClick}><meshStandardMaterial color={c.surface} side={THREE.DoubleSide}/></mesh>{roof&&<mesh geometry={roof} onClick={onClick}><meshStandardMaterial color={c.roof} side={THREE.DoubleSide}/></mesh>}</group>;
}
function Camera({alto,modello}:{alto:boolean;modello:ModelloEdificio}){const {camera,invalidate}=useThree();useEffect(()=>{const b=limitiModello(modello),x=(b.minX+b.maxX)/2,z=-(b.minY+b.maxY)/2,d=Math.max(b.L,b.W,b.H,20)*1.8;camera.position.set(alto?x:x+d,alto?d:d*.8,alto?z+.01:z+d);camera.lookAt(x,b.H*.3,z);invalidate();},[alto,modello,camera,invalidate]);return null;}
/** Celle di copertura colorate (InstancedMesh): verde = protetta dalla sfera, blu = protetta dalla maglia, rosso = esposta. */
function CelleCopertura({r,combinata,c}:{r:RisultatoSfera;combinata?:RisultatoCombinato|undefined;c:ReturnType<typeof colors>}){
  const {esposte,protette,daMaglia}=useMemo(()=>{const g=r.griglia,esposte:[number,number,number][]=[],protette:[number,number,number][]=[],daMaglia:[number,number,number][]=[];for(let k=0;k<r.esposta.length;k++){const v=r.esposta[k];if(!v)continue;const i=k%g.nx,j=Math.floor(k/g.nx);const p:[number,number,number]=[g.x0+i*g.passo,g.y0+j*g.passo,r.altezze[k]??0];if(combinata){const st=combinata.stato[k];if(st===1)protette.push(p);else if(st===2)daMaglia.push(p);else if(st===3)esposte.push(p);}else (v===1?esposte:protette).push(p);}return {esposte,protette,daMaglia};},[r,combinata]);
  const build=(lista:[number,number,number][],color:string)=>{const geo=new THREE.PlaneGeometry(r.griglia.passo,r.griglia.passo);const mat=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});const m=new THREE.InstancedMesh(geo,mat,Math.max(1,lista.length));const o=new THREE.Object3D();lista.forEach((p,i)=>{o.position.set(p[0],p[2]+.06,-p[1]);o.rotation.set(-Math.PI/2,0,0);o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.count=lista.length;m.instanceMatrix.needsUpdate=true;return m;};
  const mE=useMemo(()=>build(esposte,c.exposed),[esposte,c.exposed,r.griglia.passo]);
  const mP=useMemo(()=>build(protette,c.protected),[protette,c.protected,r.griglia.passo]);
  const mM=useMemo(()=>build(daMaglia,c.maglia),[daMaglia,c.maglia,r.griglia.passo]);
  useEffect(()=>()=>{mE.geometry.dispose();mP.geometry.dispose();mM.geometry.dispose();},[mE,mP,mM]);
  return <group>{esposte.length>0&&<primitive object={mE}/>}{protette.length>0&&<primitive object={mP}/>}{daMaglia.length>0&&<primitive object={mM}/>}</group>;
}
/** Contorni delle maglie con etichetta "lunghezza × larghezza m" al centro. */
function Maglie({rm,r,c,evidenziata}:{rm:RisultatoMaglia;r:RisultatoSfera;c:ReturnType<typeof colors>;evidenziata?:number|null|undefined}){
  const g=r.griglia;
  const dati=useMemo(()=>rm.maglie.map((m)=>{
    const seg:[number,number,number][]=[];
    for(let k=0;k<rm.maglia.length;k++){
      if(rm.maglia[k]!==m.id)continue;
      const i=k%g.nx,j=Math.floor(k/g.nx);
      const x=g.x0+i*g.passo,y=g.y0+j*g.passo,z=(r.altezze[k]??0)+.08,h=g.passo/2;
      const vicino=(di:number,dj:number)=>{const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=g.nx||jj>=g.ny)return -1;return rm.maglia[jj*g.nx+ii];};
      if(vicino(0,-1)!==m.id)seg.push([x-h,z,-(y-h)],[x+h,z,-(y-h)]);
      if(vicino(0,1)!==m.id)seg.push([x-h,z,-(y+h)],[x+h,z,-(y+h)]);
      if(vicino(-1,0)!==m.id)seg.push([x-h,z,-(y-h)],[x-h,z,-(y+h)]);
      if(vicino(1,0)!==m.id)seg.push([x+h,z,-(y-h)],[x+h,z,-(y+h)]);
    }
    const ci=Math.round((m.centro[0]-g.x0)/g.passo),cj=Math.round((m.centro[1]-g.y0)/g.passo);
    const cz=r.altezze[Math.min(g.ny-1,Math.max(0,cj))*g.nx+Math.min(g.nx-1,Math.max(0,ci))]??0;
    return {m,seg,zCentro:cz};
  }),[rm,r,g]);
  return <group>{dati.map(({m,seg,zCentro})=>{const col=m.id===evidenziata?c.accent:m.conforme?c.protected:c.exposed;return <group key={m.id}>
    {seg.length>0&&<Line segments points={seg} color={col} lineWidth={m.id===evidenziata?5:2}/>}
    <Html position={[m.centro[0],zCentro+.4,-m.centro[1]]} center style={{pointerEvents:"none"}}>
      <div style={{background:"var(--background)",color:col,border:`1px solid ${col}`,borderRadius:4,padding:"1px 6px",fontSize:11,whiteSpace:"nowrap"}}>{m.lunghezza.toFixed(1)} × {m.larghezza.toFixed(1)} m</div>
    </Html>
  </group>;})}</group>;
}
/** Facce di parete esposte: rettangoli verticali rossi semitrasparenti. */
function FacceEsposte({r,c}:{r:RisultatoSfera;c:ReturnType<typeof colors>}){
  const mesh=useMemo(()=>{const lista=r.facceEsposte;if(!lista.length)return null;const geo=new THREE.PlaneGeometry(1,1);const mat=new THREE.MeshBasicMaterial({color:c.exposed,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false});const m=new THREE.InstancedMesh(geo,mat,lista.length);const o=new THREE.Object3D();lista.forEach((f,i)=>{const h=Math.max(.01,f.zA-f.zDa);o.position.set(f.x,(f.zDa+f.zA)/2,-f.y);o.rotation.set(0,Math.atan2(f.normale[0],f.normale[1]),0);o.scale.set(f.lunghezza,h,1);o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.instanceMatrix.needsUpdate=true;return m;},[r,c.exposed]);
  useEffect(()=>()=>{mesh?.geometry.dispose();},[mesh]);
  return mesh?<primitive object={mesh}/>:null;
}
/** Superficie dell'inviluppo inferiore delle sfere (azzurra, semitrasparente). */
function Inviluppo({inv,c}:{inv:InviluppoGriglia;c:ReturnType<typeof colors>}){
  const geo=useMemo(()=>{const g=new THREE.PlaneGeometry((inv.nx-1)*inv.passo,(inv.ny-1)*inv.passo,inv.nx-1,inv.ny-1);const pos=g.attributes["position"];if(!pos)return g;for(let j=0;j<inv.ny;j++)for(let i=0;i<inv.nx;i++){const k=j*inv.nx+i;const z=inv.z[j]?.[i];pos.setXYZ(k,inv.x0+i*inv.passo,-(inv.y0+j*inv.passo),Number.isFinite(z)?z as number:0);}g.computeVertexNormals();return g;},[inv]);
  useEffect(()=>()=>geo.dispose(),[geo]);
  return <mesh geometry={geo}><meshStandardMaterial color="#7dd3fc" transparent opacity={.25} side={THREE.DoubleSide} depthWrite={false}/></mesh>;
}
/** Sfera wireframe animata lungo i centri calcolati con percorsoSfera. */
function Sfera({r,anima,centri,posizione,color}:{r:RisultatoSfera;anima:boolean;centri:Punto3[];posizione:number;color:string}){
  const ref=useRef<THREE.Mesh>(null);const tempo=useRef(0);
  useFrame((_,delta)=>{if(!ref.current||!centri.length)return;if(anima)tempo.current+=delta;
    // percorso completo in circa 4 s qualunque sia la lunghezza, con movimento continuo tra un punto e l'altro
    const DURATA=4;const n=centri.length-1;
    const f=anima?((tempo.current%DURATA)/DURATA)*n:Math.min(n,posizione*n);
    const i=Math.min(n,Math.floor(f)),t=f-i,p=centri[i],q=centri[Math.min(n,i+1)];
    if(p&&q)ref.current.position.set(p[0]+(q[0]-p[0])*t,p[2]+(q[2]-p[2])*t,-(p[1]+(q[1]-p[1])*t));
    ref.current.rotation.z=tempo.current*2;});
  return <mesh ref={ref}><sphereGeometry args={[r.raggio,32,20]}/><meshBasicMaterial color={color} wireframe transparent opacity={.35}/></mesh>;
}
/** Proposta automatica: conduttori tratteggiati arancioni, aste, supporti (punti piccoli) e connettori (punti grandi). */
function Proposta({p,c}:{p:PropostaViewer;c:ReturnType<typeof colors>}){
  const punti=(lista:ComponenteCAD[],r:number,col=c.accent)=>{const geo=new THREE.SphereGeometry(r,8,6);const mat=new THREE.MeshBasicMaterial({color:col});const m=new THREE.InstancedMesh(geo,mat,Math.max(1,lista.length));const o=new THREE.Object3D();lista.forEach((s,i)=>{o.position.set(s.x,s.z,-s.y);o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.count=lista.length;m.instanceMatrix.needsUpdate=true;return m;};
  const supC=useMemo(()=>p.supporti.filter((s)=>s.tipo==="supporto calata"),[p.supporti]);const supT=useMemo(()=>p.supporti.filter((s)=>s.tipo!=="supporto calata"),[p.supporti]);
  const mS=useMemo(()=>punti(supT,.07),[supT,c.accent]);const mSC=useMemo(()=>punti(supC,.09,c.protected),[supC,c.protected]);
  const mM=useMemo(()=>punti(p.morsetti,.14),[p.morsetti,c.accent]);
  const comp=p.compensatori??[];
  const mC=useMemo(()=>{const geo=new THREE.OctahedronGeometry(.2,0);const mat=new THREE.MeshBasicMaterial({color:c.metal});const m=new THREE.InstancedMesh(geo,mat,Math.max(1,comp.length));const o=new THREE.Object3D();comp.forEach((s,i)=>{o.position.set(s.x,s.z+.1,-s.y);o.rotation.set(0,((s.rotazione??0)*Math.PI)/180,0);o.scale.set(1,.6,.5);o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.count=comp.length;m.instanceMatrix.needsUpdate=true;return m;},[comp,c.metal]);
  useEffect(()=>()=>{mSC.geometry.dispose();mS.geometry.dispose();mM.geometry.dispose();mC.geometry.dispose();},[mS,mSC,mM,mC]);
  return <group>
    {p.conduttori.map((line,i)=><Line key={i} points={line.punti.map((q)=>[q[0],q[2]+.05,-q[1]] as [number,number,number])} color={c.accent} lineWidth={2} dashed dashSize={.4} gapSize={.25}/>)}
    {p.aste.map((a,i)=><mesh key={i} position={[a.x,(a.z??0)+a.altezza/2,-a.y]}><cylinderGeometry args={[.08,.08,a.altezza,8]}/><meshStandardMaterial color={c.accent} transparent opacity={.8}/></mesh>)}
    {supT.length>0&&<primitive object={mS}/>}{supC.length>0&&<primitive object={mSC}/>}
    {p.morsetti.length>0&&<primitive object={mM}/>}
    {comp.length>0&&<primitive object={mC}/>}
  </group>;
}
export default function ViewerEdificio(props:Props){const [c,setC]=useState<ReturnType<typeof colors>|null>(null);const [punti,setPunti]=useState<Punto3[]>([]);const [ready,setReady]=useState(false);useEffect(()=>setC(colors()),[]);if(!c)return <div className="viewer-canvas bg-secondary"/>;
  function click(e:ThreeEvent<MouseEvent>){e.stopPropagation();const p:Punto3=[e.point.x,-e.point.z,e.point.y];props.onPunto(p);if(props.misura)setPunti((prev)=>prev.length===1?[...prev,p]:[p]);}
  const a=punti[0],b=punti[1];const misura=a&&b?Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]):null;
  return <div className="relative" data-scene-ready={ready?"true":undefined}><div className="viewer-canvas"><Canvas frameloop={props.anima?"always":"demand"} camera={{position:[40,35,40],near:.1,far:5000}} onCreated={()=>setReady(true)}><color attach="background" args={[c.surface]}/><ambientLight intensity={.8}/><directionalLight position={[30,60,20]} intensity={1.6}/><gridHelper args={[500,100,c.grid,c.grid]}/><axesHelper args={[10]}/><Camera alto={props.alto} modello={props.modello}/><OrbitControls makeDefault target={[(limitiModello(props.modello).minX+limitiModello(props.modello).maxX)/2,limitiModello(props.modello).H*.3,-(limitiModello(props.modello).minY+limitiModello(props.modello).maxY)/2]}/>
    {props.modello.corpi.map((body)=><CorpoMesh key={body.id} corpo={body} c={c} onClick={click}/>)}
    {props.aste.map((a)=><mesh key={a.id} position={[a.x,a.z+a.altezza/2,-a.y]}><cylinderGeometry args={[Math.max(.06,a.diametro/2),Math.max(.06,a.diametro/2),a.altezza,8]}/><meshStandardMaterial color={c.metal}/></mesh>)}
    {props.suggerite.map((a)=><mesh key={a.id} position={[a.x,a.z+a.altezza/2,-a.y]}><cylinderGeometry args={[Math.max(.08,a.diametro/2),Math.max(.08,a.diametro/2),a.altezza,8]}/><meshStandardMaterial color={c.accent} transparent opacity={.7}/></mesh>)}
    {props.conduttori.map((line)=><Line key={line.id} points={line.punti.map((p)=>[p[0],p[2]+.04,-p[1]] as [number,number,number])} color={line.tipo==="terra"?c.terra:c.metal} depthTest={line.tipo!=="terra"} renderOrder={line.tipo==="terra"?2:0} lineWidth={3}/>)}
    {(props.picchetti??[]).map((p,i)=><Line key={`picchetto-${i}`} points={[[p.x,p.z??0,-p.y],[p.x,(p.z??0)-p.lunghezza,-p.y]]} color={c.terra} depthTest={false} renderOrder={2} lineWidth={4}/>)}
    {props.propostaTerra&&<group>{props.propostaTerra.conduttori.map((line,i)=><Line key={`terra-${i}`} points={line.punti.map((p)=>[p[0],p[2],-p[1]] as [number,number,number])} color={c.terra} depthTest={false} renderOrder={2} lineWidth={3} dashed dashSize={.4} gapSize={.2}/>)}{props.propostaTerra.picchetti.map((p,i)=><Line key={`picchetto-preview-${i}`} points={[[p.x,p.z??0,-p.y],[p.x,(p.z??0)-p.lunghezza,-p.y]]} color={c.terra} depthTest={false} renderOrder={2} lineWidth={4}/>)}{props.propostaTerra.morsetti.map((p,i)=><mesh key={`morsetto-terra-${i}`} position={[p.x,p.z,-p.y]}><sphereGeometry args={[.15,8,6]}/><meshBasicMaterial color={c.terra}/></mesh>)}</group>}
    {props.proposta&&<Proposta p={props.proposta} c={c}/>}
    {props.particolari&&props.particolari.length>0&&<MarcatoriParticolari marcatori={props.particolari} onSeleziona={(id)=>{props.onParticolare?.(id);}}/>}
    {props.risultato&&<><CelleCopertura r={props.risultato} combinata={props.combinata} c={c}/><FacceEsposte r={props.risultato} c={c}/>{props.mostraMaglie&&props.maglia&&<Maglie rm={props.maglia} r={props.risultato} c={c} evidenziata={props.magliaEvidenziata}/>}{props.mostraInviluppo&&props.inviluppo&&<Inviluppo inv={props.inviluppo} c={c}/>}<Sfera r={props.risultato} anima={props.anima} centri={props.centriSfera} posizione={props.posizioneSfera} color={c.metal}/></>}
    {a&&b&&<Line points={[[a[0],a[2]+.1,-a[1]],[b[0],b[2]+.1,-b[1]]]} color={c.metal} lineWidth={3}/>}</Canvas></div>{misura!==null&&<div className="absolute left-4 top-4 rounded bg-background px-3 py-2 font-mono text-sm">{misura.toFixed(2)} m</div>}</div>;
}
