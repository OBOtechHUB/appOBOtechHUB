import {it,expect} from "vitest";
import {computoParticolari} from "./computoParticolari";
import {rettangolo} from "@/calcoli/edificio/geometria";
import type {Particolare} from "./selezione";
const particolare:Particolare={id:"parete-cappotto",nome:"Fissaggio cappotto",categoria:"calata",condizioni:{elemento:"calata",tipo:"cappotto",parametri:{spessore:{min:100,max:200}}},componenti:[{codiceOBO:null,descrizione:"Supporto",quantita:1,unitaQuantita:"per_calata",regolaVariante:"spessore-cappotto"}],bloccoCAD:null,immagine:null,note:"",origine:"proposto",verificato:false};
it("sceglie la parete percorsa dalla calata e non la prima parete del corpo",()=>{
  const corpo={...rettangolo(20,20,10,"t"),pareti:{"0":{tipo:"vetro"},"1":{tipo:"cappotto",spessore:150}}};
  const r=computoParticolari({modello:{corpi:[corpo]},aste:[],conduttori:[{id:"c",tipo:"calata",punti:[[20,10,10],[20,10,0]],materiale:"",sezione:"",codiceOBO:""}],lpl:"III",particolari:[particolare],supporti:[],morsetti:[],compensatori:[],distinta:[],picchetti:[],terra:null,verifiche:[],pianoVerifiche:{critico:false,intervalli:null}});expect(r.righe).toHaveLength(1);expect(r.righe[0]?.quantita).toBe(1);expect(r.mancanti).toContain("Variante da definire: spessore-cappotto");
});
it("scarta particolari non validi senza perdere quelli validi",()=>{
  const corpo={...rettangolo(20,20,10,"t"),pareti:{"1":{tipo:"cappotto",spessore:150}}};
  const r=computoParticolari({modello:{corpi:[corpo]},aste:[],conduttori:[{id:"c",tipo:"calata",punti:[[20,10,10],[20,10,0]],materiale:"",sezione:"",codiceOBO:""}],lpl:"III",particolari:[{...particolare,id:"invalido",componenti:[{codiceOBO:null,descrizione:"Invalido",unitaQuantita:"per_calata",quantita:-1}]},particolare],supporti:[],morsetti:[],compensatori:[],distinta:[],picchetti:[],terra:null,verifiche:[],pianoVerifiche:{critico:false,intervalli:null}});
  expect(r.righe).toHaveLength(1);expect(r.righe[0]?.quantita).toBe(1);expect(r.righe[0]?.provenienza).toBe("Particolari: parete-cappotto");
});