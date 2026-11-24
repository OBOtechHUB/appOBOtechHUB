import { formattaNome } from "@/lib/nomi";
import type {StatoEsteso} from "./statoProgetto";
import type {RisultatoSfera} from "@/calcoli/captazione/sferaRotolante";
import {inviluppoSuGriglia} from "@/calcoli/captazione/sferaRotolante";
import type {Punto3} from "@/calcoli/edificio/tipi";
import {ShapeUtils,Vector2} from "three";
import {generaTavola,type DatiTavola} from "@/calcoli/cad/tavolaDXF";
import {LAYER_LPS,LAYER_SFERA} from "@/calcoli/cad/standard";
import {aggiungiTavole,type ParticolareScheda} from "@/calcoli/cad/tavoleLPS";
import {pdfTavole} from "@/calcoli/cad/pdfTavole";
import parametriLPL from "@/dati/captazione/parametriLPL.json";
import distanzaCalate from "@/dati/calate/distanzaCalate.json";
import {posizioniParticolari,type ParticolareCatalogo} from "@/calcoli/particolari/posizioni";
import catalogoParticolari from "@/dati/particolari/particolari.json";

/**
 * DXF professionale (R12, metri): tavola "Pianta coperture" in scala con squadratura, legenda con codici OBO,
 * richiami ai particolari costruttivi e cartiglio; a destra della tavola il modello 3D (layer LPS-3D-*,
 * non stampati: la tavola si stampa dallo spazio modello con finestra sulla squadratura).
 */
