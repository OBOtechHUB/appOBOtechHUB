import {it,expect} from "vitest";
import DxfParser from "dxf-parser";
import {generaCAD} from "./exportCAD";
import {rettangolo} from "@/calcoli/edificio/geometria";
const text=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(blob);});
it("esporta DXF R2010 in metri con tetto, pareti, asta e struttura JSON richiesta",async()=>{
  const result=generaCAD({modello:{corpi:[rettangolo(20,20,10,"t")]},aste:[{id:"a",x:1,y:2,z:10,altezza:3,diametro:.016,codiceOBO:""}],conduttori:[],lpl:"III",particolari:[],supporti:[],morsetti:[],compensatori:[],distinta:[],picchetti:[],terra:null},{codice:"P1",nome:"Prova",comune:"Roma"},{});
  const parsed=new DxfParser().parseSync(await text(result.dxf));expect(parsed?.header?.["$ACADVER"]).toBe("AC1024");expect(parsed?.header?.["$INSUNITS"]).toBe(6);expect(parsed?.entities.filter((e)=>e.type==="3DFACE")).toHaveLength(6);
  const json=JSON.parse(await text(result.json));expect(json.unita).toBe("m");expect(json.aste[0]).toMatchObject({x:1,y:2,z:10,altezza:3});expect(json.sfere.raggio).toBe(45);expect(Object.keys(json)).toEqual(expect.arrayContaining(["supporti","morsetti","picchetti","conduttori"]));
});