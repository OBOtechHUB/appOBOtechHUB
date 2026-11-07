import type {StatoEsteso} from "@/lib/statoProgetto";
import type {RigaComputo} from "@/calcoli/materiali/tipi";
import {dentroPoligono} from "@/calcoli/edificio/geometria";
import {particolareSchema,selezione,type Elemento} from "./selezione";
import base from "@/dati/particolari/particolari.json";
export function computoParticolari(s:StatoEsteso){
  const elementi:Elemento[]=s.conduttori.flatMap((c)=>c.punti.slice(1).map((b,i):Elemento|null=>{const a=c.punti[i];if(!a)return null;const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
    const distance=(p:[number,number],q:[number,number])=>{const dx=q[0]-p[0],dy=q[1]-p[1],t=Math.max(0,Math.min(1,((x-p[0])*dx+(y-p[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-p[0]-dx*t,y-p[1]-dy*t);};
    const corpo=s.modello.corpi.find((body)=>dentroPoligono(x,y,body.impronta)||body.impronta.some((p,j)=>distance(p,body.impronta[(j+1)%body.impronta.length]??p)<.05));
    const wall=corpo?.impronta.map((p,j)=>({j,d:distance(p,corpo.impronta[(j+1)%corpo.impronta.length]??p)})).sort((a,b)=>a.d-b.d)[0];const parete=wall&&wall.d<.2?corpo?.pareti?.[String(wall.j)]:undefined;
    return {id:`${c.id}:${i}`,elemento:c.tipo,tipo:c.tipo==="captazione"?corpo?.copertura??"non definito":parete?.tipo??"non definito",parametri:parete?.spessore===undefined?{}:{spessore:parete.spessore},metri:Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),punti:i===0?2:1,calate:c.tipo==="calata"&&i===0?1:0};
  }).filter((e):e is Elemento=>e!==null));
  const validi=(s.particolari.length?s.particolari:base).flatMap((p)=>{const r=particolareSchema.safeParse(p);return r.success?[r.data]:[];});
  const result=selezione(elementi,validi);
  const righe:RigaComputo[]=result.componenti.map((c,i)=>({id:`particolare-${c.elemento}-${i}`,codice:c.codiceOBO??"",descrizione:`${c.esempio?"ESEMPIO — ":""}${c.descrizione}`,categoria:"accessori",unita:"pz",materiale:"",sezione:"",quantita:c.quantita,provenienza:`Particolari: ${c.particolare}`,manuale:false}));
  return {righe,mancanti:result.mancanti};
}