import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useAttivo, snapshot, leggiAttivo,caricaSnapshot,impostaAttivo } from "@/lib/statoProgetto";
import { salvaProgetto,leggiProgetto } from "@/lib/progetti.functions";
import {supabase} from "@/integrations/supabase/client";
export const AUTOSAVE_MS = 5000;
let salvataggio: Promise<void> | null = null;
export async function salvaAttivo():Promise<void> {
  const attivo=leggiAttivo();if(!attivo)return;
  if(salvataggio){await salvataggio;if(leggiAttivo()!==attivo)return;return salvaAttivo();}
  const dati=snapshot(),serializzato=JSON.stringify(dati);if(serializzato===attivo.salvato)return;
  const job=(async()=>{const {data}=await supabase.auth.getUser();if(!data.user||data.user.id!==attivo.proprietario||leggiAttivo()!==attivo)throw new Error("Sessione o progetto cambiati.");await salvaProgetto({data:{id:attivo.id,codice:attivo.codice,nome:dati.edificio.nomeProgetto||attivo.nome,comune:dati.edificio.comune,dati}});attivo.salvato=serializzato;})();
  salvataggio=job;try{await job;}finally{if(salvataggio===job)salvataggio=null;}
  if(leggiAttivo()===attivo&&JSON.stringify(snapshot())!==serializzato)await salvaAttivo();
}
export function ProjectSync(){
  const {user,pronto}=useAuth(); const attivo=useAttivo(); const [stato,setStato]=useState("");
  const salva=salvaProgetto;
  useEffect(()=>{if(!user||attivo)return;const raw=sessionStorage.getItem("lps-progetto-attivo");if(!raw)return;try{const saved=JSON.parse(raw) as {id:string;proprietario:string};if(saved.proprietario!==user.id){sessionStorage.removeItem("lps-progetto-attivo");return;}let cancelled=false;void leggiProgetto({data:{id:saved.id}}).then((p)=>{if(cancelled)return;caricaSnapshot(p.dati);impostaAttivo({id:p.id,nome:p.nome,codice:p.codice,proprietario:p.utente,salvato:JSON.stringify(snapshot())});}).catch(()=>{sessionStorage.removeItem("lps-progetto-attivo");setStato("Progetto non disponibile.");});return()=>{cancelled=true;};}catch{sessionStorage.removeItem("lps-progetto-attivo");return;}},[user,attivo]);
  useEffect(()=>{if(!user||!attivo||attivo.proprietario!==user.id)return;
    const timer=setInterval(()=>{const a=leggiAttivo();if(!a||a.proprietario!==user.id)return;const dati=snapshot();const serialized=JSON.stringify(dati);if(serialized===a.salvato)return;
      setStato("Salvataggio…");void salvaAttivo().then(()=>setStato("Salvato")).catch(()=>setStato("Salvataggio non riuscito — riprova"));
    },AUTOSAVE_MS);return()=>clearInterval(timer);
  },[user,attivo,salva]);
  if(!pronto)return null;
  return <div className="border-b bg-secondary"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs">{user ? attivo ? <><span>{attivo.codice} · {attivo.nome}</span><span role="status">{stato||"Progetto attivo"}</span></> : <><span>Lavoro locale — nessun progetto attivo</span><Link to="/progetti" className="underline">I miei progetti</Link></> : <Link to="/auth" className="font-medium">Accedi per salvare i progetti</Link>}</div></div>;
}