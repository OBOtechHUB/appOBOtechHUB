import { massimo, minimo } from "@/lib/estremi";
import { risorsa } from "@/lib/base";
import { corpoSchema,modelloSchema,type Corpo,type ModelloEdificio } from "@/calcoli/edificio/tipi";
import {locale} from "@/calcoli/edificio/geometria";
import {unitaDaInsunits,type Unita} from "@/calcoli/importazione/scala";
import {letturaDaPolilinee,type LetturaCad} from "@/lib/letturaCad";
import type {PoliCad,TestoCad} from "@/calcoli/importazione/analisiPianta";
import {spostaEntita,trattiDaEntita,type EntitaCad} from "@/calcoli/importazione/contorni";
/** DXF: polilinee (chiuse = impronte), testi (altezze e nomi) e unità dichiarata; `scala` moltiplica le coordinate dei corpi. */
export async function leggiDXF(file:File,scala:number):Promise<LetturaCad>{const {default:DxfParser}=await import("dxf-parser");const data=new DxfParser().parseSync(await file.text());if(!data)throw new Error("DXF non leggibile.");
  type Ent={type:string;layer?:string;shape?:boolean;vertices?:{x:number;y:number}[];text?:string;startPoint?:{x:number;y:number};position?:{x:number;y:number}};
  const ent=data.entities as unknown as Ent[];
  const blocchi:Record<string,EntitaCad[]>={};for(const [k,b] of Object.entries((data as unknown as {blocks?:Record<string,{entities?:EntitaCad[];position?:{x:number;y:number}}>}).blocks??{})){const bp=b.position;blocchi[k]=(b.entities??[]).map((e)=>bp&&(bp.x||bp.y)?spostaEntita(e,-bp.x,-bp.y):e);}
  const poli:PoliCad[]=trattiDaEntita(ent as unknown as EntitaCad[],blocchi,{rotazioneInGradi:true});
  if(!poli.length)throw new Error("Nel DXF non ci sono linee o polilinee nello spazio modello: forse il disegno è solo nello spazio carta o è un'immagine. Prova a esportarlo di nuovo, oppure importa il PDF della pianta.");
  const testi:TestoCad[]=ent.filter((e)=>(e.type==="TEXT"||e.type==="MTEXT")&&typeof e.text==="string").flatMap((e)=>{const p=e.startPoint??e.position;return p?[{layer:e.layer||"0",x:p.x,y:p.y,testo:e.text??""}]:[];});
  const header=(data as unknown as {header?:Record<string,unknown>}).header??{};
  const base=letturaDaPolilinee(poli,unitaDaInsunits(header["$INSUNITS"]),"DXF",testi);
  return scala===1?base:{...base,corpi:(layer:string)=>base.corpi(layer).map((c)=>({...c,impronta:c.impronta.map((p)=>[p[0]*scala,p[1]*scala] as [number,number])}))};
}
export async function leggiKML(file:File):Promise<ModelloEdificio>{const xml=new DOMParser().parseFromString(await file.text(),"application/xml");if(xml.querySelector("parsererror"))throw new Error("KML non valido.");const polygons=[...xml.getElementsByTagName("Polygon")];let origine:{lat:number;lon:number}|undefined;
  const corpi:Corpo[]=polygons.map((poly,i)=>{const coords=poly.getElementsByTagName("coordinates")[0]?.textContent?.trim().split(/\s+/).map((s)=>s.split(",").map(Number))??[];const first=coords[0];if(!first||first[0]===undefined||first[1]===undefined)throw new Error("Poligono KML senza coordinate.");origine??={lat:first[1],lon:first[0]};const o=origine;let impronta=coords.map((p)=>locale(p[1]??0,p[0]??0,o));if(impronta.length>3&&JSON.stringify(impronta[0])===JSON.stringify(impronta.at(-1)))impronta=impronta.slice(0,-1);return corpoSchema.parse({id:crypto.randomUUID(),nome:`KML ${i+1}`,impronta,quotaBase:0,altezzaGronda:0,tipoTetto:"piano",altezzaColmo:0});});
  if(!corpi.length)throw new Error("Nessun poligono nel KML.");return modelloSchema.parse({corpi,origineGeo:origine});
}
export async function leggiCADJSON(file:File){const data=JSON.parse(await file.text());return modelloSchema.parse(data.edificio??data);}
export async function leggiMesh(files:File[],scala:number,verticaleZ=false):Promise<Corpo>{
  if(typeof window==="undefined")throw new Error("Importazione 3D disponibile solo nel browser.");
  const THREE=await import("three");const main=files.find((f)=>ESTENSIONI_3D.test(f.name));if(!main)throw new Error("Seleziona OBJ, STL, PLY, GLB, GLTF, IFC, STEP o IGES.");if(main.size>50000000)throw new Error("Modello oltre 50 MB.");
  let object:InstanceType<typeof THREE.Object3D>|undefined;
  if(/\.obj$/i.test(main.name)){const {OBJLoader}=await import("three/examples/jsm/loaders/OBJLoader.js");object=new OBJLoader().parse(await main.text());}
  else if(/\.stl$/i.test(main.name)){const {STLLoader}=await import("three/examples/jsm/loaders/STLLoader.js");object=new THREE.Mesh(new STLLoader().parse(await main.arrayBuffer()));}
  else if(/\.ply$/i.test(main.name)){const {PLYLoader}=await import("three/examples/jsm/loaders/PLYLoader.js");object=new THREE.Mesh(new PLYLoader().parse(await main.arrayBuffer()));}
  else if(/\.(step|stp|iges|igs)$/i.test(main.name)){
    // STEP e IGES: triangolati con OpenCascade, coordinate in millimetri
    const {leggiStep,leggiIges}=await import("@/lib/leggiStep");const meshes=/\.(iges|igs)$/i.test(main.name)?await leggiIges(await main.arrayBuffer(),main.name):await leggiStep(await main.arrayBuffer(),main.name);
    const g=new THREE.Group();for(const m of meshes){const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(Array.from(m.posizioni),3));if(m.indici)geometry.setIndex(Array.from(m.indici));g.add(new THREE.Mesh(geometry));}object=g;
  }
  else if(/\.gltf?$|\.glb$/i.test(main.name)){
    const {GLTFLoader}=await import("three/examples/jsm/loaders/GLTFLoader.js");const manager=new THREE.LoadingManager();const urls=new Map<string,string>();files.forEach((f)=>urls.set(f.name,URL.createObjectURL(f)));manager.setURLModifier((url)=>{const key=decodeURIComponent(url.split("/").at(-1)??url);const found=urls.get(key);if(found)return found;if(url.startsWith("data:"))return url;throw new Error(`Risorsa GLTF mancante: ${key}`);});
    try {object=(await new GLTFLoader(manager).parseAsync(await main.arrayBuffer(),"")).scene;}finally{urls.forEach((u)=>URL.revokeObjectURL(u));}
  }else{
    const {IfcAPI}=await import("web-ifc");const api=new IfcAPI();await api.Init(()=>new URL(risorsa("wasm/web-ifc.wasm"),window.location.origin).href,true);const id=api.OpenModel(new Uint8Array(await main.arrayBuffer()),{COORDINATE_TO_ORIGIN:true});
    object=new THREE.Group();api.StreamAllMeshes(id,(flat)=>{for(let i=0;i<flat.geometries.size();i++){const placed=flat.geometries.get(i);const geom=api.GetGeometry(id,placed.geometryExpressID);const vertices=api.GetVertexArray(geom.GetVertexData(),geom.GetVertexDataSize());const indices=api.GetIndexArray(geom.GetIndexData(),geom.GetIndexDataSize());const positions=[];for(let j=0;j<vertices.length;j+=6)positions.push(vertices[j]??0,vertices[j+1]??0,vertices[j+2]??0);const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setIndex([...indices]);const mesh=new THREE.Mesh(geometry);mesh.applyMatrix4(new THREE.Matrix4().fromArray(placed.flatTransformation));object?.add(mesh);geom.delete();}});api.CloseModel(id);
  }
  if(!object)throw new Error("Geometria non disponibile.");object.updateMatrixWorld(true);
  // tutti i triangoli in coordinate del mondo (Z in alto)
  const tri:number[]=[];const v=new THREE.Vector3();
  object.traverse((o)=>{if(!(o instanceof THREE.Mesh))return;const g=o.geometry as InstanceType<typeof THREE.BufferGeometry>;const a=g.getAttribute("position") as InstanceType<typeof THREE.BufferAttribute>|undefined;if(!a)return;const idx=g.index;const n=idx?idx.count:a.count;
    for(let k=0;k<n;k++){const i=idx?idx.getX(k):k;v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).multiplyScalar(scala);if(verticaleZ)tri.push(v.x,v.y,v.z);else tri.push(v.x,v.z,v.y);}});
  if(tri.length<9)throw new Error("Nel file non c'è geometria 3D leggibile (il modello potrebbe contenere solo dati senza forme): prova a esportarlo di nuovo dal programma BIM/CAD, oppure in OBJ, GLB o STEP.");
  const nV=tri.length/3;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  const xs=new Array<number>(nV),ys=new Array<number>(nV);
  for(let k=0;k<nV;k++){const x=tri[3*k]!,y=tri[3*k+1]!,z=tri[3*k+2]!;xs[k]=x;ys[k]=y;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;if(z<minZ)minZ=z;if(z>maxZ)maxZ=z;}
  const positions=semplificaTriangoli(tri,MAX_TRIANGOLI);for(let i=2;i<positions.length;i+=3)positions[i]=(positions[i]??0)-minZ;
  const hull=involucro(xs,ys);return corpoSchema.parse({id:crypto.randomUUID(),nome:main.name,impronta:hull.length>=3?hull:[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]],quotaBase:0,altezzaGronda:maxZ-minZ,altezzaColmo:maxZ-minZ,tipoTetto:"altro",mesh:{posizioni:positions}});
}
/** Formati 3D che si possono importare come corpo dell'edificio. */
export const ESTENSIONI_3D=/\.(obj|stl|ply|glb|gltf|ifc|step|stp|iges|igs)$/i;

