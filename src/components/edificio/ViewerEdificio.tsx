import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Canvas,useFrame,type ThreeEvent} from "@react-three/fiber";
import {OrbitControls,Line,Html,GizmoHelper,GizmoViewcube,Bvh} from "@react-three/drei";
import * as THREE from "three";
import {Box,Camera as IconaCamera,Crosshair,Download,FileImage,Maximize,Square} from "lucide-react";
import type {Asta,Conduttore,ModelloEdificio,Punto3} from "@/calcoli/edificio/tipi";
import {limitiModello} from "@/calcoli/edificio/geometria";
import type {RisultatoSfera} from "@/calcoli/captazione/sferaRotolante";
import type {RisultatoCombinato,RisultatoMaglia} from "@/calcoli/captazione/verificaMaglia";
import type {PropostaTerra} from "@/calcoli/terra/proponiTerra";
import type {MarcatoreParticolare} from "@/calcoli/particolari/posizioni";
import {MarcatoriParticolari} from "@/components/particolari/MarcatoriParticolari";
import type {AstaCAD,ComponenteCAD,ConduttoreCAD,PicchettoCAD} from "@/calcoli/cad/esportaCAD";
import {coloreMateriale,corpiInCopertura,etichettaCorpo,giornoDellAnno,posizioneSole,vistaCamera,type Limiti3D,type VistaPredefinita} from "@/calcoli/edificio/vista3d";
import {Asta3D,Componenti3D,ConduttoriTubi,ControlloCamera,CorpoMesh,Fotografo,Luci,Picchetto3D,ScalaGrafica,Terreno,type Componente3D,type RichiestaCamera,type StileScena} from "./Scena3D";
import {agganciaSpostamento} from "@/calcoli/captazione/modificaManuale";
import {puntoInPoligono} from "@/calcoli/captazione/sferaRotolante";
import {salvaVista3D,togliDallaRelazione,visteRelazione,type Vista3D} from "@/lib/viste3d";
export type InviluppoGriglia={x0:number;y0:number;passo:number;nx:number;ny:number;z:number[][]};
export type PropostaViewer={conduttori:ConduttoreCAD[];aste:AstaCAD[];supporti:ComponenteCAD[];morsetti:ComponenteCAD[];compensatori?:ComponenteCAD[]};
export type SelezioneViewer={tipo:"asta"|"conduttore"|"picchetto"|"corpo";id:string}|null;
export type TrattoColorato={a:Punto3;b:Punto3;colore:string};
export type EtichettaViewer={p:Punto3;testo:string;colore:string};
type Props={onSpostaCorpo?:(id:string,dx:number,dy:number)=>void;spostaConImpianto?:boolean;selezione?:SelezioneViewer;onSeleziona?:(s:SelezioneViewer)=>void;onTrascina?:(id:string,p:Punto3)=>void;spostabile?:boolean;trattiColorati?:TrattoColorato[];etichette?:EtichettaViewer[];particolari?:MarcatoreParticolare[];onParticolare?:(id:string)=>void;picchetti?:PicchettoCAD[];propostaTerra?:PropostaTerra|null;modello:ModelloEdificio;aste:Asta[];conduttori:Conduttore[];alto:boolean;misura:boolean;onPunto:(p:Punto3)=>void;risultato?:RisultatoSfera|undefined;combinata?:RisultatoCombinato|undefined;maglia?:RisultatoMaglia|null|undefined;mostraMaglie?:boolean;magliaEvidenziata?:number|null;inviluppo?:InviluppoGriglia|undefined;mostraInviluppo:boolean;anima:boolean;centriSfera:Punto3[];posizioneSfera:number;suggerite:Asta[];proposta?:PropostaViewer|null|undefined;
  /** supporti e morsetti del progetto, disegnati a grandezza reale */
  supporti?:Componente3D[]|undefined;morsetti?:Componente3D[]|undefined;
  /** vista ridotta (confronto dei livelli): niente ombre, comandi e cubo */
  semplice?:boolean;
  /** chiave del progetto per le immagini salvate per la relazione */
  chiaveViste?:string|undefined};