export function generaCAD(s:StatoEsteso,progetto:{codice:string;nome:string;comune:string},sfere:Partial<Record<string,RisultatoSfera>>,opzioni:{senzaModello3D?:boolean}={}){
  // particolari costruttivi collegati ai componenti del progetto (stesso criterio della pagina Edificio 3D)
  const personali=new Map(s.particolari.map((p)=>[p.id,p]));
  const catalogo=[...(catalogoParticolari as unknown as ParticolareCatalogo[]).filter((p)=>!personali.has(p.id)),...(s.particolari as unknown as ParticolareCatalogo[])];
  const pos=posizioniParticolari(catalogo,[{origine:"progetto",supporti:s.supporti,morsetti:s.morsetti,compensatori:s.compensatori,picchetti:s.picchetti.map((p)=>({...p,tipo:"picchetto"})),aste:s.aste,distinte:[s.distinta,s.terra?.distinta]}]);
  const oggi=new Date();
  const dati:DatiTavola={
    progetto:{codice:progetto.codice,nome:progetto.nome,comune:progetto.comune,lpl:s.lpl,data:`${String(oggi.getDate()).padStart(2,"0")}/${String(oggi.getMonth()+1).padStart(2,"0")}/${oggi.getFullYear()}`,committente:s.relazione?.committente||undefined,opera:s.relazione?.titoloOpera||undefined,progettista:formattaNome(s.relazione?.tecnico)||undefined,albo:s.relazione?.albo||undefined,rev:s.emissione?.rev??s.revisioni?.at(-1)?.rev??undefined,revisioni:(s.revisioni??[]).map((r)=>({rev:r.rev,data:r.data,descrizione:r.descrizione,autore:formattaNome(r.autore)}))},
    corpi:s.modello.corpi.map((c)=>({nome:c.nome,impronta:c.impronta.map((p)=>[p[0],p[1]] as [number,number]),quotaBase:c.quotaBase,altezzaGronda:c.altezzaGronda,tipoTetto:c.tipoTetto,altezzaColmo:c.altezzaColmo})),
    aste:s.aste.map((a)=>({x:a.x,y:a.y,z:a.z,altezza:a.altezza,codiceOBO:a.codiceOBO})),
    conduttori:s.conduttori.map((c)=>({tipo:c.tipo,sottotipo:c.sottotipo,punti:c.punti,materiale:c.materiale,sezione:c.sezione,codiceOBO:c.codiceOBO})),
    supporti:s.supporti,morsetti:s.morsetti,compensatori:s.compensatori,
    picchetti:s.picchetti.map((q)=>({x:q.x,y:q.y,z:q.z,lunghezza:q.lunghezza,codiceOBO:q.codiceOBO})),
    distinta:[...s.distinta,...(s.terra?.distinta??[])],
    particolari:{marcatori:pos.marcatori.map((m)=>({idParticolare:m.idParticolare,nome:m.nomeParticolare,x:m.x,y:m.y})),usati:pos.usati.map((u)=>({idParticolare:u.idParticolare,nome:u.nome,punti:u.punti}))},
    nordInAlto:!!s.modello.origineGeo,
  };
  const lplSfere=Object.keys(sfere).filter((l)=>sfere[l]);
  const layerSfere=lplSfere.map((l)=>{const x=LAYER_SFERA(l);return {nome:x.nome,colore:x.colore,linea:"CONTINUOUS" as const,descrizione:x.descrizione};});
  dati.latoMaglia=(parametriLPL as unknown as Record<string,{latoMaglia:number}>)[s.lpl]?.latoMaglia;
  const base=generaTavola(dati,layerSfere);
  const {dxf:w,foglio,scala,formato}=base;
  // tavole 02-04 (prospetti con sfera rotolante, calate e terra, particolari) sotto la pianta coperture
  const unita=(u:string)=>u==="per_m"?"/m":u.startsWith("per_")?`/${u.slice(4)}`:u;
  type Componente={codiceOBO:string|null;descrizione?:string;quantita?:number;unitaQuantita?:string};
  const perId=new Map(catalogo.map((p)=>[p.id,p as ParticolareCatalogo&{componenti:Componente[];note?:string;bloccoCAD?:string}]));
  const schede:ParticolareScheda[]=pos.usati.map((u)=>{const p=perId.get(u.idParticolare);return {idParticolare:u.idParticolare,nome:u.nome,punti:u.punti,note:p?.note,bloccoCAD:p?.bloccoCAD,componenti:((p?.componenti as Componente[]|undefined)??[]).map((c)=>({codiceOBO:c.codiceOBO??"",descrizione:c.descrizione??"",quantita:c.quantita??1,unita:unita(c.unitaQuantita??"")}))};});
  const par=parametriLPL as unknown as Record<string,{raggio:number}>,dc=distanzaCalate as unknown as Record<string,{distanzaTipica:number}>;
  const fogli=aggiungiTavole(w,dati,base,{raggioSfera:par[s.lpl]?.raggio??45,distanzaCalate:{tipica:dc[s.lpl]?.distanzaTipica??15},particolari:schede});
  const pdf=pdfTavole(w,fogli,[...Object.values(LAYER_LPS),...layerSfere],{titolo:`Tavole LPS - ${progetto.nome||progetto.codice||"progetto"}`});

  // ---------- modello 3D a destra della tavola
  const L=LAYER_LPS;
  const xs=s.modello.corpi.flatMap((c)=>c.impronta.map((p)=>p[0])),ys=s.modello.corpi.flatMap((c)=>c.impronta.map((p)=>p[1]));
  const mx=xs.length?Math.min(...xs):0,my=ys.length?Math.min(...ys):0;
  const dx=foglio.x+foglio.larghezza+foglio.larghezza*0.1-mx,dy=foglio.y-my;
  const T=(a:Punto3):[number,number,number]=>[a[0]+dx,a[1]+dy,a[2]];
  const face=(layer:string,a:Punto3,b:Punto3,c:Punto3,d:Punto3)=>w.faccia(layer,T(a),T(b),T(c),T(d));
  w.testo(L.testi.nome,[foglio.x+foglio.larghezza*1.1,foglio.y+foglio.altezza+foglio.altezza*0.03],foglio.altezza*0.025,opzioni.senzaModello3D?"MODELLO 3D (disegnato da LPS.lsp con blocchi e codici OBO)":"MODELLO 3D (layer LPS-3D-*, da non stampare)");
  // nel pacchetto CAD edificio, aste e conduttori 3D li disegna LPS.lsp (con blocchi e codici): qui restano sfera e zone esposte
  if(!opzioni.senzaModello3D)s.modello.corpi.forEach((body)=>{
    const z=body.quotaBase+body.altezzaGronda;
    if(body.mesh){const vertices=body.mesh.posizioni,indices=body.mesh.indici??vertices.map((_,i)=>i).filter((i)=>i%3===0).map((i)=>i/3);const vertex=(i:number):Punto3=>[vertices[i*3]??0,vertices[i*3+1]??0,(vertices[i*3+2]??0)+body.quotaBase];for(let i=0;i<indices.length;i+=3){const a=vertex(indices[i]??0),b=vertex(indices[i+1]??0),c=vertex(indices[i+2]??0);face(L.edificio3d.nome,a,b,c,c);}}
    else {body.impronta.forEach((a,i)=>{const b=body.impronta[(i+1)%body.impronta.length];if(b)face(L.edificio3d.nome,[...a,body.quotaBase],[...b,body.quotaBase],[...b,z],[...a,z]);});
      if(body.tipoTetto==="falde"){const bx=body.impronta.map((p)=>p[0]),by=body.impronta.map((p)=>p[1]),x0=Math.min(...bx),x1=Math.max(...bx),y0=Math.min(...by),y1=Math.max(...by),mid=(y0+y1)/2,top=body.quotaBase+body.altezzaColmo;face(L.edificio3d.nome,[x0,y0,z],[x1,y0,z],[x1,mid,top],[x0,mid,top]);face(L.edificio3d.nome,[x0,mid,top],[x1,mid,top],[x1,y1,z],[x0,y1,z]);face(L.edificio3d.nome,[x0,y0,z],[x0,mid,top],[x0,y1,z],[x0,y1,z]);face(L.edificio3d.nome,[x1,y0,z],[x1,mid,top],[x1,y1,z],[x1,y1,z]);}
      else for(const triangle of ShapeUtils.triangulateShape(body.impronta.map((q)=>new Vector2(...q)),[])){const points=triangle.map((i)=>body.impronta[i]);const a=points[0],b=points[1],c=points[2];if(a&&b&&c)face(L.edificio3d.nome,[...a,z],[...b,z],[...c,z],[...c,z]);}
    }
  });
  if(!opzioni.senzaModello3D)s.aste.forEach((a)=>w.linea(L.captazione3d.nome,T([a.x,a.y,a.z]),T([a.x,a.y,a.z+a.altezza])));
  if(!opzioni.senzaModello3D)s.conduttori.forEach((c)=>w.poli3d(c.tipo==="calata"?L.calate3d.nome:c.tipo==="terra"?L.terra3d.nome:L.captazione3d.nome,c.punti.map(T)));
  Object.entries(sfere).forEach(([lpl,r])=>{if(!r)return;const g=r.griglia,h=g.passo/2,layer=LAYER_SFERA(lpl).nome;
    const inv=inviluppoSuGriglia(r,Math.max(1,r.raggio/10));
    for(let j=0;j+1<inv.ny;j++)for(let i=0;i+1<inv.nx;i++){const z=inv.z[j]?.[i],za=inv.z[j]?.[i+1],zb=inv.z[j+1]?.[i+1],zc=inv.z[j+1]?.[i];if(![z,za,zb,zc].every(Number.isFinite))continue;const x0=inv.x0+i*inv.passo,y0=inv.y0+j*inv.passo,x1=x0+inv.passo,y1=y0+inv.passo;face(layer,[x0,y0,z as number],[x1,y0,za as number],[x1,y1,zb as number],[x0,y1,zc as number]);}
    for(let k=0;k<r.esposta.length;k++){if(r.esposta[k]!==1)continue;const i=k%g.nx,j=Math.floor(k/g.nx),x=g.x0+i*g.passo,y=g.y0+j*g.passo,z=r.altezze[k]??0;face(L.esposto3d.nome,[x-h,y-h,z],[x+h,y-h,z],[x+h,y+h,z],[x-h,y+h,z]);}
    r.facceEsposte.forEach((f)=>{const nx=f.normale[0],ny=f.normale[1],tx=-ny,ty=nx,hl=f.lunghezza/2;face(L.esposto3d.nome,[f.x-tx*hl,f.y-ty*hl,f.zDa],[f.x+tx*hl,f.y+ty*hl,f.zDa],[f.x+tx*hl,f.y+ty*hl,f.zA],[f.x-tx*hl,f.y-ty*hl,f.zA]);});
  });
  const json={versione:2,unita:"m",tavola:{scala,formato},progetto:{...progetto,lpl:s.lpl},edificio:s.modello,aste:s.aste.map(({id,...a})=>a),conduttori:s.conduttori.map(({id,...c})=>c),supporti:s.supporti,morsetti:s.morsetti,compensatori:s.compensatori,picchetti:s.picchetti,particolari:pos.usati,sfere:{raggio:sfere[s.lpl]?.raggio??({I:20,II:30,III:45,IV:60})[s.lpl],inviluppo:"nel DXF",calcoli:Object.fromEntries(Object.entries(sfere).map(([l,r])=>[l,r?{passo:r.griglia.passo,areaCoperturaEsposta:r.areaCoperturaEsposta,areaPareteEsposta:r.areaPareteEsposta,esito:r.esito,avvisi:r.avvisi}:null]))}};
  return {fogli,pdf:new Blob([pdf as BlobPart],{type:"application/pdf"}),origine3D:[dx,dy,0] as [number,number,number],dxf:new Blob([w.finale()],{type:"application/dxf"}),json:new Blob([JSON.stringify(json,null,2)],{type:"application/json"}),scala,formato};
}