/** Unità dichiarata dal formato: glTF e IFC in metri, STEP/IGES in millimetri (come li legge OpenCascade); OBJ, STL e PLY non la indicano. */
export function unitaDichiarata3D(nome:string):Unita|null{
  if(/\.(glb|gltf|ifc)$/i.test(nome))return "m";
  if(/\.(step|stp|iges|igs)$/i.test(nome))return "mm";
  return null;
}

/** Dimensioni del corpo letto con scala 1 (nell'unità del file): lunghezza, larghezza, altezza. */
export function dimensioniCorpo(c:Corpo):number[]{
  const xs=c.impronta.map((p)=>p[0]),ys=c.impronta.map((p)=>p[1]);
  return [massimo(xs)-minimo(xs),massimo(ys)-minimo(ys),c.altezzaGronda];
}

/** Applica il fattore di scala (metri per unità del file) a un corpo letto con scala 1. */
export function scalaCorpo(c:Corpo,f:number):Corpo{
  const mesh=c.mesh?{...c.mesh,posizioni:c.mesh.posizioni.map((v)=>v*f)}:undefined;
  return corpoSchema.parse({...c,impronta:c.impronta.map((p)=>[p[0]*f,p[1]*f]),quotaBase:c.quotaBase*f,altezzaGronda:c.altezzaGronda*f,altezzaColmo:c.altezzaColmo*f,...(mesh?{mesh}:{})});
}

