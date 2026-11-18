import {it,expect} from "vitest";
import DxfParser from "dxf-parser";
import {generaCAD} from "./exportCAD";
import {rettangolo} from "@/calcoli/edificio/geometria";
const text=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(blob);});
it("esporta DXF R12 in metri con tavola, tetto, pareti, asta e struttura JSON richiesta",async()=>{
  const result=generaCAD({modello:{corpi:[rettangolo(20,20,10,"t")]},aste:[{id:"a",x:1,y:2,z:10,altezza:3,diametro:.016,codiceOBO:""}],conduttori:[],lpl:"III",particolari:[],supporti:[],morsetti:[],compensatori:[],distinta:[],picchetti:[],terra:null,verifiche:[],pianoVerifiche:{critico:false,intervalli:null},separazione:{modoKc:"semplificato",ki:null,kmSolido:null,punti:[]},datiRischio:null,revisioni:[],emissione:{stato:"bozza",rev:null,impronta:null}},{codice:"P1",nome:"Prova",comune:"Roma"},{});
  const parsed=new DxfParser().parseSync(await text(result.dxf));expect(parsed?.header?.["$ACADVER"]).toBe("AC1009");expect(parsed?.header?.["$INSUNITS"]).toBe(6);expect(parsed?.entities.filter((e)=>e.type==="3DFACE")).toHaveLength(6);expect(parsed?.tables?.layer?.layers?.["LPS-CAPT-ASTA"]).toBeTruthy();expect(parsed?.blocks?.["LPS_ASTA"]).toBeTruthy();expect(parsed?.entities.some((e)=>e.type==="INSERT"&&(e as unknown as {name:string}).name==="LPS_ASTA")).toBe(true);
  const json=JSON.parse(await text(result.json));expect(json.unita).toBe("m");expect(json.aste[0]).toMatchObject({x:1,y:2,z:10,altezza:3});expect(json.sfere.raggio).toBe(45);expect(Object.keys(json)).toEqual(expect.arrayContaining(["supporti","morsetti","picchetti","conduttori"]));
});it("pacchetto CAD: DXF senza modello 3D (lo disegna LPS.lsp) e origine del modello accanto alla tavola",async()=>{
  const stato={modello:{corpi:[rettangolo(20,20,10,"t")]},aste:[{id:"a",x:1,y:2,z:10,altezza:3,diametro:.016,codiceOBO:""}],conduttori:[],lpl:"III" as const,particolari:[],supporti:[],morsetti:[],compensatori:[],distinta:[],picchetti:[],terra:null,verifiche:[],pianoVerifiche:{critico:false,intervalli:null},separazione:{modoKc:"semplificato" as const,ki:null,kmSolido:null,punti:[]},datiRischio:null,revisioni:[],emissione:{stato:"bozza" as const,rev:null,impronta:null}};
  const completo=generaCAD(stato,{codice:"P1",nome:"Prova",comune:"Roma"},{});
  const pacchetto=generaCAD(stato,{codice:"P1",nome:"Prova",comune:"Roma"},{},{senzaModello3D:true});
  const conta=(t:string,layer:string)=>(new DxfParser().parseSync(t)?.entities??[]).filter((e)=>e.layer===layer).length;
  expect(conta(await text(completo.dxf),"LPS-3D-EDIF")).toBeGreaterThan(0);
  expect(conta(await text(pacchetto.dxf),"LPS-3D-EDIF")).toBe(0);
  expect(conta(await text(pacchetto.dxf),"LPS-3D-CAPT")).toBe(0);
  expect(pacchetto.origine3D[0]).toBeGreaterThan(20);
});
