import {describe,it,expect} from "vitest";
import {particolareSchema,selezione,type Particolare} from "./selezione";
export const particolareProva:Particolare={id:"prova",nome:"Prova",categoria:"captazione",condizioni:{elemento:"captazione",tipo:"guaina",parametri:{}},componenti:[{codiceOBO:null,descrizione:"Supporto",quantita:1,unitaQuantita:"per_punto"}],bloccoCAD:null,immagine:null,note:"",origine:"proposto",verificato:false};
describe("Selezione particolari",()=>{
  it("calcola quantità per punto",()=>{const r=selezione([{id:"t",elemento:"captazione",tipo:"guaina",parametri:{},metri:10,punti:4,calate:0}],[particolareProva]);expect(r.componenti[0]?.quantita).toBe(4);});
  it.each(["per_asta","per_supporto","per_incrocio","per_compensatore","per_punta","per_progetto","per_picchetto","per_elemento","per_giunto"] as const)("accetta %s con moltiplicatore 1 e segnala la verifica",(unitaQuantita)=>{
    const p=particolareSchema.parse({...particolareProva,componenti:[{codiceOBO:null,descrizione:"Componente",quantita:3,unitaQuantita}]});
    const r=selezione([{id:"t",elemento:"captazione",tipo:"guaina",parametri:{},metri:10,punti:4,calate:2}],[p]);
    expect(r.componenti[0]?.quantita).toBe(3);
    expect(r.mancanti).toEqual([`Quantità da verificare: ${unitaQuantita} (prova)`]);
  });
  it.each([ ["per_m",30], ["per_punto",12], ["per_calata",6], ["fisso",3] ] as const)("mantiene il moltiplicatore di %s senza avvisi",(unitaQuantita,quantita)=>{
    const p={...particolareProva,componenti:[{codiceOBO:null,descrizione:"Componente",quantita:3,unitaQuantita}]};
    const r=selezione([{id:"t",elemento:"captazione",tipo:"guaina",parametri:{},metri:10,punti:4,calate:2}],[p]);
    expect(r.componenti[0]?.quantita).toBe(quantita);expect(r.mancanti).toEqual([]);
  });
  it("segnala elemento e tipo senza corrispondenza",()=>expect(selezione([{id:"c1",elemento:"calata",tipo:"vetro",parametri:{},metri:10,punti:2,calate:1}],[]).mancanti).toEqual(["Particolare mancante: c1 — calata, vetro"]));
});