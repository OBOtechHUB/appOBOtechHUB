import {useEffect,useMemo,useState} from "react";
import {useSearch} from "@tanstack/react-router";
import {useAuth} from "@/lib/auth";
import {useEsteso,aggiornaEsteso} from "@/lib/statoProgetto";
import base from "@/dati/particolari/particolari.json";
import {particolareSchema,type Particolare} from "@/calcoli/particolari/selezione";
import {Button} from "@/components/ui/button";
import {inputCls} from "@/components/Campo";
import {salvaLibreria} from "@/lib/libreria";
import {useVerificati,segnaVerificato as salvaVerificato} from "@/lib/verificaParticolari";
import {SchedaParticolare} from "@/components/particolari/SchedaParticolare";
import {AnteprimaDisegno} from "@/components/particolari/AnteprimaDisegno";
import {CodiceObo} from "@/components/prodotti/CodiceObo";

type Componente=Particolare["componenti"][number]&{nota?:string};
type Scheda=Omit<Particolare,"componenti"|"condizioni">&{riferimento?:string;condizioni:Particolare["condizioni"]&{applicazione?:string};componenti:Componente[]};
const ordine=["captazione","raccordo","impianti_tetto","terra","calata"] as const;
const grezzi=base as unknown as Scheda[];

export function ParticolariPage(){const s=useEsteso(),{user}=useAuth(),verificati=useVerificati();const [categoria,setCategoria]=useState("");const [cerca,setCerca]=useState("");const rif=useSearch({strict:false}) as {rif?:string};const [selId,setSelId]=useState<string|null>(null);const [editor,setEditor]=useState<string|null>(null);const [msg,setMsg]=useState("");const [schedaId,setSchedaId]=useState<string|null>(null);
  const lista=useMemo<Scheda[]>(()=>{const salvati=new Map(s.particolari.map((p)=>[p.id,p]));const ids=new Set(grezzi.map((p)=>p.id));
    const daBase=grezzi.map((g):Scheda=>{const p=salvati.get(g.id);return p?{...g,...p,riferimento:g.riferimento??"",condizioni:{...p.condizioni,...(g.condizioni.applicazione?{applicazione:g.condizioni.applicazione}:{})},componenti:p.componenti.map((c,i)=>({...c,...(g.componenti[i]?.nota?{nota:g.componenti[i]?.nota}:{})}))}:g;});
    const personali=s.particolari.filter((p)=>!ids.has(p.id)&&!/ESEMPIO/i.test(p.nome)) as Scheda[];return [...daBase,...personali].map((p)=>verificati.includes(p.id)?{...p,verificato:true}:p);},[s.particolari,verificati]);
  const q=cerca.trim().toLowerCase();
  const filtrati=lista.filter((p)=>(!categoria||p.categoria===categoria)&&(!q||p.nome.toLowerCase().includes(q)||(p.riferimento??"").toLowerCase().includes(q)||p.componenti.some((c)=>(c.codiceOBO??"").toLowerCase().includes(q))));
  useEffect(()=>{if(!selId)return;const t=setTimeout(()=>document.getElementById(`dettaglio-${selId}`)?.scrollIntoView({behavior:"smooth",block:"nearest"}),50);return()=>clearTimeout(t);},[selId]);
  useEffect(()=>{if(!rif.rif)return;const p=lista.find((x)=>x.riferimento===rif.rif||x.id===rif.rif);if(p)setSelId(p.id);},[rif.rif,lista]);
  const scheda=lista.find((p)=>p.id===schedaId)??null;
  const dettaglio=(sel:Scheda)=><section id={`dettaglio-${sel.id}`} className="mb-4 rounded-lg border-[0.8px] border-primary bg-background p-4"><div className="flex flex-wrap items-center gap-3"><h3 className="text-[1.3rem] font-medium">{sel.nome}</h3>{!sel.verificato&&<span className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground">Da verificare</span>}</div>
      <p className="mt-1 font-mono text-sm text-muted-foreground">Riferimento OBO: {sel.riferimento??"—"}</p>
      <AnteprimaDisegno immagine={(sel as {immagine?:string|null}).immagine} titolo={sel.nome}/>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">Elemento</dt><dd>{sel.condizioni.elemento}</dd></div><div><dt className="text-muted-foreground">Tipo</dt><dd>{sel.condizioni.tipo}</dd></div><div><dt className="text-muted-foreground">Applicazione</dt><dd>{sel.condizioni.applicazione??"—"}</dd></div></dl>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-left">{["Codice","Descrizione","Quantità","Unità","Nota"].map((h)=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{sel.componenti.map((c,i)=><tr key={i} className="border-b"><td className="p-2"><CodiceObo codice={c.codiceOBO}/></td><td className="p-2">{c.descrizione}</td><td className="p-2 font-mono">{c.quantita}</td><td className="p-2">{c.unitaQuantita}</td><td className="p-2 text-muted-foreground">{c.nota??""}</td></tr>)}</tbody></table></div>
      {sel.note&&<p className="mt-3 text-sm">{sel.note}</p>}
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setSchedaId(sel.id)}>Scheda</Button>{user&&!sel.verificato&&<Button onClick={()=>segnaVerificato(sel)}>Segna come verificato</Button>}{user&&<Button variant="outline" onClick={()=>setEditor(JSON.stringify(sel,null,2))}>Modifica particolare</Button>}</div></section>;
  async function salva(nuovi:Scheda[],testo:string){const particolari=nuovi.map((p)=>particolareSchema.safeParse(p)).flatMap((r)=>r.success?[r.data]:[]);await salvaLibreria({particolari});aggiornaEsteso({particolari});setMsg(testo);}
  async function segnaVerificato(p:Scheda){try{await salvaVerificato(p.id);setMsg("Particolare segnato come verificato.");}catch{setMsg("Salvataggio non riuscito.");}}
  return <main className="mx-auto max-w-5xl px-4 py-8"><h1 className="font-display text-2xl font-bold">Particolari costruttivi</h1>
    <div className="mt-5 flex flex-wrap gap-3"><select aria-label="Categoria particolare" className={`${inputCls} max-w-xs`} value={categoria} onChange={(e)=>setCategoria(e.target.value)}><option value="">Tutte le categorie</option>{ordine.map((c)=><option key={c} value={c}>{c}</option>)}</select><input aria-label="Cerca particolare" placeholder="Cerca per nome o codice articolo" className={`${inputCls} max-w-xs`} value={cerca} onChange={(e)=>setCerca(e.target.value)}/>{user&&<Button onClick={()=>setEditor(JSON.stringify({...lista[0],id:crypto.randomUUID(),nome:"Nuovo particolare",verificato:false},null,2))}>Aggiungi particolare</Button>}</div>
    {ordine.map((cat)=>{const g=filtrati.filter((p)=>p.categoria===cat);if(!g.length)return null;return <section key={cat} className="mt-6"><h2 className="border-b border-accent pb-2 font-mono text-sm uppercase">{cat}</h2><div className="divide-y border-b">{g.map((p)=><div key={p.id}><div className="flex flex-wrap items-center justify-between gap-3 py-3"><div><h3 className="font-semibold"><button type="button" aria-expanded={selId===p.id} onClick={()=>setSelId(selId===p.id?null:p.id)} className="text-left hover:text-primary hover:underline">{p.nome}</button></h3><p className="text-xs text-muted-foreground">{p.riferimento??p.id} {!p.verificato&&<span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-accent-foreground">Da verificare</span>}</p></div><div className="flex gap-2"><Button variant={selId===p.id?"default":"outline"} aria-expanded={selId===p.id} onClick={()=>setSelId(selId===p.id?null:p.id)}>{selId===p.id?"Chiudi":"Dettaglio"}</Button><Button variant="outline" onClick={()=>setSchedaId(p.id)}>Scheda</Button></div></div>{selId===p.id&&dettaglio(p)}</div>)}</div></section>;})}
    {!filtrati.length&&<p className="my-8 text-center text-muted-foreground">Nessun particolare trovato.</p>}
    {editor!==null&&user&&<section className="mt-6"><h2 className="font-semibold">Editor particolare</h2><textarea aria-label="Dati particolare JSON" className={`${inputCls} mt-3 h-96 font-mono text-sm`} value={editor} onChange={(e)=>setEditor(e.target.value)}/><div className="mt-3 flex gap-2"><Button onClick={async()=>{try{const p=particolareSchema.parse(JSON.parse(editor)) as Scheda;await salva([...lista.filter((v)=>v.id!==p.id),p],"Particolare personale salvato in Cloud.");setEditor(null);}catch{setMsg("Dati non validi o salvataggio non riuscito.");}}}>Salva</Button><Button variant="outline" onClick={()=>setEditor(null)}>Annulla</Button></div></section>}<p role="status" className="mt-3">{msg}</p>{scheda&&<SchedaParticolare particolare={scheda} open onOpenChange={(open)=>{if(!open)setSchedaId(null);}}/>}</main>;
}