/** Asse verticale proposto: Z per i formati CAD (STEP, IGES, STL, PLY), Y per OBJ, glTF e IFC letto da web-ifc. */
export function verticaleZProposto(nome:string):boolean{return /\.(step|stp|iges|igs|stl|ply)$/i.test(nome);}

/** Impronta in pianta di un modello 3D: involucro convesso dei vertici (più fedele del rettangolo d'ingombro). */
export function involucro(xs:number[],ys:number[]):[number,number][]{
  const passo=1;const p:[number,number][]=[];for(let i=0;i<xs.length;i+=passo)p.push([Math.round(xs[i]!*1000)/1000,Math.round(ys[i]!*1000)/1000]);
  p.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(p.length<3)return p;
  const x=(o:[number,number],a:[number,number],b:[number,number])=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo:[number,number][]=[],hi:[number,number][]=[];
  for(const q of p){while(lo.length>=2&&x(lo[lo.length-2]!,lo[lo.length-1]!,q)<=0)lo.pop();lo.push(q);}
  for(let i=p.length-1;i>=0;i--){const q=p[i]!;while(hi.length>=2&&x(hi[hi.length-2]!,hi[hi.length-1]!,q)<=0)hi.pop();hi.push(q);}
  return lo.slice(0,-1).concat(hi.slice(0,-1));
}