function colors(){const css=getComputedStyle(document.documentElement);const get=(name:string,riserva:string)=>css.getPropertyValue(name).trim()||riserva;return {terra:get("--viewer-terra","#875b32"),surface:get("--viewer-surface","#d7e0e5"),roof:get("--viewer-roof","#718e9d"),metal:get("--viewer-metal","#f27d2b"),grid:get("--viewer-grid","#93a7b3"),exposed:get("--viewer-exposed","#dc4545"),protected:get("--viewer-protected","#28a861"),maglia:get("--viewer-maglia","#2b7de9"),accent:get("--accent","#f39b00"),
  parete:get("--viewer-parete","#e9edf0"),tetto:get("--viewer-tetto","#b5c2ca"),falde:get("--viewer-falde","#b3654a"),impianto:get("--viewer-impianto","#6d7f8c"),spigolo:get("--viewer-spigolo","#3c4a54"),terreno:get("--viewer-terreno","#c6d0c2"),cieloAlto:get("--viewer-cielo-alto","#cfe3f1"),cieloBasso:get("--viewer-cielo-basso","#f4f7f9"),cemento:get("--viewer-cemento","#a7abae")};}
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
    // percorso completo da 4 s (un lato) fino a 45 s (tutto l'edificio), con movimento continuo tra un punto e l'altro
    const DURATA=Math.max(4,Math.min(45,centri.length*.03));const n=centri.length-1; // percorso su tutto l'edificio: più lungo, la sfera va a velocità leggibile
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
type PrefVista={ombre:boolean;sole:"auto"|"ora";ora:number;terreno:"griglia"|"terreno"|"satellite";spigoli:boolean;raggiX:boolean;etichette:boolean;sezione:"no"|"orizzontale"|"ns"|"eo";taglio:number;evidenzia:boolean};
const PREF:PrefVista={ombre:true,sole:"auto",ora:11,terreno:"griglia",spigoli:true,raggiX:false,etichette:false,sezione:"no",taglio:.5,evidenzia:true};
const CHIAVE_PREF="lps-vista3d";
function leggiPref():PrefVista{try{const v=JSON.parse(localStorage.getItem(CHIAVE_PREF)??"null") as Partial<PrefVista>|null;return {...PREF,...(v??{})};}catch{return PREF;}}
const btn="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border bg-background/90 px-2 text-xs font-semibold shadow-sm hover:bg-accent hover:text-accent-foreground";
export default function ViewerEdificio(props:Props){
  const [c,setC]=useState<ReturnType<typeof colors>|null>(null);const [trascina,setTrascina]=useState<string|null>(null);const [punti,setPunti]=useState<Punto3[]>([]);const [ready,setReady]=useState(false);const [deltaCorpo,setDeltaCorpo]=useState<{id:string;d:[number,number]}|null>(null);const presa=useRef<{id:string;piano:THREE.Plane;p0:THREE.Vector3}|null>(null);const ctrlRef=useRef<{enabled:boolean}|null>(null);
  const [pref,setPrefStato]=useState<PrefVista>(PREF);const [richiesta,setRichiesta]=useState<RichiestaCamera|null>(null);const [stato,setStato]=useState("");const [viste,setViste]=useState<(Vista3D&{url:string})[]>([]);const [didascalia,setDidascalia]=useState("Vista 3D dell'edificio con l'impianto di protezione contro i fulmini");
  const barra=useRef<HTMLDivElement|null>(null),testoScala=useRef<HTMLSpanElement|null>(null),scatta=useRef<((tipo:"image/png"|"image/jpeg")=>Promise<Blob|null>)|null>(null),nRich=useRef(0),camRef=useRef<THREE.Camera|null>(null),targetRef=useRef<THREE.Vector3|null>(null);
  const semplice=!!props.semplice;
  useEffect(()=>{setC(colors());if(!semplice)setPrefStato(leggiPref());const o=new MutationObserver(()=>setC(colors()));o.observe(document.documentElement,{attributes:true,attributeFilter:["class","data-theme","style"]});return ()=>o.disconnect();},[semplice]);
  const setPref=(p:Partial<PrefVista>)=>setPrefStato((v)=>{const n={...v,...p};try{localStorage.setItem(CHIAVE_PREF,JSON.stringify(n));}catch{/* senza memoria del browser */}return n;});
  const lim=limitiModello(props.modello);const b:Limiti3D=useMemo(()=>({minX:Number.isFinite(lim.minX)?lim.minX:0,maxX:Number.isFinite(lim.maxX)?lim.maxX:20,minY:Number.isFinite(lim.minY)?lim.minY:0,maxY:Number.isFinite(lim.maxY)?lim.maxY:20,H:Number.isFinite(lim.H)?Math.max(lim.H,1):10}),[lim.minX,lim.maxX,lim.minY,lim.maxY,lim.H]);
  // nuova inquadratura solo quando cambiano i blocchi (importazione, nuovo corpo), non quando si spostano o si modificano
  const chiaveLimiti=props.modello.corpi.map((k)=>k.id).join("|");
  const vai=useCallback((v:VistaPredefinita,subito=false)=>{const x=vistaCamera(b,v);setRichiesta({n:++nRich.current,posizione:x.posizione,obiettivo:x.obiettivo,subito});},[b]);
  // inquadratura iniziale e quando cambiano molto le dimensioni dell'edificio (non a ogni modifica)
  useEffect(()=>{vai(props.alto?"pianta":"assonometria",nRich.current===0);},[chiaveLimiti]); // eslint-disable-line react-hooks/exhaustive-deps
  const primoAlto=useRef(true);useEffect(()=>{if(primoAlto.current){primoAlto.current=false;return;}vai(props.alto?"pianta":"assonometria");},[props.alto]); // eslint-disable-line react-hooks/exhaustive-deps
  const clip=useMemo(()=>{if(semplice||pref.sezione==="no")return [] as THREE.Plane[];const t=pref.taglio;if(pref.sezione==="orizzontale")return [new THREE.Plane(new THREE.Vector3(0,-1,0),.05+t*(b.H+.5))];if(pref.sezione==="ns")return [new THREE.Plane(new THREE.Vector3(-1,0,0),b.minX+t*(b.maxX-b.minX))];return [new THREE.Plane(new THREE.Vector3(0,0,-1),-(b.minY+t*(b.maxY-b.minY)))];},[semplice,pref.sezione,pref.taglio,b]);
  const ombre=!semplice&&pref.ombre;
  const stile:StileScena=useMemo(()=>({spigoli:pref.spigoli,raggiX:!semplice&&pref.raggiX,ombre,clip}),[pref.spigoli,pref.raggiX,semplice,ombre,clip]);
  const sole=useMemo(()=>{if(pref.sole==="auto")return {azimut:215,elevazione:48};return posizioneSole(props.modello.origineGeo?.lat??44,giornoDellAnno(new Date()),pref.ora);},[pref.sole,pref.ora,props.modello.origineGeo?.lat]);
  const impianti=useMemo(()=>corpiInCopertura(props.modello.corpi),[props.modello.corpi]);
  const onStato=useCallback((m:string)=>setStato(m),[]);
  const caricaViste=useCallback(async()=>{if(!props.chiaveViste)return;const l=await visteRelazione(props.chiaveViste);setViste((prima)=>{prima.forEach((v)=>URL.revokeObjectURL(v.url));return l.map((v)=>({...v,url:URL.createObjectURL(v.immagine)}));});},[props.chiaveViste]);
  useEffect(()=>{if(!semplice)void caricaViste();},[caricaViste,semplice]);
  if(!c)return <div className="viewer-canvas bg-secondary"/>;
  // durante il trascinamento di un blocco si muovono con lui (a vista) i blocchi appoggiati e le aste sulla copertura
  const trascinato=deltaCorpo?props.modello.corpi.find((k)=>k.id===deltaCorpo.id):undefined;const zT=trascinato?(trascinato.quotaBase??0)+trascinato.altezzaGronda:0;
  const dentro=(x:number,y:number)=>!!trascinato&&puntoInPoligono(x,y,trascinato.impronta);
  const insieme=new Set(trascinato?props.modello.corpi.filter((k)=>k.id!==trascinato.id&&(k.quotaBase??0)>=zT-.5&&dentro(etichettaCorpo(k).p[0],etichettaCorpo(k).p[1])).map((k)=>k.id):[]);
  const asteInsieme=new Set(trascinato?props.aste.filter((a)=>a.z>=zT-.5&&dentro(a.x,a.y)).map((a)=>a.id):[]);
  function sposta(e:ThreeEvent<PointerEvent>){const pr=presa.current;if(pr){e.stopPropagation();const v=new THREE.Vector3();if(!e.ray.intersectPlane(pr.piano,v))return;const k=props.modello.corpi.find((x)=>x.id===pr.id);if(!k)return;setDeltaCorpo({id:pr.id,d:agganciaSpostamento(k,props.modello.corpi,v.x-pr.p0.x,-(v.z-pr.p0.z))});return;}
    if(!trascina||!props.onTrascina)return;e.stopPropagation();props.onTrascina(trascina,[e.point.x,-e.point.z,e.point.y]);}
  const fine=()=>{if(ctrlRef.current)ctrlRef.current.enabled=true;if(trascina)setTrascina(null);const pr=presa.current;if(pr){presa.current=null;const d=deltaCorpo?.id===pr.id?deltaCorpo.d:null;setDeltaCorpo(null);if(d&&(d[0]||d[1]))props.onSpostaCorpo?.(pr.id,d[0],d[1]);}};
  const clicCorpo=(id:string)=>(e:ThreeEvent<MouseEvent>)=>{if(props.spostabile&&props.onSeleziona){e.stopPropagation();props.onSeleziona({tipo:"corpo",id});return;}click(e);};
  /** ferma subito la rotazione della vista (prima che React aggiorni i controlli) */
  const bloccaVista=()=>{if(ctrlRef.current)ctrlRef.current.enabled=false;};
  // un solo gesto: in «Seleziona e sposta» premere su un blocco lo seleziona e lo trascina subito (la vista non ruota)
  const presaCorpo=(id:string)=>(e:ThreeEvent<PointerEvent>)=>{if(!props.spostabile||!props.onSpostaCorpo||e.button!==0)return;e.stopPropagation();bloccaVista();if(!selez("corpo",id))props.onSeleziona?.({tipo:"corpo",id});presa.current={id,piano:new THREE.Plane(new THREE.Vector3(0,1,0),-e.point.y),p0:e.point.clone()};setDeltaCorpo({id,d:[0,0]});};
  const sel=(tipo:"asta"|"conduttore"|"picchetto",id:string)=>(e:ThreeEvent<MouseEvent>)=>{if(!props.onSeleziona)return;e.stopPropagation();props.onSeleziona({tipo,id});};
  const selez=(tipo:string,id:string)=>props.selezione?.tipo===tipo&&props.selezione.id===id;
  function click(e:ThreeEvent<MouseEvent>){e.stopPropagation();const p:Punto3=[e.point.x,-e.point.z,e.point.y];props.onPunto(p);if(props.misura)setPunti((prev)=>prev.length===1?[...prev,p]:[p]);}
  /** doppio clic: centra la vista sul punto, con la stessa distanza */
  function doppio(e:ThreeEvent<MouseEvent>){e.stopPropagation();const cam=camRef.current,t=targetRef.current;if(!cam||!t)return;const off=cam.position.clone().sub(t);setRichiesta({n:++nRich.current,posizione:[e.point.x+off.x,e.point.y+off.y,e.point.z+off.z],obiettivo:[e.point.x,e.point.y,e.point.z]});}
  function inquadraSelezione(){const s=props.selezione;if(!s){setStato("Seleziona prima un blocco, un'asta, un conduttore o un dispersore con «Seleziona e sposta».");return;}let p:THREE.Vector3|null=null;
    if(s.tipo==="asta"){const a=props.aste.find((x)=>x.id===s.id);if(a)p=new THREE.Vector3(a.x,a.z+a.altezza/2,-a.y);}
    else if(s.tipo==="conduttore"){const k=props.conduttori.find((x)=>x.id===s.id);const q=k?.punti[Math.floor((k.punti.length-1)/2)];if(q)p=new THREE.Vector3(q[0],q[2],-q[1]);}
    else if(s.tipo==="corpo"){const k=props.modello.corpi.find((x)=>x.id===s.id);if(k){const e=etichettaCorpo(k);p=new THREE.Vector3(e.p[0],e.p[2]/2,-e.p[1]);}}
    else{const k=(props.picchetti??[]).find((x)=>x.id===s.id);if(k)p=new THREE.Vector3(k.x,k.z??0,-k.y);}
    const cam=camRef.current,t=targetRef.current;if(!p||!cam||!t)return;const dir=cam.position.clone().sub(t).normalize().multiplyScalar(9);setRichiesta({n:++nRich.current,posizione:[p.x+dir.x,p.y+dir.y,p.z+dir.z],obiettivo:[p.x,p.y,p.z]});}
  async function salvaPng(){const bl=await scatta.current?.("image/png");if(!bl)return;const u=URL.createObjectURL(bl),a=document.createElement("a");a.href=u;a.download=`vista-3d-${new Date().toISOString().slice(0,16).replace(/[:T]/g,"-")}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
  async function perRelazione(){if(!props.chiaveViste)return;const bl=await scatta.current?.("image/jpeg");if(!bl)return;try{await salvaVista3D(props.chiaveViste,bl,didascalia.trim()||"Vista 3D dell'edificio");setStato("Vista salvata: entra nella relazione tecnica (Computo materiali → Relazione tecnica Word).");await caricaViste();}catch{setStato("Non riesco a salvare la vista su questo dispositivo.");}}
  const a=punti[0],bb=punti[1];const misura=a&&bb?{d:Math.hypot(a[0]-bb[0],a[1]-bb[1],a[2]-bb[2]),o:Math.hypot(a[0]-bb[0],a[1]-bb[1]),h:bb[2]-a[2]}:null;
  const origine=props.modello.origineGeo;
  const fogNear=Math.max(b.maxX-b.minX,b.maxY-b.minY,b.H,20)*4;
  return <div>
  <div className="relative" data-scene-ready={ready?"true":undefined}>
    <div className="viewer-canvas overflow-hidden rounded-md" style={{background:`linear-gradient(180deg, ${c.cieloAlto} 0%, ${c.cieloBasso} 100%)`}}>
    <Canvas shadows={!semplice} dpr={[1,2]} gl={{antialias:true,alpha:true}} onPointerUp={fine} onPointerLeave={fine} onPointerMissed={()=>{fine();}} frameloop={props.anima?"always":"demand"} camera={{position:[40,35,40],near:.1,far:20000,fov:50}} onCreated={(st)=>{st.gl.localClippingEnabled=true;st.gl.toneMapping=THREE.ACESFilmicToneMapping;camRef.current=st.camera;setReady(true);}}>
      <fog attach="fog" args={[c.cieloBasso,fogNear,fogNear*5]}/>
      <Luci b={b} sole={sole} ombre={ombre} c={c}/>
      <OrbitControls makeDefault enabled={!trascina&&!deltaCorpo} enableDamping={false} ref={(o)=>{targetRef.current=o?o.target:null;ctrlRef.current=o;}}/>
      <ControlloCamera richiesta={richiesta}/>
      {!semplice&&<ScalaGrafica barra={barra} testo={testoScala}/>}
      {!semplice&&<Fotografo scatta={scatta} c={c}/>}
      <Terreno b={b} modo={semplice?"griglia":pref.terreno==="satellite"&&!origine?"griglia":pref.terreno} c={c} s={stile} origine={origine} onStato={onStato} onClick={click} onMove={sposta} onDoppio={doppio}/>
      <Bvh firstHitOnly>
      {props.modello.corpi.map((body)=>{const off=deltaCorpo&&(deltaCorpo.id===body.id||(props.spostaConImpianto!==false&&insieme.has(body.id)))?deltaCorpo.d:null;return <group key={body.id} position={off?[off[0],0,-off[1]]:[0,0,0]}><CorpoMesh corpo={body} impianto={impianti.has(body.id)} c={c} s={stile} selezionato={selez("corpo",body.id)} onClick={clicCorpo(body.id)} onMove={sposta} onDoppio={doppio} onGiu={presaCorpo(body.id)}/></group>;})}
      </Bvh>
      {props.aste.map((x0)=>{const o=deltaCorpo&&props.spostaConImpianto!==false&&asteInsieme.has(x0.id)?deltaCorpo.d:([0,0] as [number,number]);const x={...x0,x:x0.x+o[0],y:x0.y+o[1]};return <Line key={`l-${x.id}`} points={[[x.x,x.z,-x.y],[x.x,x.z+x.altezza,-x.y]]} color={selez("asta",x.id)?c.accent:pref.evidenzia||semplice?c.metal:"#aeb5bb"} lineWidth={selez("asta",x.id)?5:3}/>;})}
      {props.aste.map((x)=>{const on=selez("asta",x.id);const off=deltaCorpo&&props.spostaConImpianto!==false&&asteInsieme.has(x.id)?deltaCorpo.d:null;return <Asta3D key={x.id} a={off?{...x,x:x.x+off[0],y:x.y+off[1]}:x} on={on} evidenzia={pref.evidenzia} c={c} ombra={ombre} onClick={sel("asta",x.id)} onPointerDown={(e)=>{if(props.spostabile&&props.onTrascina&&e.button===0){e.stopPropagation();bloccaVista();if(!on)props.onSeleziona?.({tipo:"asta",id:x.id});setTrascina(x.id);}}}/>;})}
      {props.suggerite.map((x)=><mesh key={x.id} position={[x.x,x.z+x.altezza/2,-x.y]}><cylinderGeometry args={[Math.max(.08,x.diametro/2),Math.max(.08,x.diametro/2),x.altezza,8]}/><meshStandardMaterial color={c.accent} transparent opacity={.7}/></mesh>)}
      <ConduttoriTubi conduttori={props.conduttori} c={c} ombra={ombre} evidenzia={pref.evidenzia&&!semplice}/>
      {props.conduttori.map((line)=>{const on=selez("conduttore",line.id);return <Line key={line.id} onClick={sel("conduttore",line.id)} points={line.punti.map((p)=>[p[0],p[2]+.01,-p[1]] as [number,number,number])} color={on?c.accent:line.tipo==="terra"?c.terra:pref.evidenzia||semplice?c.metal:coloreMateriale(line.materiale,line.tipo)} depthTest={line.tipo!=="terra"} renderOrder={line.tipo==="terra"?2:0} lineWidth={on?6:2}/>;})}
      {!semplice&&<Componenti3D supporti={props.supporti??[]} morsetti={props.morsetti??[]} c={c} ombra={ombre}/>}
      {(props.picchetti??[]).map((p,i)=>{const on=!!p.id&&selez("picchetto",p.id);return <group key={`picchetto-${p.id??i}`}><Picchetto3D x={p.x} y={p.y} z={p.z??0} lunghezza={p.lunghezza} diametro={p.diametro??.02} c={c}/><Line {...(p.id?{onClick:sel("picchetto",p.id)}:{})} points={[[p.x,p.z??0,-p.y],[p.x,(p.z??0)-p.lunghezza,-p.y]]} color={on?c.accent:c.terra} depthTest={false} renderOrder={2} lineWidth={on?7:3}/></group>;})}
      {(props.trattiColorati??[]).map((t,i)=><Line key={`sep-${i}`} points={[[t.a[0],t.a[2]+.09,-t.a[1]],[t.b[0],t.b[2]+.09,-t.b[1]]]} color={t.colore} lineWidth={6}/>)}
      {(props.etichette??[]).map((t,i)=><Html key={`et-${i}`} position={[t.p[0],t.p[2]+.5,-t.p[1]]} center style={{pointerEvents:"none"}}><div style={{background:"var(--background)",color:t.colore,border:`1px solid ${t.colore}`,borderRadius:4,padding:"1px 5px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{t.testo}</div></Html>)}
      {!semplice&&pref.etichette&&props.modello.corpi.slice(0,60).map((k)=>{const e=etichettaCorpo(k);return <Html key={`corpo-${k.id}`} position={[e.p[0],e.p[2]+.8,-e.p[1]]} center style={{pointerEvents:"none"}}><div style={{background:"var(--card)",color:"var(--foreground)",border:"1px solid var(--border)",borderRadius:4,padding:"1px 6px",fontSize:11,whiteSpace:"nowrap",boxShadow:"0 1px 3px rgba(0,0,0,.15)"}}>{e.testo}</div></Html>;})}
      {props.propostaTerra&&<group>{props.propostaTerra.conduttori.map((line,i)=><Line key={`terra-${i}`} points={line.punti.map((p)=>[p[0],p[2],-p[1]] as [number,number,number])} color={c.terra} depthTest={false} renderOrder={2} lineWidth={3} dashed dashSize={.4} gapSize={.2}/>)}{props.propostaTerra.picchetti.map((p,i)=><Line key={`picchetto-preview-${i}`} points={[[p.x,p.z??0,-p.y],[p.x,(p.z??0)-p.lunghezza,-p.y]]} color={c.terra} depthTest={false} renderOrder={2} lineWidth={4}/>)}{props.propostaTerra.morsetti.map((p,i)=><mesh key={`morsetto-terra-${i}`} position={[p.x,p.z,-p.y]}><sphereGeometry args={[.15,8,6]}/><meshBasicMaterial color={c.terra}/></mesh>)}</group>}
      {props.proposta&&<Proposta p={props.proposta} c={c}/>}
      {props.particolari&&props.particolari.length>0&&<MarcatoriParticolari marcatori={props.particolari} onSeleziona={(id)=>{props.onParticolare?.(id);}}/>}
      {props.risultato&&<><CelleCopertura r={props.risultato} combinata={props.combinata} c={c}/><FacceEsposte r={props.risultato} c={c}/>{props.mostraMaglie&&props.maglia&&<Maglie rm={props.maglia} r={props.risultato} c={c} evidenziata={props.magliaEvidenziata}/>}{props.mostraInviluppo&&props.inviluppo&&<Inviluppo inv={props.inviluppo} c={c}/>}<Sfera r={props.risultato} anima={props.anima} centri={props.centriSfera} posizione={props.posizioneSfera} color={c.metal}/></>}
      {a&&<mesh position={[a[0],a[2]+.1,-a[1]]}><sphereGeometry args={[.12,12,8]}/><meshBasicMaterial color={c.accent}/></mesh>}
      {bb&&<mesh position={[bb[0],bb[2]+.1,-bb[1]]}><sphereGeometry args={[.12,12,8]}/><meshBasicMaterial color={c.accent}/></mesh>}
      {a&&bb&&<Line points={[[a[0],a[2]+.1,-a[1]],[bb[0],bb[2]+.1,-bb[1]]]} color={c.accent} lineWidth={3}/>}
      {!semplice&&<GizmoHelper alignment="bottom-right" margin={[56,56]}><GizmoViewcube faces={["EST","OVEST","ALTO","BASSO","SUD","NORD"]} font="bold 24px Inter, Arial, sans-serif" color="#ffffff" hoverColor={c.accent} textColor="#1f2a33" strokeColor="#41525d" opacity={1}/></GizmoHelper>}
    </Canvas></div>
    {!semplice&&<div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start gap-1">
      <div className="pointer-events-auto flex flex-wrap gap-1" role="group" aria-label="Viste">
        <button type="button" className={btn} title="Assonometria" aria-label="Assonometria" onClick={()=>vai("assonometria")}><Box className="h-4 w-4"/></button>
        <button type="button" className={btn} title="Pianta (dall'alto)" aria-label="Pianta" onClick={()=>vai("pianta")}><Square className="h-4 w-4"/></button>
        {(["nord","sud","est","ovest"] as const).map((v)=><button key={v} type="button" className={btn} title={`Prospetto ${v}`} aria-label={`Prospetto ${v}`} onClick={()=>vai(v)}>{v==="ovest"?"O":v[0]!.toUpperCase()}</button>)}
        <button type="button" className={btn} title="Inquadra tutto" aria-label="Inquadra tutto" onClick={()=>vai("assonometria")}><Maximize className="h-4 w-4"/></button>
        <button type="button" className={btn} title="Inquadra la selezione" aria-label="Inquadra la selezione" onClick={inquadraSelezione}><Crosshair className="h-4 w-4"/></button>
      </div>
      {props.spostabile&&!deltaCorpo&&<div className="pointer-events-none rounded-md border border-primary bg-background/95 px-2 py-1 text-xs font-semibold shadow-sm">Trascina un blocco o un'asta per spostarlo · clic per il pannello</div>}
      {deltaCorpo&&<div className="pointer-events-auto rounded-md border bg-background/95 px-2 py-1 font-mono text-xs shadow-sm">Sposto il blocco: Δx {deltaCorpo.d[0].toFixed(2)} m · Δy {deltaCorpo.d[1].toFixed(2)} m</div>}
      {misura&&<div className="pointer-events-auto rounded-md border bg-background/95 px-2 py-1 font-mono text-xs shadow-sm">{misura.d.toFixed(2)} m · orizz. {misura.o.toFixed(2)} m · Δh {misura.h>=0?"+":""}{misura.h.toFixed(2)} m</div>}
    </div>}
    {!semplice&&<div className="pointer-events-none absolute bottom-2 left-2 flex flex-col items-start gap-0.5 rounded bg-background/80 px-2 py-1 text-[11px] font-semibold shadow-sm"><span ref={testoScala}>–</span><div ref={barra} className="h-1.5 border-x-2 border-b-2 border-foreground" style={{width:60}}/></div>}
    {!semplice&&pref.terreno==="satellite"&&origine&&<div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-background/70 px-1 text-[10px]">Foto: Esri, Maxar, Earthstar Geographics</div>}
  </div>
  {!semplice&&<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-card px-3 py-2 text-sm">
    <span className="font-semibold">Vista</span>
    <label className="flex items-center gap-1.5"><input type="checkbox" checked={pref.ombre} onChange={(e)=>setPref({ombre:e.target.checked})}/>Ombre</label>
    <label className="flex items-center gap-1.5">Sole <select aria-label="Sole" className="h-8 max-w-[11rem] rounded-md border bg-background px-1" value={pref.sole} onChange={(e)=>setPref({sole:e.target.value as PrefVista["sole"]})}><option value="auto">da sud-ovest</option><option value="ora">ora di oggi</option></select></label>
    {pref.sole==="ora"&&<label className="flex items-center gap-1.5"><input type="range" aria-label="Ora del giorno" min={6} max={20} step={.25} value={pref.ora} onChange={(e)=>setPref({ora:Number(e.target.value)})} className="w-28"/><span className="font-mono text-xs">{Math.floor(pref.ora)}:{String(Math.round((pref.ora%1)*60)).padStart(2,"0")}</span>{sole.elevazione<5&&<span className="text-xs text-muted-foreground">(sole basso)</span>}</label>}
    <label className="flex items-center gap-1.5">Terreno <select aria-label="Terreno" className="h-8 max-w-[11rem] rounded-md border bg-background px-1" value={pref.terreno} onChange={(e)=>{setStato("");setPref({terreno:e.target.value as PrefVista["terreno"]});}}><option value="griglia">con griglia</option><option value="terreno">semplice</option><option value="satellite" disabled={!origine} title={origine?"":"Serve l'edificio importato dalla mappa (con le coordinate)"}>foto satellitare</option></select></label>
    <label className="flex items-center gap-1.5"><input type="checkbox" checked={pref.spigoli} onChange={(e)=>setPref({spigoli:e.target.checked})}/>Spigoli</label>
    <label className="flex items-center gap-1.5"><input type="checkbox" checked={pref.raggiX} onChange={(e)=>setPref({raggiX:e.target.checked})}/>Edificio trasparente</label>
    <label className="flex items-center gap-1.5" title="Togli la spunta per vedere i colori reali dei materiali (alluminio, rame, acciaio, isCon)"><input type="checkbox" checked={pref.evidenzia} onChange={(e)=>setPref({evidenzia:e.target.checked})}/>Impianto in arancio</label>
    <label className="flex items-center gap-1.5"><input type="checkbox" checked={pref.etichette} onChange={(e)=>setPref({etichette:e.target.checked})}/>Nomi e altezze dei corpi</label>
    <label className="flex items-center gap-1.5">Sezione <select aria-label="Sezione" className="h-8 max-w-[11rem] rounded-md border bg-background px-1" value={pref.sezione} onChange={(e)=>setPref({sezione:e.target.value as PrefVista["sezione"]})}><option value="no">nessuna</option><option value="orizzontale">taglio orizzontale</option><option value="ns">verticale nord-sud</option><option value="eo">verticale est-ovest</option></select></label>
    {pref.sezione!=="no"&&<input type="range" aria-label="Posizione della sezione" min={0} max={1} step={.01} value={pref.taglio} onChange={(e)=>setPref({taglio:Number(e.target.value)})} className="w-32"/>}
    <span className="text-xs text-muted-foreground">Doppio clic: centra la vista sul punto. Cubo in basso a destra: clic su una faccia.</span>
    <div className="flex w-full flex-wrap items-center gap-2 border-t pt-2">
      <button type="button" className={btn} onClick={()=>void salvaPng()}><Download className="h-4 w-4"/>Salva immagine (PNG)</button>
      {props.chiaveViste&&<><input aria-label="Didascalia della vista per la relazione" className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs sm:max-w-md" value={didascalia} onChange={(e)=>setDidascalia(e.target.value)}/><button type="button" className={btn} onClick={()=>void perRelazione()}><FileImage className="h-4 w-4"/>Usa nella relazione</button></>}
      {viste.length>0&&<div className="flex w-full flex-wrap items-center gap-2 text-xs"><IconaCamera className="h-4 w-4"/><span>Viste per la relazione ({viste.length}):</span>{viste.map((v)=><span key={v.id} className="flex items-center gap-1 rounded border px-1 py-0.5"><img src={v.url} alt={v.didascalia} className="h-8 w-12 rounded object-cover"/><span className="max-w-40 truncate" title={v.didascalia}>{v.didascalia}</span><button type="button" className="text-muted-foreground underline" onClick={()=>void togliDallaRelazione(v.id).then(caricaViste)}>Togli</button></span>)}</div>}
    </div>
    {stato&&<p role="status" className="w-full text-xs text-muted-foreground">{stato}</p>}
  </div>}
  </div>;
}
