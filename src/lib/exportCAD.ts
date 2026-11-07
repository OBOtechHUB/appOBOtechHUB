import type {StatoEsteso} from "./statoProgetto";
import type {RisultatoSfera} from "@/calcoli/captazione/sferaRotolante";
import {inviluppoSuGriglia} from "@/calcoli/captazione/sferaRotolante";
import type {Punto3} from "@/calcoli/edificio/tipi";
import {ShapeUtils,Vector2} from "three";
export function generaCAD(s:StatoEsteso,progetto:{codice:string;nome:string;comune:string},sfere:Partial<Record<string,RisultatoSfera>>){
  const layers=["LPS_EDIFICIO","LPS_CAPTAZIONE_ASTE","LPS_CAPTAZIONE_CONDUTTORI","LPS_CALATE","LPS_TERRA","LPS_SFERA_I","LPS_SFERA_II","LPS_SFERA_III","LPS_SFERA_IV","LPS_ESPOSTO","LPS_TESTI"];
  const pairs:(string|number)[]=[];const p=(code:number,value:string|number)=>pairs.push(code,value);
  p(0,"SECTION");p(2,"HEADER");p(9,"$ACADVER");p(1,"AC1024");p(9,"$INSUNITS");p(70,6);p(0,"ENDSEC");p(0,"SECTION");p(2,"TABLES");p(0,"TABLE");p(2,"LAYER");p(70,layers.length);layers.forEach((name,i)=>{p(0,"LAYER");p(100,"AcDbSymbolTableRecord");p(100,"AcDbLayerTableRecord");p(2,name);p(70,0);p(62,i+1);p(6,"CONTINUOUS");});p(0,"ENDTAB");p(0,"ENDSEC");p(0,"SECTION");p(2,"ENTITIES");
  const point=(a:Punto3,n=0)=>{p(10+n,a[0]);p(20+n,a[1]);p(30+n,a[2]);};
  const line=(layer:string,a:Punto3,b:Punto3)=>{p(0,"LINE");p(100,"AcDbEntity");p(8,layer);p(100,"AcDbLine");point(a);point(b,1);};
  const face=(layer:string,a:Punto3,b:Punto3,c:Punto3,d:Punto3)=>{p(0,"3DFACE");p(100,"AcDbEntity");p(8,layer);p(100,"AcDbFace");[a,b,c,d].forEach((v,i)=>point(v,i));};
  const polyline=(layer:string,points:Punto3[])=>{p(0,"POLYLINE");p(100,"AcDbEntity");p(8,layer);p(100,"AcDb3dPolyline");p(66,1);p(70,8);point([0,0,0]);points.forEach((a)=>{p(0,"VERTEX");p(100,"AcDbEntity");p(8,layer);p(100,"AcDbVertex");p(100,"AcDb3dPolylineVertex");point(a);p(70,32);});p(0,"SEQEND");p(8,layer);};
  s.modello.corpi.forEach((body)=>{
    const z=body.quotaBase+body.altezzaGronda;
    if(body.mesh){const vertices=body.mesh.posizioni,indices=body.mesh.indici??vertices.map((_,i)=>i).filter((i)=>i%3===0).map((i)=>i/3);const vertex=(i:number):Punto3=>[vertices[i*3]??0,vertices[i*3+1]??0,(vertices[i*3+2]??0)+body.quotaBase];for(let i=0;i<indices.length;i+=3){const a=vertex(indices[i]??0),b=vertex(indices[i+1]??0),c=vertex(indices[i+2]??0);face("LPS_EDIFICIO",a,b,c,c);}}
    else {body.impronta.forEach((a,i)=>{const b=body.impronta[(i+1)%body.impronta.length];if(b)face("LPS_EDIFICIO",[...a,body.quotaBase],[...b,body.quotaBase],[...b,z],[...a,z]);});
      if(body.tipoTetto==="falde"){const xs=body.impronta.map((p)=>p[0]),ys=body.impronta.map((p)=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),mid=(y0+y1)/2,top=body.quotaBase+body.altezzaColmo;face("LPS_EDIFICIO",[x0,y0,z],[x1,y0,z],[x1,mid,top],[x0,mid,top]);face("LPS_EDIFICIO",[x0,mid,top],[x1,mid,top],[x1,y1,z],[x0,y1,z]);face("LPS_EDIFICIO",[x0,y0,z],[x0,mid,top],[x0,y1,z],[x0,y1,z]);face("LPS_EDIFICIO",[x1,y0,z],[x1,mid,top],[x1,y1,z],[x1,y1,z]);}
      else for(const triangle of ShapeUtils.triangulateShape(body.impronta.map((q)=>new Vector2(...q)),[])){const points=triangle.map((i)=>body.impronta[i]);const a=points[0],b=points[1],c=points[2];if(a&&b&&c)face("LPS_EDIFICIO",[...a,z],[...b,z],[...c,z],[...c,z]);}
    }
    polyline("LPS_EDIFICIO",[...body.impronta,body.impronta[0]??[0,0]].map((a)=>[a[0],a[1],body.quotaBase]));const a=body.impronta[0];if(a){p(0,"TEXT");p(100,"AcDbEntity");p(8,"LPS_TESTI");p(100,"AcDbText");point([a[0],a[1],z]);p(40,.5);p(1,`${body.nome.replace(/[\r\n]/g," ")} H=${body.altezzaGronda}m`);}
  });
  s.aste.forEach((a)=>line("LPS_CAPTAZIONE_ASTE",[a.x,a.y,a.z],[a.x,a.y,a.z+a.altezza]));s.conduttori.forEach((c)=>polyline(c.tipo==="calata"?"LPS_CALATE":c.tipo==="terra"?"LPS_TERRA":"LPS_CAPTAZIONE_CONDUTTORI",c.punti));
  Object.entries(sfere).forEach(([lpl,r])=>{if(!r)return;const g=r.griglia,h=g.passo/2;
    const inv=inviluppoSuGriglia(r,Math.max(1,r.raggio/10));
    for(let j=0;j+1<inv.ny;j++)for(let i=0;i+1<inv.nx;i++){const z=inv.z[j]?.[i],za=inv.z[j]?.[i+1],zb=inv.z[j+1]?.[i+1],zc=inv.z[j+1]?.[i];if(![z,za,zb,zc].every(Number.isFinite))continue;const x0=inv.x0+i*inv.passo,y0=inv.y0+j*inv.passo,x1=x0+inv.passo,y1=y0+inv.passo;face(`LPS_SFERA_${lpl}`,[x0,y0,z as number],[x1,y0,za as number],[x1,y1,zb as number],[x0,y1,zc as number]);}
    for(let k=0;k<r.esposta.length;k++){if(r.esposta[k]!==1)continue;const i=k%g.nx,j=Math.floor(k/g.nx),x=g.x0+i*g.passo,y=g.y0+j*g.passo,z=r.altezze[k]??0;face("LPS_ESPOSTO",[x-h,y-h,z],[x+h,y-h,z],[x+h,y+h,z],[x-h,y+h,z]);}
    r.facceEsposte.forEach((f)=>{const nx=f.normale[0],ny=f.normale[1],tx=-ny,ty=nx,hl=f.lunghezza/2;face("LPS_ESPOSTO",[f.x-tx*hl,f.y-ty*hl,f.zDa],[f.x+tx*hl,f.y+ty*hl,f.zDa],[f.x+tx*hl,f.y+ty*hl,f.zA],[f.x-tx*hl,f.y-ty*hl,f.zA]);});
  });
  p(0,"ENDSEC");p(0,"EOF");
  const json={versione:1,unita:"m",progetto:{...progetto,lpl:s.lpl},edificio:s.modello,aste:s.aste.map(({id,...a})=>a),conduttori:s.conduttori.map(({id,...c})=>c),supporti:[],morsetti:[],picchetti:[],sfere:{raggio:sfere[s.lpl]?.raggio??({I:20,II:30,III:45,IV:60})[s.lpl],inviluppo:"nel DXF",calcoli:Object.fromEntries(Object.entries(sfere).map(([l,r])=>[l,r?{passo:r.griglia.passo,areaCoperturaEsposta:r.areaCoperturaEsposta,areaPareteEsposta:r.areaPareteEsposta,esito:r.esito,avvisi:r.avvisi}:null]))}};
  return {dxf:new Blob([pairs.join("\n")+"\n"],{type:"application/dxf"}),json:new Blob([JSON.stringify(json,null,2)],{type:"application/json"})};
}