import {createFileRoute} from "@tanstack/react-router";
import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {useAuth} from "@/lib/auth";
import {paginaHead} from "@/lib/head";
import {Button} from "@/components/ui/button";
import {Campo,inputCls} from "@/components/Campo";
export const Route=createFileRoute("/_authenticated/profilo")({head:()=>paginaHead("Profilo","Gestisci il tuo profilo personale."),component:Profilo});
function Profilo(){const {user}=useAuth();const [nome,setNome]=useState("");const [avatar,setAvatar]=useState("");const [msg,setMsg]=useState("");useEffect(()=>{if(user)void supabase.from("profiles").select().eq("id",user.id).single().then(({data})=>{setNome(data?.nome_visualizzato??"");setAvatar(data?.avatar_url??"");});},[user]);return <main className="mx-auto max-w-xl px-4 py-8"><h1 className="font-display text-2xl font-bold">Profilo</h1><form className="mt-5 space-y-4" onSubmit={async(e)=>{e.preventDefault();if(!user)return;const {error}=await supabase.from("profiles").update({nome_visualizzato:nome,avatar_url:avatar||null}).eq("id",user.id);setMsg(error?"Salvataggio non riuscito.":"Profilo salvato.");}}><Campo etichetta="Nome visualizzato"><input className={inputCls} maxLength={100} value={nome} onChange={(e)=>setNome(e.target.value)}/></Campo><Campo etichetta="Indirizzo immagine avatar"><input className={inputCls} type="url" value={avatar} onChange={(e)=>setAvatar(e.target.value)}/></Campo><Button>Salva profilo</Button><p role="status">{msg}</p></form></main>;}