/** Triangoli tenuti nel modello importato: abbastanza per vedere l'edificio, leggero da salvare nel progetto. */
export const MAX_TRIANGOLI=60000;
/**
 * Semplifica una lista di triangoli (x,y,z ×3 per triangolo): unisce i vertici vicini su una griglia proporzionata
 * al modello, toglie i triangoli degeneri e doppi e, se sono ancora troppi, tiene i più grandi (tetti e pareti).
 */
export function semplificaTriangoli(tri:number[],max=MAX_TRIANGOLI):number[]{
  const n=Math.floor(tri.length/9);if(n<=max)return tri.slice(0,n*9);
  let mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<tri.length;i+=3)for(let a=0;a<3;a++){const q=tri[i+a]!;if(q<mn[a]!)mn[a]=q;if(q>mx[a]!)mx[a]=q;}
  const lato=Math.max(mx[0]!-mn[0]!,mx[1]!-mn[1]!,mx[2]!-mn[2]!,1e-6);
  let cella=lato/600;let out:number[]=[];
  for(let giro=0;giro<4;giro++){
    out=[];const visti=new Set<string>();const aree:number[]=[];
    const k=(i:number)=>`${Math.round(tri[i]!/cella)},${Math.round(tri[i+1]!/cella)},${Math.round(tri[i+2]!/cella)}`;
    for(let t=0;t<n;t++){const b=t*9;const a=k(b),c=k(b+3),d=k(b+6);if(a===c||c===d||a===d)continue;const chiave=[a,c,d].sort().join("|");if(visti.has(chiave))continue;visti.add(chiave);
      const q=(i:number)=>Math.round(tri[i]!/cella)*cella;const p=[q(b),q(b+1),q(b+2),q(b+3),q(b+4),q(b+5),q(b+6),q(b+7),q(b+8)];
      const ux=p[3]!-p[0]!,uy=p[4]!-p[1]!,uz=p[5]!-p[2]!,vx=p[6]!-p[0]!,vy=p[7]!-p[1]!,vz=p[8]!-p[2]!;aree.push(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx));for(const q of p)out.push(q);}
    if(out.length/9<=max)return out;
    if(giro===3){const ord=aree.map((a,i)=>[a,i] as const).sort((x,y)=>y[0]-x[0]).slice(0,max).map((x)=>x[1]).sort((x,y)=>x-y);const r:number[]=[];for(const i of ord)for(let j=0;j<9;j++)r.push(out[i*9+j]!);return r;}
    cella*=2;
  }
  return out;
}

