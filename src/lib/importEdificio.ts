import { risorsa } from "@/lib/base";
import { corpoSchema,modelloSchema,type Corpo,type ModelloEdificio } from "@/calcoli/edificio/tipi";
import {locale} from "@/calcoli/edificio/geometria";
import {unitaDaInsunits,type Unita} from "@/calcoli/importazione/scala";
import {letturaDaPolilinee,type LetturaCad} from "@/lib/letturaCad";
import type {PoliCad,TestoCad} from "@/calcoli/importazione/analisiPianta";
/** DXF: polilinee (chiuse = impronte), testi (altezze e nomi) e unità dichiarata; `scala` moltiplica le coordinate dei corpi. */
export async function leggiDXF(file:File,scala:number):Promise<LetturaCad>{const {default:DxfParser}=await import("dxf-parser");const data=new DxfParser().parseSync(await file.text());if(!data)throw new Error("DXF non leggibile.");
  type Ent={type:string;layer?:string;shape?:boolean;vertices?:{x:number;y:number}[];text?:string;startPoint?:{x:number;y:number};position?:{x:number;y:number}};
  const ent=data.entities as unknown as Ent[];
  const poli:PoliCad[]=ent.filter((e)=>(e.type==="LWPOLYLINE"||e.type==="POLYLINE")&&Array.isArray(e.vertices)).map((e)=>({layer:e.layer||"0",punti:(e.vertices??[]).map((v)=>[v.x,v.y] as [number,number]),chiusa:!!e.shape}));
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
  if(!object)throw new Error("Geometria non disponibile.");object.updateMatrixWorld(true);const positions:number[]=[];
  object.traverse((o)=>{if(!(o instanceof THREE.Mesh))return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry;const a=g.getAttribute("position");for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).multiplyScalar(scala);if(verticaleZ)positions.push(v.x,v.y,v.z);else positions.push(v.x,v.z,v.y);}g.dispose();});
  if(!positions.length||positions.length>3000000)throw new Error("Mesh vuota o troppo complessa.");const xs=positions.filter((_,i)=>i%3===0),ys=positions.filter((_,i)=>i%3===1),zs=positions.filter((_,i)=>i%3===2);const min=(a:number[])=>a.reduce((s,v)=>Math.min(s,v),Infinity),max=(a:number[])=>a.reduce((s,v)=>Math.max(s,v),-Infinity);const minZ=min(zs),minX=min(xs),maxX=max(xs),minY=min(ys),maxY=max(ys);for(let i=2;i<positions.length;i+=3)positions[i]=(positions[i]??0)-minZ;
  return corpoSchema.parse({id:crypto.randomUUID(),nome:main.name,impronta:[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]],quotaBase:0,altezzaGronda:max(zs)-minZ,altezzaColmo:max(zs)-minZ,tipoTetto:"altro",mesh:{posizioni:positions}});
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
  return [Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),c.altezzaGronda];
}

/** Applica il fattore di scala (metri per unità del file) a un corpo letto con scala 1. */
export function scalaCorpo(c:Corpo,f:number):Corpo{
  const mesh=c.mesh?{...c.mesh,posizioni:c.mesh.posizioni.map((v)=>v*f)}:undefined;
  return corpoSchema.parse({...c,impronta:c.impronta.map((p)=>[p[0]*f,p[1]*f]),quotaBase:c.quotaBase*f,altezzaGronda:c.altezzaGronda*f,altezzaColmo:c.altezzaColmo*f,...(mesh?{mesh}:{})});
}

/** Asse verticale proposto: Z per i formati CAD (STEP, IGES, STL, PLY), Y per OBJ, glTF e IFC letto da web-ifc. */
export function verticaleZProposto(nome:string):boolean{return /\.(step|stp|iges|igs|stl|ply)$/i.test(nome);}
